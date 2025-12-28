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
  waveformData?: number[]; // Pre-computed waveform peaks (0-1 normalized)
  uploadedBy: string;
  uploadedAt: string;
  stems?: AudioStems;
  isProcessing?: boolean;
  aiGenerated?: boolean;
  youtubeId?: string;
  thumbnail?: string;
  // Musical metadata (can be set manually or detected via analysis)
  bpm?: number;
  key?: string;
  keyScale?: 'major' | 'minor';
  timeSignature?: [number, number]; // e.g., [4, 4] for 4/4
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

// Real-time audio performance metrics
export interface AudioPerformanceMetrics {
  // Timing metrics (all in ms)
  audioContextLatency: number; // Audio context baseLatency (processing/buffer latency)
  outputLatency: number; // Hardware output latency
  jsProcessingTime: number; // Time spent in JS audio processing
  effectsProcessingTime: number; // Time spent in effects chain
  totalLatency: number; // Sum of processing + output latency

  // Buffer metrics
  currentBufferSize: number; // Actual buffer size in samples (derived from baseLatency)
  underruns: number; // Audio buffer underruns count

  // Per-track metrics
  trackMetrics: Map<string, TrackPerformanceMetrics>;

  // Timestamps
  lastUpdate: number;
}

export interface TrackPerformanceMetrics {
  trackId: string;
  inputLevel: number;
  outputLevel: number;
  effectsTime: number;
  isMuted: boolean;
  isSolo: boolean;
  isClipping: boolean;
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
  effects: UnifiedEffectsChain;
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
  // Unified effects chain (all 15 effects in signal chain order)
  effects: UnifiedEffectsChain;
  // Active preset (if any)
  activePreset?: string;
  // Monitoring
  directMonitoring: boolean;
  monitoringVolume: number; // 0 to 1
}

// MIDI Input Settings for MIDI tracks
export interface MidiInputSettings {
  deviceId: string | null;
  deviceName?: string;
  channel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 'all';
  soundBank: string;
  soundPreset: string;
  noteMapping?: Record<number, number>;
  arpeggiator?: {
    enabled: boolean;
    mode: 'up' | 'down' | 'updown' | 'random' | 'order';
    rate: '1/4' | '1/8' | '1/16' | '1/32';
    octaves: 1 | 2 | 3 | 4;
    gate: number;
  };
  velocityCurve: 'linear' | 'soft' | 'hard';
}

// User track type discriminator
export type UserTrackType = 'audio' | 'midi';

// User track - represents a single audio or MIDI input track from a user
export interface UserTrack {
  id: string;
  userId: string;
  name: string;
  color: string;
  // Track type discriminator
  type: 'audio' | 'midi';
  // Audio settings (required for audio tracks)
  audioSettings: TrackAudioSettings;
  // MIDI settings (required for MIDI tracks)
  midiSettings?: MidiInputSettings;
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
  // MIDI-specific live state (not persisted)
  activeMidiNotes?: number[]; // Currently held MIDI notes
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

// ============================================================================
// Guitar Effects Types
// ============================================================================

// Overdrive Settings - Soft clipping tube-style saturation
export interface OverdriveSettings {
  enabled: boolean;
  drive: number; // 0-1, amount of overdrive
  tone: number; // 0-1, brightness control
  level: number; // 0-1, output level
}

// Distortion Settings - Hard clipping with multiple voicings
export type DistortionType = 'classic' | 'hard' | 'fuzz' | 'asymmetric' | 'rectifier';

export interface DistortionSettings {
  enabled: boolean;
  amount: number; // 0-1, distortion intensity
  type: DistortionType;
  tone: number; // 0-1, brightness control
  level: number; // 0-1, output level
}

// Amp Simulator Settings - Full amp modeling
export type AmpType = 'clean' | 'crunch' | 'highgain' | 'british' | 'american' | 'modern';

export interface AmpSimulatorSettings {
  enabled: boolean;
  type: AmpType;
  gain: number; // 0-1, preamp gain
  bass: number; // 0-1, bass EQ
  mid: number; // 0-1, mid EQ
  treble: number; // 0-1, treble EQ
  presence: number; // 0-1, presence/high-end boost
  master: number; // 0-1, master volume
}

// Cabinet Simulator Settings - IR-based speaker emulation
export type CabinetType = '1x12' | '2x12' | '4x12' | '1x15' | '2x10' | 'direct';
export type MicPosition = 'center' | 'edge' | 'room' | 'blend';

export interface CabinetSimulatorSettings {
  enabled: boolean;
  type: CabinetType;
  micPosition: MicPosition;
  mix: number; // 0-1, dry/wet mix
  roomLevel: number; // 0-1, room ambience
  customIRUrl?: string; // URL to custom impulse response
}

// Delay Settings - Multi-mode delay with tempo sync
export type DelayType = 'digital' | 'analog' | 'tape' | 'pingpong' | 'reverse';
export type DelaySubdivision =
  | '1/1'
  | '1/2'
  | '1/2D'
  | '1/4'
  | '1/4D'
  | '1/4T'
  | '1/8'
  | '1/8D'
  | '1/8T'
  | '1/16'
  | '1/16D'
  | '1/16T';

export interface DelaySettings {
  enabled: boolean;
  type: DelayType;
  time: number; // 0.01-2.0 seconds
  feedback: number; // 0-1
  mix: number; // 0-1
  tone: number; // 0-1, brightness of echoes
  modulation: number; // 0-1, for analog/tape character
  pingPongSpread: number; // 0-1, stereo spread
  tempo: number; // BPM
  tempoSync: boolean;
  subdivision: DelaySubdivision;
}

// Chorus Settings - LFO-modulated delay for thickness
export interface ChorusSettings {
  enabled: boolean;
  rate: number; // 0.1-10 Hz, LFO rate
  depth: number; // 0-1, modulation depth
  delay: number; // 2-20 ms, base delay time
  feedback: number; // 0-1
  spread: number; // 0-180 degrees, stereo spread
  mix: number; // 0-1
}

// Flanger Settings - Short modulated delay with feedback
export interface FlangerSettings {
  enabled: boolean;
  rate: number; // 0.05-5 Hz, LFO rate
  depth: number; // 0-1, modulation depth
  delay: number; // 0.5-10 ms, base delay time
  feedback: number; // 0-1
  mix: number; // 0-1
  negative: boolean; // Invert feedback for different character
}

// Phaser Settings - Allpass filter cascade with LFO
export interface PhaserSettings {
  enabled: boolean;
  rate: number; // 0.1-8 Hz, LFO rate
  depth: number; // 0-1, modulation depth
  baseFrequency: number; // 100-4000 Hz, center frequency
  octaves: number; // 0.5-6, sweep range
  stages: number; // 2-12 (even numbers), number of allpass stages
  feedback: number; // 0-1, resonance
  q: number; // 0.1-10, filter Q
  mix: number; // 0-1
}

// Wah Settings - Bandpass filter with multiple control modes
export type WahMode = 'manual' | 'auto' | 'envelope';

export interface WahSettings {
  enabled: boolean;
  mode: WahMode;
  frequency: number; // 0-1, manual position (heel to toe)
  rate: number; // 0.1-10 Hz, auto mode LFO rate
  depth: number; // 0-1, sweep depth
  baseFrequency: number; // Hz, minimum frequency
  maxFrequency: number; // Hz, maximum frequency
  q: number; // 1-20, filter resonance
  sensitivity: number; // 0-1, envelope sensitivity
  attack: number; // seconds, envelope attack
  release: number; // seconds, envelope release
  mix: number; // 0-1
}

// Tremolo Settings - Amplitude modulation
export type TremoloWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface TremoloSettings {
  enabled: boolean;
  rate: number; // 0.1-20 Hz, LFO rate
  depth: number; // 0-1, modulation depth
  spread: number; // 0-180 degrees, stereo spread
  waveform: TremoloWaveform;
}

// Complete Guitar Effects Chain
export interface GuitarEffectsChain {
  wah: WahSettings;
  overdrive: OverdriveSettings;
  distortion: DistortionSettings;
  ampSimulator: AmpSimulatorSettings;
  cabinet: CabinetSimulatorSettings;
  chorus: ChorusSettings;
  flanger: FlangerSettings;
  phaser: PhaserSettings;
  delay: DelaySettings;
  tremolo: TremoloSettings;
}

// Unified Effects Chain - combines all effects in signal chain order
// Signal flow: wah → overdrive → distortion → amp → cabinet → noiseGate → eq → compressor → chorus → flanger → phaser → delay → tremolo → reverb → limiter
export interface UnifiedEffectsChain {
  // Guitar/instrument effects (pre-processing)
  wah: WahSettings;
  overdrive: OverdriveSettings;
  distortion: DistortionSettings;
  ampSimulator: AmpSimulatorSettings;
  cabinet: CabinetSimulatorSettings;
  // Track effects (mixing)
  noiseGate: NoiseGateSettings;
  eq: EQSettings;
  compressor: CompressorSettings;
  // Modulation effects
  chorus: ChorusSettings;
  flanger: FlangerSettings;
  phaser: PhaserSettings;
  // Time-based effects
  delay: DelaySettings;
  tremolo: TremoloSettings;
  // Output effects
  reverb: ReverbSettings;
  limiter: LimiterSettings;
}

// Guitar Effect Preset Types
export type GuitarPresetCategory =
  | 'clean'
  | 'crunch'
  | 'high-gain'
  | 'metal'
  | 'blues'
  | 'acoustic-sim'
  | 'ambient'
  | 'classic-rock'
  | 'modern-rock'
  | 'funk'
  | 'custom';

export interface GuitarEffectPreset {
  id: string;
  name: string;
  category: GuitarPresetCategory;
  description?: string;
  effects: GuitarEffectsChain;
}

// Legacy type aliases for backwards compatibility
/** @deprecated Use UnifiedEffectsChain instead */
export type ExtendedTrackAudioSettings = TrackAudioSettings;

// ============================================================================
// World-Class Latency & Synchronization Types
// ============================================================================

/**
 * Quality preset names for audio encoding/latency tradeoffs
 */
export type QualityPresetName =
  | 'ultra-low-latency'
  | 'low-latency'
  | 'balanced'
  | 'high-quality'
  | 'studio-quality'
  | 'poor-connection'
  | 'custom';

/**
 * Opus encoding settings - controls codec behavior
 */
export interface OpusEncodingSettings {
  /** Bitrate in kbps (24-510) */
  bitrate: number;
  /** Frame size in ms (10 or 20) - lower = less latency */
  frameSize: 10 | 20;
  /** Encoder complexity (0-10) - higher = better quality but more CPU */
  complexity: number;
  /** Forward Error Correction - helps with packet loss but adds latency */
  fec: boolean;
  /** Discontinuous Transmission - saves bandwidth during silence */
  dtx: boolean;
  /** Constant Bitrate - more predictable latency */
  cbr: boolean;
  /** In-band FEC for voice - additional redundancy */
  inbandFec: boolean;
  /** Packet loss percentage to optimize for (0-100) */
  packetLossPercentage: number;
}

/**
 * Quality preset with all encoding and buffer settings
 */
export interface QualityPreset {
  name: string;
  id: QualityPresetName;
  description: string;
  icon: string;
  encoding: OpusEncodingSettings;
  jitterMode: 'live-jamming' | 'balanced' | 'stable';
  lowLatencyMode: boolean;
  /** Recommended for connections under this RTT (ms) */
  recommendedMaxRtt: number;
}

/**
 * Jam compatibility assessment
 */
export type JamQuality = 'tight' | 'good' | 'loose' | 'difficult' | 'impossible';

export interface JamCompatibility {
  canJam: boolean;
  quality: JamQuality;
  maxGroupLatency: number;
  recommendation: string;
  suggestedBpmMax?: number;
  autoOptimizations: AutoOptimization[];
}

export interface AutoOptimization {
  type: 'reduce_buffer' | 'increase_buffer' | 'enable_fec' | 'disable_fec' |
        'reduce_bitrate' | 'increase_bitrate' | 'bypass_effects' |
        'enable_effects' | 'switch_preset';
  description: string;
  automatic: boolean;
  applied?: boolean;
}

/**
 * Per-user performance information (shared with room)
 */
export interface UserPerformanceInfo {
  userId: string;
  userName: string;

  // Network metrics
  rttToMaster: number;           // ms - RTT to room master
  rttEstimated: number;          // ms - estimated end-to-end latency
  jitter: number;                // ms - network jitter
  packetLoss: number;            // percentage (0-100)
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';

  // Encoding info
  codec: 'opus';
  sampleRate: 48000 | 44100;
  bitrate: number;               // kbps
  frameSize: 10 | 20;            // ms
  fecEnabled: boolean;
  dtxEnabled: boolean;

  // Processing info
  jitterBufferMode: 'live-jamming' | 'balanced' | 'stable';
  jitterBufferSize: number;      // samples
  effectsLatency: number;        // ms added by effects chain
  activePreset: QualityPresetName;

  // Compensation info
  compensationDelay: number;     // ms of artificial delay added
  clockOffset: number;           // ms offset from master clock

  // Latency breakdown
  latencyBreakdown: LatencyBreakdown;

  // Derived
  totalLatency: number;          // End-to-end estimated latency
  qualityScore: number;          // 0-100 quality estimation

  // Timestamp
  lastUpdate: number;
}

/**
 * Detailed latency breakdown for visualization
 */
export interface LatencyBreakdown {
  capture: number;       // Audio capture latency (getUserMedia)
  encode: number;        // Opus encoding time
  network: number;       // Network RTT / 2
  jitterBuffer: number;  // Jitter buffer delay
  decode: number;        // Opus decoding time
  effects: number;       // Effects processing
  playback: number;      // Audio output latency
  compensation: number;  // Artificial delay for sync
  total: number;         // Sum of all
}

/**
 * Clock sync message sent via WebRTC data channel
 */
export interface ClockSyncMessage {
  type: 'clock_sync';
  masterTime: number;        // Master's performance.now()
  masterWallClock: number;   // Master's Date.now()
  beatPosition: number;      // Current beat position
  bpm: number;               // Current BPM
  sendTimestamp: number;     // When packet was sent
  sequence: number;          // Sequence number for ordering
}

/**
 * Clock sync acknowledgment
 */
export interface ClockSyncAck {
  type: 'clock_ack';
  originalSendTime: number;
  clientReceiveTime: number;
  clientId: string;
  sequence: number;
}

/**
 * Performance info broadcast message
 */
export interface PerformanceInfoMessage {
  type: 'performance_info';
  userId: string;
  info: Omit<UserPerformanceInfo, 'userId' | 'userName'>;
}

/**
 * Master handoff message
 */
export interface MasterHandoffMessage {
  type: 'master_handoff';
  previousMasterId: string;
  newMasterId: string;
  lastKnownBeatPosition: number;
  lastKnownBpm: number;
  handoffTime: number;
}

/**
 * Latency compensation settings message
 */
export interface LatencyCompensationMessage {
  type: 'latency_compensation';
  targetDelay: number;       // Global target delay all users sync to
  userDelays: Record<string, number>;  // Per-user compensation delays
}

/**
 * All data channel message types
 */
export type DataChannelMessage =
  | ClockSyncMessage
  | ClockSyncAck
  | PerformanceInfoMessage
  | MasterHandoffMessage
  | LatencyCompensationMessage
  | { type: 'ping'; timestamp: number; senderId: string }
  | { type: 'pong'; originalTimestamp: number; senderId: string; responderId: string };

/**
 * Clock sample for NTP-style sync
 */
export interface ClockSample {
  offset: number;
  rtt: number;
  timestamp: number;
  weight: number;
}

/**
 * Latency history sample for prediction
 */
export interface LatencySample {
  rtt: number;
  jitter: number;
  packetLoss: number;
  timestamp: number;
}

/**
 * Network quality trend
 */
export interface NetworkTrend {
  direction: 'improving' | 'stable' | 'degrading';
  confidence: number;
  predictedRtt: number;
  predictedJitter: number;
}

/**
 * Auto-optimization engine state
 */
export interface OptimizationState {
  isEnabled: boolean;
  lastOptimization: number;
  recentIssues: OptimizationIssue[];
  appliedOptimizations: AutoOptimization[];
  pendingOptimizations: AutoOptimization[];
}

export interface OptimizationIssue {
  type: 'high_jitter' | 'high_latency' | 'packet_loss' | 'buffer_underrun' |
        'bandwidth_constrained' | 'consistent_low_latency';
  severity: 'low' | 'medium' | 'high';
  detectedAt: number;
  resolved: boolean;
}

/**
 * Room synchronization state
 */
export interface RoomSyncState {
  masterId: string;
  masterName: string;
  clockOffset: number;
  clockDrift: number;
  lastSyncTime: number;
  syncQuality: 'excellent' | 'good' | 'fair' | 'poor';
  participantPerformance: Map<string, UserPerformanceInfo>;
  jamCompatibility: JamCompatibility;
  targetCompensationDelay: number;
}

// ============================================================================
// Quality Preset Constants (exported from types for reference)
// ============================================================================

/**
 * All available bitrate options for Opus encoding
 * Range: 24kbps (voice) to 510kbps (studio quality)
 */
export const OPUS_BITRATES = [
  24, 32, 48, 64, 96, 128, 160, 192, 256, 320, 384, 448, 510
] as const;

export type OpusBitrate = typeof OPUS_BITRATES[number];
