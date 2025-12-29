'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { useSessionTempoStore, selectTempo, selectKey } from '@/stores/session-tempo-store';
import { useLyriaStore } from '@/stores/lyria-store';
import { useSongsStore } from '@/stores/songs-store';
import { useRoomStore } from '@/stores/room-store';
import { useShallow } from 'zustand/shallow';
import { useAIPermissions } from '@/hooks/usePermissions';
import { Slider } from '../ui/slider';
import {
  Sparkles,
  ExternalLink,
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
  Plus,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  LYRIA_STYLES,
  LYRIA_MOODS,
  buildPrompt,
  type LyriaStyleId,
  type LyriaMoodId,
} from '@/lib/ai/lyria';
import { DEFAULT_LYRIA_CONFIG, type LyriaTrackConfig } from '@/types/songs';

export function AIPanel() {
  const { canGenerateMusic } = useAIPermissions();

  // Use session tempo store as single source of truth for BPM/key
  const roomBpm = useSessionTempoStore(selectTempo);
  const { key: roomKey, scale: roomKeyScale } = useSessionTempoStore(useShallow(selectKey));

  // Lyria store state (persists across tab switches)
  const sessionState = useLyriaStore((state) => state.sessionState);
  const error = useLyriaStore((state) => state.error);
  const lyriaVolume = useLyriaStore((state) => state.volume);
  const setLyriaVolume = useLyriaStore((state) => state.setVolume);

  // Songs store for creating Lyria songs
  const { createSong, addTrackToSong, getCurrentSong, currentSongId } = useSongsStore();
  const room = useRoomStore((state) => state.room);
  const currentUser = useRoomStore((state) => state.currentUser);
  const roomId = room?.id;

  // UI state for config
  const [selectedStyle, setSelectedStyle] = useState<LyriaStyleId>('jazz');
  const [selectedMood, setSelectedMood] = useState<LyriaMoodId | null>('chill');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Live control values (local until song is created)
  const [density, setDensity] = useState(0.5);
  const [brightness, setBrightness] = useState(0.5);
  const [drums, setDrums] = useState(0.7);
  const [bass, setBass] = useState(0.7);
  const [temperature, setTemperature] = useState(0.5);

  // Sync room context to Lyria store when BPM/key changes
  useEffect(() => {
    useLyriaStore.getState().setRoomContext(roomBpm, roomKey, roomKeyScale);
  }, [roomBpm, roomKey, roomKeyScale]);

  // Live update Lyria session when sliders change (only when playing)
  useEffect(() => {
    const lyriaStore = useLyriaStore.getState();
    if (lyriaStore.sessionState !== 'playing') return;

    const session = lyriaStore.session;
    if (!session) return;

    session.setDensity(density);
    session.setBrightness(brightness);
    session.setDrums(drums);
    session.setBass(bass);
    session.setTemperature(temperature * 3); // Scale to 0-3
  }, [density, brightness, drums, bass, temperature]);

  // Live update prompts when style/mood changes (only when playing)
  useEffect(() => {
    const lyriaStore = useLyriaStore.getState();
    if (lyriaStore.sessionState !== 'playing') return;

    const session = lyriaStore.session;
    if (!session) return;

    const prompt = customPrompt.trim() || buildPrompt(selectedStyle, selectedMood || undefined);
    session.setPrompts(prompt);
  }, [selectedStyle, selectedMood, customPrompt]);

  // Get current config as LyriaTrackConfig
  const getCurrentConfig = useCallback((): LyriaTrackConfig => ({
    styleId: selectedStyle,
    moodId: selectedMood,
    customPrompt: customPrompt.trim() || undefined,
    density,
    brightness,
    drums,
    bass,
    temperature,
  }), [selectedStyle, selectedMood, customPrompt, density, brightness, drums, bass, temperature]);

  // Create a new song with a Lyria track
  const handleCreateLyriaSong = useCallback(() => {
    if (!roomId || !currentUser?.id) return;

    const config = getCurrentConfig();
    const styleName = LYRIA_STYLES.find(s => s.id === selectedStyle)?.label || 'AI Music';
    const songName = `Lyria - ${styleName}`;

    // Create a new song
    const song = createSong(roomId, songName, currentUser.id, currentUser.name);

    // Add a Lyria track to it
    addTrackToSong(song.id, {
      type: 'lyria',
      trackId: `lyria-${uuidv4()}`,
      startOffset: 0,
      volume: lyriaVolume,
      lyriaConfig: config,
    });

    console.log('[AIPanel] Created Lyria song:', song.name);
  }, [roomId, currentUser, getCurrentConfig, selectedStyle, createSong, addTrackToSong, lyriaVolume]);

  // Add Lyria track to current song
  const handleAddToCurrentSong = useCallback(() => {
    const currentSong = getCurrentSong();
    if (!currentSong) return;

    const config = getCurrentConfig();

    // Check if song already has a Lyria track
    const hasLyriaTrack = currentSong.tracks.some(t => t.type === 'lyria');
    if (hasLyriaTrack) {
      console.log('[AIPanel] Song already has a Lyria track');
      return;
    }

    addTrackToSong(currentSong.id, {
      type: 'lyria',
      trackId: `lyria-${uuidv4()}`,
      startOffset: 0,
      volume: lyriaVolume,
      lyriaConfig: config,
    });

    console.log('[AIPanel] Added Lyria track to song:', currentSong.name);
  }, [getCurrentSong, getCurrentConfig, addTrackToSong, lyriaVolume]);

  // Connection state helpers
  const isConnected = sessionState === 'connected' || sessionState === 'playing' || sessionState === 'paused';
  const isPlaying = sessionState === 'playing';

  // Check if current song has Lyria track
  const currentSong = getCurrentSong();
  const currentSongHasLyria = currentSong?.tracks.some(t => t.type === 'lyria') ?? false;

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
            {/* Connection Status (read-only) */}
            <div className={cn(
              'flex items-center gap-2 p-3 rounded-xl transition-all',
              isConnected
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
            )}>
              {isConnected ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {isPlaying ? 'Playing' : isConnected ? 'Connected' : 'Ready'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                  {isPlaying
                    ? 'Streaming live to room'
                    : isConnected
                    ? 'Press play on transport to start'
                    : 'Add a Lyria song to get started'}
                </p>
              </div>
              {isPlaying && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
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

            {/* Create Lyria Song Button */}
            <div className="space-y-2">
              <button
                onClick={handleCreateLyriaSong}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Create Lyria Song
              </button>
              {currentSongId && !currentSongHasLyria && (
                <button
                  onClick={handleAddToCurrentSong}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-white/20 transition-all text-sm"
                >
                  <Plus className="w-3 h-3" />
                  Add to Current Song
                </button>
              )}
              <p className="text-[10px] text-gray-500 dark:text-zinc-500 text-center">
                Creates a song with infinite AI-generated music. Use the transport to play/pause.
              </p>
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                Custom Prompt (optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., smooth jazz piano with soft drums, ambient pads"
                className="w-full h-16 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
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
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all',
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
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-medium transition-all',
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

            {/* Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">Volume</span>
                </div>
                <span className="text-xs text-purple-400">{Math.round(lyriaVolume * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={lyriaVolume}
                onChange={(e) => setLyriaVolume(parseFloat(e.target.value))}
              />
            </div>

            {/* Live Controls */}
            <div className="space-y-3 p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">Generation Controls</span>
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
                  onChange={(e) => setDensity(parseFloat(e.target.value))}
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
                  onChange={(e) => setBrightness(parseFloat(e.target.value))}
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
                  onChange={(e) => setDrums(parseFloat(e.target.value))}
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
                  onChange={(e) => setBass(parseFloat(e.target.value))}
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
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
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
