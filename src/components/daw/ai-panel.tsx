'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSessionTempoStore, selectTempo, selectKey } from '@/stores/session-tempo-store';
import { useAIPermissions } from '@/hooks/usePermissions';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { Slider } from '../ui/slider';
import {
  Sparkles,
  Loader2,
  ExternalLink,
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
  Lock,
} from 'lucide-react';
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
import type { CloudflareCalls } from '@/lib/cloudflare/calls';

interface AIPanelProps {
  getCloudflareRef?: () => CloudflareCalls | null;
}

// Constant ID for Lyria external audio source in AudioEngine
const LYRIA_AUDIO_SOURCE_ID = 'lyria-ai-music';

export function AIPanel({ getCloudflareRef }: AIPanelProps) {
  const { canGenerateMusic } = useAIPermissions();

  // Audio engine for routing Lyria through master channel
  // Use refs to store functions to avoid dependency issues in useEffect/useCallback
  const audioEngine = useAudioEngine();
  const audioEngineRef = useRef(audioEngine);
  audioEngineRef.current = audioEngine;

  // Use session tempo store as single source of truth for BPM/key
  const roomBpm = useSessionTempoStore(selectTempo);
  const { key: roomKey, scale: roomKeyScale } = useSessionTempoStore(selectKey);

  // Lyria session
  const sessionRef = useRef<LyriaSession | null>(null);
  const [sessionState, setSessionState] = useState<LyriaSessionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // WebRTC track ID for sharing Lyria audio
  const lyriaTrackIdRef = useRef<string | null>(null);
  const [isSharingAudio, setIsSharingAudio] = useState(false);

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

  // Initialize session on mount
  useEffect(() => {
    const session = createLyriaSession();

    // Enable external routing so Lyria audio goes through AudioEngine's master bus
    session.setUseExternalRouting(true);

    session.setCallbacks({
      onStateChange: (state) => {
        setSessionState(state);
        if (state === 'error') {
          setError('Connection lost. Click Connect to retry.');
        } else if (state === 'connected') {
          setError(null);
        }
      },
      onError: (err) => {
        setError(err.message);
      },
      onConfigApplied: () => {
        // Config applied successfully
      },
    });
    sessionRef.current = session;

    return () => {
      // Cleanup: remove from AudioEngine and stop sharing
      audioEngineRef.current.removeExternalAudioSource(LYRIA_AUDIO_SOURCE_ID);

      if (lyriaTrackIdRef.current && getCloudflareRef) {
        const cloudflare = getCloudflareRef();
        cloudflare?.removeTrack(lyriaTrackIdRef.current).catch(() => {});
        lyriaTrackIdRef.current = null;
      }
      session.disconnect();
    };
  }, [getCloudflareRef]);

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

  // Update prompts when style/mood changes during playback
  useEffect(() => {
    if (sessionRef.current && sessionState === 'playing') {
      const prompt = customPrompt.trim() || buildPrompt(selectedStyle, selectedMood || undefined);
      sessionRef.current.setPrompts(prompt);
    }
  }, [selectedStyle, selectedMood, customPrompt, sessionState]);

  // Add Lyria audio to WebRTC for sharing with room
  const shareAudioWithRoom = useCallback(async (retryCount = 0): Promise<boolean> => {
    if (!sessionRef.current) {
      console.warn('[Lyria] No session available for sharing');
      return false;
    }

    if (!getCloudflareRef) {
      console.warn('[Lyria] getCloudflareRef not provided');
      return false;
    }

    const cloudflare = getCloudflareRef();
    if (!cloudflare) {
      // Retry up to 3 times with 500ms delay
      if (retryCount < 3) {
        console.log(`[Lyria] CloudflareCalls not ready, retrying in 500ms (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return shareAudioWithRoom(retryCount + 1);
      }
      console.warn('[Lyria] CloudflareCalls not ready after retries - audio sharing skipped');
      return false;
    }

    const outputStream = sessionRef.current.getOutputStream();
    if (!outputStream) {
      console.warn('[Lyria] No output stream available');
      return false;
    }

    try {
      // Add Lyria audio as a track - stereo for full quality
      const trackId = await cloudflare.addTrack(outputStream, 'lyria', 'AI Live Music', true);
      lyriaTrackIdRef.current = trackId;
      setIsSharingAudio(true);
      console.log('[Lyria] Audio shared with room:', trackId);
      return true;
    } catch (err) {
      console.error('[Lyria] Failed to share audio:', err);
      return false;
    }
  }, [getCloudflareRef]);

  // Remove Lyria audio from WebRTC
  const stopSharingAudio = useCallback(async () => {
    if (!lyriaTrackIdRef.current || !getCloudflareRef) return;

    const cloudflare = getCloudflareRef();
    if (!cloudflare) return;

    try {
      await cloudflare.removeTrack(lyriaTrackIdRef.current);
      console.log('[Lyria] Audio sharing stopped');
    } catch (err) {
      console.error('[Lyria] Failed to stop audio sharing:', err);
    }

    lyriaTrackIdRef.current = null;
    setIsSharingAudio(false);
  }, [getCloudflareRef]);

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

      // Connect Lyria audio to AudioEngine's master bus
      const outputStream = sessionRef.current.getOutputStream();
      if (outputStream) {
        audioEngineRef.current.addExternalAudioSource(LYRIA_AUDIO_SOURCE_ID, outputStream, volume);
        console.log('[Lyria] Audio routed through AudioEngine master');
      }

      // Share audio with room once connected
      await shareAudioWithRoom();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [roomBpm, roomKey, roomKeyScale, density, brightness, drums, bass, temperature, volume, shareAudioWithRoom]);

  const handleDisconnect = useCallback(async () => {
    // Remove from AudioEngine
    audioEngineRef.current.removeExternalAudioSource(LYRIA_AUDIO_SOURCE_ID);

    // Stop sharing audio before disconnecting
    await stopSharingAudio();
    sessionRef.current?.disconnect();
  }, [stopSharingAudio]);

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

  // Live control handlers
  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value);
    sessionRef.current?.setVolume(value);
    // Also update AudioEngine external source volume
    audioEngineRef.current.setExternalAudioVolume(LYRIA_AUDIO_SOURCE_ID, value);
  }, []);

  // Connection state helpers
  const isConnected = sessionState === 'connected' || sessionState === 'playing' || sessionState === 'paused';
  const isPlaying = sessionState === 'playing';
  const isConnecting = sessionState === 'connecting';

  const handleDensityChange = useCallback((value: number) => {
    setDensity(value);
    if (isConnected) {
      sessionRef.current?.setDensity(value);
    }
  }, [isConnected]);

  const handleBrightnessChange = useCallback((value: number) => {
    setBrightness(value);
    if (isConnected) {
      sessionRef.current?.setBrightness(value);
    }
  }, [isConnected]);

  const handleDrumsChange = useCallback((value: number) => {
    setDrums(value);
    if (isConnected) {
      sessionRef.current?.setDrums(value);
    }
  }, [isConnected]);

  const handleBassChange = useCallback((value: number) => {
    setBass(value);
    if (isConnected) {
      sessionRef.current?.setBass(value);
    }
  }, [isConnected]);

  const handleTemperatureChange = useCallback((value: number) => {
    setTemperature(value);
    if (isConnected) {
      sessionRef.current?.setTemperature(value * 3);
    }
  }, [isConnected]);

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
        {/* Permission Check for AI Generation */}
        {!canGenerateMusic ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/5 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-gray-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">No Permission</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
              You don&apos;t have permission to use AI music generation
            </p>
          </div>
        ) : (
          <>
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
                    {isConnected
                      ? isSharingAudio
                        ? 'Sharing audio with room'
                        : 'Real-time streaming ready'
                      : 'Click to connect'}
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
          </>
        )}
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
