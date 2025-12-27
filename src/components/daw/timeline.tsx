'use client';

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TimelineProps {
  duration: number;
  zoom: number;
  scrollLeft: number;
  onSeek?: (time: number) => void;
  className?: string;
}

export function Timeline({
  duration,
  zoom,
  scrollLeft,
  onSeek,
  className,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate interval based on zoom
  const getInterval = (): { major: number; minor: number } => {
    if (zoom > 2) return { major: 5, minor: 1 };
    if (zoom > 1) return { major: 10, minor: 2 };
    if (zoom > 0.5) return { major: 15, minor: 5 };
    if (zoom > 0.2) return { major: 30, minor: 10 };
    return { major: 60, minor: 15 };
  };

  const { major, minor } = getInterval();
  const pixelsPerSecond = 100 * zoom;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onSeek) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const seekTime = x / pixelsPerSecond;

    if (seekTime >= 0 && seekTime <= duration) {
      onSeek(seekTime);
    }
  }, [onSeek, scrollLeft, pixelsPerSecond, duration]);

  // Generate tick marks
  const ticks: { time: number; isMajor: boolean }[] = [];
  for (let t = 0; t <= duration; t += minor) {
    ticks.push({
      time: t,
      isMajor: t % major === 0,
    });
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-8 bg-[#12121a] border-b border-white/5 relative overflow-hidden shrink-0',
        onSeek && 'cursor-pointer',
        className
      )}
      onClick={handleClick}
    >
      {/* Tick marks */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: -scrollLeft,
          width: duration * pixelsPerSecond,
        }}
      >
        {ticks.map(({ time, isMajor }) => {
          const x = time * pixelsPerSecond;
          return (
            <div
              key={time}
              className="absolute top-0"
              style={{ left: x }}
            >
              {/* Tick line */}
              <div
                className={cn(
                  'w-px',
                  isMajor ? 'h-3 bg-zinc-500' : 'h-2 bg-zinc-700'
                )}
              />
              {/* Time label */}
              {isMajor && (
                <span className="absolute top-3 left-1 text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                  {formatTime(time)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* End marker */}
      {duration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-indigo-500/50"
          style={{ left: duration * pixelsPerSecond - scrollLeft }}
        />
      )}
    </div>
  );
}
