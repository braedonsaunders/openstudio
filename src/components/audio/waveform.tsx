'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  audioUrl?: string;
  waveformData?: number[];
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  isPlaying?: boolean;
  className?: string;
  color?: string;
  progressColor?: string;
}

export function Waveform({
  audioUrl,
  waveformData,
  currentTime = 0,
  duration = 0,
  onSeek,
  isPlaying = false,
  className,
  color = '#4F46E5',
  progressColor = '#818CF8',
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Determine if we're showing placeholder
  const isPlaceholder = !waveformData || waveformData.length === 0;

  // Placeholder colors - more muted/gray to indicate it's not real data
  const placeholderColor = '#3f3f46'; // zinc-700
  const placeholderProgressColor = '#52525b'; // zinc-600

  const drawWaveform = useCallback((data: number[], progress: number, placeholder: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const barWidth = width / data.length;
    const barGap = 1;

    ctx.clearRect(0, 0, width, height);

    // Use different colors for placeholder
    const baseColor = placeholder ? placeholderColor : color;
    const playedColor = placeholder ? placeholderProgressColor : progressColor;

    data.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * height * 0.8;
      const y = (height - barHeight) / 2;

      const isPlayed = index / data.length < progress;

      ctx.fillStyle = isPlayed ? playedColor : baseColor;
      ctx.fillRect(
        x + barGap / 2,
        y,
        barWidth - barGap,
        barHeight
      );
    });

    // Draw progress line
    if (progress > 0) {
      const progressX = progress * width;
      ctx.strokeStyle = placeholder ? '#71717a' : '#fff'; // More muted for placeholder
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    }

    // Draw placeholder indicator - dashed border at bottom
    if (placeholder) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [color, progressColor, placeholderColor, placeholderProgressColor]);

  // Generate placeholder waveform data - more uniform to look obviously fake
  const placeholderData = useMemo(() => {
    const bars = 100;
    // Create a smooth sine-wave pattern that looks obviously placeholder
    return Array.from({ length: bars }, (_, i) => {
      const phase = (i / bars) * Math.PI * 4;
      return 0.3 + Math.sin(phase) * 0.15 + Math.random() * 0.1;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set canvas size
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    const data = waveformData && waveformData.length > 0 ? waveformData : placeholderData;
    const progress = duration > 0 ? currentTime / duration : 0;

    drawWaveform(data, progress, isPlaceholder);
  }, [waveformData, currentTime, duration, drawWaveform, placeholderData, isPlaceholder]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !duration) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    const seekTime = progress * duration;

    onSeek(seekTime);
  }, [onSeek, duration]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-16 bg-gray-800/50 rounded-lg cursor-pointer',
        isPlaceholder && 'opacity-60',
        className
      )}
      onClick={handleClick}
      title={isPlaceholder ? 'Loading waveform...' : undefined}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {isPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-zinc-500 bg-black/30 px-2 py-0.5 rounded">
            Loading waveform...
          </span>
        </div>
      )}
    </div>
  );
}
