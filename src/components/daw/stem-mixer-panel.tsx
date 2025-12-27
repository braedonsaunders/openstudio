'use client';

import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Fader } from './fader';
import { VerticalMeter } from './vertical-meter';
import { Progress } from '../ui/progress';
import {
  Mic,
  Guitar,
  Music,
  Volume2,
  VolumeX,
  Wand2,
  Loader2,
} from 'lucide-react';
import { Drum } from '../icons';
import type { StemType } from '@/types';

interface StemMixerPanelProps {
  onToggleStem: (stem: StemType, enabled: boolean) => void;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onSeparateTrack?: () => void;
  isSeparating?: boolean;
  separationProgress?: number;
}

const stemConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  vocals: {
    icon: <Mic className="w-4 h-4" />,
    label: 'Vocals',
    color: '#ec4899',
  },
  drums: {
    icon: <Drum className="w-4 h-4" />,
    label: 'Drums',
    color: '#f97316',
  },
  bass: {
    icon: <Guitar className="w-4 h-4" />,
    label: 'Bass',
    color: '#22c55e',
  },
  other: {
    icon: <Music className="w-4 h-4" />,
    label: 'Other',
    color: '#3b82f6',
  },
};

export function StemMixerPanel({
  onToggleStem,
  onStemVolumeChange,
  onSeparateTrack,
  isSeparating = false,
  separationProgress = 0,
}: StemMixerPanelProps) {
  const { stemMixState, stemsAvailable, currentTrack } = useRoomStore();

  if (!currentTrack) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-500">Select a track to use stem mixing</p>
        </div>
      </div>
    );
  }

  if (isSeparating) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center w-full max-w-xs">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Separating Audio</h4>
          <Progress value={separationProgress} showLabel className="mb-3" />
          <p className="text-xs text-gray-500 dark:text-zinc-500">
            Using Meta SAM to extract individual stems...
          </p>
        </div>
      </div>
    );
  }

  if (!stemsAvailable) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Wand2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
          </div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Stem Separation</h4>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4 max-w-52">
            Use AI to separate vocals, drums, bass, and other instruments
          </p>
          <button
            onClick={onSeparateTrack}
            className="neon-button px-4 py-2.5 rounded-xl text-white font-medium flex items-center gap-2 mx-auto"
          >
            <Wand2 className="w-4 h-4" />
            Separate Track
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Stem Mixer</h4>
          <span className="text-[10px] text-gray-500 dark:text-zinc-500">Powered by Meta SAM</span>
        </div>
      </div>

      {/* Channel Strips */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(stemConfig).map(([stem, config]) => {
            const state = stemMixState[stem as keyof typeof stemMixState];
            const isEnabled = state?.enabled ?? true;
            const volume = state?.volume ?? 1;

            return (
              <div
                key={stem}
                className={cn(
                  'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 flex flex-col items-center gap-2 transition-opacity',
                  !isEnabled && 'opacity-40'
                )}
              >
                {/* Stem Icon */}
                <button
                  onClick={() => onToggleStem(stem as StemType, !isEnabled)}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                    isEnabled
                      ? 'text-white'
                      : 'bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'
                  )}
                  style={{
                    backgroundColor: isEnabled ? config.color : undefined,
                    boxShadow: isEnabled ? `0 0 15px ${config.color}40` : undefined,
                  }}
                >
                  {config.icon}
                </button>

                {/* Label */}
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">{config.label}</span>

                {/* Fader */}
                <div className="w-6 h-24">
                  <Fader
                    value={volume}
                    onChange={(v) => onStemVolumeChange(stem as StemType, v)}
                    orientation="vertical"
                    disabled={!isEnabled}
                  />
                </div>

                {/* Volume % */}
                <span className="text-[10px] text-gray-500 dark:text-zinc-500">
                  {Math.round(volume * 100)}%
                </span>

                {/* Mute Button */}
                <button
                  onClick={() => onStemVolumeChange(stem as StemType, volume === 0 ? 1 : 0)}
                  className={cn(
                    'w-6 h-6 rounded flex items-center justify-center transition-all',
                    volume === 0
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-zinc-500 hover:bg-gray-300 dark:hover:bg-white/10'
                  )}
                >
                  {volume === 0 ? (
                    <VolumeX className="w-3 h-3" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Master Section */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 dark:text-zinc-400">Master</span>
          <span className="text-xs text-gray-500 dark:text-zinc-500">0.0 dB</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full" />
      </div>
    </div>
  );
}
