'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface TrackLaneProps {
  user: User;
  isLocal: boolean;
  audioLevel: number;
  trackColor: string;
  zoom: number;
  currentTime: number;
}

export function TrackLane({
  user,
  isLocal,
  audioLevel,
  trackColor,
  zoom,
  currentTime,
}: TrackLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformBuffer, setWaveformBuffer] = useState<number[]>([]);

  // Add current level to waveform buffer (simulated real-time waveform)
  useEffect(() => {
    const interval = setInterval(() => {
      setWaveformBuffer(prev => {
        const maxSamples = 2000; // Store last ~30 seconds at 60fps
        const newBuffer = [...prev, audioLevel];
        if (newBuffer.length > maxSamples) {
          return newBuffer.slice(-maxSamples);
        }
        return newBuffer;
      });
    }, 50); // 20fps update

    return () => clearInterval(interval);
  }, [audioLevel]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (waveformBuffer.length === 0) return;

    // Draw waveform bars
    const barWidth = 2;
    const gap = 1;
    const barsCount = Math.floor(width / (barWidth + gap));
    const samplesPerBar = Math.max(1, Math.floor(waveformBuffer.length / barsCount));

    ctx.fillStyle = trackColor;

    for (let i = 0; i < barsCount; i++) {
      const startSample = i * samplesPerBar;
      const endSample = Math.min(startSample + samplesPerBar, waveformBuffer.length);

      if (startSample >= waveformBuffer.length) break;

      // Get average level for this bar
      let sum = 0;
      for (let j = startSample; j < endSample; j++) {
        sum += waveformBuffer[j];
      }
      const avgLevel = sum / (endSample - startSample);

      // Draw centered bar
      const barHeight = avgLevel * height * 0.8;
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      // Add glow effect for active bars
      if (avgLevel > 0.1) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = trackColor;
      } else {
        ctx.shadowBlur = 0;
      }

      // Draw with rounded corners
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }
  }, [waveformBuffer, trackColor]);

  // Determine if user is actively speaking/playing
  const isActive = audioLevel > 0.05;

  return (
    <div
      className={cn(
        'h-[72px] border-b border-white/5 relative transition-colors',
        isActive && 'bg-white/[0.02]',
        user.isMuted && 'opacity-30'
      )}
      style={{ '--track-color': trackColor } as React.CSSProperties}
    >
      {/* Track color indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-0.5 transition-all',
          isActive && 'shadow-[0_0_8px_var(--track-color)]'
        )}
        style={{ backgroundColor: trackColor }}
      />

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: user.isMuted ? 0.3 : 1 }}
      />

      {/* Current activity indicator */}
      {isActive && !user.isMuted && (
        <div
          className="absolute right-2 top-2 w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: trackColor }}
        />
      )}

      {/* Muted indicator */}
      {user.isMuted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-zinc-500 bg-black/50 px-2 py-1 rounded">Muted</span>
        </div>
      )}
    </div>
  );
}
