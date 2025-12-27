'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import { useAnalysisStore } from '@/stores/analysis-store';
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
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';

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
}: TransportBarProps) {
  const [copied, setCopied] = useState(false);

  const { isPlaying, currentTime, duration, isMuted } = useAudioStore();
  const { currentTrack, isMaster } = useRoomStore();
  const { syncedAnalysis, localAnalysis } = useAnalysisStore();

  const displayKey = syncedAnalysis?.key || localAnalysis?.key;
  const displayScale = syncedAnalysis?.keyScale || localAnalysis?.keyScale;
  const displayBPM = syncedAnalysis?.bpm || localAnalysis?.bpm;

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

  // Key color mapping
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

  const keyColor = displayKey ? keyColors[displayKey] || 'bg-zinc-500' : 'bg-zinc-600';

  return (
    <header className="h-14 bg-white dark:bg-[#12121a] border-b border-gray-200 dark:border-white/5 flex items-center px-4 gap-4 z-30 shrink-0">
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/5 transition-colors group"
        >
          <span className="text-xs text-gray-500 dark:text-zinc-400">Room</span>
          <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{roomId}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors" />
          )}
        </button>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10">
          <Zap className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">12ms</span>
        </div>
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
          disabled={!isMaster || !currentTrack}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-all',
            isMaster && currentTrack
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

      {/* Right Section - Analysis & Controls */}
      <div className="flex items-center gap-3">
        {/* BPM Badge */}
        {displayBPM && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{Math.round(displayBPM)}</span>
            <span className="text-xs text-gray-500 dark:text-zinc-400">BPM</span>
          </div>
        )}

        {/* Key Badge */}
        {displayKey && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5">
            <div className={cn('w-2.5 h-2.5 rounded-full', keyColor)} />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {displayKey}
              <span className="text-gray-500 dark:text-zinc-400">{displayScale === 'minor' ? 'm' : ''}</span>
            </span>
          </div>
        )}

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
