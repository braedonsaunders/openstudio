'use client';

import { useState } from 'react';
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
  Lock,
  Crown,
} from 'lucide-react';
import { Drum } from '../icons';
import type { StemType } from '@/types';
import type { User } from '@/types';

interface MixerViewProps {
  isMaster: boolean;
  onToggleStem: (stem: StemType, enabled: boolean) => void;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onSeparateTrack?: () => void;
  isSeparating?: boolean;
  separationProgress?: number;
  users: Map<string, User>;
  audioLevels: Map<string, number>;
}

const stemConfig: Record<string, { icon: React.ReactNode; label: string; color: string; darkColor: string }> = {
  vocals: {
    icon: <Mic className="w-5 h-5" />,
    label: 'Vocals',
    color: '#ec4899',
    darkColor: '#be185d',
  },
  drums: {
    icon: <Drum className="w-5 h-5" />,
    label: 'Drums',
    color: '#f97316',
    darkColor: '#c2410c',
  },
  bass: {
    icon: <Guitar className="w-5 h-5" />,
    label: 'Bass',
    color: '#22c55e',
    darkColor: '#15803d',
  },
  other: {
    icon: <Music className="w-5 h-5" />,
    label: 'Other',
    color: '#3b82f6',
    darkColor: '#1d4ed8',
  },
};

function StemChannel({
  stem,
  config,
  state,
  isMaster,
  onToggle,
  onVolumeChange,
}: {
  stem: string;
  config: typeof stemConfig.vocals;
  state: { enabled: boolean; volume: number };
  isMaster: boolean;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const isEnabled = state?.enabled ?? true;
  const volume = state?.volume ?? 1;

  return (
    <div
      className={cn(
        'relative bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 transition-all',
        !isEnabled && 'opacity-50',
        !isMaster && 'cursor-not-allowed'
      )}
    >
      {/* Read-only indicator */}
      {!isMaster && (
        <div className="absolute top-2 right-2">
          <Lock className="w-3 h-3 text-gray-400 dark:text-zinc-600" />
        </div>
      )}

      {/* Stem Icon/Toggle */}
      <button
        onClick={isMaster ? onToggle : undefined}
        disabled={!isMaster}
        className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center transition-all',
          isEnabled
            ? 'text-white'
            : 'bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500',
          isMaster && 'hover:scale-105 active:scale-95',
          !isMaster && 'cursor-not-allowed'
        )}
        style={{
          backgroundColor: isEnabled ? config.color : undefined,
          boxShadow: isEnabled ? `0 0 25px ${config.color}50` : undefined,
        }}
      >
        {config.icon}
      </button>

      {/* Label */}
      <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{config.label}</span>

      {/* Fader + Meter */}
      <div className="flex-1 flex items-center gap-3 min-h-[200px]">
        <div className="w-8 h-full">
          <Fader
            value={volume}
            onChange={isMaster ? onVolumeChange : () => {}}
            orientation="vertical"
            disabled={!isEnabled || !isMaster}
          />
        </div>
        <div className="w-4 h-full">
          <VerticalMeter level={isEnabled ? volume * 0.8 : 0} color={config.color} />
        </div>
      </div>

      {/* Volume Display */}
      <div className="text-center">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Mute Button */}
      <button
        onClick={isMaster ? () => onVolumeChange(volume === 0 ? 1 : 0) : undefined}
        disabled={!isMaster}
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
          volume === 0
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-zinc-500 border border-gray-300 dark:border-white/10',
          isMaster && 'hover:bg-gray-300 dark:hover:bg-white/10',
          !isMaster && 'cursor-not-allowed'
        )}
      >
        {volume === 0 ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export function MixerView({
  isMaster,
  onToggleStem,
  onStemVolumeChange,
  onSeparateTrack,
  isSeparating = false,
  separationProgress = 0,
  users,
  audioLevels,
}: MixerViewProps) {
  const { stemMixState, stemsAvailable, currentTrack } = useRoomStore();

  // Empty state - no track
  if (!currentTrack) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
            <Wand2 className="w-10 h-10 text-gray-400 dark:text-zinc-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Track Selected
          </h3>
          <p className="text-gray-500 dark:text-zinc-400">
            Select a track from the queue to use the stem mixer
          </p>
        </div>
      </div>
    );
  }

  // Separating state
  if (isSeparating) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center w-full max-w-md">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Separating Audio Stems
          </h3>
          <Progress value={separationProgress} showLabel className="mb-4" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Using Meta SAM to extract vocals, drums, bass, and other instruments...
          </p>
        </div>
      </div>
    );
  }

  // No stems yet
  if (!stemsAvailable) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Wand2 className="w-12 h-12 text-indigo-500 dark:text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            AI Stem Separation
          </h3>
          <p className="text-gray-500 dark:text-zinc-400 mb-6">
            Use AI to separate the track into individual stems: vocals, drums, bass, and other instruments
          </p>

          {isMaster ? (
            <button
              onClick={onSeparateTrack}
              className="neon-button px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2 mx-auto"
            >
              <Wand2 className="w-5 h-5" />
              Separate Track
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-amber-500/80">
              <Lock className="w-4 h-4" />
              <span className="text-sm">Only the room master can separate tracks</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mixer view
  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Stem Mixer</h2>
          {!isMaster && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Lock className="w-3 h-3 text-amber-500" />
              <span className="text-xs text-amber-500 font-medium">View Only</span>
            </div>
          )}
          {isMaster && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Crown className="w-3 h-3 text-indigo-500" />
              <span className="text-xs text-indigo-500 font-medium">Master</span>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-zinc-500">Powered by Meta SAM</span>
      </div>

      {/* Mixer Channels */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
          {Object.entries(stemConfig).map(([stem, config]) => {
            const state = stemMixState[stem as keyof typeof stemMixState];
            return (
              <StemChannel
                key={stem}
                stem={stem}
                config={config}
                state={state}
                isMaster={isMaster}
                onToggle={() => onToggleStem(stem as StemType, !(state?.enabled ?? true))}
                onVolumeChange={(volume) => onStemVolumeChange(stem as StemType, volume)}
              />
            );
          })}
        </div>
      </div>

      {/* Master Section */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Master Output</span>
          <span className="text-sm text-gray-500 dark:text-zinc-500">0.0 dB</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all"
              style={{ width: '60%' }}
            />
          </div>
          <div className="flex-1 h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full transition-all"
              style={{ width: '55%' }}
            />
          </div>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-500 dark:text-zinc-600">L</span>
          <span className="text-[10px] text-gray-500 dark:text-zinc-600">R</span>
        </div>
      </div>
    </div>
  );
}
