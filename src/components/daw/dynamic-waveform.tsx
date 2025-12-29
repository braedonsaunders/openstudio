'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';

interface DynamicWaveformProps {
  audioLevel: number;
  trackColor: string;
  isMuted: boolean;
  isArmed?: boolean; // When false, track is not receiving input
  zoom: number;
  historySeconds: number;
}

// Non-linear curve to make quiet sounds more visible
function amplifyLevel(level: number): number {
  // Apply a curve that boosts low levels while preserving high levels
  const boosted = Math.pow(level, 0.5); // Square root curve
  return Math.min(boosted * 1.2, 1);
}

// Smooth interpolation for bezier curves
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

// HSL to RGB conversion for dynamic coloring
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Parse color string to get RGB values
function parseColor(color: string): { r: number; g: number; b: number } {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  // Default to indigo
  return { r: 99, g: 102, b: 241 };
}

const SAMPLE_RATE = 30; // Higher sample rate for smoother animation
const MAX_PARTICLES = 50;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export function DynamicWaveform({
  audioLevel,
  trackColor,
  isMuted,
  isArmed = true,
  zoom,
  historySeconds,
}: DynamicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformBufferRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const smoothLevelRef = useRef<number>(0);
  const energyRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  // Store audioLevel in a ref to avoid restarting effects on every level change
  const audioLevelRef = useRef<number>(audioLevel);
  audioLevelRef.current = audioLevel;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const maxSamples = historySeconds * SAMPLE_RATE;
  const baseColor = parseColor(trackColor);

  // Theme-aware background colors
  const bgColor = isDark ? { r: 10, g: 10, b: 15 } : { r: 249, g: 250, b: 251 }; // dark: #0a0a0f, light: #f9fafb (gray-50)

  // Sample audio level at fixed interval
  useEffect(() => {
    const interval = setInterval(() => {
      // Read from ref to get current level without restarting the interval
      const amplified = amplifyLevel(audioLevelRef.current);
      waveformBufferRef.current.push(amplified);

      if (waveformBufferRef.current.length > maxSamples) {
        waveformBufferRef.current = waveformBufferRef.current.slice(-maxSamples);
      }
    }, 1000 / SAMPLE_RATE);

    return () => clearInterval(interval);
  }, [maxSamples]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const draw = (timestamp: number) => {
      const dt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Resize canvas if needed
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const width = rect.width;
      const height = rect.height;
      const buffer = waveformBufferRef.current;

      // Clear with fade for trail effect
      ctx.fillStyle = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0.15)`;
      ctx.fillRect(0, 0, width, height);

      // Smooth the current level for animations (read from ref to avoid effect restarts)
      const targetLevel = amplifyLevel(audioLevelRef.current);
      smoothLevelRef.current += (targetLevel - smoothLevelRef.current) * 0.15;
      const smoothLevel = smoothLevelRef.current;

      // Track energy for effects (exponential smoothing)
      energyRef.current = energyRef.current * 0.95 + smoothLevel * 0.05;
      const energy = energyRef.current;

      // Animate phase for wave motion
      phaseRef.current += (dt / 1000) * (1 + smoothLevel * 3);
      const phase = phaseRef.current;

      if (buffer.length < 4) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const centerY = height / 2;
      const nowLineX = width - 32;

      // Calculate samples to display
      const samplesPerPixel = 0.15 / zoom;
      const visibleWidth = nowLineX - 20;
      const numPoints = Math.floor(visibleWidth / 3);

      // Interpolate buffer values to get smooth points
      const points: { x: number; y: number; level: number }[] = [];

      for (let i = 0; i < numPoints; i++) {
        const bufferIndex = buffer.length - 1 - (i * samplesPerPixel * 3);
        if (bufferIndex < 0) break;

        const idx = Math.floor(bufferIndex);
        const frac = bufferIndex - idx;

        // Get surrounding points for interpolation
        const p0 = buffer[Math.max(0, idx - 1)] || 0;
        const p1 = buffer[idx] || 0;
        const p2 = buffer[Math.min(buffer.length - 1, idx + 1)] || 0;
        const p3 = buffer[Math.min(buffer.length - 1, idx + 2)] || 0;

        // Catmull-Rom interpolation for smoothness
        let level = catmullRom(p0, p1, p2, p3, frac);

        // Add subtle wave motion based on phase
        const waveOffset = Math.sin(phase + i * 0.1) * 0.02 * energy;
        level = Math.max(0, Math.min(1, level + waveOffset));

        const x = nowLineX - (i * 3);
        points.push({ x, y: 0, level });
      }

      if (points.length < 2) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Calculate dynamic colors based on energy
      const hueShift = energy * 30; // Shift towards warmer colors with more energy
      const saturationBoost = 1 + energy * 0.3;

      // Create main gradient
      const gradient = ctx.createLinearGradient(0, 0, nowLineX, 0);
      const alpha1 = 0.1 + energy * 0.3;
      const alpha2 = 0.5 + energy * 0.4;
      gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha1})`);
      gradient.addColorStop(0.7, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha2})`);
      gradient.addColorStop(1, `rgba(${Math.min(255, baseColor.r + hueShift)}, ${baseColor.g}, ${Math.max(0, baseColor.b - hueShift)}, ${0.9 + energy * 0.1})`);

      // Draw glow layer first
      if (energy > 0.05) {
        ctx.save();
        ctx.filter = `blur(${8 + energy * 12}px)`;
        ctx.globalAlpha = energy * 0.6;

        ctx.beginPath();
        ctx.moveTo(points[0].x, centerY);

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const amplitude = p.level * height * 0.4 * (1 + energy * 0.3);

          if (i === 0) {
            ctx.lineTo(p.x, centerY - amplitude);
          } else {
            const prevP = points[i - 1];
            const cpX = (prevP.x + p.x) / 2;
            ctx.quadraticCurveTo(prevP.x, centerY - prevP.level * height * 0.4 * (1 + energy * 0.3), cpX, centerY - (prevP.level + p.level) / 2 * height * 0.4 * (1 + energy * 0.3));
          }
        }

        // Mirror back
        for (let i = points.length - 1; i >= 0; i--) {
          const p = points[i];
          const amplitude = p.level * height * 0.4 * (1 + energy * 0.3);

          if (i === points.length - 1) {
            ctx.lineTo(p.x, centerY + amplitude);
          } else {
            const nextP = points[i + 1];
            const cpX = (nextP.x + p.x) / 2;
            ctx.quadraticCurveTo(nextP.x, centerY + nextP.level * height * 0.4 * (1 + energy * 0.3), cpX, centerY + (nextP.level + p.level) / 2 * height * 0.4 * (1 + energy * 0.3));
          }
        }

        ctx.closePath();
        ctx.fillStyle = trackColor;
        ctx.fill();
        ctx.restore();
      }

      // Draw main waveform shape
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, centerY);

      // Top curve
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const distanceRatio = i / points.length;
        const fade = 1 - distanceRatio * 0.6;
        const amplitude = p.level * height * 0.38 * fade * (1 + energy * 0.2);

        if (i === 0) {
          ctx.lineTo(p.x, centerY - amplitude);
        } else {
          const prevP = points[i - 1];
          const prevFade = 1 - ((i - 1) / points.length) * 0.6;
          const prevAmplitude = prevP.level * height * 0.38 * prevFade * (1 + energy * 0.2);
          const cpX = (prevP.x + p.x) / 2;
          ctx.quadraticCurveTo(prevP.x, centerY - prevAmplitude, cpX, centerY - (prevAmplitude + amplitude) / 2);
        }
      }

      // Bottom curve (mirror)
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        const distanceRatio = i / points.length;
        const fade = 1 - distanceRatio * 0.6;
        const amplitude = p.level * height * 0.38 * fade * (1 + energy * 0.2);

        if (i === points.length - 1) {
          ctx.lineTo(p.x, centerY + amplitude);
        } else {
          const nextP = points[i + 1];
          const nextFade = 1 - ((i + 1) / points.length) * 0.6;
          const nextAmplitude = nextP.level * height * 0.38 * nextFade * (1 + energy * 0.2);
          const cpX = (nextP.x + p.x) / 2;
          ctx.quadraticCurveTo(nextP.x, centerY + nextAmplitude, cpX, centerY + (nextAmplitude + amplitude) / 2);
        }
      }

      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw stroke outline for definition
      ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${0.6 + energy * 0.4})`;
      ctx.lineWidth = 1.5 + energy * 1;
      ctx.stroke();
      ctx.restore();

      // Draw center line with energy pulse
      ctx.beginPath();
      ctx.moveTo(20, centerY);
      ctx.lineTo(nowLineX, centerY);
      const lineGradient = ctx.createLinearGradient(20, 0, nowLineX, 0);
      lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
      lineGradient.addColorStop(0.8, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${0.1 + energy * 0.2})`);
      lineGradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${0.3 + energy * 0.3})`);
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Particle effects for high energy (only when armed and not muted)
      if (smoothLevel > 0.3 && !isMuted && isArmed) {
        // Spawn new particles
        if (Math.random() < smoothLevel * 0.5 && particlesRef.current.length < MAX_PARTICLES) {
          const spawnX = nowLineX - 5;
          const spawnY = centerY + (Math.random() - 0.5) * smoothLevel * height * 0.6;
          particlesRef.current.push({
            x: spawnX,
            y: spawnY,
            vx: -1 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 1,
            maxLife: 0.5 + Math.random() * 0.5,
            size: 2 + Math.random() * 3 * smoothLevel,
            color: trackColor,
          });
        }
      }

      // Update and draw particles
      const dtSec = dt / 1000;
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx * 60 * dtSec;
        p.y += p.vy * 60 * dtSec;
        p.vy += 0.5 * dtSec; // Slight gravity
        p.life -= dtSec / p.maxLife;

        if (p.life <= 0) return false;

        const alpha = p.life * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
        ctx.fill();

        return true;
      });

      // Draw current level indicator (pulsing orb at NOW position - only when armed and not muted)
      if (smoothLevel > 0.02 && !isMuted && isArmed) {
        const orbSize = 4 + smoothLevel * 8;
        const pulseSize = orbSize + Math.sin(phase * 4) * smoothLevel * 4;

        // Outer glow
        const orbGlow = ctx.createRadialGradient(
          nowLineX, centerY, 0,
          nowLineX, centerY, pulseSize * 3
        );
        orbGlow.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${smoothLevel * 0.5})`);
        orbGlow.addColorStop(0.5, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${smoothLevel * 0.2})`);
        orbGlow.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(nowLineX, centerY, pulseSize * 3, 0, Math.PI * 2);
        ctx.fillStyle = orbGlow;
        ctx.fill();

        // Core orb
        const orbGradient = ctx.createRadialGradient(
          nowLineX - 1, centerY - 1, 0,
          nowLineX, centerY, pulseSize
        );
        orbGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        orbGradient.addColorStop(0.3, `rgba(${Math.min(255, baseColor.r + 50)}, ${Math.min(255, baseColor.g + 50)}, ${Math.min(255, baseColor.b + 50)}, 0.9)`);
        orbGradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.8)`);

        ctx.beginPath();
        ctx.arc(nowLineX, centerY, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = orbGradient;
        ctx.fill();
      }

      // Reflection effect at bottom
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.scale(1, -0.3);
      ctx.translate(0, -height * 4.5);

      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const distanceRatio = i / points.length;
        const fade = 1 - distanceRatio * 0.6;
        const amplitude = p.level * height * 0.3 * fade;

        if (i === 0) {
          ctx.moveTo(p.x, centerY - amplitude);
        } else {
          const prevP = points[i - 1];
          const prevFade = 1 - ((i - 1) / points.length) * 0.6;
          const prevAmplitude = prevP.level * height * 0.3 * prevFade;
          const cpX = (prevP.x + p.x) / 2;
          ctx.quadraticCurveTo(prevP.x, centerY - prevAmplitude, cpX, centerY - (prevAmplitude + amplitude) / 2);
        }
      }
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Left edge fade gradient
      const fadeGradient = ctx.createLinearGradient(0, 0, 40, 0);
      fadeGradient.addColorStop(0, `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 1)`);
      fadeGradient.addColorStop(1, `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0)`);
      ctx.fillStyle = fadeGradient;
      ctx.fillRect(0, 0, 40, height);

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  // Note: audioLevel is read from audioLevelRef inside draw() to avoid restarting the animation loop
  // baseColor and bgColor are derived from trackColor and isDark, so they don't need to be in deps
  }, [trackColor, zoom, isMuted, isArmed, historySeconds, maxSamples, isDark]);

  // Calculate opacity: muted or not armed = dimmed
  const opacity = isMuted ? 0.3 : !isArmed ? 0.4 : 1;

  // Theme-aware background gradient for canvas
  const canvasBg = isDark
    ? 'linear-gradient(to right, rgba(10,10,15,1), rgba(10,10,15,0.95))'
    : 'linear-gradient(to right, rgba(249,250,251,1), rgba(249,250,251,0.95))';

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{
        opacity,
        background: canvasBg
      }}
    />
  );
}
