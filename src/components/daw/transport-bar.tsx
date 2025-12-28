'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn, formatLatency } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { Tooltip } from '@/components/ui/tooltip';
import { useRoomStore } from '@/stores/room-store';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useSongsStore } from '@/stores/songs-store';
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
} from 'lucide-react';
import { MetronomeInline } from '@/components/daw/metronome-controls';
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
  audioContext?: AudioContext | null;
  masterGain?: AudioNode | null;
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
}: TransportBarProps) {
  const [copied, setCopied] = useState(false);

  const { isPlaying, currentTime, duration, isMuted, jitterStats, webrtcStats, connectionQuality, currentBufferSize, performanceMetrics, settings } = useAudioStore();
  const { currentTrack, isMaster, currentUser } = useRoomStore();
  const { syncedAnalysis, localAnalysis } = useAnalysisStore();
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

        {/* Connection Status with Performance Tooltip */}
        <Tooltip
          position="bottom"
          delay={0}
          className="w-64 whitespace-normal p-0"
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
            'flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-default transition-colors',
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

      {/* Right Section - Analysis & Controls */}
      <div className="flex items-center gap-3">
        {/* Metronome */}
        {audioContext && (
          <MetronomeInline
            audioContext={audioContext}
            masterGain={masterGain}
          />
        )}

        {/* BPM Badge (shows detected BPM when metronome not active) */}
        {displayBPM && !audioContext && (
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
