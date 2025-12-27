'use client';

import { cn, getConnectionQualityColor } from '@/lib/utils';
import { LevelMeter } from '../audio/level-meter';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Crown,
  Guitar,
  Music,
} from 'lucide-react';
import { Drum, Piano } from '../icons';
import type { User } from '@/types';

interface UserCardProps {
  user: User;
  audioLevel: number;
  isLocal?: boolean;
  isMaster?: boolean;
  onMute?: (muted: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  className?: string;
}

const instrumentIcons: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-4 h-4" />,
  piano: <Piano className="w-4 h-4" />,
  keyboard: <Piano className="w-4 h-4" />,
  drums: <Drum className="w-4 h-4" />,
  bass: <Guitar className="w-4 h-4" />,
  vocals: <Mic className="w-4 h-4" />,
};

export function UserCard({
  user,
  audioLevel,
  isLocal = false,
  isMaster = false,
  onMute,
  onVolumeChange,
  className,
}: UserCardProps) {
  const instrumentIcon = user.instrument
    ? instrumentIcons[user.instrument.toLowerCase()] || <Music className="w-4 h-4" />
    : null;

  return (
    <div
      className={cn(
        'relative p-4 bg-slate-50 rounded-xl border transition-all duration-200',
        user.isMuted ? 'border-slate-200 opacity-60' : 'border-slate-200',
        audioLevel > 0.1 && !user.isMuted && 'border-indigo-300 shadow-md shadow-indigo-100',
        className
      )}
    >
      {/* Master badge */}
      {user.isMaster && (
        <Tooltip content="Room Master">
          <div className="absolute -top-2 -right-2 p-1.5 bg-amber-400 rounded-full shadow-sm">
            <Crown className="w-3 h-3 text-amber-900" />
          </div>
        </Tooltip>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar with level indicator */}
        <div className="relative">
          <div
            className={cn(
              'w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600',
              'flex items-center justify-center text-lg font-semibold text-white',
              audioLevel > 0.1 && !user.isMuted && 'ring-2 ring-emerald-400 ring-offset-2'
            )}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white',
              getConnectionQualityColor(user.connectionQuality).replace('text-', 'bg-')
            )}
          />
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-900 truncate">
              {user.name}
              {isLocal && <span className="text-slate-400 text-sm"> (You)</span>}
            </h4>
            <span className="text-slate-400">{instrumentIcon}</span>
          </div>

          {user.instrument && (
            <p className="text-sm text-slate-500 truncate">{user.instrument}</p>
          )}

          {/* Audio level */}
          <div className="mt-2">
            <LevelMeter level={audioLevel} size="sm" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          <Button
            variant={user.isMuted ? 'danger' : 'secondary'}
            size="icon"
            onClick={() => onMute?.(!user.isMuted)}
            className="w-8 h-8"
          >
            {user.isMuted ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Volume slider */}
      {!isLocal && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 shrink-0"
            onClick={() => onVolumeChange?.(user.volume === 0 ? 1 : 0)}
          >
            {user.volume === 0 ? (
              <VolumeX className="w-3 h-3" />
            ) : (
              <Volume2 className="w-3 h-3" />
            )}
          </Button>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={user.volume}
            onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
            className="flex-1"
          />
        </div>
      )}

      {/* Connection stats */}
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
        <span>{user.latency}ms</span>
        <span>Buffer: {user.jitterBuffer}</span>
      </div>
    </div>
  );
}
