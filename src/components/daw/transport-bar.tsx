'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { cn, formatLatency } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { Tooltip } from '@/components/ui/tooltip';
import { useRoomStore } from '@/stores/room-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useSongsStore } from '@/stores/songs-store';
import { useSessionTempoStore, selectTempo, selectKey, selectSource, type TempoSource } from '@/stores/session-tempo-store';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Mic,
  MicOff,
  Settings,
  LogOut,
  Copy,
  Check,
  Music,
  Wifi,
  WifiOff,
  Zap,
  Timer,
  Activity,
  Lock,
  Music2,
  Hand,
  ChevronDown,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { MetronomeInline } from '@/components/daw/metronome-controls';
import { UserMenu } from '@/components/auth/UserMenu';
import { MainViewSwitcher, type MainViewType } from './main-view-switcher';

// =============================================================================
// BPM Badge Component - Inline editable with mode switching
// =============================================================================
function BpmBadge() {
  const [isEditing, setIsEditing] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tempo = useSessionTempoStore(selectTempo);
  const source = useSessionTempoStore(selectSource);
  const trackTempo = useSessionTempoStore((s) => s.trackTempo);
  const analyzerTempo = useSessionTempoStore((s) => s.analyzerTempo);
  const setSource = useSessionTempoStore((s) => s.setSource);
  const setManualTempo = useSessionTempoStore((s) => s.setManualTempo);

  const sourceConfig: Record<TempoSource, { icon: typeof Lock; label: string; color: string }> = {
    manual: { icon: Lock, label: 'Manual', color: 'text-gray-400 dark:text-zinc-500' },
    track: { icon: Music2, label: 'Track', color: 'text-emerald-500 dark:text-emerald-400' },
    analyzer: { icon: Activity, label: 'Auto', color: 'text-indigo-500 dark:text-indigo-400' },
    tap: { icon: Hand, label: 'Tap', color: 'text-orange-500 dark:text-orange-400' },
  };

  const SourceIcon = sourceConfig[source].icon;

  // Close menus on outside click
  useEffect(() => {
    if (!showModeMenu && !isEditing) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
        setIsEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModeMenu, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleValueClick = () => {
    if (source === 'manual' || source === 'tap') {
      setEditValue(Math.round(tempo).toString());
      setIsEditing(true);
    }
  };

  const handleSubmit = () => {
    const value = parseInt(editValue);
    if (!isNaN(value) && value >= 40 && value <= 240) {
      setManualTempo(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleSourceSelect = (newSource: TempoSource) => {
    setSource(newSource);
    setShowModeMenu(false);
  };

  // Get hint text for unavailable sources
  const getSourceHint = (s: TempoSource): string | null => {
    if (s === 'track' && !trackTempo) return 'Load a track with BPM metadata';
    if (s === 'analyzer' && !analyzerTempo) return 'Play audio to detect BPM';
    return null;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-stretch">
        {/* Source icon - clickable to show mode dropdown */}
        <Tooltip content={`Tempo source: ${sourceConfig[source].label}`} position="bottom">
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            className={cn(
              'px-2 h-8 flex items-center rounded-l-lg border border-r-0 transition-all',
              'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5',
              'hover:bg-gray-200 dark:hover:bg-white/10',
              showModeMenu && 'bg-gray-200 dark:bg-white/10'
            )}
          >
            <SourceIcon className={cn('w-4 h-4 transition-colors', sourceConfig[source].color)} />
          </button>
        </Tooltip>

        {/* Value display/input */}
        <Tooltip
          content={source === 'track' || source === 'analyzer'
            ? `${sourceConfig[source].label} mode - click icon to change source`
            : 'Click to edit BPM'
          }
          position="bottom"
        >
          <div
            onClick={handleValueClick}
            className={cn(
              'flex items-center gap-1.5 px-2 h-8 rounded-r-lg border border-l-0 transition-all cursor-pointer',
              'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5',
              'hover:bg-gray-200 dark:hover:bg-white/10'
            )}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSubmit}
                onKeyDown={handleKeyDown}
                className="w-10 bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none text-center"
                min={40}
                max={240}
              />
            ) : (
              <span className={cn(
                'text-sm font-semibold',
                source === 'analyzer' ? 'text-indigo-600 dark:text-indigo-400' :
                source === 'track' ? 'text-emerald-600 dark:text-emerald-400' :
                'text-gray-900 dark:text-white'
              )}>
                {Math.round(tempo)}
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-zinc-400">BPM</span>
          </div>
        </Tooltip>
      </div>

      {/* Mode dropdown */}
      {showModeMenu && (
        <div className="absolute top-full left-0 mt-1 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 shadow-xl z-50 min-w-[180px]">
          {(Object.keys(sourceConfig) as TempoSource[]).map((s) => {
            const { icon: Icon, label, color } = sourceConfig[s];
            const hint = getSourceHint(s);
            const isActive = source === s;
            return (
              <button
                key={s}
                onClick={() => handleSourceSelect(s)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all',
                  isActive && 'bg-gray-100 dark:bg-white/10',
                  'hover:bg-gray-50 dark:hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? color : 'text-gray-400 dark:text-zinc-500')} />
                <div className="flex-1 flex flex-col">
                  <span className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-zinc-400'
                  )}>
                    {label}
                  </span>
                  {hint && (
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500">{hint}</span>
                  )}
                </div>
                {s === 'track' && trackTempo && (
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">{trackTempo}</span>
                )}
                {s === 'analyzer' && analyzerTempo && (
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">{Math.round(analyzerTempo)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Key Badge Component - Inline editable with mode switching
// =============================================================================
function KeyBadge() {
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showKeyMenu, setShowKeyMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { key: sessionKey, scale: sessionKeyScale } = useSessionTempoStore(useShallow(selectKey));
  const keySource = useSessionTempoStore((s) => s.keySource);
  const trackKey = useSessionTempoStore((s) => s.trackKey);
  const analyzerKey = useSessionTempoStore((s) => s.analyzerKey);
  const setKeySource = useSessionTempoStore((s) => s.setKeySource);
  const setManualKey = useSessionTempoStore((s) => s.setManualKey);

  type KeySource = 'manual' | 'track' | 'analyzer';
  const sourceConfig: Record<KeySource, { icon: typeof Lock; label: string; color: string }> = {
    manual: { icon: Lock, label: 'Manual', color: 'text-gray-400 dark:text-zinc-500' },
    track: { icon: Music2, label: 'Track', color: 'text-emerald-500 dark:text-emerald-400' },
    analyzer: { icon: Activity, label: 'Auto', color: 'text-indigo-500 dark:text-indigo-400' },
  };

  const SourceIcon = sourceConfig[keySource].icon;

  const keyColors: Record<string, string> = {
    'C': 'bg-red-500',
    'C#': 'bg-red-600', 'Db': 'bg-red-600',
    'D': 'bg-orange-500',
    'D#': 'bg-orange-600', 'Eb': 'bg-orange-600',
    'E': 'bg-yellow-500',
    'F': 'bg-lime-500',
    'F#': 'bg-green-500', 'Gb': 'bg-green-500',
    'G': 'bg-emerald-500',
    'G#': 'bg-teal-500', 'Ab': 'bg-teal-500',
    'A': 'bg-cyan-500',
    'A#': 'bg-blue-500', 'Bb': 'bg-blue-500',
    'B': 'bg-purple-500',
  };

  const allKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyColor = sessionKey ? keyColors[sessionKey] || 'bg-zinc-500' : 'bg-zinc-600';

  // Close menus on outside click
  useEffect(() => {
    if (!showModeMenu && !showKeyMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
        setShowKeyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModeMenu, showKeyMenu]);

  const handleSourceSelect = (newSource: KeySource) => {
    setKeySource(newSource);
    setShowModeMenu(false);
  };

  const handleKeySelect = (key: string, scale: 'major' | 'minor') => {
    setManualKey(key, scale);
    setShowKeyMenu(false);
  };

  // Get hint text for unavailable sources
  const getSourceHint = (s: KeySource): string | null => {
    if (s === 'track' && !trackKey) return 'Load a track with key metadata';
    if (s === 'analyzer' && !analyzerKey) return 'Play audio to detect key';
    return null;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-stretch">
        {/* Source icon - clickable to show mode dropdown */}
        <Tooltip content={`Key source: ${sourceConfig[keySource].label}`} position="bottom">
          <button
            onClick={() => { setShowModeMenu(!showModeMenu); setShowKeyMenu(false); }}
            className={cn(
              'px-2 h-8 flex items-center rounded-l-lg border border-r-0 transition-all',
              'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5',
              'hover:bg-gray-200 dark:hover:bg-white/10',
              showModeMenu && 'bg-gray-200 dark:bg-white/10'
            )}
          >
            <SourceIcon className={cn('w-4 h-4 transition-colors', sourceConfig[keySource].color)} />
          </button>
        </Tooltip>

        {/* Value display - clickable to open key picker */}
        <Tooltip
          content={keySource === 'manual'
            ? 'Click to change key'
            : `${sourceConfig[keySource].label} mode - click icon to change source`
          }
          position="bottom"
        >
          <button
            onClick={() => {
              setShowKeyMenu(!showKeyMenu);
              setShowModeMenu(false);
            }}
            className={cn(
              'flex items-center gap-1.5 px-2 h-8 rounded-r-lg border border-l-0 transition-all',
              'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5',
              'hover:bg-gray-200 dark:hover:bg-white/10'
            )}
          >
            {sessionKey ? (
              <>
                <div className={cn('w-2.5 h-2.5 rounded-full', keyColor)} />
                <span className={cn(
                  'text-sm font-semibold',
                  keySource === 'analyzer' ? 'text-indigo-600 dark:text-indigo-400' :
                  keySource === 'track' ? 'text-emerald-600 dark:text-emerald-400' :
                  'text-gray-900 dark:text-white'
                )}>
                  {sessionKey}
                  <span className="text-gray-500 dark:text-zinc-400">{sessionKeyScale === 'minor' ? 'm' : ''}</span>
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400 dark:text-zinc-500">Key</span>
            )}
            <ChevronDown className={cn(
              'w-3 h-3 text-gray-400 dark:text-zinc-500 transition-transform',
              showKeyMenu && 'rotate-180'
            )} />
          </button>
        </Tooltip>
      </div>

      {/* Mode dropdown */}
      {showModeMenu && (
        <div className="absolute top-full left-0 mt-1 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 shadow-xl z-50 min-w-[180px]">
          {(Object.keys(sourceConfig) as KeySource[]).map((s) => {
            const { icon: Icon, label, color } = sourceConfig[s];
            const hint = getSourceHint(s);
            const isActive = keySource === s;
            return (
              <button
                key={s}
                onClick={() => handleSourceSelect(s)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all',
                  isActive && 'bg-gray-100 dark:bg-white/10',
                  'hover:bg-gray-50 dark:hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? color : 'text-gray-400 dark:text-zinc-500')} />
                <div className="flex-1 flex flex-col">
                  <span className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-zinc-400'
                  )}>
                    {label}
                  </span>
                  {hint && (
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500">{hint}</span>
                  )}
                </div>
                {s === 'track' && trackKey && (
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">{trackKey}</span>
                )}
                {s === 'analyzer' && analyzerKey && (
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">{analyzerKey}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Key picker dropdown */}
      {showKeyMenu && (
        <div className="absolute top-full right-0 mt-1 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 shadow-xl z-50 min-w-[180px]">
          <div className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-2 px-1">Major</div>
          <div className="grid grid-cols-4 gap-1 mb-2">
            {allKeys.map((k) => (
              <button
                key={`${k}-major`}
                onClick={() => handleKeySelect(k, 'major')}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-all',
                  sessionKey === k && sessionKeyScale === 'major'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10'
                )}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-2 px-1">Minor</div>
          <div className="grid grid-cols-4 gap-1">
            {allKeys.map((k) => (
              <button
                key={`${k}-minor`}
                onClick={() => handleKeySelect(k, 'minor')}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-all',
                  sessionKey === k && sessionKeyScale === 'minor'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10'
                )}
              >
                {k}m
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TransportBarProps {
  roomId: string;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onMuteToggle: () => void;
  onSettingsClick: () => void;
  onLeave: () => void;
  loopEnabled: boolean;
  onLoopToggle: () => void;
  audioContext?: AudioContext | null;
  masterGain?: AudioNode | null;
  // View switcher props
  activeView?: MainViewType;
  onViewChange?: (view: MainViewType) => void;
}

export function TransportBar({
  roomId,
  onPlay,
  onPause,
  onSeek,
  onPrevious,
  onNext,
  onMuteToggle,
  onSettingsClick,
  onLeave,
  loopEnabled,
  onLoopToggle,
  audioContext,
  masterGain,
  activeView,
  onViewChange,
}: TransportBarProps) {
  const [copied, setCopied] = useState(false);

  const { isPlaying, currentTime, duration, isMuted, jitterStats, webrtcStats, connectionQuality, currentBufferSize, performanceMetrics, settings } = useAudioStore();
  const { currentTrack, isMaster, currentUser } = useRoomStore();
  const getTracksByUser = useUserTracksStore((s) => s.getTracksByUser);
  const currentSong = useSongsStore((s) => s.getCurrentSong());

  // Check if there's something to play - either legacy queue track or song with tracks
  const hasPlayableContent = currentTrack || (currentSong && currentSong.tracks.length > 0);

  // Get the buffer size from the user's track settings (not global settings)
  const userBufferSize = useMemo(() => {
    if (!currentUser) return settings.bufferSize;
    const userTracks = getTracksByUser(currentUser.id);
    if (userTracks.length === 0) return settings.bufferSize;
    // Use the first audio track's buffer setting
    const audioTrack = userTracks.find((t) => t.type !== 'midi');
    return audioTrack?.audioSettings.bufferSize ?? settings.bufferSize;
  }, [currentUser, getTracksByUser, settings.bufferSize]);

  const handleCopyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  const formatTimeDetailed = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatTimeDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="h-14 bg-white dark:bg-[#12121a] border-b border-gray-200 dark:border-white/5 flex items-center px-4 gap-4 z-40 shrink-0">
      {/* Logo & Room */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Music className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-base font-semibold text-gray-900 dark:text-white hidden sm:block">OpenStudio</span>
        </div>

        <div className="h-5 w-px bg-gray-200 dark:bg-white/10" />

        <button
          onClick={handleCopyRoomId}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-colors group"
        >
          <span className="text-[10px] text-gray-500 dark:text-zinc-400">Room</span>
          <span className="text-xs font-mono font-medium text-gray-900 dark:text-white">{roomId}</span>
          {copied ? (
            <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors" />
          )}
        </button>

        {/* Connection Status with Performance Tooltip */}
        <Tooltip
          position="bottom"
          delay={0}
          className="w-64 whitespace-normal p-0 z-[100]"
          content={
            <div className="p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Connection</span>
                <span className={cn(
                  'text-xs font-medium capitalize',
                  connectionQuality === 'excellent' && 'text-emerald-400',
                  connectionQuality === 'good' && 'text-emerald-400',
                  connectionQuality === 'fair' && 'text-yellow-400',
                  connectionQuality === 'poor' && 'text-red-400'
                )}>
                  {connectionQuality}
                </span>
              </div>
              <div className="h-px bg-white/10" />

              {/* Audio Processing Performance */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Audio Latency</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Buffer Setting</span>
                  <span className="text-xs font-medium text-white">
                    {userBufferSize} samples ({((userBufferSize / settings.sampleRate) * 1000).toFixed(1)}ms)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">System Latency</span>
                  <span className="text-xs font-medium text-white">
                    {performanceMetrics.audioContextLatency.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Output</span>
                  <span className="text-xs font-medium text-white">
                    {performanceMetrics.outputLatency.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Effects</span>
                  <span className="text-xs font-medium text-white">
                    {performanceMetrics.effectsProcessingTime.toFixed(2)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Total</span>
                  <span className={cn(
                    'text-xs font-medium',
                    performanceMetrics.totalLatency < 10 && 'text-emerald-400',
                    performanceMetrics.totalLatency >= 10 && performanceMetrics.totalLatency < 20 && 'text-yellow-400',
                    performanceMetrics.totalLatency >= 20 && 'text-orange-400'
                  )}>
                    {performanceMetrics.totalLatency.toFixed(1)}ms
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              {/* Network Stats */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">Network</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">RTT</span>
                  <span className="text-xs font-medium text-white">
                    {formatLatency(webrtcStats?.roundTripTime ?? jitterStats.roundTripTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Jitter</span>
                  <span className="text-xs font-medium text-white">
                    {formatLatency(jitterStats.averageJitter)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Packet Loss</span>
                  <span className={cn(
                    'text-xs font-medium',
                    jitterStats.packetLoss < 0.01 && 'text-emerald-400',
                    jitterStats.packetLoss >= 0.01 && jitterStats.packetLoss < 0.05 && 'text-yellow-400',
                    jitterStats.packetLoss >= 0.05 && 'text-red-400'
                  )}>
                    {(jitterStats.packetLoss * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          }
        >
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg cursor-default transition-colors',
            connectionQuality === 'excellent' && 'bg-emerald-500/10',
            connectionQuality === 'good' && 'bg-emerald-500/10',
            connectionQuality === 'fair' && 'bg-yellow-500/10',
            connectionQuality === 'poor' && 'bg-red-500/10'
          )}>
            <Zap className={cn(
              'w-3.5 h-3.5',
              connectionQuality === 'excellent' && 'text-emerald-500 dark:text-emerald-400',
              connectionQuality === 'good' && 'text-emerald-500 dark:text-emerald-400',
              connectionQuality === 'fair' && 'text-yellow-500 dark:text-yellow-400',
              connectionQuality === 'poor' && 'text-red-500 dark:text-red-400'
            )} />
            <span className={cn(
              'text-xs font-medium',
              connectionQuality === 'excellent' && 'text-emerald-600 dark:text-emerald-400',
              connectionQuality === 'good' && 'text-emerald-600 dark:text-emerald-400',
              connectionQuality === 'fair' && 'text-yellow-600 dark:text-yellow-400',
              connectionQuality === 'poor' && 'text-red-600 dark:text-red-400'
            )}>
              {performanceMetrics.totalLatency > 0
                ? `${performanceMetrics.totalLatency.toFixed(1)}ms`
                : formatLatency(webrtcStats?.roundTripTime ?? jitterStats.roundTripTime)}
            </span>
          </div>
        </Tooltip>

        {/* View Switcher */}
        {activeView && onViewChange && (
          <MainViewSwitcher
            activeView={activeView}
            onViewChange={onViewChange}
            isMaster={isMaster}
          />
        )}
      </div>

      {/* Transport Controls - Center */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {/* Previous */}
        <button
          onClick={onPrevious}
          disabled={!isMaster}
          className={cn(
            'p-2 rounded-lg transition-all',
            isMaster
              ? 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
              : 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
          )}
        >
          <SkipBack className="w-5 h-5" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isMaster || !hasPlayableContent}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            isMaster && hasPlayableContent
              ? 'neon-button text-white'
              : 'bg-gray-200 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed'
          )}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={!isMaster}
          className={cn(
            'p-2 rounded-lg transition-all',
            isMaster
              ? 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
              : 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
          )}
        >
          <SkipForward className="w-5 h-5" />
        </button>

        {/* Loop */}
        <button
          onClick={onLoopToggle}
          className={cn(
            'p-2 rounded-lg transition-all ml-2',
            loopEnabled
              ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Time Display */}
        <div className="flex items-center gap-2 ml-4 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-black/30">
          <span className="time-display text-lg font-medium text-gray-900 dark:text-white">
            {formatTimeDetailed(duration > 0 ? Math.min(currentTime, duration) : currentTime)}
          </span>
          <span className="text-gray-400 dark:text-zinc-500">/</span>
          <span className="time-display text-sm text-gray-500 dark:text-zinc-400">
            {formatTimeDuration(duration)}
          </span>
        </div>
      </div>

      {/* Right Section - BPM, Key & Controls */}
      <div className="flex items-center gap-3">
        {/* Metronome (with full controls when audioContext available) */}
        {audioContext ? (
          <MetronomeInline
            audioContext={audioContext}
            masterGain={masterGain}
          />
        ) : (
          /* BPM Badge - Interactive with mode switching */
          <BpmBadge />
        )}

        {/* Key Badge - Interactive with mode switching and key picker */}
        <KeyBadge />

        <div className="h-5 w-px bg-gray-200 dark:bg-white/10" />

        {/* Mute Button */}
        <button
          onClick={onMuteToggle}
          className={cn(
            'p-2.5 rounded-lg transition-all',
            isMuted
              ? 'bg-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/30'
              : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="p-2.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="h-5 w-px bg-white/10" />

        {/* User Menu - force dark mode styling in DAW */}
        <div className="dark">
          <UserMenu />
        </div>

        {/* Leave */}
        <button
          onClick={onLeave}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:block">Leave</span>
        </button>
      </div>
    </header>
  );
}
