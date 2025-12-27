'use client';

import { useRef, useEffect, useCallback } from 'react';
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

  const drawWaveform = useCallback((data: number[], progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const barWidth = width / data.length;
    const barGap = 1;

    ctx.clearRect(0, 0, width, height);

    data.forEach((value, index) => {
      const x = index * barWidth;
      const barHeight = value * height * 0.8;
      const y = (height - barHeight) / 2;

      const isPlayed = index / data.length < progress;

      ctx.fillStyle = isPlayed ? progressColor : color;
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
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();
    }
  }, [color, progressColor]);

  // Generate placeholder waveform data if not provided
  const generatePlaceholderWaveform = useCallback(() => {
    const bars = 100;
    return Array.from({ length: bars }, () => 0.3 + Math.random() * 0.7);
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

    const data = waveformData || generatePlaceholderWaveform();
    const progress = duration > 0 ? currentTime / duration : 0;

    drawWaveform(data, progress);
  }, [waveformData, currentTime, duration, drawWaveform, generatePlaceholderWaveform]);

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
        className
      )}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
