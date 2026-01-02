'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { useSessionTempoStore, selectTempo, selectKey } from '@/stores/session-tempo-store';
import { useLyriaStore } from '@/stores/lyria-store';
import { useSongsStore } from '@/stores/songs-store';
import { useRoomStore } from '@/stores/room-store';
import { useAuthStore } from '@/stores/auth-store';
import { useShallow } from 'zustand/shallow';
import { useAIPermissions } from '@/hooks/usePermissions';
import { useStatsTracker } from '@/hooks/useStatsTracker';
import { useLyriaSessionTimer, type SessionWarningLevel } from '@/hooks/useLyriaSessionTimer';
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
  Save,
  Trash2,
  User,
  Clock,
  AlertCircle,
  Timer,
  RefreshCw,
} from 'lucide-react';
import {
  LYRIA_STYLES,
  LYRIA_MOODS,
  buildPrompt,
  type LyriaStyleId,
  type LyriaMoodId,
} from '@/lib/ai/lyria';
import { DEFAULT_LYRIA_CONFIG, type LyriaTrackConfig } from '@/types/songs';

// Session timer component for displaying remaining time
function SessionTimer({
  remainingSeconds,
  warningLevel,
  formattedTime,
  isSessionExpired,
  extendSession,
  isExtending,
}: {
  remainingSeconds: number | null;
  warningLevel: SessionWarningLevel;
  formattedTime: string;
  isSessionExpired: boolean;
  extendSession: () => Promise<void>;
  isExtending: boolean;
}) {
  if (remainingSeconds === null && !isSessionExpired) return null;

  const showExtendButton = (remainingSeconds !== null && remainingSeconds <= 120) || isSessionExpired;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2.5 rounded-xl border transition-all',
        warningLevel === 'expired' && 'bg-red-500/20 border-red-500/30',
        warningLevel === 'urgent' && 'bg-red-500/15 border-red-500/25',
        warningLevel === 'warning' && 'bg-orange-500/15 border-orange-500/25',
        warningLevel === 'info' && 'bg-yellow-500/10 border-yellow-500/20',
        warningLevel === 'none' && 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10'
      )}
    >
      <div className="flex items-center gap-2">
        <Timer
          className={cn(
            'w-4 h-4',
            warningLevel === 'expired' && 'text-red-400',
            warningLevel === 'urgent' && 'text-red-400 animate-pulse',
            warningLevel === 'warning' && 'text-orange-400',
            warningLevel === 'info' && 'text-yellow-400',
            warningLevel === 'none' && 'text-gray-400 dark:text-zinc-400'
          )}
        />
        <div className="flex flex-col">
          <span
            className={cn(
              'text-sm font-mono font-medium',
              warningLevel === 'expired' && 'text-red-400',
              warningLevel === 'urgent' && 'text-red-400',
              warningLevel === 'warning' && 'text-orange-400',
              warningLevel === 'info' && 'text-yellow-500',
              warningLevel === 'none' && 'text-gray-700 dark:text-zinc-300'
            )}
          >
            {isSessionExpired ? 'Expired' : formattedTime}
          </span>
          <span className="text-[9px] text-gray-500 dark:text-zinc-500">
            {isSessionExpired ? 'Session ended' : 'Session time left'}
          </span>
        </div>
      </div>

      {showExtendButton && (
        <button
          onClick={extendSession}
          disabled={isExtending}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
            isSessionExpired
              ? 'bg-purple-500 hover:bg-purple-600 text-white'
              : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30',
            isExtending && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-3 h-3', isExtending && 'animate-spin')} />
          {isSessionExpired ? 'Reconnect' : 'Extend'}
        </button>
      )}
    </div>
  );
}

export function AIPanel() {
  const { canGenerateMusic } = useAIPermissions();
  const { trackAIGeneration } = useStatsTracker();

  // Session timer hook
  const {
    remainingSeconds,
    warningLevel,
    formattedTime,
    isSessionExpired,
    extendSession,
  } = useLyriaSessionTimer();
  const [isExtending, setIsExtending] = useState(false);

  // Wrap extendSession to track loading state
  const handleExtendSession = useCallback(async () => {
    setIsExtending(true);
    try {
      await extendSession();
    } finally {
      setIsExtending(false);
    }
  }, [extendSession]);

  // Auth state
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  // Use session tempo store as single source of truth for BPM/key
  const roomBpm = useSessionTempoStore(selectTempo);
  const { key: roomKey, scale: roomKeyScale } = useSessionTempoStore(useShallow(selectKey));

  // Lyria store state (persists across tab switches)
  const sessionState = useLyriaStore((state) => state.sessionState);
  const error = useLyriaStore((state) => state.error);
  const errorCode = useLyriaStore((state) => state.errorCode);
  const rateLimits = useLyriaStore((state) => state.rateLimits);
  const lyriaVolume = useLyriaStore((state) => state.volume);
  const setLyriaVolume = useLyriaStore((state) => state.setVolume);

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Songs store for creating Lyria songs
  const { createSong, addTrackToSong, getCurrentSong, currentSongId, updateTrackInSong, deleteSong, updateSong } = useSongsStore();
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

  // Song name for editing
  const [editingSongName, setEditingSongName] = useState('');
  const [newSongName, setNewSongName] = useState('');

  // Get current Lyria track from song if it exists
  const currentSong = getCurrentSong();
  const currentLyriaTrack = currentSong?.tracks.find(t => t.type === 'lyria');
  const isEditingExisting = !!currentLyriaTrack;

  // Load settings from current Lyria track when it changes
  useEffect(() => {
    if (currentLyriaTrack?.lyriaConfig) {
      const config = currentLyriaTrack.lyriaConfig;
      setSelectedStyle(config.styleId || 'jazz');
      setSelectedMood(config.moodId || null);
      setCustomPrompt(config.customPrompt || '');
      setDensity(config.density ?? 0.5);
      setBrightness(config.brightness ?? 0.5);
      setDrums(config.drums ?? 0.7);
      setBass(config.bass ?? 0.7);
      setTemperature(config.temperature ?? 0.5);
    }
    // Also load song name
    if (currentSong) {
      setEditingSongName(currentSong.name);
    }
  }, [currentLyriaTrack?.id, currentSong?.id]); // Only reload when the track or song reference changes

  // NOTE: BPM/key sync to Lyria is now handled by useSessionTempoSync hook with debouncing
  // Do NOT add a sync here as it would bypass the debounce

  // Live update Lyria session when sliders change (works when connected/playing/paused)
  useEffect(() => {
    const lyriaStore = useLyriaStore.getState();
    const { sessionState, session } = lyriaStore;

    // Update for any active session state
    const isActiveSession = sessionState === 'playing' || sessionState === 'connected' || sessionState === 'paused';
    if (!isActiveSession || !session) return;

    session.setDensity(density);
    session.setBrightness(brightness);
    session.setDrums(drums);
    session.setBass(bass);
    session.setTemperature(temperature * 3); // Scale to 0-3
  }, [density, brightness, drums, bass, temperature]);

  // Live update prompts when style/mood changes (works when connected/playing/paused)
  // Debounce custom prompt changes to avoid sending on every keystroke
  useEffect(() => {
    const lyriaStore = useLyriaStore.getState();
    const { sessionState, session } = lyriaStore;

    // Update for any active session state
    const isActiveSession = sessionState === 'playing' || sessionState === 'connected' || sessionState === 'paused';
    if (!isActiveSession || !session) return;

    const prompt = customPrompt.trim() || buildPrompt(selectedStyle, selectedMood || undefined);

    // Debounce prompt changes (500ms) to avoid spamming the API
    const timeoutId = setTimeout(() => {
      session.setPrompts(prompt);
    }, 500);

    return () => clearTimeout(timeoutId);
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
    // Use custom name if provided, otherwise generate from style
    const songName = newSongName.trim() || `Lyria - ${styleName}`;

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

    // Clear the new song name input
    setNewSongName('');

    // Track AI generation for stats
    trackAIGeneration();

    console.log('[AIPanel] Created Lyria song:', song.name);
  }, [roomId, currentUser, getCurrentConfig, selectedStyle, createSong, addTrackToSong, lyriaVolume, newSongName, trackAIGeneration]);

  // Add Lyria track to current song
  const handleAddToCurrentSong = useCallback(() => {
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
  }, [currentSong, getCurrentConfig, addTrackToSong, lyriaVolume]);

  // Save changes to existing Lyria track and auto-play
  const handleSaveChanges = useCallback(async () => {
    if (!currentSong || !currentLyriaTrack) return;

    const config = getCurrentConfig();
    updateTrackInSong(currentSong.id, currentLyriaTrack.id, {
      lyriaConfig: config,
      volume: lyriaVolume,
    });

    // Also update song name if changed
    if (editingSongName.trim() && editingSongName !== currentSong.name) {
      updateSong(currentSong.id, { name: editingSongName.trim() });
    }

    console.log('[AIPanel] Saved Lyria track changes');

    // Auto-play if not already playing
    const lyriaStore = useLyriaStore.getState();
    if (lyriaStore.sessionState !== 'playing') {
      // Connect if needed
      if (lyriaStore.sessionState === 'disconnected' || lyriaStore.sessionState === 'error') {
        try {
          await lyriaStore.connect();
        } catch (err) {
          console.error('[AIPanel] Failed to connect Lyria:', err);
          return;
        }
      }
      // Play with the new config
      const freshState = useLyriaStore.getState();
      if (freshState.sessionState === 'connected' || freshState.sessionState === 'paused') {
        await freshState.play(config);
      }
    }
  }, [currentSong, currentLyriaTrack, getCurrentConfig, updateTrackInSong, lyriaVolume, editingSongName, updateSong]);

  // Delete current Lyria song
  const handleDeleteSong = useCallback(() => {
    if (!currentSong) return;

    // Stop Lyria if playing
    const lyriaStore = useLyriaStore.getState();
    if (lyriaStore.sessionState === 'playing' || lyriaStore.sessionState === 'connected') {
      lyriaStore.pause();
    }

    deleteSong(currentSong.id);
    console.log('[AIPanel] Deleted Lyria song:', currentSong.name);
  }, [currentSong, deleteSong]);

  // Helper to check if current song has a Lyria track
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
        {/* Authentication Check */}
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-3">
              <User className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Sign In Required</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 max-w-[200px]">
              Create a free account to use Lyria AI music generation
            </p>
            <div className="mt-4 flex flex-col gap-2 w-full max-w-[180px]">
              <a
                href="/auth/signup"
                className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-xl text-center transition-all"
              >
                Create Account
              </a>
              <a
                href="/auth/signin"
                className="w-full px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-xl text-center hover:bg-gray-300 dark:hover:bg-white/20 transition-all"
              >
                Sign In
              </a>
            </div>
          </div>
        ) : !canGenerateMusic ? (
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
            {/* Rate Limit Info */}
            {rateLimits && (
              <div className="p-3 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">Daily Limit</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    rateLimits.accountType === 'pro' ? "bg-purple-500/20 text-purple-400" :
                    rateLimits.accountType === 'admin' ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-zinc-400"
                  )}>
                    {rateLimits.accountType.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                      style={{
                        width: `${Math.max(0, Math.min(100, (rateLimits.dailySecondsRemaining / (rateLimits.dailySecondsLimit || 1800)) * 100))}%`
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-zinc-500 whitespace-nowrap">
                    {Math.round(rateLimits.dailySecondsRemaining / 60)}m left
                  </span>
                </div>
                {rateLimits.dailySecondsRemaining <= 0 && (
                  <p className="text-[10px] text-orange-400 mt-2">
                    Daily limit reached. Resets at midnight.
                    {rateLimits.accountType === 'free' && ' Upgrade to Pro for 8 hours/day.'}
                  </p>
                )}
              </div>
            )}

            {/* Session Timer - shows when connected/playing */}
            {(sessionState === 'playing' || sessionState === 'connected' || sessionState === 'paused' || isSessionExpired) && (
              <SessionTimer
                remainingSeconds={remainingSeconds}
                warningLevel={warningLevel}
                formattedTime={formattedTime}
                isSessionExpired={isSessionExpired}
                extendSession={handleExtendSession}
                isExtending={isExtending}
              />
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p>{error}</p>
                  {errorCode === 'RATE_LIMIT_EXCEEDED' && (
                    <p className="mt-1 text-[10px] opacity-80">
                      Your daily Lyria limit has been reached. Try again tomorrow or upgrade to Pro.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Editing Status / Create Buttons */}
            {isEditingExisting ? (
              <div className="space-y-3">
                {/* Song name input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-purple-400/70 uppercase tracking-wide font-medium">Song Name</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingSongName}
                      onChange={(e) => setEditingSongName(e.target.value)}
                      placeholder="Enter song name..."
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500 px-1.5 py-0.5 bg-gray-200 dark:bg-white/10 rounded whitespace-nowrap">
                      {roomBpm} BPM
                    </span>
                  </div>
                </div>

                {/* Save & Delete buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveChanges}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-xl transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button
                    onClick={handleDeleteSong}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-all border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Create new song button */}
                <button
                  onClick={handleCreateLyriaSong}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-white/20 transition-all text-sm"
                >
                  <Plus className="w-3 h-3" />
                  Create New Lyria Song
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Song name input for new song */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">Song Name</label>
                  <input
                    type="text"
                    value={newSongName}
                    onChange={(e) => setNewSongName(e.target.value)}
                    placeholder="e.g., Lyria - Jazz (optional)"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
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
            )}

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
