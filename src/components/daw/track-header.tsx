'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { VerticalMeter } from './vertical-meter';
import { Fader } from './fader';
import {
  Mic,
  MicOff,
  Volume2,
  Crown,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Guitar,
  Music,
} from 'lucide-react';
import { Drum, Piano } from '../icons';
import type { User } from '@/types';

interface TrackHeaderProps {
  user: User;
  isLocal: boolean;
  isMaster: boolean;
  audioLevel: number;
  trackColor: string;
  trackNumber: number;
  onMute: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
}

const instrumentIcons: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-3.5 h-3.5" />,
  piano: <Piano className="w-3.5 h-3.5" />,
  keyboard: <Piano className="w-3.5 h-3.5" />,
  drums: <Drum className="w-3.5 h-3.5" />,
  bass: <Guitar className="w-3.5 h-3.5" />,
  vocals: <Mic className="w-3.5 h-3.5" />,
};

export function TrackHeader({
  user,
  isLocal,
  isMaster,
  audioLevel,
  trackColor,
  trackNumber,
  onMute,
  onVolumeChange,
}: TrackHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSolo, setIsSolo] = useState(false);

  const instrumentIcon = user.instrument
    ? instrumentIcons[user.instrument.toLowerCase()] || <Music className="w-3.5 h-3.5" />
    : null;

  return (
    <div
      className={cn(
        'border-b border-white/5 transition-all',
        audioLevel > 0.1 && !user.isMuted && 'bg-white/[0.02]'
      )}
      style={{ '--track-color': trackColor } as React.CSSProperties}
    >
      {/* Main Track Info Row */}
      <div className="h-[72px] flex items-center gap-2 px-2">
        {/* Track Color Bar */}
        <div
          className={cn(
            'w-1 h-12 rounded-full transition-all',
            audioLevel > 0.1 && !user.isMuted && 'shadow-[0_0_8px_var(--track-color)]'
          )}
          style={{ backgroundColor: trackColor }}
        />

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Mute Button */}
        <button
          onClick={() => onMute(!user.isMuted)}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all',
            user.isMuted
              ? 'bg-red-500/20 text-red-400'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
          )}
        >
          M
        </button>

        {/* Solo Button */}
        <button
          onClick={() => setIsSolo(!isSolo)}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all',
            isSolo
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
          )}
        >
          S
        </button>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* Avatar */}
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0',
                audioLevel > 0.1 && !user.isMuted && 'ring-2 ring-offset-1 ring-offset-[#0d0d14]'
              )}
              style={{
                backgroundColor: trackColor,
                '--tw-ring-color': trackColor,
              } as React.CSSProperties}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-white truncate">
                  {user.name}
                </span>
                {isLocal && (
                  <span className="text-[10px] text-zinc-500">(You)</span>
                )}
                {isMaster && (
                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 text-zinc-500">
                {instrumentIcon}
                <span className="text-[10px] truncate">{user.instrument || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level Meter */}
        <div className="w-3 h-12 shrink-0">
          <VerticalMeter level={audioLevel} color={trackColor} />
        </div>

        {/* More Options */}
        <button className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Controls */}
      {isExpanded && !isLocal && (
        <div className="px-3 pb-3 pt-1">
          {/* Volume Fader */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <Fader
              value={user.volume}
              onChange={onVolumeChange}
              className="flex-1"
            />
            <span className="text-[10px] text-zinc-500 w-8 text-right">
              {Math.round(user.volume * 100)}%
            </span>
          </div>

          {/* Connection Stats */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {user.latency}ms
            </span>
            <span>Buf: {user.jitterBuffer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
