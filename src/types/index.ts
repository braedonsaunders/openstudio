// Core type definitions for OpenStudio

export interface User {
  id: string;
  name: string;
  avatar?: string;
  instrument?: string;
  isMaster?: boolean;
  isMuted?: boolean;
  volume: number;
  latency: number;
  jitterBuffer: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  popLocation: string;
  maxUsers: number;
  users: User[];
  isPublic: boolean;
  settings: RoomSettings;
}

export interface RoomSettings {
  sampleRate: 48000 | 44100;
  bitDepth: 16 | 24;
  bufferSize: 128 | 256 | 512 | 1024;
  autoJitterBuffer: boolean;
  backingTrackVolume: number;
  masterVolume: number;
}

export interface BackingTrack {
  id: string;
  name: string;
  artist?: string;
  duration: number;
  url: string;
  waveformUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  stems?: AudioStems;
  isProcessing?: boolean;
  aiGenerated?: boolean;
  youtubeId?: string;
  thumbnail?: string;
}

export interface AudioStems {
  vocals?: string;
  drums?: string;
  bass?: string;
  other?: string;
  original: string;
}

export interface TrackQueue {
  tracks: BackingTrack[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  syncTimestamp: number;
}

export interface JitterStats {
  averageJitter: number;
  maxJitter: number;
  packetLoss: number;
  roundTripTime: number;
  recommendedBuffer: number;
}

export interface AudioStream {
  userId: string;
  stream: MediaStream;
  analyser?: AnalyserNode;
  gainNode?: GainNode;
  level: number;
}

export interface CloudflareSession {
  sessionId: string;
  tracks: CloudflareTrack[];
}

export interface CloudflareTrack {
  trackId: string;
  userId: string;
  kind: 'audio' | 'video';
  mid?: string;
}

export interface SunoGenerationRequest {
  prompt: string;
  duration?: number;
  style?: string;
  tempo?: number;
  key?: string;
  continueFromId?: string;
}

export interface SAMSeparationRequest {
  trackId: string;
  separationType: 'vocals' | 'drums' | 'bass' | 'all';
}

export interface WebRTCStats {
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  jitter: number;
  roundTripTime: number;
  timestamp: number;
}

export interface RoomMessage {
  type: 'chat' | 'system' | 'sync' | 'control';
  userId: string;
  userName?: string;
  userColor?: string;
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type StemType = 'vocals' | 'drums' | 'bass' | 'other' | 'original';

export interface StemMixState {
  vocals: { enabled: boolean; volume: number };
  drums: { enabled: boolean; volume: number };
  bass: { enabled: boolean; volume: number };
  other: { enabled: boolean; volume: number };
}

// Per-track audio settings
export interface TrackAudioSettings {
  inputMode: 'microphone' | 'application';
  inputDeviceId: string;
  sampleRate: 48000 | 44100;
  bufferSize: 128 | 256 | 512 | 1024;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  // For application capture
  applicationName?: string;
}

// User track - represents a single audio input track from a user
export interface UserTrack {
  id: string;
  userId: string;
  name: string;
  color: string;
  audioSettings: TrackAudioSettings;
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  isArmed: boolean; // Ready to record
  isRecording: boolean;
  stream?: MediaStream;
  createdAt: number;
}
