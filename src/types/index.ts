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
  bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
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

// Audio input channel configuration
export interface InputChannelConfig {
  channelCount: 1 | 2; // Mono or Stereo
  leftChannel: number; // 0-indexed channel number for left/mono
  rightChannel?: number; // 0-indexed channel number for right (stereo only)
}

// Effect parameter types
export interface CompressorSettings {
  enabled: boolean;
  threshold: number; // dB (-60 to 0)
  ratio: number; // 1:1 to 20:1
  attack: number; // ms (0 to 1000)
  release: number; // ms (0 to 3000)
  knee: number; // dB (0 to 40)
  makeupGain: number; // dB (-12 to 24)
}

export interface ReverbSettings {
  enabled: boolean;
  type: 'room' | 'hall' | 'plate' | 'spring' | 'ambient';
  mix: number; // 0 to 1 (dry/wet)
  decay: number; // 0.1 to 10 seconds
  preDelay: number; // 0 to 100 ms
  highCut: number; // Hz (1000 to 20000)
  lowCut: number; // Hz (20 to 1000)
}

export interface EQBand {
  frequency: number; // Hz
  gain: number; // dB (-24 to 24)
  q: number; // 0.1 to 10
  type: 'lowshelf' | 'highshelf' | 'peaking' | 'lowpass' | 'highpass';
}

export interface EQSettings {
  enabled: boolean;
  bands: EQBand[];
}

export interface NoiseGateSettings {
  enabled: boolean;
  threshold: number; // dB (-96 to 0)
  attack: number; // ms (0 to 50)
  hold: number; // ms (0 to 500)
  release: number; // ms (0 to 500)
  range: number; // dB (-80 to 0) - how much to attenuate when closed
}

export interface LimiterSettings {
  enabled: boolean;
  threshold: number; // dB (-24 to 0)
  release: number; // ms (10 to 1000)
  ceiling: number; // dB (-6 to 0)
}

// Complete effects chain settings
export interface TrackEffectsChain {
  noiseGate: NoiseGateSettings;
  eq: EQSettings;
  compressor: CompressorSettings;
  reverb: ReverbSettings;
  limiter: LimiterSettings;
}

// Effect presets
export type EffectPresetType = 'vocal' | 'guitar' | 'bass' | 'drums' | 'keys' | 'acoustic' | 'clean' | 'custom';

export interface EffectPreset {
  id: string;
  name: string;
  type: EffectPresetType;
  effects: TrackEffectsChain;
}

// Per-track audio settings
export interface TrackAudioSettings {
  inputMode: 'microphone' | 'application';
  inputDeviceId: string;
  sampleRate: 48000 | 44100;
  bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  // For application capture
  applicationName?: string;
  // Advanced input selection
  channelConfig: InputChannelConfig;
  // Input gain before effects
  inputGain: number; // dB (-24 to 24)
  // Effects chain
  effects: TrackEffectsChain;
  // Active preset (if any)
  activePreset?: string;
  // Monitoring
  directMonitoring: boolean;
  monitoringVolume: number; // 0 to 1
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
  // Ownership and persistence fields
  ownerUserId?: string; // Original owner (for reassignment on rejoin)
  ownerUserName?: string; // Display name of original owner
  isActive?: boolean; // Whether the owner is currently connected
}

// Extended Room types for room management
export interface RoomListItem {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  popLocation: string;
  maxUsers: number;
  isPublic: boolean;
  settings: Partial<RoomSettings>;
  // Extended fields for room browser
  activeUsers?: number;
  creatorName?: string;
  creatorUsername?: string;
  genre?: string;
  description?: string;
  tags?: string[];
  rules?: Partial<RoomRules>;
  lastActivity?: string;
}

export interface RoomRules {
  allowBackingTracks: boolean;
  allowAIGeneration: boolean;
  allowStemSeparation: boolean;
  allowRecording: boolean;
  requireMicCheck: boolean;
  customRules?: string[];
}

export interface CreateRoomInput {
  name: string;
  description?: string;
  isPublic: boolean;
  maxUsers: number;
  genre?: string;
  tags?: string[];
  rules?: Partial<RoomRules>;
  settings?: Partial<RoomSettings>;
}

export interface RoomActivity {
  roomId: string;
  activeUsers: number;
  lastActivity: string;
  isLive: boolean;
}

export type RoomFilter = 'all' | 'public' | 'my-rooms' | 'recent' | 'friends';

export interface RoomSearchParams {
  filter?: RoomFilter;
  genre?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// Mureka AI Music Generation Types
export type MurekaStyle =
  | 'pop'
  | 'rock'
  | 'hiphop'
  | 'rnb'
  | 'electronic'
  | 'jazz'
  | 'classical'
  | 'folk'
  | 'country'
  | 'metal'
  | 'reggae'
  | 'latin'
  | 'ambient'
  | 'lofi'
  | 'cinematic'
  | 'funk'
  | 'soul'
  | 'blues';

export type MurekaMood =
  | 'happy'
  | 'sad'
  | 'energetic'
  | 'chill'
  | 'romantic'
  | 'dark'
  | 'uplifting'
  | 'melancholic'
  | 'aggressive'
  | 'peaceful'
  | 'mysterious'
  | 'epic'
  | 'dreamy'
  | 'nostalgic';

export interface MurekaGenerationRequest {
  prompt: string;
  lyrics?: string;
  style?: MurekaStyle;
  mood?: MurekaMood;
  tempo?: 'slow' | 'medium' | 'fast' | 'very_fast';
  duration?: number;
  instrumental?: boolean;
  model?: 'standard' | 'pro' | 'ultra';
  referenceAudioUrl?: string;
  key?: string;
  customTags?: string[];
}

export interface MurekaTrack {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  style: MurekaStyle;
  mood?: MurekaMood;
  prompt: string;
  lyrics?: string;
  hasVocals: boolean;
  createdAt: string;
  waveformUrl?: string;
  coverArtUrl?: string;
  stems?: {
    vocals?: string;
    instrumental?: string;
  };
}

export interface MurekaGenerationProgress {
  stage: 'queued' | 'composing' | 'arranging' | 'vocals' | 'mixing' | 'mastering' | 'complete' | 'error';
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
  currentStep?: string;
}

// AudioDec (Facebook SAM Audio) Types - Stem Separation & Audio Manipulation
export type AudioDecStemType = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'strings' | 'other';

export interface AudioDecConfig {
  audioUrl: string;
  separationType: 'stems' | 'vocal-removal' | 'music-removal';
  outputFormat?: 'wav' | 'mp3' | 'flac';
  quality?: 'fast' | 'balanced' | 'high';
  stemTypes?: AudioDecStemType[];
}

export interface AudioDecResult {
  jobId: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  stems?: {
    [key in AudioDecStemType]?: string;
  };
  processingTime?: number;
  error?: string;
}

export interface AudioDecProgress {
  stage: 'uploading' | 'analyzing' | 'separating' | 'encoding' | 'complete';
  progress: number;
  message: string;
  currentStem?: AudioDecStemType;
}

// Text-to-Song Modification Types
export interface TextToSongModification {
  audioUrl: string;
  modification: 'style-transfer' | 'tempo-change' | 'key-change' | 'remix' | 'extend';
  parameters: {
    targetStyle?: MurekaStyle;
    targetTempo?: number;
    targetKey?: string;
    extensionDuration?: number;
    preserveVocals?: boolean;
  };
}

// AI Generation Provider Union Type
export type AIGenerationProvider = 'mureka' | 'musicgen';

export interface AIGenerationConfig {
  provider: AIGenerationProvider;
  prompt: string;
  duration?: number;
  style?: string;
  tempo?: number;
  key?: string;
  instrumental?: boolean;
  // Provider-specific options
  murekaOptions?: Partial<MurekaGenerationRequest>;
}
