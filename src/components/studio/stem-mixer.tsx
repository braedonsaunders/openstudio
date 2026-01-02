'use client';

import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
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

interface StemMixerProps {
  onToggleStem: (stem: StemType, enabled: boolean) => void;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onSeparateTrack?: () => void;
  isSeparating?: boolean;
  separationProgress?: number;
  className?: string;
}

const stemConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  vocals: {
    icon: <Mic className="w-4 h-4" />,
    label: 'Vocals',
    color: 'bg-pink-500',
  },
  drums: {
    icon: <Drum className="w-4 h-4" />,
    label: 'Drums',
    color: 'bg-orange-500',
  },
  bass: {
    icon: <Guitar className="w-4 h-4" />,
    label: 'Bass',
    color: 'bg-green-500',
  },
  other: {
    icon: <Music className="w-4 h-4" />,
    label: 'Other',
    color: 'bg-blue-500',
  },
};

export function StemMixer({
  onToggleStem,
  onStemVolumeChange,
  onSeparateTrack,
  isSeparating = false,
  separationProgress = 0,
  className,
}: StemMixerProps) {
  const { stemMixState, stemsAvailable, currentTrack } = useRoomStore();

  if (!currentTrack) {
    return (
      <div className={cn('p-4 bg-gray-800/50 rounded-xl text-center', className)}>
        <p className="text-gray-500">Select a track to use stem mixing</p>
      </div>
    );
  }

  if (isSeparating) {
    return (
      <div className={cn('p-6 bg-gray-800/50 rounded-xl', className)}>
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="font-medium text-white">Separating audio...</span>
        </div>
        <Progress value={separationProgress} showLabel />
        <p className="mt-2 text-sm text-gray-400">
          Using Demucs AI to separate instruments from the track
        </p>
      </div>
    );
  }

  if (!stemsAvailable) {
    return (
      <div className={cn('p-6 bg-gray-800/50 rounded-xl', className)}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-indigo-500/20 rounded-full flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h4 className="font-medium text-white">Stem Separation</h4>
            <p className="text-sm text-gray-400 mt-1">
              Use AI to separate vocals, drums, bass, and other instruments
            </p>
          </div>
          <Button onClick={onSeparateTrack} className="w-full">
            <Wand2 className="w-4 h-4 mr-2" />
            Separate Track
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">Stem Mixer</h4>
        <span className="text-xs text-gray-500">Powered by Demucs</span>
      </div>

      <div className="space-y-3">
        {Object.entries(stemConfig).map(([stem, config]) => {
          const state = stemMixState[stem as keyof typeof stemMixState];

          return (
            <div
              key={stem}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg bg-gray-800/50',
                !state.enabled && 'opacity-50'
              )}
            >
              {/* Stem icon and toggle */}
              <Button
                variant={state.enabled ? 'primary' : 'ghost'}
                size="icon"
                onClick={() => onToggleStem(stem as StemType, !state.enabled)}
                className={cn('w-10 h-10', state.enabled && config.color)}
              >
                {config.icon}
              </Button>

              {/* Label */}
              <span className="w-16 text-sm text-gray-300">{config.label}</span>

              {/* Volume slider */}
              <div className="flex-1 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 shrink-0"
                  onClick={() =>
                    onStemVolumeChange(stem as StemType, state.volume === 0 ? 1 : 0)
                  }
                >
                  {state.volume === 0 ? (
                    <VolumeX className="w-3 h-3" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                </Button>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(e) =>
                    onStemVolumeChange(stem as StemType, parseFloat(e.target.value))
                  }
                  disabled={!state.enabled}
                />
              </div>

              {/* Volume value */}
              <span className="w-12 text-right text-sm text-gray-500">
                {Math.round(state.volume * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
