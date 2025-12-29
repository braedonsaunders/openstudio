'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { DynamicWaveform } from './dynamic-waveform';
import type { User } from '@/types';

interface LiveTrackLaneProps {
  user: User;
  isLocal: boolean;
  audioLevel: number;
  trackColor: string;
  zoom: number;
  historySeconds: number;
  isGlobalMuted?: boolean;
}

function LiveTrackLaneInner({
  user,
  isLocal,
  audioLevel,
  trackColor,
  zoom,
  historySeconds,
  isGlobalMuted,
}: LiveTrackLaneProps) {
  // Combined mute state
  const isMuted = user.isMuted || isGlobalMuted;
  // Determine if user is actively playing
  const isActive = audioLevel > 0.05 && !isMuted;

  return (
    <div
      className={cn(
        'h-[80px] border-b border-gray-200 dark:border-white/5 relative transition-colors flex-shrink-0 overflow-hidden',
        isActive && 'bg-gray-100/50 dark:bg-white/[0.02]'
      )}
      style={{ '--track-color': trackColor } as React.CSSProperties}
    >
      {/* Track color indicator on left */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 transition-all z-10',
          isActive && !isMuted && 'shadow-[0_0_12px_var(--track-color)]'
        )}
        style={{ backgroundColor: trackColor }}
      />

      {/* Dynamic Waveform Canvas */}
      <DynamicWaveform
        audioLevel={audioLevel}
        trackColor={trackColor}
        isMuted={isMuted ?? false}
        zoom={zoom}
        historySeconds={historySeconds}
      />

      {/* Live indicator badge */}
      {isActive && !isMuted && (
        <div className="absolute right-3 top-2 z-20">
          <div
            className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider animate-pulse shadow-lg"
            style={{
              backgroundColor: trackColor,
              color: 'white',
              boxShadow: `0 0 12px ${trackColor}60`,
            }}
          >
            LIVE
          </div>
        </div>
      )}

      {/* Muted indicator */}
      {isMuted && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
          <span className="text-xs text-zinc-400 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            MUTED
          </span>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent re-renders when parent updates with new audioLevels Map
export const LiveTrackLane = memo(LiveTrackLaneInner);
