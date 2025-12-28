'use client';

import { cn } from '@/lib/utils';
import { DynamicWaveform } from './dynamic-waveform';
import type { UserTrack } from '@/types';
import { Mic, Monitor, Circle } from 'lucide-react';

interface UserTrackLaneProps {
  track: UserTrack;
  audioLevel: number;
  zoom: number;
  historySeconds: number;
  isGlobalMuted?: boolean;
}

export function UserTrackLane({
  track,
  audioLevel,
  zoom,
  historySeconds,
  isGlobalMuted,
}: UserTrackLaneProps) {
  // Only render audio tracks (type undefined means audio for backward compatibility)
  const trackType = track.type || 'audio';
  if (trackType !== 'audio') return null;

  const isArmed = track.isArmed;
  const isMuted = track.isMuted || isGlobalMuted;
  // Only show as active if armed, not muted, and has signal
  const isActive = isArmed && !isMuted && audioLevel > 0.05;
  // When not armed or muted, force the level to 0 for visualization
  const effectiveLevel = isArmed && !isGlobalMuted ? audioLevel : 0;

  return (
    <div
      className={cn(
        'h-[80px] border-b border-gray-200 dark:border-white/5 relative transition-colors flex-shrink-0 overflow-hidden',
        isActive && 'bg-gray-100/50 dark:bg-white/[0.02]'
      )}
      style={{ '--track-color': track.color } as React.CSSProperties}
    >
      {/* Track color indicator with recording status */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
        <div
          className={cn(
            'w-1 h-full transition-all',
            isActive && !isMuted && 'shadow-[0_0_12px_var(--track-color)]'
          )}
          style={{ backgroundColor: track.color }}
        />
        {track.isArmed && (
          <div className="absolute left-1.5 top-2">
            <Circle
              className={cn(
                'w-2 h-2',
                track.isRecording
                  ? 'text-red-500 fill-red-500 animate-pulse'
                  : 'text-red-500/50'
              )}
            />
          </div>
        )}
      </div>

      {/* Dynamic Waveform Canvas */}
      <DynamicWaveform
        audioLevel={effectiveLevel}
        trackColor={track.color}
        isMuted={isMuted}
        isArmed={isArmed}
        zoom={zoom}
        historySeconds={historySeconds}
      />

      {/* Track info overlay (subtle, bottom left) */}
      <div className="absolute left-4 bottom-2 flex items-center gap-1.5 opacity-60 z-10">
        {track.audioSettings.inputMode === 'application' ? (
          <Monitor className="w-3 h-3 text-zinc-400" />
        ) : (
          <Mic className="w-3 h-3 text-zinc-400" />
        )}
        <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">
          {track.name}
        </span>
      </div>

      {/* Live indicator badge */}
      {isActive && !isMuted && (
        <div className="absolute right-3 top-2 z-20">
          <div
            className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider animate-pulse shadow-lg"
            style={{
              backgroundColor: track.color,
              color: 'white',
              boxShadow: `0 0 12px ${track.color}60`,
            }}
          >
            {track.isRecording ? 'REC' : 'LIVE'}
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

      {/* Unarmed indicator - shown when track is not armed (not receiving input) */}
      {!isArmed && !isMuted && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/20">
          <span className="text-xs text-zinc-500 bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-sm">
            NOT ARMED
          </span>
        </div>
      )}
    </div>
  );
}
