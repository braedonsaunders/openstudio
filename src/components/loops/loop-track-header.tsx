'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { useContextMenu } from '../ui/context-menu';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useCustomLoopsStore } from '@/stores/custom-loops-store';
import { getLoopById } from '@/lib/audio/loop-library';
import { AVAILABLE_SOUND_PRESETS } from '@/lib/audio/sound-engine';
import type { LoopTrackState, LoopDefinition } from '@/types/loops';
import {
  Volume2,
  VolumeX,
  Headphones,
  Trash2,
  Settings,
  ChevronDown,
  Repeat,
  Music,
  Zap,
  Edit3,
  Copy,
} from 'lucide-react';

interface LoopTrackHeaderProps {
  track: LoopTrackState;
  onRemove: () => void;
  onEditLoop?: (loopId: string) => void;
  isMaster?: boolean;
}

export function LoopTrackHeader({
  track,
  onRemove,
  onEditLoop,
  isMaster = false,
}: LoopTrackHeaderProps) {
  const {
    setTrackVolume,
    setTrackMuted,
    setTrackSolo,
    setTrackSoundPreset,
    setTrackHumanize,
  } = useLoopTracksStore();
  const { createLoop: createCustomLoop } = useCustomLoopsStore();
  const { showContextMenu, ContextMenuComponent } = useContextMenu();

  const [showSettings, setShowSettings] = useState(false);

  // Get loop definition
  const loopDef = getLoopById(track.loopId);

  // Check if this is a custom loop (editable)
  const isCustomLoop = loopDef && 'isCustom' in loopDef && loopDef.isCustom === true;

  // Duplicate a loop as a custom loop for editing
  const handleDuplicateAsCustom = useCallback(
    async (loop: LoopDefinition) => {
      const newLoop = await createCustomLoop({
        name: `${loop.name} (Copy)`,
        category: loop.category,
        subcategory: 'custom',
        bars: loop.bars,
        bpm: loop.bpm,
        timeSignature: loop.timeSignature,
        midiData: [...loop.midiData],
        soundPreset: loop.soundPreset,
        tags: ['custom', ...loop.tags],
        intensity: loop.intensity,
        complexity: loop.complexity,
        key: loop.key,
      });
      onEditLoop?.(newLoop.id);
    },
    [createCustomLoop, onEditLoop]
  );

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!loopDef) return;

      const items = [];

      if (isCustomLoop) {
        items.push({
          label: 'Edit Loop',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => onEditLoop?.(track.loopId),
        });
        items.push({
          label: 'Duplicate',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => handleDuplicateAsCustom(loopDef),
        });
      } else {
        items.push({
          label: 'Duplicate & Edit',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => handleDuplicateAsCustom(loopDef),
        });
      }

      if (isMaster) {
        items.push({ divider: true, label: '', onClick: () => {} });
        items.push({
          label: 'Remove Track',
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: onRemove,
        });
      }

      showContextMenu(e, items);
    },
    [loopDef, isCustomLoop, isMaster, showContextMenu, onEditLoop, handleDuplicateAsCustom, onRemove, track.loopId]
  );

  // Get category icon
  const getCategoryIcon = () => {
    switch (loopDef?.category) {
      case 'drums':
        return '🥁';
      case 'bass':
        return '🎸';
      case 'keys':
        return '🎹';
      case 'guitar':
        return '🎸';
      case 'synth':
        return '🎹';
      default:
        return '🎵';
    }
  };

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTrackVolume(track.id, parseFloat(e.target.value));
    },
    [track.id, setTrackVolume]
  );

  return (
    <>
    <div
      className="flex flex-col h-24 bg-slate-900 border-b border-slate-700"
      style={{ borderLeftColor: track.color, borderLeftWidth: '3px' }}
      onContextMenu={handleContextMenu}
    >
      {/* Top Row - Name and Controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 min-w-0">
        {/* Loop Icon */}
        <div
          className={cn(
            'w-7 h-7 flex items-center justify-center rounded-full',
            'bg-indigo-500/20 text-indigo-400'
          )}
        >
          <Repeat className="w-3.5 h-3.5" />
        </div>

        {/* Track Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{getCategoryIcon()}</span>
            <span className="text-sm font-medium text-slate-200 truncate">
              {track.name || loopDef?.name || 'Loop'}
            </span>
          </div>
          <div className="text-xs text-slate-500 truncate">
            {loopDef?.bpm} BPM • {loopDef?.bars} {loopDef?.bars === 1 ? 'bar' : 'bars'}
          </div>
        </div>

        {/* Edit Button - only for custom loops */}
        {isCustomLoop && onEditLoop && (
          <button
            onClick={() => onEditLoop(track.loopId)}
            className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
            title="Edit loop"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'p-1 rounded transition-colors',
            showSettings
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-slate-400 hover:text-slate-300'
          )}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Delete Button - only for master */}
        {isMaster && (
          <button
            onClick={onRemove}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom Row - Volume and Mute/Solo */}
      <div className="flex items-center gap-2 px-2 py-1">
        {/* Mute */}
        <button
          onClick={() => setTrackMuted(track.id, !track.muted)}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors',
            track.muted
              ? 'bg-red-500 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-slate-300'
          )}
          title="Mute"
        >
          M
        </button>

        {/* Solo */}
        <button
          onClick={() => setTrackSolo(track.id, !track.solo)}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors',
            track.solo
              ? 'bg-amber-500 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-slate-300'
          )}
          title="Solo"
        >
          S
        </button>

        {/* Volume Slider */}
        <div className="flex-1 flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-slate-500" />
          <Slider
            value={track.volume}
            min={0}
            max={1.5}
            step={0.01}
            onChange={handleVolumeChange}
            className="flex-1"
          />
          <span className="text-xs text-slate-500 w-8 text-right">
            {Math.round(track.volume * 100)}%
          </span>
        </div>

        {/* Humanize Toggle */}
        <button
          onClick={() => setTrackHumanize(track.id, !track.humanizeEnabled)}
          className={cn(
            'p-1 rounded transition-colors',
            track.humanizeEnabled
              ? 'bg-purple-500/20 text-purple-400'
              : 'text-slate-500 hover:text-slate-400'
          )}
          title="Humanize"
        >
          <Zap className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings Panel (Expanded) */}
      {showSettings && (
        <LoopTrackSettings
          track={track}
          loopDef={loopDef}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
    {ContextMenuComponent}
    </>
  );
}

// Settings Panel
interface LoopTrackSettingsProps {
  track: LoopTrackState;
  loopDef: ReturnType<typeof getLoopById>;
  onClose: () => void;
}

function LoopTrackSettings({ track, loopDef, onClose }: LoopTrackSettingsProps) {
  const {
    setTrackSoundPreset,
    setTrackTempoLocked,
    setTrackKeyLocked,
    setTrackHumanize,
  } = useLoopTracksStore();

  // Get available presets for this category
  const categoryPresets = loopDef?.category
    ? AVAILABLE_SOUND_PRESETS[loopDef.category as keyof typeof AVAILABLE_SOUND_PRESETS] || []
    : [];

  return (
    <div className="absolute top-full left-0 right-0 z-50 bg-slate-800 border border-slate-700 rounded-b-lg shadow-xl p-3 space-y-3">
      {/* Sound Preset */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-1 block">Sound</label>
        <select
          value={track.soundPreset}
          onChange={(e) => setTrackSoundPreset(track.id, e.target.value)}
          className="w-full h-8 px-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {categoryPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lock Controls */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={track.tempoLocked}
            onChange={(e) => setTrackTempoLocked(track.id, e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
          />
          Lock Tempo
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={track.keyLocked}
            onChange={(e) => setTrackKeyLocked(track.id, e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
          />
          Lock Key
        </label>
      </div>

      {/* Humanization */}
      <div>
        <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
          <input
            type="checkbox"
            checked={track.humanizeEnabled}
            onChange={(e) => setTrackHumanize(track.id, e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
          />
          Humanize
        </label>
        {track.humanizeEnabled && (
          <div className="grid grid-cols-2 gap-3 ml-6">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Timing</label>
              <Slider
                value={track.humanizeTiming * 100}
                min={0}
                max={20}
                step={1}
                onChange={(e) =>
                  setTrackHumanize(track.id, true, parseFloat(e.target.value) / 100, undefined)
                }
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Velocity</label>
              <Slider
                value={track.humanizeVelocity * 100}
                min={0}
                max={50}
                step={1}
                onChange={(e) =>
                  setTrackHumanize(track.id, true, undefined, parseFloat(e.target.value) / 100)
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition-colors"
      >
        Close
      </button>
    </div>
  );
}
