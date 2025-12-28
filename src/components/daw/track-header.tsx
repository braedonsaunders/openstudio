'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FullHeightMeter } from './full-height-meter';
import { Fader } from './fader';
import {
  Mic,
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
  isGlobalMuted?: boolean;
  onMute: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
}

const instrumentIcons: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-3 h-3" />,
  piano: <Piano className="w-3 h-3" />,
  keyboard: <Piano className="w-3 h-3" />,
  drums: <Drum className="w-3 h-3" />,
  bass: <Guitar className="w-3 h-3" />,
  vocals: <Mic className="w-3 h-3" />,
};

export function TrackHeader({
  user,
  isLocal,
  isMaster,
  audioLevel,
  trackColor,
  trackNumber,
  isGlobalMuted,
  onMute,
  onVolumeChange,
}: TrackHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSolo, setIsSolo] = useState(false);

  const instrumentIcon = user.instrument
    ? instrumentIcons[user.instrument.toLowerCase()] || <Music className="w-3 h-3" />
    : null;

  const isActive = audioLevel > 0.05 && !user.isMuted && !isGlobalMuted;

  return (
    <div
      className={cn(
        'border-b border-white/5 transition-all',
        isActive && 'bg-white/[0.02]',
        isGlobalMuted && 'opacity-50'
      )}
      style={{ '--track-color': trackColor } as React.CSSProperties}
    >
      {/* Main Row - Fixed height matching the lane */}
      <div className="h-[80px] flex">
        {/* Left Content Area */}
        <div className="flex-1 flex flex-col py-2 pl-2 pr-1">
          {/* Top: User Info Row */}
          <div className="flex items-center gap-1.5">
            {/* Track Color Bar */}
            <div
              className={cn(
                'w-1 h-8 rounded-full transition-all shrink-0',
                isActive && 'shadow-[0_0_8px_var(--track-color)]'
              )}
              style={{ backgroundColor: trackColor }}
            />

            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>

            {/* Avatar */}
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0 transition-all',
                isActive && 'ring-2 ring-offset-1 ring-offset-[#0d0d14]'
              )}
              style={{
                backgroundColor: trackColor,
                '--tw-ring-color': trackColor,
              } as React.CSSProperties}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>

            {/* Name and Instrument */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-white truncate">
                  {user.name}
                </span>
                {isLocal && (
                  <span className="text-[9px] text-zinc-500">(You)</span>
                )}
                {isMaster && (
                  <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 text-zinc-500">
                {instrumentIcon}
                <span className="text-[9px] truncate">{user.instrument || 'Unknown'}</span>
              </div>
            </div>

            {/* More Options */}
            <button className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom: Controls Row */}
          <div className="flex items-center gap-1 mt-auto pt-1">
            {/* Mute Button */}
            <button
              onClick={() => onMute(!user.isMuted)}
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all',
                user.isMuted || isGlobalMuted
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
                'w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all',
                isSolo
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
            >
              S
            </button>

            {/* Volume Mini-Fader */}
            <div className="flex items-center gap-1 flex-1 min-w-0 ml-1">
              <Volume2 className="w-3 h-3 text-zinc-500 shrink-0" />
              <Fader
                value={user.volume}
                onChange={onVolumeChange}
                className="flex-1"
              />
              <span className="text-[9px] text-zinc-500 w-5 text-right shrink-0">
                {Math.round(user.volume * 100)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Full Height Level Meter */}
        <div className="w-6 h-full shrink-0 bg-black/20 border-l border-white/5">
          <FullHeightMeter
            level={audioLevel}
            color={trackColor}
            showPeak={true}
            segments={16}
          />
        </div>
      </div>

      {/* Expanded Controls */}
      {isExpanded && !isLocal && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5">
          {/* Connection Stats */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  user.latency < 50 ? 'bg-emerald-500' :
                  user.latency < 100 ? 'bg-yellow-500' : 'bg-red-500'
                )}
              />
              {user.latency}ms
            </span>
            <span>Buffer: {user.jitterBuffer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
