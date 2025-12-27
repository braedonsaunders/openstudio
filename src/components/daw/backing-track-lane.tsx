'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { BackingTrack, StemMixState } from '@/types';

interface BackingTrackLaneProps {
  track: BackingTrack;
  zoom: number;
  currentTime: number;
  duration: number;
  stemsAvailable: boolean;
  stemMixState: StemMixState;
}

const STEM_COLORS = {
  vocals: '#ec4899',
  drums: '#f97316',
  bass: '#22c55e',
  other: '#3b82f6',
};

export function BackingTrackLane({
  track,
  zoom,
  currentTime,
  duration,
  stemsAvailable,
  stemMixState,
}: BackingTrackLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<number[]>([]);

  // Generate placeholder waveform data (in real app, this would come from audio analysis)
  useEffect(() => {
    const samples = Math.floor(duration * 50); // 50 samples per second
    waveformData.current = Array.from({ length: samples }, () => 0.3 + Math.random() * 0.7);
  }, [duration]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const pixelsPerSecond = 100 * zoom;
    const totalWidth = duration * pixelsPerSecond;

    ctx.clearRect(0, 0, width, height);

    const data = waveformData.current;
    if (data.length === 0) return;

    const barWidth = 3;
    const gap = 1;
    const centerY = height / 2;
    const progress = duration > 0 ? currentTime / duration : 0;

    // Draw each bar
    for (let x = 0; x < totalWidth; x += barWidth + gap) {
      const sampleIndex = Math.floor((x / totalWidth) * data.length);
      const value = data[sampleIndex] || 0.5;
      const barHeight = value * height * 0.8;

      const isPlayed = x / totalWidth < progress;

      // Set color based on played state
      if (isPlayed) {
        ctx.fillStyle = '#818cf8'; // Brighter indigo for played
      } else {
        ctx.fillStyle = '#4f46e5'; // Darker indigo for unplayed
        ctx.globalAlpha = 0.5;
      }

      // Draw mirrored bar (top and bottom from center)
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
      ctx.globalAlpha = 1;
    }

    // Draw progress overlay
    const progressX = progress * totalWidth;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.fillRect(0, 0, progressX, height);
  }, [duration, zoom, currentTime]);

  const totalWidth = duration * 100 * zoom;

  return (
    <div className="relative">
      {/* Main backing track lane */}
      <div className="h-20 border-b border-white/10 bg-indigo-500/5 relative">
        {/* Track label */}
        <div className="absolute left-2 top-2 flex items-center gap-2 z-10">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-medium text-white truncate max-w-48">{track.name}</div>
            {track.artist && (
              <div className="text-[10px] text-zinc-500 truncate max-w-48">{track.artist}</div>
            )}
          </div>
        </div>

        {/* Waveform canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ width: totalWidth }}
        />
      </div>

      {/* Stem lanes (if available) */}
      {stemsAvailable && (
        <div className="border-b border-white/5">
          {Object.entries(STEM_COLORS).map(([stem, color]) => {
            const state = stemMixState[stem as keyof typeof stemMixState];
            if (!state?.enabled) return null;

            return (
              <StemLane
                key={stem}
                stemName={stem}
                color={color}
                volume={state.volume}
                duration={duration}
                zoom={zoom}
                currentTime={currentTime}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Individual stem lane component
interface StemLaneProps {
  stemName: string;
  color: string;
  volume: number;
  duration: number;
  zoom: number;
  currentTime: number;
}

function StemLane({
  stemName,
  color,
  volume,
  duration,
  zoom,
  currentTime,
}: StemLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<number[]>([]);

  // Generate placeholder waveform
  useEffect(() => {
    const samples = Math.floor(duration * 50);
    waveformData.current = Array.from({ length: samples }, () => 0.2 + Math.random() * 0.6);
  }, [duration]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const pixelsPerSecond = 100 * zoom;
    const totalWidth = duration * pixelsPerSecond;

    ctx.clearRect(0, 0, width, height);

    const data = waveformData.current;
    if (data.length === 0) return;

    const barWidth = 2;
    const gap = 1;
    const centerY = height / 2;
    const progress = duration > 0 ? currentTime / duration : 0;

    for (let x = 0; x < totalWidth; x += barWidth + gap) {
      const sampleIndex = Math.floor((x / totalWidth) * data.length);
      const value = (data[sampleIndex] || 0.5) * volume;
      const barHeight = value * height * 0.8;

      const isPlayed = x / totalWidth < progress;
      ctx.fillStyle = color;
      ctx.globalAlpha = isPlayed ? 1 : 0.4;

      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    }
    ctx.globalAlpha = 1;
  }, [duration, zoom, currentTime, color, volume]);

  const totalWidth = duration * 100 * zoom;

  const stemLabels: Record<string, string> = {
    vocals: 'Vocals',
    drums: 'Drums',
    bass: 'Bass',
    other: 'Other',
  };

  return (
    <div
      className="h-10 relative border-t border-white/5"
      style={{ opacity: volume }}
    >
      {/* Stem label */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] text-zinc-400">{stemLabels[stemName]}</span>
      </div>

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ width: totalWidth }}
      />
    </div>
  );
}
