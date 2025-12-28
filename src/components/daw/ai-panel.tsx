'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Slider } from '../ui/slider';
import {
  Sparkles,
  Wand2,
  Loader2,
  ExternalLink,
  Layers,
  Play,
  Pause,
  Square,
  Wifi,
  WifiOff,
  Music,
  Volume2,
  Drum,
  Activity,
  Sun,
  Zap,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Progress } from '../ui/progress';
import {
  LyriaSession,
  createLyriaSession,
  LYRIA_STYLES,
  LYRIA_MOODS,
  buildPrompt,
  keyToLyriaScale,
  type LyriaStyleId,
  type LyriaMoodId,
} from '@/lib/ai/lyria';
import type { LyriaSessionState } from '@/types';

interface AIPanelProps {
  onSeparateTrack: () => void;
  isSeparating: boolean;
  separationProgress: number;
  roomId?: string;
}

export function AIPanel({
  onSeparateTrack,
  isSeparating,
  separationProgress,
  roomId,
}: AIPanelProps) {
  const { currentTrack, stemsAvailable, syncedAnalysis } = useRoomStore();

  // Lyria session
  const sessionRef = useRef<LyriaSession | null>(null);
  const [sessionState, setSessionState] = useState<LyriaSessionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedStyle, setSelectedStyle] = useState<LyriaStyleId>('jazz');
  const [selectedMood, setSelectedMood] = useState<LyriaMoodId | null>('chill');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Live control values
  const [volume, setVolume] = useState(0.7);
  const [density, setDensity] = useState(0.5);
  const [brightness, setBrightness] = useState(0.5);
  const [drums, setDrums] = useState(0.7);
  const [bass, setBass] = useState(0.7);
  const [temperature, setTemperature] = useState(0.5);

  // Sync with room BPM and key
  const roomBpm = syncedAnalysis?.bpm || 120;
  const roomKey = syncedAnalysis?.key || null;
  const roomKeyScale = syncedAnalysis?.keyScale || null;

  // Initialize session on mount
  useEffect(() => {
    const session = createLyriaSession();
    session.setCallbacks({
      onStateChange: (state) => {
        setSessionState(state);
        if (state === 'error') {
          setError('Connection lost. Click Connect to retry.');
        }
      },
      onError: (err) => {
        setError(err.message);
      },
      onConfigApplied: () => {
        setError(null);
      },
    });
    sessionRef.current = session;

    return () => {
      session.disconnect();
    };
  }, []);

  // Update session when room BPM changes
  useEffect(() => {
    if (sessionRef.current && sessionState === 'playing') {
      sessionRef.current.setBpm(roomBpm);
    }
  }, [roomBpm, sessionState]);

  // Update session when room key changes
  useEffect(() => {
    if (sessionRef.current && sessionState === 'playing') {
      const scale = keyToLyriaScale(roomKey, roomKeyScale);
      sessionRef.current.setScale(scale);
    }
  }, [roomKey, roomKeyScale, sessionState]);

  const handleConnect = useCallback(async () => {
    if (!sessionRef.current) return;

    setError(null);
    try {
      await sessionRef.current.connect();
      // Set initial config from room
      const scale = keyToLyriaScale(roomKey, roomKeyScale);
      sessionRef.current.setConfig({
        bpm: roomBpm,
        scale,
        density,
        brightness,
        drums,
        bass,
        temperature: temperature * 3, // Scale to 0-3
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, [roomBpm, roomKey, roomKeyScale, density, brightness, drums, bass, temperature]);

  const handleDisconnect = useCallback(() => {
    sessionRef.current?.disconnect();
  }, []);

  const handlePlay = useCallback(() => {
    if (!sessionRef.current) return;

    // Build and set prompt
    const prompt = customPrompt.trim() || buildPrompt(selectedStyle, selectedMood || undefined);
    sessionRef.current.setPrompts(prompt);
    sessionRef.current.play();
  }, [customPrompt, selectedStyle, selectedMood]);

  const handlePause = useCallback(() => {
    sessionRef.current?.pause();
  }, []);

  const handleStop = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  // Live control handlers with debounce
  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value);
    sessionRef.current?.setVolume(value);
  }, []);

  const handleDensityChange = useCallback((value: number) => {
    setDensity(value);
    if (sessionState === 'playing') {
      sessionRef.current?.setDensity(value);
    }
  }, [sessionState]);

  const handleBrightnessChange = useCallback((value: number) => {
    setBrightness(value);
    if (sessionState === 'playing') {
      sessionRef.current?.setBrightness(value);
    }
  }, [sessionState]);

  const handleDrumsChange = useCallback((value: number) => {
    setDrums(value);
    if (sessionState === 'playing') {
      sessionRef.current?.setDrums(value);
    }
  }, [sessionState]);

  const handleBassChange = useCallback((value: number) => {
    setBass(value);
    if (sessionState === 'playing') {
      sessionRef.current?.setBass(value);
    }
  }, [sessionState]);

  const handleTemperatureChange = useCallback((value: number) => {
    setTemperature(value);
    if (sessionState === 'playing') {
      sessionRef.current?.setTemperature(value * 3);
    }
  }, [sessionState]);

  const isConnected = sessionState === 'connected' || sessionState === 'playing' || sessionState === 'paused';
  const isPlaying = sessionState === 'playing';
  const isConnecting = sessionState === 'connecting';

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">AI Live Music</span>
          <span className="ml-auto px-2 py-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 text-[10px] font-medium rounded-full">
            Lyria
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Connection Status */}
        <div className={cn(
          'flex items-center justify-between p-3 rounded-xl transition-all',
          isConnected
            ? 'bg-emerald-500/10 border border-emerald-500/20'
            : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
        )}>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                {isConnected ? 'Real-time streaming ready' : 'Click to connect'}
              </p>
            </div>
          </div>
          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              isConnected
                ? 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20'
                : 'bg-purple-500 text-white hover:bg-purple-600',
              isConnecting && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isConnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isConnected ? (
              'Disconnect'
            ) : (
              'Connect'
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Room Sync Info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <Music className="w-4 h-4 text-purple-400" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Synced to Room</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {roomBpm} BPM {roomKey ? `• ${roomKey}${roomKeyScale === 'minor' ? 'm' : ''}` : ''}
            </p>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">
            Custom Prompt (optional)
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g., smooth jazz piano with soft drums:0.8, ambient pads:0.3"
            disabled={!isConnected}
            className="w-full h-16 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50"
          />
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Style</label>
          <div className="grid grid-cols-4 gap-1.5">
            {LYRIA_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                disabled={!isConnected}
                className={cn(
                  'px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50',
                  selectedStyle === style.id
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mood Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Mood</label>
          <div className="flex flex-wrap gap-1.5">
            {LYRIA_MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(selectedMood === mood.id ? null : mood.id)}
                disabled={!isConnected}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-medium transition-all disabled:opacity-50',
                  selectedMood === mood.id
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
                )}
              >
                {mood.label}
              </button>
            ))}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={handleStop}
            disabled={!isConnected || (!isPlaying && sessionState !== 'paused')}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all',
              'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-white/20',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={!isConnected}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg',
              isPlaying
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>
          <div className="w-10" /> {/* Spacer for symmetry */}
        </div>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Volume</span>
            </div>
            <span className="text-xs text-purple-400">{Math.round(volume * 100)}%</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          />
        </div>

        {/* Live Controls */}
        <div className="space-y-3 p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">Live Controls</span>
            {isPlaying && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* Density */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">Density</span>
              </div>
              <span className="text-[10px] text-blue-400">{Math.round(density * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={density}
              onChange={(e) => handleDensityChange(parseFloat(e.target.value))}
              disabled={!isConnected}
            />
          </div>

          {/* Brightness */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">Brightness</span>
              </div>
              <span className="text-[10px] text-yellow-400">{Math.round(brightness * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={brightness}
              onChange={(e) => handleBrightnessChange(parseFloat(e.target.value))}
              disabled={!isConnected}
            />
          </div>

          {/* Drums */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Drum className="w-3 h-3 text-orange-400" />
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">Drums</span>
              </div>
              <span className="text-[10px] text-orange-400">{Math.round(drums * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={drums}
              onChange={(e) => handleDrumsChange(parseFloat(e.target.value))}
              disabled={!isConnected}
            />
          </div>

          {/* Bass */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Music className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">Bass</span>
              </div>
              <span className="text-[10px] text-purple-400">{Math.round(bass * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={bass}
              onChange={(e) => handleBassChange(parseFloat(e.target.value))}
              disabled={!isConnected}
            />
          </div>

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
          >
            <Settings2 className="w-3 h-3" />
            Advanced
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAdvanced && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-pink-400" />
                  <span className="text-[10px] text-gray-500 dark:text-zinc-400">Chaos</span>
                </div>
                <span className="text-[10px] text-pink-400">{Math.round(temperature * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={temperature}
                onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                disabled={!isConnected}
              />
            </div>
          )}
        </div>

        {/* Stem Separation */}
        <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Stem Separation</h4>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500">Extract instruments</p>
            </div>
          </div>

          {!currentTrack ? (
            <p className="text-xs text-gray-500 dark:text-zinc-500 text-center py-2">
              Load a track first
            </p>
          ) : isSeparating ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs text-gray-900 dark:text-white">Separating...</span>
              </div>
              <Progress value={separationProgress} showLabel />
            </div>
          ) : stemsAvailable ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-emerald-400">Stems ready - use Mixer panel</span>
            </div>
          ) : (
            <button
              onClick={onSeparateTrack}
              className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Separate Stems
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-white/5">
        <a
          href="https://ai.google.dev/gemini-api/docs/music-generation"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 hover:text-purple-400 dark:hover:text-purple-400 transition-colors"
        >
          Powered by Google Lyria RealTime
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
