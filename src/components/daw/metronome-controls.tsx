'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useMetronomeStore } from '@/stores/metronome-store';
import { useSessionTempoStore, type TempoSource, selectTempo, selectTimeSignature, selectSource } from '@/stores/session-tempo-store';
import { useMetronome } from '@/hooks/use-metronome';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Timer,
  Play,
  Pause,
  Lock,
  Activity,
  Hand,
  Music2,
  ChevronDown,
  Volume2,
  Wifi,
  Settings,
} from 'lucide-react';

interface MetronomeControlsProps {
  audioContext: AudioContext | null;
  masterGain?: AudioNode | null;
  onBroadcastStreamReady?: (stream: MediaStream) => void;
  className?: string;
  compact?: boolean;
}

const TEMPO_SOURCE_LABELS: Record<TempoSource, { label: string; description: string; icon: typeof Lock }> = {
  'manual': {
    label: 'Manual',
    description: 'Set tempo manually',
    icon: Lock,
  },
  'track': {
    label: 'Track',
    description: 'Use backing track BPM',
    icon: Music2,
  },
  'analyzer': {
    label: 'Auto-Detect',
    description: 'Real-time BPM detection',
    icon: Activity,
  },
  'tap': {
    label: 'Tap Tempo',
    description: 'Tap to set tempo',
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

  // Metronome settings store
  const {
    enabled,
    volume,
    clickType,
    accentFirstBeat,
    broadcastEnabled,
    currentBeat,
    setEnabled,
    setVolume,
    setClickType,
    setAccentFirstBeat,
    setBroadcastEnabled,
  } = useMetronomeStore();

  // Session tempo store
  const tempo = useSessionTempoStore(selectTempo);
  const source = useSessionTempoStore(selectSource);
  const { beatsPerBar } = useSessionTempoStore(selectTimeSignature);
  const trackTempo = useSessionTempoStore((s) => s.trackTempo);
  const analyzerTempo = useSessionTempoStore((s) => s.analyzerTempo);
  const setSource = useSessionTempoStore((s) => s.setSource);
  const setManualTempo = useSessionTempoStore((s) => s.setManualTempo);
  const setTimeSignature = useSessionTempoStore((s) => s.setTimeSignature);
  const recordTap = useSessionTempoStore((s) => s.recordTap);

  // Metronome hook
  const {
    start,
    stop,
    tap,
  } = useMetronome({
    audioContext,
    masterGain,
    onBroadcastStreamReady,
  });

  // Handle tempo input change
  const handleTempoChange = useCallback((value: number) => {
    if (source === 'manual' || source === 'tap') {
      setManualTempo(value);
    }
  }, [source, setManualTempo]);

  // Handle tap tempo
  const handleTap = useCallback(() => {
    recordTap();
    tap();
  }, [recordTap, tap]);

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
  const handleSourceChange = useCallback((newSource: TempoSource) => {
    setSource(newSource);
    setShowModeDropdown(false);
  }, [setSource]);

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

  const SourceIcon = TEMPO_SOURCE_LABELS[source].icon;

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
              {Math.round(tempo)}
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
              <Wifi className="w-3.5 h-3.5" />
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
              value={Math.round(tempo)}
              onChange={(e) => handleTempoChange(parseInt(e.target.value) || 120)}
              disabled={source === 'analyzer' || source === 'track'}
              className={cn(
                'w-16 px-2 py-1 text-xl font-bold bg-transparent border-none outline-none text-center',
                (source === 'analyzer' || source === 'track')
                  ? 'text-indigo-400'
                  : 'text-white'
              )}
              min={40}
              max={240}
            />
            <span className="text-sm text-zinc-400">BPM</span>

            {/* Source indicator */}
            {source === 'analyzer' && analyzerTempo && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span className="text-xs text-indigo-400">Auto</span>
              </div>
            )}
            {source === 'track' && trackTempo && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20">
                <Music2 className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">Track</span>
              </div>
            )}
          </div>

          {/* Beat visualization */}
          <div className="flex items-center gap-1">
            {beatDots}
          </div>
        </div>

        {/* Tap tempo button (when in tap mode) */}
        {source === 'tap' && (
          <button
            onClick={handleTap}
            className="px-3 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all font-medium text-sm"
          >
            TAP
          </button>
        )}
      </div>

      {/* Tempo Source selector */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModeDropdown(!showModeDropdown);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-2">
            <SourceIcon className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-white">{TEMPO_SOURCE_LABELS[source].label}</span>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-zinc-400 transition-transform',
            showModeDropdown && 'rotate-180'
          )} />
        </button>

        {/* Source dropdown */}
        {showModeDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg bg-zinc-800 border border-white/10 shadow-xl z-50">
            {(Object.keys(TEMPO_SOURCE_LABELS) as TempoSource[]).map((src) => {
              const { label, description, icon: Icon } = TEMPO_SOURCE_LABELS[src];
              const isDisabled = (src === 'track' && !trackTempo) || (src === 'analyzer' && !analyzerTempo);

              return (
                <button
                  key={src}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) {
                      handleSourceChange(src);
                    }
                  }}
                  disabled={isDisabled}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2 transition-all',
                    source === src && 'bg-white/5',
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-white/5'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4 mt-0.5',
                    source === src ? 'text-orange-400' : 'text-zinc-400'
                  )} />
                  <div className="flex flex-col items-start">
                    <span className={cn(
                      'text-sm font-medium',
                      source === src ? 'text-orange-400' : 'text-white'
                    )}>
                      {label}
                      {src === 'track' && trackTempo && (
                        <span className="ml-1 text-zinc-500">({trackTempo} BPM)</span>
                      )}
                      {src === 'analyzer' && analyzerTempo && (
                        <span className="ml-1 text-zinc-500">({Math.round(analyzerTempo)} BPM)</span>
                      )}
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
              onChange={(e) => setTimeSignature(parseInt(e.target.value), 4)}
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
 * Compact inline metronome for transport bar with expandable settings
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
  const [showPopover, setShowPopover] = useState(false);

  // Metronome settings store
  const {
    enabled,
    currentBeat,
    volume,
    clickType,
    accentFirstBeat,
    broadcastEnabled,
    setEnabled,
    setVolume,
    setClickType,
    setAccentFirstBeat,
    setBroadcastEnabled,
  } = useMetronomeStore();

  // Session tempo store
  const tempo = useSessionTempoStore(selectTempo);
  const source = useSessionTempoStore(selectSource);
  const { beatsPerBar } = useSessionTempoStore(selectTimeSignature);
  const trackTempo = useSessionTempoStore((s) => s.trackTempo);
  const analyzerTempo = useSessionTempoStore((s) => s.analyzerTempo);
  const setSource = useSessionTempoStore((s) => s.setSource);
  const setManualTempo = useSessionTempoStore((s) => s.setManualTempo);
  const setTimeSignature = useSessionTempoStore((s) => s.setTimeSignature);
  const recordTap = useSessionTempoStore((s) => s.recordTap);

  // Metronome hook
  const {
    start,
    stop,
    tap,
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

  const handleTempoChange = useCallback((value: number) => {
    if (source === 'manual' || source === 'tap') {
      setManualTempo(value);
    }
  }, [source, setManualTempo]);

  const handleSourceChange = useCallback((newSource: TempoSource) => {
    setSource(newSource);
  }, [setSource]);

  const handleTap = useCallback(() => {
    recordTap();
    tap();
  }, [recordTap, tap]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.metronome-popover-container')) {
        setShowPopover(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showPopover]);

  return (
    <div className={cn('relative metronome-popover-container', className)}>
      <div className="flex items-center gap-1">
        {/* Main toggle button */}
        <Tooltip content={enabled ? 'Stop metronome' : 'Start metronome'}>
          <button
            onClick={handleToggle}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-l-lg transition-all',
              enabled
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 border-r-0'
                : 'bg-white/5 text-zinc-400 border border-white/10 border-r-0 hover:bg-white/10 hover:text-white'
            )}
          >
            <Timer className="w-3.5 h-3.5" />
            <span className="text-sm font-medium">{Math.round(tempo)}</span>

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

        {/* Settings button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPopover(!showPopover);
          }}
          className={cn(
            'p-1.5 rounded-r-lg transition-all',
            enabled
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 border-l-0'
              : 'bg-white/5 text-zinc-400 border border-white/10 border-l-0 hover:bg-white/10 hover:text-white',
            showPopover && 'bg-white/10'
          )}
        >
          <ChevronDown className={cn(
            'w-3 h-3 transition-transform',
            showPopover && 'rotate-180'
          )} />
        </button>
      </div>

      {/* Popover */}
      {showPopover && (
        <div className="absolute top-full right-0 mt-2 w-72 p-3 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-50">
          {/* BPM Input */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">BPM</label>
              <input
                type="number"
                value={Math.round(tempo)}
                onChange={(e) => handleTempoChange(parseInt(e.target.value) || 120)}
                disabled={source === 'analyzer' || source === 'track'}
                className={cn(
                  'w-full px-3 py-2 text-lg font-bold rounded-lg bg-white/5 border border-white/10 outline-none',
                  (source === 'analyzer' || source === 'track')
                    ? 'text-indigo-400 cursor-not-allowed'
                    : 'text-white focus:border-orange-500/50'
                )}
                min={40}
                max={240}
              />
            </div>

            {/* Tap tempo button */}
            {source === 'tap' && (
              <button
                onClick={handleTap}
                className="px-4 py-2 mt-5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all font-bold text-sm"
              >
                TAP
              </button>
            )}
          </div>

          {/* Tempo Source */}
          <div className="mb-3">
            <label className="text-xs text-zinc-500 mb-1.5 block">Tempo Source</label>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(TEMPO_SOURCE_LABELS) as TempoSource[]).map((src) => {
                const { label, icon: Icon } = TEMPO_SOURCE_LABELS[src];
                const isDisabled = (src === 'track' && !trackTempo) || (src === 'analyzer' && !analyzerTempo);

                return (
                  <button
                    key={src}
                    onClick={() => !isDisabled && handleSourceChange(src)}
                    disabled={isDisabled}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg transition-all',
                      source === src
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-white/5 text-zinc-400 border border-white/10',
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
            {source === 'analyzer' && analyzerTempo && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded bg-indigo-500/10">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span className="text-xs text-indigo-400">
                  Detected: {Math.round(analyzerTempo)} BPM
                </span>
              </div>
            )}
            {source === 'track' && trackTempo && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded bg-emerald-500/10">
                <Music2 className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">
                  Track: {trackTempo} BPM
                </span>
              </div>
            )}
          </div>

          <div className="h-px bg-white/10 my-3" />

          {/* Time signature */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-zinc-500 w-20">Time Sig</span>
            <select
              value={beatsPerBar}
              onChange={(e) => setTimeSignature(parseInt(e.target.value), 4)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 text-white text-sm border border-white/10 outline-none"
            >
              {[2, 3, 4, 5, 6, 7, 8].map((beats) => (
                <option key={beats} value={beats}>
                  {beats}/4
                </option>
              ))}
            </select>
          </div>

          {/* Click sound */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-zinc-500 w-20">Sound</span>
            <select
              value={clickType}
              onChange={(e) => setClickType(e.target.value as typeof clickType)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 text-white text-sm border border-white/10 outline-none"
            >
              {CLICK_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-zinc-500 w-20">Volume</span>
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

          {/* Accent & Broadcast */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={accentFirstBeat}
                onChange={(e) => setAccentFirstBeat(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-white/5 border-white/20 text-orange-500"
              />
              <span className="text-xs text-zinc-300">Accent 1st beat</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastEnabled}
                onChange={(e) => setBroadcastEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-white/5 border-white/20 text-indigo-500"
              />
              <span className="text-xs text-zinc-300">Broadcast</span>
              {broadcastEnabled && <Wifi className="w-3 h-3 text-indigo-400" />}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
