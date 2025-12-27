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
        'relative p-4 bg-gray-800/50 rounded-xl border transition-all duration-200',
        user.isMuted ? 'border-gray-700 opacity-60' : 'border-gray-700',
        audioLevel > 0.1 && !user.isMuted && 'border-indigo-500/50 shadow-lg shadow-indigo-500/10',
        className
      )}
    >
      {/* Master badge */}
      {user.isMaster && (
        <Tooltip content="Room Master">
          <div className="absolute -top-2 -right-2 p-1 bg-yellow-500 rounded-full">
            <Crown className="w-3 h-3 text-yellow-900" />
          </div>
        </Tooltip>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar with level indicator */}
        <div className="relative">
          <div
            className={cn(
              'w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600',
              'flex items-center justify-center text-lg font-bold text-white',
              audioLevel > 0.1 && !user.isMuted && 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900'
            )}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div
            className={cn(
              'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900',
              getConnectionQualityColor(user.connectionQuality).replace('text-', 'bg-')
            )}
          />
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate">
              {user.name}
              {isLocal && <span className="text-gray-500 text-sm"> (You)</span>}
            </h4>
            {instrumentIcon}
          </div>

          {user.instrument && (
            <p className="text-sm text-gray-400 truncate">{user.instrument}</p>
          )}

          {/* Audio level */}
          <div className="mt-2">
            <LevelMeter level={audioLevel} size="sm" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          <Button
            variant={user.isMuted ? 'danger' : 'ghost'}
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
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        <span>{user.latency}ms</span>
        <span>Buffer: {user.jitterBuffer}</span>
      </div>
    </div>
  );
}
