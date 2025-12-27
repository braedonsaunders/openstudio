'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Music,
  Waves,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { BackingTrack, StemMixState } from '@/types';

interface SeekableBackingTrackProps {
  track: BackingTrack;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMaster: boolean;
  onSeek: (time: number) => void;
  stemsAvailable: boolean;
  stemMixState: StemMixState;
  waveformData?: number[] | null;
}

const STEM_COLORS = {
  vocals: '#ec4899',
  drums: '#f97316',
  bass: '#22c55e',
  other: '#3b82f6',
};

export function SeekableBackingTrack({
  track,
  currentTime,
  duration,
  isPlaying,
  isMaster,
  onSeek,
  stemsAvailable,
  stemMixState,
  waveformData: realWaveformData,
}: SeekableBackingTrackProps) {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const placeholderWaveform = useRef<number[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Detect if this is a YouTube track
  const isYouTube = !!track.youtubeId;

  // Generate placeholder waveform data only when needed
  useEffect(() => {
    if (!realWaveformData && duration > 0) {
      const samples = 300;
      if (isYouTube) {
        // YouTube: create a smooth, ghostly sine-wave pattern
        placeholderWaveform.current = Array.from({ length: samples }, (_, i) => {
          const x = i / samples;
          // Layered sine waves for a flowing, ghostly look
          return 0.3 + 0.2 * Math.sin(x * Math.PI * 8) + 0.15 * Math.sin(x * Math.PI * 16) + 0.1 * Math.sin(x * Math.PI * 4);
        });
      } else {
        // Regular placeholder: random bars
        placeholderWaveform.current = Array.from({ length: samples }, () => 0.2 + Math.random() * 0.8);
      }
    }
  }, [duration, realWaveformData, isYouTube]);

  // Get the waveform data to use
  const waveformToRender = realWaveformData || placeholderWaveform.current;

  // Draw waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
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
    const data = waveformToRender;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const barWidth = 2;
    const gap = 1;
    const barsCount = Math.floor(width / (barWidth + gap));
    const centerY = height / 2;

    for (let i = 0; i < barsCount; i++) {
      const sampleIndex = Math.floor((i / barsCount) * data.length);
      const value = data[sampleIndex] || 0.5;
      const barHeight = value * height * 0.7;
      const x = i * (barWidth + gap);

      const isPlayed = i / barsCount < progress;

      if (isYouTube) {
        // YouTube skeleton style: red/pink gradient with dashed/ghostly appearance
        if (isPlayed) {
          ctx.fillStyle = '#f87171'; // Red-400
          ctx.shadowBlur = 3;
          ctx.shadowColor = '#ef4444';
          ctx.globalAlpha = 0.9;
        } else {
          ctx.fillStyle = '#7f1d1d'; // Red-900 (very dark)
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.35;
        }
      } else {
        // Normal waveform style (indigo for real/uploaded tracks)
        if (isPlayed) {
          ctx.fillStyle = '#818cf8'; // Bright indigo
          ctx.shadowBlur = 2;
          ctx.shadowColor = '#818cf8';
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = '#3730a3'; // Darker indigo
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.6;
        }
      }

      // Draw mirrored bar
      const halfHeight = barHeight / 2;
      ctx.fillRect(x, centerY - halfHeight, barWidth, barHeight);
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
  }, [duration, currentTime, waveformToRender, isYouTube]);

  // Handle scrubber interaction - uses currentTarget for position
  const handleScrubberClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMaster || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const seekTime = ratio * duration;

    onSeek(Math.max(0, Math.min(duration, seekTime)));
  }, [isMaster, duration, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(ratio * duration);
  }, [duration]);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#0d0d14] border-b border-white/10 shrink-0">
      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shadow-lg",
            isYouTube
              ? "bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/20"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
          )}>
            <Music className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white truncate max-w-[200px]">{track.name}</span>
            {track.artist && (
              <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">{track.artist}</span>
            )}
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded border",
            isYouTube
              ? "bg-red-500/10 border-red-500/20"
              : "bg-indigo-500/10 border-indigo-500/20"
          )}>
            <Waves className={cn("w-3 h-3", isYouTube ? "text-red-400" : "text-indigo-400")} />
            <span className={cn("text-[10px] font-medium", isYouTube ? "text-red-400" : "text-indigo-400")}>
              {isYouTube ? "YOUTUBE" : "BACKING TRACK"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            Click timeline to seek {isMaster ? '' : '(master only)'}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Waveform and Scrubber */}
      {isExpanded && (
        <div className="relative">
          {/* Waveform display - clickable for seeking */}
          <div
            onClick={handleScrubberClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'h-16 relative',
              isMaster ? 'cursor-pointer' : 'cursor-default'
            )}
          >
            <canvas
              ref={waveformCanvasRef}
              className="absolute inset-0 w-full h-full"
            />

            {/* Progress overlay */}
            <div
              className={cn(
                "absolute top-0 bottom-0 left-0 pointer-events-none",
                isYouTube ? "bg-red-500/10" : "bg-indigo-500/10"
              )}
              style={{ width: `${progress}%` }}
            />

            {/* Playhead */}
            <div
              className={cn(
                "absolute top-0 bottom-0 w-0.5 pointer-events-none",
                isYouTube
                  ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"
                  : "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]"
              )}
              style={{ left: `${progress}%` }}
            />

            {/* Hover time indicator on waveform */}
            {hoverTime !== null && isMaster && (
              <div
                className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
                style={{ left: `${(hoverTime / duration) * 100}%` }}
              >
                <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-zinc-800 rounded text-[9px] text-white font-mono whitespace-nowrap">
                  {formatTime(hoverTime)}
                </div>
              </div>
            )}
          </div>

          {/* Timeline - also clickable for seeking */}
          <div
            onClick={handleScrubberClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'h-8 relative bg-[#0a0a0f] border-t border-white/5',
              isMaster ? 'cursor-pointer' : 'cursor-default'
            )}
          >
            {/* Timeline ticks - adaptive intervals based on duration */}
            <div className="absolute inset-0 flex items-center">
              {(() => {
                // Calculate interval based on duration to show ~6-10 markers max
                const getInterval = () => {
                  if (duration <= 60) return 10;      // 10s intervals for < 1 min
                  if (duration <= 180) return 30;     // 30s intervals for < 3 min
                  if (duration <= 360) return 60;     // 1 min intervals for < 6 min
                  if (duration <= 600) return 90;     // 1.5 min intervals for < 10 min
                  return 120;                          // 2 min intervals for longer tracks
                };
                const interval = getInterval();
                const tickCount = Math.ceil(duration / interval) + 1;

                return Array.from({ length: tickCount }).map((_, i) => {
                  const time = i * interval;
                  const percent = (time / duration) * 100;
                  if (percent > 100) return null;

                  return (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${percent}%` }}
                    >
                      <div className="w-px h-2 bg-zinc-600" />
                      <span className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                        {formatTime(time)}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Hover time indicator */}
            {hoverTime !== null && isMaster && (
              <div
                className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
                style={{ left: `${(hoverTime / duration) * 100}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-zinc-800 rounded text-[9px] text-white font-mono whitespace-nowrap">
                  {formatTime(hoverTime)}
                </div>
              </div>
            )}

            {/* Current time / Duration display */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
              <span className="font-mono text-white">{formatTime(currentTime)}</span>
              <span className="text-zinc-500">/</span>
              <span className="font-mono text-zinc-400">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Stem lanes (if available) */}
          {stemsAvailable && (
            <div className="border-t border-white/5">
              {Object.entries(STEM_COLORS).map(([stem, color]) => {
                const state = stemMixState[stem as keyof typeof stemMixState];
                if (!state?.enabled) return null;

                return (
                  <StemMiniLane
                    key={stem}
                    stemName={stem}
                    color={color}
                    volume={state.volume}
                    duration={duration}
                    currentTime={currentTime}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini stem lane for showing individual stem progress
interface StemMiniLaneProps {
  stemName: string;
  color: string;
  volume: number;
  duration: number;
  currentTime: number;
}

function StemMiniLane({
  stemName,
  color,
  volume,
  duration,
  currentTime,
}: StemMiniLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<number[]>([]);

  useEffect(() => {
    const samples = Math.floor(duration * 50);
    waveformData.current = Array.from({ length: samples }, () => 0.2 + Math.random() * 0.6);
  }, [duration]);

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
    const data = waveformData.current;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const barWidth = 2;
    const gap = 1;
    const barsCount = Math.floor(width / (barWidth + gap));
    const centerY = height / 2;

    for (let i = 0; i < barsCount; i++) {
      const sampleIndex = Math.floor((i / barsCount) * data.length);
      const value = (data[sampleIndex] || 0.5) * volume;
      const barHeight = value * height * 0.8;
      const x = i * (barWidth + gap);

      const isPlayed = i / barsCount < progress;
      ctx.fillStyle = color;
      ctx.globalAlpha = isPlayed ? 1 : 0.3;

      const halfHeight = barHeight / 2;
      ctx.fillRect(x, centerY - halfHeight, barWidth, barHeight);
    }
    ctx.globalAlpha = 1;
  }, [duration, currentTime, color, volume]);

  const stemLabels: Record<string, string> = {
    vocals: 'VOC',
    drums: 'DRM',
    bass: 'BAS',
    other: 'OTH',
  };

  return (
    <div
      className="h-6 relative border-t border-white/5"
      style={{ opacity: volume }}
    >
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[9px] font-medium text-zinc-500">{stemLabels[stemName]}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
