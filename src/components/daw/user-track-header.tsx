'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VerticalMeter } from './vertical-meter';
import { Fader } from './fader';
import { TrackAudioSettingsPopover } from './track-audio-settings';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import {
  Mic,
  Monitor,
  Volume2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Settings2,
  Trash2,
  Circle,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { UserTrack } from '@/types';

interface UserTrackHeaderProps {
  track: UserTrack;
  audioLevel: number;
  trackNumber: number;
  isFirst: boolean;
  userName: string;
  onRemove?: () => void;
}

export function UserTrackHeader({
  track,
  audioLevel,
  trackNumber,
  isFirst,
  userName,
  onRemove,
}: UserTrackHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(track.name);
  const settingsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const {
    setTrackMuted,
    setTrackSolo,
    setTrackVolume,
    setTrackArmed,
    updateTrack,
  } = useUserTracksStore();

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleStartRename = () => {
    setNewName(track.name);
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleConfirmRename = () => {
    if (newName.trim()) {
      updateTrack(track.id, { name: newName.trim() });
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setNewName(track.name);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  return (
    <div
      className={cn(
        'border-b border-white/5 transition-all',
        audioLevel > 0.1 && !track.isMuted && 'bg-white/[0.02]'
      )}
      style={{ '--track-color': track.color } as React.CSSProperties}
    >
      {/* Main Track Info Row */}
      <div className="h-[72px] flex items-center gap-2 px-2">
        {/* Track Color Bar with Recording Indicator */}
        <div className="relative">
          <div
            className={cn(
              'w-1 h-12 rounded-full transition-all',
              audioLevel > 0.1 && !track.isMuted && 'shadow-[0_0_8px_var(--track-color)]'
            )}
            style={{ backgroundColor: track.color }}
          />
          {track.isArmed && (
            <Circle
              className={cn(
                'absolute -top-1 -left-0.5 w-2 h-2',
                track.isRecording ? 'text-red-500 fill-red-500 animate-pulse' : 'text-red-500/50'
              )}
            />
          )}
        </div>

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

        {/* Record Arm Button */}
        <button
          onClick={() => setTrackArmed(track.id, !track.isArmed)}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center transition-all',
            track.isArmed
              ? 'bg-red-500/20 text-red-400'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
          )}
          title={track.isArmed ? 'Disarm track' : 'Arm track for recording'}
        >
          <Circle className={cn('w-3 h-3', track.isArmed && 'fill-current')} />
        </button>

        {/* Mute Button */}
        <button
          onClick={() => setTrackMuted(track.id, !track.isMuted)}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all',
            track.isMuted
              ? 'bg-red-500/20 text-red-400'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
          )}
        >
          M
        </button>

        {/* Solo Button */}
        <button
          onClick={() => setTrackSolo(track.id, !track.isSolo)}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all',
            track.isSolo
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
          )}
        >
          S
        </button>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* Input Mode Icon */}
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                audioLevel > 0.1 && !track.isMuted && 'ring-2 ring-offset-1 ring-offset-[#0d0d14]'
              )}
              style={{
                backgroundColor: track.color,
                '--tw-ring-color': track.color,
              } as React.CSSProperties}
            >
              {track.audioSettings.inputMode === 'application' ? (
                <Monitor className="w-3.5 h-3.5 text-white" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-white" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleConfirmRename}
                    className="w-full h-6 px-1.5 bg-white/10 border border-white/20 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleConfirmRename}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCancelRename}
                    className="p-1 text-zinc-400 hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-white truncate">
                      {track.name}
                    </span>
                    {isFirst && (
                      <span className="text-[10px] text-zinc-500">(You)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-500">
                    {track.audioSettings.inputMode === 'application' ? (
                      <>
                        <Monitor className="w-3 h-3" />
                        <span className="text-[10px] truncate">
                          {track.audioSettings.applicationName || 'App Audio'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        <span className="text-[10px] truncate">
                          {track.audioSettings.inputDeviceId === 'default' ? 'Default Mic' : 'Microphone'}
                        </span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Level Meter */}
        <div className="w-3 h-12 shrink-0">
          <VerticalMeter level={audioLevel} color={track.color} />
        </div>

        {/* Settings Button */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showSettings
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
            title="Audio Input Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 z-50">
              <TrackAudioSettingsPopover
                track={track}
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}
        </div>

        {/* More Options */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-[#16161f] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
              <button
                onClick={handleStartRename}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename Track
              </button>
              <button
                onClick={() => {
                  setShowSettings(true);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Audio Input Settings
              </button>
              {onRemove && (
                <>
                  <div className="border-t border-white/5" />
                  <button
                    onClick={() => {
                      onRemove();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Track
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Controls - Volume only */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <Fader
              value={track.volume}
              onChange={(v) => setTrackVolume(track.id, v)}
              className="flex-1"
            />
            <span className="text-[10px] text-zinc-500 w-8 text-right">
              {Math.round(track.volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
