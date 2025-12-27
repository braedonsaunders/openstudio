'use client';

import { cn } from '@/lib/utils';

interface PlayheadProps {
  position: number; // Position in pixels
  isPlaying: boolean;
}

export function Playhead({ position, isPlaying }: PlayheadProps) {
  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 z-20 pointer-events-none transition-opacity',
        isPlaying ? 'opacity-100' : 'opacity-80'
      )}
      style={{
        left: position,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Top triangle */}
      <div className="absolute -top-0 left-1/2 -translate-x-1/2">
        <div
          className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent"
          style={{ borderTopColor: '#6366f1' }}
        />
      </div>

      {/* Main line */}
      <div
        className={cn(
          'w-0.5 h-full bg-indigo-500',
          isPlaying && 'playhead'
        )}
      />

      {/* Glow effect */}
      <div
        className={cn(
          'absolute inset-0 w-0.5 bg-indigo-500 blur-sm',
          isPlaying ? 'opacity-100' : 'opacity-50'
        )}
      />
    </div>
  );
}
