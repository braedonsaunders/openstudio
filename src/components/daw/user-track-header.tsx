'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { FullHeightMeter } from './full-height-meter';
import { Fader } from './fader';
import { AdvancedAudioSettingsPopover } from './advanced-audio-settings';
import { EffectsRack } from './effects-rack';
import { useUserTracksStore, TRACK_COLORS } from '@/stores/user-tracks-store';
import {
  Mic,
  Monitor,
  Volume2,
  ChevronDown,
  ChevronRight,
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

    let top = rect.bottom + 8;
    let left = rect.left;
    let alignRight = false;

    if (popoverRef.current) {
      const popoverWidth = popoverRef.current.offsetWidth;
      if (left + popoverWidth > viewportWidth - 16) {
        left = rect.right - popoverWidth;
        alignRight = true;
      }
      if (left < 16) {
        left = 16;
      }

      const popoverHeight = popoverRef.current.offsetHeight;
      if (top + popoverHeight > viewportHeight - 16) {
        top = rect.top - popoverHeight - 8;
        if (top < 16) top = 16;
      }
    }

    setPosition({ top, left, alignRight });
  }, [anchorRef, isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
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
  isGlobalMuted?: boolean;
  onRemove?: () => void;
}

export function UserTrackHeader({
  track,
  audioLevel,
  trackNumber,
  isFirst,
  userName,
  isGlobalMuted,
  onRemove,
}: UserTrackHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showTrackEditor, setShowTrackEditor] = useState(false);
  const [newName, setNewName] = useState(track.name);
  const advancedSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const effectsButtonRef = useRef<HTMLButtonElement>(null);
  const trackEditorButtonRef = useRef<HTMLButtonElement>(null);
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

  // Focus input when track editor opens
  useEffect(() => {
    if (showTrackEditor && renameInputRef.current) {
      // Small delay to ensure popover is rendered
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [showTrackEditor]);

  // Reset name when opening editor
  useEffect(() => {
    if (showTrackEditor) {
      setNewName(track.name);
    }
  }, [showTrackEditor, track.name]);

  const handleOpenTrackEditor = () => {
    setShowTrackEditor(true);
    setShowEffects(false);
    setShowAdvancedSettings(false);
  };

  const handleSaveName = () => {
    if (newName.trim() && newName.trim() !== track.name) {
      updateTrack(track.id, { name: newName.trim() });
    }
  };

  const handleColorChange = (color: string) => {
    updateTrack(track.id, { color });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
      setShowTrackEditor(false);
    } else if (e.key === 'Escape') {
      setShowTrackEditor(false);
    }
  };

  // Only active if armed, not muted, not globally muted, and has signal
  const isActive = track.isArmed && !track.isMuted && !isGlobalMuted && audioLevel > 0.05;
  // When not armed or globally muted, show level as 0
  const effectiveLevel = track.isArmed && !isGlobalMuted ? audioLevel : 0;

  return (
    <div
      className={cn(
        'border-b border-gray-200 dark:border-white/5 transition-all',
        isActive && 'bg-gray-100/50 dark:bg-white/[0.02]',
        isGlobalMuted && 'opacity-50'
      )}
      style={{ '--track-color': track.color } as React.CSSProperties}
    >
      {/* Main Row - Fixed height matching the lane */}
      <div className="h-[80px] flex">
        {/* Left Content Area */}
        <div className="flex-1 flex flex-col py-2 pl-2 pr-1">
          {/* Top: Track Info Row */}
          <div className="flex items-center gap-1.5">
            {/* Track Color Bar with Recording Indicator */}
            <div className="relative shrink-0">
              <div
                className={cn(
                  'w-1 h-8 rounded-full transition-all',
                  isActive && 'shadow-[0_0_8px_var(--track-color)]'
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

            {/* Expand/Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors shrink-0"
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
                'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all',
                isActive && 'ring-1 ring-offset-1 ring-offset-[#0d0d14]'
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
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {track.name}
                </span>
                {isFirst && (
                  <span className="text-[9px] text-gray-500 dark:text-zinc-500">(You)</span>
                )}
              </div>
              {/* Input source label */}
              <div className="flex items-center gap-1 text-gray-500 dark:text-zinc-500">
                <span className="text-[9px] truncate">
                  {track.audioSettings.inputMode === 'application'
                    ? track.audioSettings.applicationName || 'App'
                    : 'Input'}
                </span>
              </div>
            </div>

            {/* Track Editor (Name + Color) */}
            <button
              ref={trackEditorButtonRef}
              onClick={handleOpenTrackEditor}
              className={cn(
                'p-1 rounded transition-colors shrink-0',
                showTrackEditor
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              )}
              title="Edit Track Name & Color"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom: Controls Row */}
          <div className="flex items-center gap-1 mt-auto pt-1">
            {/* Record Arm Button */}
            <button
              onClick={() => setTrackArmed(track.id, !track.isArmed)}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center transition-all',
                track.isArmed
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/10'
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
                track.isMuted || isGlobalMuted
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/10'
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
                  : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/10'
              )}
            >
              S
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Effects Rack Button */}
            <button
              ref={effectsButtonRef}
              onClick={() => {
                setShowEffects(!showEffects);
                setShowAdvancedSettings(false);
              }}
              className={cn(
                'p-1 rounded transition-colors relative',
                showEffects
                  ? 'bg-purple-500/20 text-purple-400'
                  : activeEffectsCount > 0
                    ? 'text-purple-400 hover:text-purple-300'
                    : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              )}
              title="Effects Rack"
            >
              <Sparkles className="w-3 h-3" />
              {activeEffectsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full text-[6px] font-bold text-white flex items-center justify-center">
                  {activeEffectsCount}
                </span>
              )}
            </button>

            {/* Advanced Settings Button */}
            <button
              ref={advancedSettingsButtonRef}
              onClick={() => {
                setShowAdvancedSettings(!showAdvancedSettings);
                setShowEffects(false);
              }}
              className={cn(
                'p-1 rounded transition-colors',
                showAdvancedSettings
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              )}
              title="Advanced Audio Settings"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Full Height Level Meter */}
        <div className="w-6 h-full shrink-0 bg-black/20 border-l border-gray-200 dark:border-white/5">
          <FullHeightMeter
            level={effectiveLevel}
            color={track.color}
            showPeak={true}
            segments={16}
          />
        </div>
      </div>

      {/* Expanded Controls - Volume */}
      {isExpanded && (
        <div className="px-3 pb-2 pt-1 border-t border-gray-200 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-gray-500 dark:text-zinc-500 shrink-0" />
            <Fader
              value={track.volume}
              onChange={(v) => setTrackVolume(track.id, v)}
              className="flex-1"
            />
            <span className="text-[9px] text-gray-500 dark:text-zinc-500 w-6 text-right">
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

      {/* Track Name & Color Editor Popover */}
      <PopoverPortal
        anchorRef={trackEditorButtonRef}
        isOpen={showTrackEditor}
        onClose={() => {
          handleSaveName();
          setShowTrackEditor(false);
        }}
      >
        <div className="w-56 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-medium text-white">Edit Track</span>
            <button
              onClick={() => {
                handleSaveName();
                setShowTrackEditor(false);
              }}
              className="p-0.5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* Track Name Input */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
                Name
              </label>
              <input
                ref={renameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleSaveName}
                className="w-full h-7 px-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Track name"
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-2">
                Color
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {TRACK_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={cn(
                      'w-7 h-7 rounded-md transition-all hover:scale-110',
                      track.color === color
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900'
                        : 'hover:ring-1 hover:ring-white/50'
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverPortal>
    </div>
  );
}
