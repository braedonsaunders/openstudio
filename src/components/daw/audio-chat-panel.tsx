'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAudioChatStore, type VoiceChatParticipant } from '@/stores/audio-chat-store';
import { useRoomStore } from '@/stores/room-store';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  ChevronLeft,
  Users,
  Headphones,
  Settings,
} from 'lucide-react';

interface AudioChatPanelProps {
  roomId: string;
  userId: string;
  userName?: string;
  onBack: () => void;
}

// Audio level threshold for speaking detection
const SPEAKING_THRESHOLD = 0.02;
const SPEAKING_DEBOUNCE_MS = 150;

export function AudioChatPanel({ roomId, userId, userName, onBack }: AudioChatPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const { users } = useRoomStore();

  const {
    isConnected,
    isConnecting,
    error,
    localStream,
    isSelfMuted,
    isMasterMuted,
    localAudioLevel,
    participants,
    audioContext,
    selectedInputDevice,
    setConnected,
    setConnecting,
    setError,
    setLocalStream,
    setSelfMuted,
    setMasterMuted,
    setLocalAudioLevel,
    addParticipant,
    removeParticipant,
    setParticipantMutedByMe,
    setParticipantVolume,
    setParticipantSpeaking,
    setParticipantAudioLevel,
    setAudioContext,
    setGainNode,
    setSelectedInputDevice,
    muteAllParticipants,
    unmuteAllParticipants,
    reset,
  } = useAudioChatStore();

  // Load available input devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permissions first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
          s.getTracks().forEach((t) => t.stop());
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        setInputDevices(audioInputs);
      } catch (err) {
        console.error('Failed to load audio devices:', err);
      }
    }
    loadDevices();
  }, []);

  // Analyze local audio level
  const analyzeAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setLocalAudioLevel(rms);

    animationFrameRef.current = requestAnimationFrame(analyzeAudioLevel);
  }, [setLocalAudioLevel]);

  // Start voice chat
  const joinVoiceChat = useCallback(async () => {
    setConnecting(true);
    setError(null);

    try {
      // Create audio context for playback
      const ctx = new AudioContext();
      setAudioContext(ctx);

      // Get local audio stream
      const constraints: MediaStreamConstraints = {
        audio: selectedInputDevice
          ? { deviceId: { exact: selectedInputDevice } }
          : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      // Set up analyser for local audio
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start analyzing audio level
      analyzeAudioLevel();

      // Add existing room users as participants (simulating they're in voice chat)
      // In a real implementation, this would come from the server/WebRTC signaling
      users.forEach((user) => {
        if (user.id !== userId) {
          addParticipant({
            id: user.id,
            name: user.name,
            isMuted: false,
            isMutedByMe: false,
            volume: 1,
            isSpeaking: false,
            audioLevel: 0,
            stream: null,
          });
        }
      });

      setConnected(true);
    } catch (err) {
      console.error('Failed to join voice chat:', err);
      setError('Failed to access microphone. Please check permissions.');
    } finally {
      setConnecting(false);
    }
  }, [
    selectedInputDevice,
    userId,
    users,
    setConnecting,
    setError,
    setAudioContext,
    setLocalStream,
    setConnected,
    addParticipant,
    analyzeAudioLevel,
  ]);

  // Leave voice chat
  const leaveVoiceChat = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear speaking timeout
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }

    reset();
  }, [reset]);

  // Toggle self mute
  const toggleSelfMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isSelfMuted; // Toggle
        setSelfMuted(!isSelfMuted);
      }
    }
  }, [localStream, isSelfMuted, setSelfMuted]);

  // Toggle master mute (mute all incoming audio)
  const toggleMasterMute = useCallback(() => {
    setMasterMuted(!isMasterMuted);
  }, [isMasterMuted, setMasterMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
      }
      if (isConnected) {
        reset();
      }
    };
  }, [isConnected, reset]);

  // Track users joining/leaving the room while connected
  useEffect(() => {
    if (!isConnected) return;

    const userIds = new Set(users.map((u) => u.id));
    const participantIds = new Set(participants.keys());

    // Add new users
    users.forEach((user) => {
      if (user.id !== userId && !participantIds.has(user.id)) {
        addParticipant({
          id: user.id,
          name: user.name,
          isMuted: false,
          isMutedByMe: false,
          volume: 1,
          isSpeaking: false,
          audioLevel: 0,
          stream: null,
        });
      }
    });

    // Remove users who left
    participants.forEach((_, id) => {
      if (!userIds.has(id)) {
        removeParticipant(id);
      }
    });
  }, [users, isConnected, userId, participants, addParticipant, removeParticipant]);

  // Calculate participant count
  const participantCount = participants.size + 1; // +1 for self
  const participantsArray = Array.from(participants.values());

  // Count muted participants
  const mutedByMeCount = participantsArray.filter((p) => p.isMutedByMe).length;
  const allMutedByMe = mutedByMeCount === participantsArray.length && participantsArray.length > 0;

  // Not connected - show join view
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-white/5">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">Voice Chat</span>
          </div>
        </div>

        {/* Join View */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Headphones className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              Join Voice Chat
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
              Talk with other musicians in real-time without affecting the audio engine
            </p>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Device selection */}
          {inputDevices.length > 1 && (
            <div className="w-full max-w-[200px]">
              <label className="block text-[10px] font-medium text-gray-500 dark:text-zinc-500 mb-1">
                Microphone
              </label>
              <select
                value={selectedInputDevice || ''}
                onChange={(e) => setSelectedInputDevice(e.target.value || null)}
                className="w-full px-2 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white"
              >
                <option value="">Default</option>
                {inputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={joinVoiceChat}
            disabled={isConnecting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              isConnecting
                ? 'bg-gray-700 text-gray-400 cursor-wait'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            )}
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                <span>Join</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
            Voice chat is separate from your instrument audio
          </p>
        </div>
      </div>
    );
  }

  // Connected - show voice chat view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={leaveVoiceChat}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-500">Voice Chat</span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-500 rounded-full">
            Live
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] text-gray-400">{participantCount}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between">
          {/* Self mute */}
          <button
            onClick={toggleSelfMute}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              isSelfMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            )}
          >
            {isSelfMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isSelfMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Master mute (mute all incoming) */}
          <button
            onClick={toggleMasterMute}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              isMasterMuted
                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
            )}
            title={isMasterMuted ? 'Unmute all incoming audio' : 'Mute all incoming audio'}
          >
            {isMasterMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span>{isMasterMuted ? 'Deafen' : 'Deafen'}</span>
          </button>

          {/* Leave */}
          <button
            onClick={leaveVoiceChat}
            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="Leave voice chat"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Your audio level indicator */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold',
              isSelfMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
            )}
          >
            {userName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                You
              </span>
              {isSelfMuted && (
                <MicOff className="w-3 h-3 text-red-400 shrink-0" />
              )}
            </div>
            {/* Audio level bar */}
            <div className="mt-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-75',
                  isSelfMuted ? 'bg-red-400/50' : 'bg-emerald-400'
                )}
                style={{
                  width: `${Math.min(100, (isSelfMuted ? 0 : localAudioLevel) * 200)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Participants list */}
      <div className="flex-1 overflow-y-auto">
        {participantsArray.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              Waiting for others to join...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-white/5">
            {participantsArray.map((participant) => (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                isMasterMuted={isMasterMuted}
                onMuteToggle={() =>
                  setParticipantMutedByMe(participant.id, !participant.isMutedByMe)
                }
                onVolumeChange={(volume) => setParticipantVolume(participant.id, volume)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with mute all toggle */}
      {participantsArray.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-white/5">
          <button
            onClick={() => (allMutedByMe ? unmuteAllParticipants() : muteAllParticipants())}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              allMutedByMe
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10'
            )}
          >
            {allMutedByMe ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Unmute All</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Mute All</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Individual participant item
interface ParticipantItemProps {
  participant: VoiceChatParticipant;
  isMasterMuted: boolean;
  onMuteToggle: () => void;
  onVolumeChange: (volume: number) => void;
}

function ParticipantItem({
  participant,
  isMasterMuted,
  onMuteToggle,
  onVolumeChange,
}: ParticipantItemProps) {
  const [showVolume, setShowVolume] = useState(false);

  const isMuted = participant.isMutedByMe || participant.isMuted || isMasterMuted;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        {/* Avatar with speaking indicator */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all',
            participant.isSpeaking && !isMuted
              ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900'
              : '',
            isMuted ? 'bg-gray-500/20 text-gray-400' : 'bg-indigo-500/20 text-indigo-400'
          )}
        >
          {participant.name?.charAt(0).toUpperCase() || '?'}
        </div>

        {/* Name and level */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'text-xs font-medium truncate',
                isMuted ? 'text-gray-500 dark:text-zinc-500' : 'text-gray-900 dark:text-white'
              )}
            >
              {participant.name}
            </span>
            <div className="flex items-center gap-1">
              {participant.isMuted && (
                <span className="text-[9px] text-gray-500">muted</span>
              )}
              {participant.isMutedByMe && (
                <VolumeX className="w-3 h-3 text-orange-400" />
              )}
            </div>
          </div>

          {/* Audio level bar */}
          <div className="mt-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-75',
                isMuted ? 'bg-gray-400/50' : 'bg-indigo-400'
              )}
              style={{
                width: `${Math.min(100, (isMuted ? 0 : participant.audioLevel) * 200)}%`,
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Volume button - shows slider on click */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              showVolume
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
            )}
            title="Adjust volume"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>

          {/* Mute button */}
          <button
            onClick={onMuteToggle}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              participant.isMutedByMe
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
            )}
            title={participant.isMutedByMe ? 'Unmute' : 'Mute'}
          >
            {participant.isMutedByMe ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Volume slider (shown when clicking volume button) */}
      {showVolume && (
        <div className="mt-2 px-10">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={participant.volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-gray-400">0%</span>
            <span className="text-[9px] text-gray-400">
              {Math.round(participant.volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
