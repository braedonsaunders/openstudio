'use client';

import { useRef, useEffect, useMemo, memo } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { waveformAnimationCoordinator } from '@/lib/audio/waveform-animation-coordinator';

interface DynamicWaveformProps {
  audioLevel: number;
  trackColor: string;
  isMuted: boolean;
  isArmed?: boolean;
  zoom: number;
  historySeconds: number;
}

// Non-linear curve to make quiet sounds more visible
function amplifyLevel(level: number): number {
  const boosted = Math.pow(level, 0.5);
  return Math.min(boosted * 1.2, 1);
}

// Simplified linear interpolation (faster than Catmull-Rom)
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Parse color string to get RGB values
function parseColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 99, g: 102, b: 241 };
}

const SAMPLE_RATE = 30;
const MAX_PARTICLES = 12; // Reduced from 50

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/**
 * Ring buffer for efficient audio level storage without array allocations
 */
class RingBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private length: number = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  push(value: number): void {
    this.buffer[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.length < this.capacity) {
      this.length++;
    }
  }

  // Get value at index from the end (0 = most recent)
  get(indexFromEnd: number): number {
    if (indexFromEnd >= this.length) return 0;
    const actualIndex = (this.writeIndex - 1 - indexFromEnd + this.capacity) % this.capacity;
    return this.buffer[actualIndex];
  }

  size(): number {
    return this.length;
  }

  resize(newCapacity: number): void {
    if (newCapacity === this.capacity) return;
    const newBuffer = new Float32Array(newCapacity);
    const copyCount = Math.min(this.length, newCapacity);
    for (let i = 0; i < copyCount; i++) {
      newBuffer[i] = this.get(copyCount - 1 - i);
    }
    this.buffer = newBuffer;
    this.capacity = newCapacity;
    this.writeIndex = copyCount % newCapacity;
    this.length = copyCount;
  }
}

// Generate a unique ID for each waveform instance
let instanceCounter = 0;

function DynamicWaveformInner({
  audioLevel,
  trackColor,
  isMuted,
  isArmed = true,
  zoom,
  historySeconds,
}: DynamicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceIdRef = useRef<string>(`waveform-${++instanceCounter}`);
  const waveformBufferRef = useRef<RingBuffer | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const smoothLevelRef = useRef<number>(0);
  const energyRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(0);

  // Store props in refs for access in draw callback without triggering re-registration
  const audioLevelRef = useRef<number>(audioLevel);
  const isMutedRef = useRef<boolean>(isMuted);
  const isArmedRef = useRef<boolean>(isArmed);
  const zoomRef = useRef<number>(zoom);

  // Update refs when props change
  audioLevelRef.current = audioLevel;
  isMutedRef.current = isMuted;
  isArmedRef.current = isArmed;
  zoomRef.current = zoom;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const maxSamples = historySeconds * SAMPLE_RATE;

  // Memoize parsed colors to avoid recalculating every render
  const baseColor = useMemo(() => parseColor(trackColor), [trackColor]);
  const bgColor = useMemo(
    () => isDark ? { r: 10, g: 10, b: 15 } : { r: 249, g: 250, b: 251 },
    [isDark]
  );

  // Initialize or resize ring buffer when maxSamples changes
  useEffect(() => {
    if (!waveformBufferRef.current) {
      waveformBufferRef.current = new RingBuffer(maxSamples);
    } else {
      waveformBufferRef.current.resize(maxSamples);
    }
  }, [maxSamples]);

  // Main effect: register with animation coordinator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const instanceId = instanceIdRef.current;
    const buffer = waveformBufferRef.current;
    if (!buffer) return;

    // Pre-calculate sample interval
    const sampleInterval = 1000 / SAMPLE_RATE;

    const draw = (timestamp: number, dt: number) => {
      // Sample audio at fixed rate
      if (timestamp - lastSampleTimeRef.current >= sampleInterval) {
        const amplified = amplifyLevel(audioLevelRef.current);
        buffer.push(amplified);
        lastSampleTimeRef.current = timestamp;
      }

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
      const currentZoom = zoomRef.current;
      const currentIsMuted = isMutedRef.current;
      const currentIsArmed = isArmedRef.current;

      // Clear with fade for trail effect
      ctx.fillStyle = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0.2)`;
      ctx.fillRect(0, 0, width, height);

      // Smooth the current level for animations
      const targetLevel = amplifyLevel(audioLevelRef.current);
      smoothLevelRef.current += (targetLevel - smoothLevelRef.current) * 0.15;
      const smoothLevel = smoothLevelRef.current;

      // Track energy for effects (exponential smoothing)
      energyRef.current = energyRef.current * 0.95 + smoothLevel * 0.05;
      const energy = energyRef.current;

      // Animate phase for wave motion
      phaseRef.current += (dt / 1000) * (1 + smoothLevel * 2);
      const phase = phaseRef.current;

      if (buffer.size() < 4) return;

      const centerY = height / 2;
      const nowLineX = width - 32;

      // Calculate samples to display
      const samplesPerPixel = 0.15 / currentZoom;
      const visibleWidth = nowLineX - 20;
      const numPoints = Math.floor(visibleWidth / 4); // Reduced point density

      // Build points array with simpler interpolation
      const points: { x: number; level: number }[] = [];

      for (let i = 0; i < numPoints; i++) {
        const bufferIndex = i * samplesPerPixel * 4;
        if (bufferIndex >= buffer.size()) break;

        const idx = Math.floor(bufferIndex);
        const frac = bufferIndex - idx;

        // Simple linear interpolation (much faster than Catmull-Rom)
        const p1 = buffer.get(idx);
        const p2 = buffer.get(idx + 1);
        let level = lerp(p1, p2, frac);

        // Add subtle wave motion
        const waveOffset = Math.sin(phase + i * 0.08) * 0.015 * energy;
        level = Math.max(0, Math.min(1, level + waveOffset));

        const x = nowLineX - (i * 4);
        points.push({ x, level });
      }

      if (points.length < 2) return;

      // Draw simple glow layer (no blur filter - use opacity instead)
      if (energy > 0.08) {
        ctx.save();
        ctx.globalAlpha = energy * 0.3;
        ctx.lineWidth = 8 + energy * 8;
        ctx.strokeStyle = trackColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, centerY);

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const amplitude = p.level * height * 0.35 * (1 + energy * 0.2);
          const y = centerY - amplitude;

          if (i === 0) {
            ctx.lineTo(p.x, y);
          } else {
            const prevP = points[i - 1];
            const prevAmplitude = prevP.level * height * 0.35 * (1 + energy * 0.2);
            const cpX = (prevP.x + p.x) / 2;
            ctx.quadraticCurveTo(prevP.x, centerY - prevAmplitude, cpX, centerY - (prevAmplitude + amplitude) / 2);
          }
        }
        ctx.stroke();
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
        const fade = 1 - distanceRatio * 0.5;
        const amplitude = p.level * height * 0.35 * fade * (1 + energy * 0.15);

        if (i === 0) {
          ctx.lineTo(p.x, centerY - amplitude);
        } else {
          const prevP = points[i - 1];
          const prevFade = 1 - ((i - 1) / points.length) * 0.5;
          const prevAmplitude = prevP.level * height * 0.35 * prevFade * (1 + energy * 0.15);
          const cpX = (prevP.x + p.x) / 2;
          ctx.quadraticCurveTo(prevP.x, centerY - prevAmplitude, cpX, centerY - (prevAmplitude + amplitude) / 2);
        }
      }

      // Bottom curve (mirror)
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        const distanceRatio = i / points.length;
        const fade = 1 - distanceRatio * 0.5;
        const amplitude = p.level * height * 0.35 * fade * (1 + energy * 0.15);

        if (i === points.length - 1) {
          ctx.lineTo(p.x, centerY + amplitude);
        } else {
          const nextP = points[i + 1];
          const nextFade = 1 - ((i + 1) / points.length) * 0.5;
          const nextAmplitude = nextP.level * height * 0.35 * nextFade * (1 + energy * 0.15);
          const cpX = (nextP.x + p.x) / 2;
          ctx.quadraticCurveTo(nextP.x, centerY + nextAmplitude, cpX, centerY + (nextAmplitude + amplitude) / 2);
        }
      }

      ctx.closePath();

      // Simple gradient (reuse pattern)
      const alpha1 = 0.15 + energy * 0.25;
      const alpha2 = 0.6 + energy * 0.3;
      const gradient = ctx.createLinearGradient(0, 0, nowLineX, 0);
      gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha1})`);
      gradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha2})`);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Simple stroke
      ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${0.5 + energy * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Draw center line
      ctx.beginPath();
      ctx.moveTo(20, centerY);
      ctx.lineTo(nowLineX, centerY);
      ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${0.1 + energy * 0.15})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Simplified particle effects (only when armed and not muted, higher threshold)
      if (smoothLevel > 0.5 && !currentIsMuted && currentIsArmed) {
        if (Math.random() < smoothLevel * 0.3 && particlesRef.current.length < MAX_PARTICLES) {
          const spawnX = nowLineX - 5;
          const spawnY = centerY + (Math.random() - 0.5) * smoothLevel * height * 0.5;
          particlesRef.current.push({
            x: spawnX,
            y: spawnY,
            vx: -1.5 - Math.random() * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 1,
            maxLife: 0.4 + Math.random() * 0.3,
            size: 2 + Math.random() * 2 * smoothLevel,
          });
        }
      }

      // Update and draw particles
      const dtSec = dt / 1000;
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx * 50 * dtSec;
        p.y += p.vy * 50 * dtSec;
        p.life -= dtSec / p.maxLife;

        if (p.life <= 0) return false;

        const alpha = p.life * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
        ctx.fill();

        return true;
      });

      // Simplified current level indicator (only when armed and not muted)
      if (smoothLevel > 0.03 && !currentIsMuted && currentIsArmed) {
        const orbSize = 3 + smoothLevel * 6;

        // Simple orb without radial gradient overhead
        ctx.beginPath();
        ctx.arc(nowLineX, centerY, orbSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${0.6 + smoothLevel * 0.3})`;
        ctx.fill();

        // White core
        ctx.beginPath();
        ctx.arc(nowLineX, centerY, orbSize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + smoothLevel * 0.2})`;
        ctx.fill();
      }

      // Left edge fade
      const fadeGradient = ctx.createLinearGradient(0, 0, 40, 0);
      fadeGradient.addColorStop(0, `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 1)`);
      fadeGradient.addColorStop(1, `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, 0)`);
      ctx.fillStyle = fadeGradient;
      ctx.fillRect(0, 0, 40, height);
    };

    // Register with the shared animation coordinator
    waveformAnimationCoordinator.register(instanceId, draw);

    return () => {
      waveformAnimationCoordinator.unregister(instanceId);
    };
  }, [trackColor, historySeconds, maxSamples, isDark, baseColor, bgColor]);

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

// Memoize the component to prevent unnecessary re-renders
export const DynamicWaveform = memo(DynamicWaveformInner);
