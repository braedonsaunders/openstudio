'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DAWLayout, NativeBridgeGate } from '@/components/daw';
import { RoomExitAnimation } from '@/components/daw/room-exit-animation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useRoom } from '@/hooks/useRoom';
import { useAuthStore } from '@/stores/auth-store';
import { useSavedTracksStore, presetToTrackSettings } from '@/stores/saved-tracks-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { InstrumentIcon } from '@/components/ui/instrument-icon';
import { INSTRUMENTS, getInstrumentEmoji, type SavedTrackPreset } from '@/types/user';
import {
  Music,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Check,
  Sliders,
  ChevronDown,
  ChevronUp,
  Headphones,
} from 'lucide-react';

type JoinMode = 'undecided' | 'performer' | 'listener';

const instruments = [
  { id: 'guitar', label: 'Guitar', icon: '🎸' },
  { id: 'bass', label: 'Bass', icon: '🎸' },
  { id: 'drums', label: 'Drums', icon: '🥁' },
  { id: 'keyboard', label: 'Keyboard', icon: '🎹' },
  { id: 'vocals', label: 'Vocals', icon: '🎤' },
  { id: 'other', label: 'Other', icon: '🎵' },
];

// Map user instrument IDs to room instrument categories
function mapInstrumentToCategory(instrumentId: string): string {
  const inst = INSTRUMENTS[instrumentId];
  if (!inst) return '';

  switch (inst.category) {
    case 'guitar':
      return instrumentId.includes('bass') ? 'bass' : 'guitar';
    case 'keyboard':
      return 'keyboard';
    case 'drums':
      return 'drums';
    case 'vocals':
      return 'vocals';
    default:
      return 'other';
  }
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const { user, profile, instruments: userInstruments, isInitialized } = useAuthStore();
  const { presets, loadPresets, selectedPresets, togglePresetSelection, getSelectedPresets, incrementUseCount } = useSavedTracksStore();
  const { addTrack, addMidiTrack } = useUserTracksStore();

  const [hasJoined, setHasJoined] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [userName, setUserName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [showSavedTracks, setShowSavedTracks] = useState(false);
  const [joinMode, setJoinMode] = useState<JoinMode>('undecided');

  // Check if user is in listener mode (no native bridge)
  const isListenerMode = joinMode === 'listener';

  // Auth initialization is handled by onAuthStateChange in auth-store

  // Load saved track presets when user is logged in
  useEffect(() => {
    if (user?.id) {
      loadPresets(user.id);
    }
  }, [user?.id, loadPresets]);

  // Pre-populate name and instrument from profile when auth is ready
  useEffect(() => {
    if (profile && !userName) {
      setUserName(profile.displayName);
    }
  }, [profile, userName]);

  // Pre-populate instrument from user's primary instrument
  useEffect(() => {
    if (userInstruments && userInstruments.length > 0 && !instrument) {
      const primaryInstrument = userInstruments.find(i => i.isPrimary) || userInstruments[0];
      if (primaryInstrument) {
        const mappedCategory = mapInstrumentToCategory(primaryInstrument.instrumentId);
        if (mappedCategory) {
          setInstrument(mappedCategory);
        }
      }
    }
  }, [userInstruments, instrument]);

  const { join, leave, isJoining, error, isConnected } = useRoom(roomId, {
    onUserJoined: (user) => {
      console.log('User joined:', user.name);
    },
    onUserLeft: (userId) => {
      console.log('User left:', userId);
    },
    onError: (err) => {
      console.error('Room error:', err);
    },
  });

  // Navigate to /lobby when user leaves (isConnected becomes false after joining)
  // Don't redirect if still joining, if there was an error, or if we're handling animated exit
  useEffect(() => {
    if (hasJoined && !isConnected && !isJoining && !error && !isExiting) {
      router.push('/lobby');
    }
  }, [hasJoined, isConnected, isJoining, error, isExiting, router]);

  // Handle animated room exit
  const handleLeaveRoom = useCallback(() => {
    setIsExiting(true);
  }, []);

  // Called when exit animation completes
  const handleExitAnimationComplete = useCallback(async () => {
    await leave();
    router.push('/lobby');
  }, [leave, router]);

  const handleJoin = useCallback(async () => {
    if (!userName.trim()) return;
    const success = await join(userName.trim(), instrument || undefined, isListenerMode);
    if (success) {
      // Create tracks from selected presets
      const selected = getSelectedPresets();
      for (const preset of selected) {
        const trackSettings = presetToTrackSettings(preset);
        if ('type' in trackSettings && trackSettings.type === 'midi' && 'midiSettings' in trackSettings && trackSettings.midiSettings) {
          addMidiTrack(
            user?.id || 'local-user',
            trackSettings.name,
            trackSettings.midiSettings,
            userName.trim()
          );
        } else if ('audioSettings' in trackSettings && trackSettings.audioSettings) {
          addTrack(
            user?.id || 'local-user',
            trackSettings.name,
            trackSettings.audioSettings,
            userName.trim()
          );
        }
        // Increment use count for analytics
        incrementUseCount(preset.id);
      }
      setHasJoined(true);
    }
  }, [userName, instrument, join, getSelectedPresets, addTrack, addMidiTrack, user?.id, incrementUseCount, isListenerMode]);

  // Show DAW layout once joined, with exit animation wrapper
  if (hasJoined && (isConnected || isExiting)) {
    return (
      <RoomExitAnimation
        isExiting={isExiting}
        onAnimationComplete={handleExitAnimationComplete}
      >
        <DAWLayout roomId={roomId} onLeaveRoom={handleLeaveRoom} listenerMode={isListenerMode} />
      </RoomExitAnimation>
    );
  }

  // Show native bridge gate before join form - encourage native bridge usage
  if (joinMode === 'undecided') {
    return (
      <NativeBridgeGate
        roomName={`Room ${roomId}`}
        onJoinAsPerformer={() => setJoinMode('performer')}
        onJoinAsListener={() => setJoinMode('listener')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="text-center">
          {/* Listener mode badge */}
          {isListenerMode && (
            <div className="flex items-center justify-center gap-2 mb-4 py-2 px-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Headphones className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-500 font-medium">Listen-Only Mode</span>
            </div>
          )}

          {/* Show user avatar if logged in, otherwise show music icon */}
          {user && profile ? (
            <div className="flex flex-col items-center mb-4">
              <UserAvatar
                userId={user.id}
                username={profile.username}
                size="xl"
                variant="fullBody"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Joining as <span className="font-medium text-gray-900 dark:text-white">{profile.displayName}</span>
              </p>
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
              {isListenerMode ? (
                <Headphones className="w-8 h-8 text-amber-500" />
              ) : (
                <Music className="w-8 h-8 text-indigo-500" />
              )}
            </div>
          )}
          <CardTitle className="text-2xl">
            {isListenerMode ? 'Join as Listener' : 'Join Room'}
          </CardTitle>
          <CardDescription>
            Room code: <span className="text-gray-900 dark:text-white font-mono">{roomId}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Name input */}
          <Input
            label="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            disabled={isJoining}
          />

          {/* Listener mode info */}
          {isListenerMode && (
            <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You'll be able to hear all performers but won't be able to send audio.
                Perfect for spectating or when you don't have the native bridge installed.
              </p>
            </div>
          )}

          {/* Instrument selection - only for performers */}
          {!isListenerMode && (
            <div className="space-y-2">
              <label className="text-sm text-gray-500 dark:text-gray-400">Instrument (optional)</label>
              <div className="grid grid-cols-3 gap-2">
                {instruments.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => setInstrument(inst.id === instrument ? '' : inst.id)}
                    disabled={isJoining}
                    className={`
                      flex flex-col items-center gap-1 p-3 rounded-lg transition-all
                      ${instrument === inst.id
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
                      ${isJoining && 'opacity-50 cursor-not-allowed'}
                    `}
                  >
                    <span className="text-xl">{inst.icon}</span>
                    <span className="text-xs">{inst.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved Tracks Selection - only for performers */}
          {!isListenerMode && user && presets.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowSavedTracks(!showSavedTracks)}
                className="w-full flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Bring your saved tracks
                  {selectedPresets.size > 0 && (
                    <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {selectedPresets.size}
                    </span>
                  )}
                </span>
                {showSavedTracks ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showSavedTracks && (
                <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => togglePresetSelection(preset.id)}
                      disabled={isJoining}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left
                        ${selectedPresets.has(preset.id)
                          ? 'bg-indigo-500/10 border-2 border-indigo-500'
                          : 'bg-white dark:bg-gray-800 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'}
                        ${isJoining && 'opacity-50 cursor-not-allowed'}
                      `}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${preset.color}20` }}
                      >
                        <InstrumentIcon
                          instrumentId={preset.instrumentId}
                          size="md"
                          className="opacity-80"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {preset.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {INSTRUMENTS[preset.instrumentId]?.name || preset.instrumentId}
                        </p>
                      </div>
                      {selectedPresets.has(preset.id) && (
                        <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                      )}
                    </button>
                  ))}
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                    Selected tracks will be created automatically when you join
                  </p>
                </div>
              )}
            </div>
          )}

        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={handleJoin}
            disabled={!userName.trim() || isJoining}
            loading={isJoining}
            className="w-full"
            size="lg"
            variant={isListenerMode ? 'secondary' : 'primary'}
          >
            {isJoining
              ? 'Joining...'
              : isListenerMode
                ? 'Join as Listener'
                : 'Join as Performer'}
            {!isJoining && (isListenerMode
              ? <Headphones className="w-4 h-4 ml-2" />
              : <ArrowRight className="w-4 h-4 ml-2" />)}
          </Button>
          <button
            onClick={() => setJoinMode('undecided')}
            disabled={isJoining}
            className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to mode selection
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
