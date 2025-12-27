'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { VerticalMeter } from './vertical-meter';
import { Fader } from './fader';
import { TrackAudioSettingsPopover } from './track-audio-settings';
import { AdvancedAudioSettingsPopover } from './advanced-audio-settings';
import { EffectsRack } from './effects-rack';
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
  Sparkles,
  Sliders,
} from 'lucide-react';
import type { UserTrack } from '@/types';

// Popover wrapper that portals to body and positions correctly
function PopoverPortal({
  children,
  anchorRef,
  isOpen,
  onClose,
}: {
  children: React.ReactNode;
  anchorRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [position, setPosition] = useState({ top: 0, left: 0, alignRight: false });
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current || !isOpen) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Position below the anchor
    let top = rect.bottom + 8;
    let left = rect.left;
    let alignRight = false;

    // Check if we have enough space on the right, if not align to right edge
    if (popoverRef.current) {
      const popoverWidth = popoverRef.current.offsetWidth;
      if (left + popoverWidth > viewportWidth - 16) {
        left = rect.right - popoverWidth;
        alignRight = true;
      }
      // Ensure it doesn't go off the left edge
      if (left < 16) {
        left = 16;
      }

      // Check vertical space
      const popoverHeight = popoverRef.current.offsetHeight;
      if (top + popoverHeight > viewportHeight - 16) {
        // Position above instead
        top = rect.top - popoverHeight - 8;
        if (top < 16) top = 16;
      }
    }

    setPosition({ top, left, alignRight });
  }, [anchorRef, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Use RAF for smoother positioning after render
      requestAnimationFrame(updatePosition);
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[100]"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(track.name);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const advancedSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const effectsButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const {
    setTrackMuted,
    setTrackSolo,
    setTrackVolume,
    setTrackArmed,
    updateTrack,
  } = useUserTracksStore();

  // Count active effects
  const activeEffectsCount = [
    track.audioSettings.effects?.noiseGate?.enabled,
    track.audioSettings.effects?.eq?.enabled,
    track.audioSettings.effects?.compressor?.enabled,
    track.audioSettings.effects?.reverb?.enabled,
    track.audioSettings.effects?.limiter?.enabled,
  ].filter(Boolean).length;

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
      {/* Main Track Row */}
      <div className="flex items-stretch gap-2 px-2 py-2">
        {/* Track Color Bar with Recording Indicator */}
        <div className="relative flex-shrink-0">
          <div
            className={cn(
              'w-1 h-full min-h-[56px] rounded-full transition-all',
              audioLevel > 0.1 && !track.isMuted && 'shadow-[0_0_8px_var(--track-color)]'
            )}
            style={{ backgroundColor: track.color }}
          />
          {track.isArmed && (
            <Circle
              className={cn(
                'absolute -top-0.5 -left-0.5 w-2 h-2',
                track.isRecording ? 'text-red-500 fill-red-500 animate-pulse' : 'text-red-500/50'
              )}
            />
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Track Name Row */}
          <div className="flex items-center gap-1.5">
            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>

            {/* Input Mode Icon */}
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                audioLevel > 0.1 && !track.isMuted && 'ring-1 ring-offset-1 ring-offset-[#0d0d14]'
              )}
              style={{
                backgroundColor: track.color,
                '--tw-ring-color': track.color,
              } as React.CSSProperties}
            >
              {track.audioSettings.inputMode === 'application' ? (
                <Monitor className="w-2.5 h-2.5 text-white" />
              ) : (
                <Mic className="w-2.5 h-2.5 text-white" />
              )}
            </div>

            {/* Track Name */}
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
                    className="w-full h-5 px-1 bg-white/10 border border-white/20 rounded text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleConfirmRename}
                    className="p-0.5 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleCancelRename}
                    className="p-0.5 text-zinc-400 hover:text-zinc-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-white truncate">
                    {track.name}
                  </span>
                  {isFirst && (
                    <span className="text-[9px] text-zinc-500">(You)</span>
                  )}
                </div>
              )}
            </div>

            {/* Level Meter */}
            <div className="w-2 h-5 shrink-0">
              <VerticalMeter level={audioLevel} color={track.color} />
            </div>
          </div>

          {/* Controls Row - R/M/S + Settings Buttons */}
          <div className="flex items-center gap-1">
            {/* Record Arm Button */}
            <button
              onClick={() => setTrackArmed(track.id, !track.isArmed)}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center transition-all',
                track.isArmed
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
              title={track.isArmed ? 'Disarm track' : 'Arm track for recording'}
            >
              <Circle className={cn('w-2.5 h-2.5', track.isArmed && 'fill-current')} />
            </button>

            {/* Mute Button */}
            <button
              onClick={() => setTrackMuted(track.id, !track.isMuted)}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-all',
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
                'w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-all',
                track.isSolo
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              )}
            >
              S
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Input source label */}
            <div className="flex items-center gap-1 text-zinc-500 mr-1">
              {track.audioSettings.inputMode === 'application' ? (
                <span className="text-[9px] truncate max-w-[60px]">
                  {track.audioSettings.applicationName || 'App'}
                </span>
              ) : (
                <span className="text-[9px] truncate max-w-[60px]">
                  Input
                </span>
              )}
            </div>

            {/* Effects Rack Button */}
            <button
              ref={effectsButtonRef}
              onClick={() => {
                setShowEffects(!showEffects);
                setShowSettings(false);
                setShowAdvancedSettings(false);
                setShowMenu(false);
              }}
              className={cn(
                'p-1 rounded transition-colors relative',
                showEffects
                  ? 'bg-purple-500/20 text-purple-400'
                  : activeEffectsCount > 0
                    ? 'text-purple-400 hover:text-purple-300'
                    : 'text-zinc-500 hover:text-zinc-300'
              )}
              title="Effects Rack"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {activeEffectsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full text-[7px] font-bold text-white flex items-center justify-center">
                  {activeEffectsCount}
                </span>
              )}
            </button>

            {/* Advanced Settings Button */}
            <button
              ref={advancedSettingsButtonRef}
              onClick={() => {
                setShowAdvancedSettings(!showAdvancedSettings);
                setShowSettings(false);
                setShowEffects(false);
                setShowMenu(false);
              }}
              className={cn(
                'p-1 rounded transition-colors',
                showAdvancedSettings
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
              title="Advanced Audio Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Quick Settings Button */}
            <button
              ref={settingsButtonRef}
              onClick={() => {
                setShowSettings(!showSettings);
                setShowAdvancedSettings(false);
                setShowEffects(false);
                setShowMenu(false);
              }}
              className={cn(
                'p-1 rounded transition-colors',
                showSettings
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
              title="Quick Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            {/* More Options */}
            <button
              ref={menuButtonRef}
              onClick={() => {
                setShowMenu(!showMenu);
                setShowSettings(false);
                setShowAdvancedSettings(false);
                setShowEffects(false);
              }}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Controls - Volume only */}
      {isExpanded && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-zinc-500 shrink-0" />
            <Fader
              value={track.volume}
              onChange={(v) => setTrackVolume(track.id, v)}
              className="flex-1"
            />
            <span className="text-[9px] text-zinc-500 w-6 text-right">
              {Math.round(track.volume * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Portaled Popovers */}
      <PopoverPortal
        anchorRef={effectsButtonRef}
        isOpen={showEffects}
        onClose={() => setShowEffects(false)}
      >
        <EffectsRack
          track={track}
          onClose={() => setShowEffects(false)}
        />
      </PopoverPortal>

      <PopoverPortal
        anchorRef={advancedSettingsButtonRef}
        isOpen={showAdvancedSettings}
        onClose={() => setShowAdvancedSettings(false)}
      >
        <AdvancedAudioSettingsPopover
          track={track}
          onClose={() => setShowAdvancedSettings(false)}
        />
      </PopoverPortal>

      <PopoverPortal
        anchorRef={settingsButtonRef}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      >
        <TrackAudioSettingsPopover
          track={track}
          onClose={() => setShowSettings(false)}
        />
      </PopoverPortal>

      <PopoverPortal
        anchorRef={menuButtonRef}
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <div className="w-48 bg-[#16161f] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={handleStartRename}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Rename Track
          </button>
          <div className="border-t border-white/5" />
          <button
            onClick={() => {
              setShowMenu(false);
              setShowEffects(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Effects Rack
            {activeEffectsCount > 0 && (
              <span className="ml-auto text-[10px] text-purple-400">
                {activeEffectsCount} active
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              setShowAdvancedSettings(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            Advanced Audio Settings
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              setShowSettings(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Quick Settings
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
      </PopoverPortal>
    </div>
  );
}
