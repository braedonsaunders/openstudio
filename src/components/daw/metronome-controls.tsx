'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useMetronomeStore, type BpmMode } from '@/stores/metronome-store';
import { useMetronome } from '@/hooks/use-metronome';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Timer,
  Play,
  Pause,
  Radio,
  Lock,
  Unlock,
  Activity,
  Hand,
  ChevronDown,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';

interface MetronomeControlsProps {
  audioContext: AudioContext | null;
  masterGain?: AudioNode | null;
  onBroadcastStreamReady?: (stream: MediaStream) => void;
  className?: string;
  compact?: boolean;
}

const BPM_MODE_LABELS: Record<BpmMode, { label: string; description: string; icon: typeof Lock }> = {
  'locked': {
    label: 'Locked',
    description: 'Fixed BPM, ignores track tempo',
    icon: Lock,
  },
  'follow-analyzer': {
    label: 'Follow Track',
    description: 'Syncs with detected BPM from audio',
    icon: Activity,
  },
  'tap-tempo': {
    label: 'Tap Tempo',
    description: 'Set BPM by tapping the beat',
    icon: Hand,
  },
};

const CLICK_TYPES = [
  { value: 'digital', label: 'Digital' },
  { value: 'woodblock', label: 'Woodblock' },
  { value: 'cowbell', label: 'Cowbell' },
  { value: 'hihat', label: 'Hi-Hat' },
  { value: 'rimshot', label: 'Rimshot' },
] as const;

export function MetronomeControls({
  audioContext,
  masterGain,
  onBroadcastStreamReady,
  className,
  compact = false,
}: MetronomeControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  // Store state
  const {
    enabled,
    bpm,
    volume,
    bpmMode,
    lockedBpm,
    beatsPerBar,
    clickType,
    accentFirstBeat,
    broadcastEnabled,
    currentBeat,
    analyzerBpm,
    setEnabled,
    setBpm,
    setVolume,
    setBpmMode,
    setLockedBpm,
    setBeatsPerBar,
    setClickType,
    setAccentFirstBeat,
    setBroadcastEnabled,
  } = useMetronomeStore();

  // Metronome hook
  const {
    isPlaying,
    effectiveBpm,
    start,
    stop,
    toggle,
    tap,
  } = useMetronome({
    audioContext,
    masterGain,
    onBroadcastStreamReady,
  });

  // Handle BPM input change
  const handleBpmChange = useCallback((value: number) => {
    if (bpmMode === 'locked') {
      setLockedBpm(value);
    }
    setBpm(value);
  }, [bpmMode, setLockedBpm, setBpm]);

  // Handle tap tempo
  const handleTap = useCallback(() => {
    tap();
  }, [tap]);

  // Toggle metronome on/off
  const handleToggle = useCallback(() => {
    setEnabled(!enabled);
    if (!enabled) {
      start();
    } else {
      stop();
    }
  }, [enabled, setEnabled, start, stop]);

  // Handle mode change
  const handleModeChange = useCallback((mode: BpmMode) => {
    setBpmMode(mode);
    setShowModeDropdown(false);
  }, [setBpmMode]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowModeDropdown(false);
      setShowSettings(false);
    };

    if (showModeDropdown || showSettings) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showModeDropdown, showSettings]);

  const ModeIcon = BPM_MODE_LABELS[bpmMode].icon;

  // Beat visualization dots
  const beatDots = Array.from({ length: beatsPerBar }, (_, i) => (
    <div
      key={i}
      className={cn(
        'w-2 h-2 rounded-full transition-all duration-75',
        currentBeat === i + 1
          ? i === 0
            ? 'bg-orange-500 scale-125'
            : 'bg-emerald-500 scale-125'
          : 'bg-zinc-600'
      )}
    />
  ));

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Compact metronome toggle */}
        <Tooltip content={enabled ? 'Stop metronome' : 'Start metronome'}>
          <button
            onClick={handleToggle}
            className={cn(
              'p-2 rounded-lg transition-all',
              enabled
                ? 'bg-orange-500/20 text-orange-500'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            )}
          >
            <Timer className="w-4 h-4" />
          </button>
        </Tooltip>

        {/* BPM display */}
        {enabled && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
            <span className="text-sm font-semibold text-white">
              {Math.round(effectiveBpm)}
            </span>
            <span className="text-xs text-zinc-400">BPM</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3 p-3 rounded-xl bg-white/5', className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-white">Metronome</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Broadcast toggle */}
          <Tooltip content={broadcastEnabled ? 'Broadcasting to room' : 'Enable WebRTC broadcast'}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setBroadcastEnabled(!broadcastEnabled);
              }}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                broadcastEnabled
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
              )}
            >
              {broadcastEnabled ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>

          {/* Settings toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
            }}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              showSettings
                ? 'bg-white/10 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            )}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <button
          onClick={handleToggle}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-all',
            enabled
              ? 'bg-orange-500 text-white'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          )}
        >
          {enabled ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        {/* BPM display/input */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={Math.round(effectiveBpm)}
              onChange={(e) => handleBpmChange(parseInt(e.target.value) || 120)}
              disabled={bpmMode === 'follow-analyzer'}
              className={cn(
                'w-16 px-2 py-1 text-xl font-bold bg-transparent border-none outline-none text-center',
                bpmMode === 'follow-analyzer'
                  ? 'text-indigo-400'
                  : 'text-white'
              )}
              min={40}
              max={240}
            />
            <span className="text-sm text-zinc-400">BPM</span>

            {/* Mode indicator */}
            {bpmMode === 'follow-analyzer' && analyzerBpm && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span className="text-xs text-indigo-400">Following</span>
              </div>
            )}
          </div>

          {/* Beat visualization */}
          <div className="flex items-center gap-1">
            {beatDots}
          </div>
        </div>

        {/* Tap tempo button (when in tap mode) */}
        {bpmMode === 'tap-tempo' && (
          <button
            onClick={handleTap}
            className="px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all font-medium text-sm"
          >
            TAP
          </button>
        )}
      </div>

      {/* BPM Mode selector */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModeDropdown(!showModeDropdown);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-2">
            <ModeIcon className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-white">{BPM_MODE_LABELS[bpmMode].label}</span>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-zinc-400 transition-transform',
            showModeDropdown && 'rotate-180'
          )} />
        </button>

        {/* Mode dropdown */}
        {showModeDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg bg-zinc-800 border border-white/10 shadow-xl z-50">
            {(Object.keys(BPM_MODE_LABELS) as BpmMode[]).map((mode) => {
              const { label, description, icon: Icon } = BPM_MODE_LABELS[mode];
              return (
                <button
                  key={mode}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleModeChange(mode);
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2 hover:bg-white/5 transition-all',
                    bpmMode === mode && 'bg-white/5'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4 mt-0.5',
                    bpmMode === mode ? 'text-orange-400' : 'text-zinc-400'
                  )} />
                  <div className="flex flex-col items-start">
                    <span className={cn(
                      'text-sm font-medium',
                      bpmMode === mode ? 'text-orange-400' : 'text-white'
                    )}>
                      {label}
                    </span>
                    <span className="text-xs text-zinc-500">{description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
          {/* Volume slider */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-zinc-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-orange-500"
            />
            <span className="text-xs text-zinc-400 w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Time signature */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-16">Time Sig</span>
            <select
              value={beatsPerBar}
              onChange={(e) => setBeatsPerBar(parseInt(e.target.value))}
              className="flex-1 px-2 py-1 rounded bg-white/5 text-white text-sm border border-white/10 outline-none"
            >
              {[2, 3, 4, 5, 6, 7, 8].map((beats) => (
                <option key={beats} value={beats}>
                  {beats}/4
                </option>
              ))}
            </select>
          </div>

          {/* Click type */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-16">Sound</span>
            <select
              value={clickType}
              onChange={(e) => setClickType(e.target.value as typeof clickType)}
              className="flex-1 px-2 py-1 rounded bg-white/5 text-white text-sm border border-white/10 outline-none"
            >
              {CLICK_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Accent first beat */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accentFirstBeat}
              onChange={(e) => setAccentFirstBeat(e.target.checked)}
              className="w-4 h-4 rounded bg-white/5 border-white/20 text-orange-500 focus:ring-orange-500/50"
            />
            <span className="text-sm text-zinc-300">Accent first beat</span>
          </label>

          {/* Broadcast info */}
          {broadcastEnabled && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Wifi className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-indigo-300">
                Metronome clicks are being broadcast to all room members
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline metronome for transport bar
 */
export function MetronomeInline({
  audioContext,
  masterGain,
  className,
}: {
  audioContext: AudioContext | null;
  masterGain?: AudioNode | null;
  className?: string;
}) {
  const { enabled, currentBeat, beatsPerBar, setEnabled } = useMetronomeStore();

  const {
    effectiveBpm,
    start,
    stop,
  } = useMetronome({
    audioContext,
    masterGain,
  });

  const handleToggle = useCallback(() => {
    setEnabled(!enabled);
    if (!enabled) {
      start();
    } else {
      stop();
    }
  }, [enabled, setEnabled, start, stop]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip content={enabled ? 'Stop metronome' : 'Start metronome'}>
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all',
            enabled
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 hover:text-white'
          )}
        >
          <Timer className="w-3.5 h-3.5" />
          <span className="text-sm font-medium">{Math.round(effectiveBpm)}</span>

          {/* Mini beat indicator */}
          {enabled && (
            <div className="flex items-center gap-0.5 ml-1">
              {Array.from({ length: Math.min(beatsPerBar, 4) }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1 h-1 rounded-full transition-all duration-75',
                    currentBeat === i + 1
                      ? i === 0
                        ? 'bg-orange-400'
                        : 'bg-emerald-400'
                      : 'bg-zinc-600'
                  )}
                />
              ))}
            </div>
          )}
        </button>
      </Tooltip>
    </div>
  );
}
