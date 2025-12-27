'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface LiveTrackLaneProps {
  user: User;
  isLocal: boolean;
  audioLevel: number;
  trackColor: string;
  zoom: number;
  historySeconds: number;
}

// Waveform sample rate (samples per second)
const SAMPLE_RATE = 20;

export function LiveTrackLane({
  user,
  isLocal,
  audioLevel,
  trackColor,
  zoom,
  historySeconds,
}: LiveTrackLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformBufferRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Max samples to keep in buffer
  const maxSamples = historySeconds * SAMPLE_RATE;

  // Add current level to waveform buffer
  useEffect(() => {
    const interval = setInterval(() => {
      waveformBufferRef.current.push(audioLevel);

      // Trim to max size
      if (waveformBufferRef.current.length > maxSamples) {
        waveformBufferRef.current = waveformBufferRef.current.slice(-maxSamples);
      }
    }, 1000 / SAMPLE_RATE);

    return () => clearInterval(interval);
  }, [audioLevel, maxSamples]);

  // Draw waveform with animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Set canvas size
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;
      const buffer = waveformBufferRef.current;

      // Clear
      ctx.clearRect(0, 0, width, height);

      if (buffer.length === 0) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Calculate dimensions
      const nowLineX = width - 24; // Position of NOW line (24px from right)
      const barWidth = 3;
      const gap = 1;
      const pixelsPerSample = (barWidth + gap) * zoom;

      // How many samples can we show?
      const visibleSamples = Math.floor(nowLineX / pixelsPerSample);

      // Get the most recent samples
      const startIndex = Math.max(0, buffer.length - visibleSamples);
      const visibleBuffer = buffer.slice(startIndex);

      // Draw bars from right (NOW) to left (history)
      const centerY = height / 2;

      for (let i = 0; i < visibleBuffer.length; i++) {
        const level = visibleBuffer[visibleBuffer.length - 1 - i]; // Reverse order (newest first)
        const x = nowLineX - (i * pixelsPerSample);

        if (x < 0) break;

        // Calculate fade based on distance from NOW
        const distanceRatio = i / visibleBuffer.length;
        const fade = 1 - (distanceRatio * 0.7); // Fade from 100% to 30%

        // Bar height based on audio level
        const barHeight = Math.max(2, level * height * 0.8);

        // Color with fade
        const alpha = fade;
        ctx.fillStyle = trackColor;
        ctx.globalAlpha = alpha;

        // Add glow for recent active samples
        if (i < 10 && level > 0.1) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = trackColor;
        } else {
          ctx.shadowBlur = 0;
        }

        // Draw mirrored bar (extends up and down from center)
        const halfHeight = barHeight / 2;
        ctx.beginPath();
        ctx.roundRect(x - barWidth / 2, centerY - halfHeight, barWidth, barHeight, 1);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [trackColor, zoom]);

  // Determine if user is actively playing
  const isActive = audioLevel > 0.05;

  return (
    <div
      className={cn(
        'h-[80px] border-b border-gray-200 dark:border-white/5 relative transition-colors flex-shrink-0',
        isActive && 'bg-gray-100/50 dark:bg-white/[0.02]',
        user.isMuted && 'opacity-30'
      )}
      style={{ '--track-color': trackColor } as React.CSSProperties}
    >
      {/* Track color indicator on left */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 transition-all',
          isActive && 'shadow-[0_0_12px_var(--track-color)]'
        )}
        style={{ backgroundColor: trackColor }}
      />

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: user.isMuted ? 0.3 : 1 }}
      />

      {/* Live pulse indicator (right side near NOW line) */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        {/* Real-time level meter */}
        <div className="w-16 h-10 relative">
          <div className="absolute inset-0 flex items-end justify-center gap-0.5">
            {Array.from({ length: 8 }).map((_, i) => {
              const threshold = (i + 1) / 8;
              const isLit = audioLevel >= threshold;
              const isHot = i >= 6;
              const isWarm = i >= 4 && i < 6;

              return (
                <div
                  key={i}
                  className={cn(
                    'w-1.5 rounded-sm transition-all duration-75',
                    isLit
                      ? isHot
                        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                        : isWarm
                          ? 'bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.4)]'
                          : 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]'
                      : 'bg-white/5'
                  )}
                  style={{ height: `${(i + 1) * 12.5}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* LIVE badge */}
        {isActive && !user.isMuted && (
          <div
            className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider animate-pulse"
            style={{ backgroundColor: trackColor, color: 'white' }}
          >
            LIVE
          </div>
        )}
      </div>

      {/* Muted indicator */}
      {user.isMuted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-zinc-500 bg-black/50 px-3 py-1.5 rounded-lg">MUTED</span>
        </div>
      )}

      {/* Gradient fade on left edge */}
      <div className="absolute left-1 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-[#0a0a0f] to-transparent pointer-events-none" />
    </div>
  );
}
