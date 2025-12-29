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
  delayNode?: DelayNode; // For per-user latency compensation on incoming streams
  level: number;
  preMuteVolume?: number; // Store volume before muting so it can be restored
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
  inputMode: 'microphone' | 'application' | 'native';
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

// Room color and icon options
export const ROOM_COLORS = [
  { value: 'indigo', label: 'Indigo', gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-500' },
  { value: 'purple', label: 'Purple', gradient: 'from-purple-500 to-purple-600', bg: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', gradient: 'from-pink-500 to-pink-600', bg: 'bg-pink-500' },
  { value: 'rose', label: 'Rose', gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-500' },
  { value: 'red', label: 'Red', gradient: 'from-red-500 to-red-600', bg: 'bg-red-500' },
  { value: 'orange', label: 'Orange', gradient: 'from-orange-500 to-orange-600', bg: 'bg-orange-500' },
  { value: 'amber', label: 'Amber', gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-500' },
  { value: 'yellow', label: 'Yellow', gradient: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-500' },
  { value: 'lime', label: 'Lime', gradient: 'from-lime-500 to-lime-600', bg: 'bg-lime-500' },
  { value: 'green', label: 'Green', gradient: 'from-green-500 to-green-600', bg: 'bg-green-500' },
  { value: 'emerald', label: 'Emerald', gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500' },
  { value: 'teal', label: 'Teal', gradient: 'from-teal-500 to-teal-600', bg: 'bg-teal-500' },
  { value: 'cyan', label: 'Cyan', gradient: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500' },
  { value: 'sky', label: 'Sky', gradient: 'from-sky-500 to-sky-600', bg: 'bg-sky-500' },
  { value: 'blue', label: 'Blue', gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-500' },
] as const;

export const ROOM_ICONS = [
  { value: 'music', label: 'Music', icon: '🎵' },
  { value: 'guitar', label: 'Guitar', icon: '🎸' },
  { value: 'drums', label: 'Drums', icon: '🥁' },
  { value: 'piano', label: 'Piano', icon: '🎹' },
  { value: 'microphone', label: 'Microphone', icon: '🎤' },
  { value: 'headphones', label: 'Headphones', icon: '🎧' },
  { value: 'saxophone', label: 'Saxophone', icon: '🎷' },
  { value: 'trumpet', label: 'Trumpet', icon: '🎺' },
  { value: 'violin', label: 'Violin', icon: '🎻' },
  { value: 'fire', label: 'Fire', icon: '🔥' },
  { value: 'star', label: 'Star', icon: '⭐' },
  { value: 'lightning', label: 'Lightning', icon: '⚡' },
  { value: 'rocket', label: 'Rocket', icon: '🚀' },
  { value: 'diamond', label: 'Diamond', icon: '💎' },
  { value: 'crown', label: 'Crown', icon: '👑' },
  { value: 'heart', label: 'Heart', icon: '❤️' },
  { value: 'moon', label: 'Moon', icon: '🌙' },
  { value: 'sun', label: 'Sun', icon: '☀️' },
  { value: 'wave', label: 'Wave', icon: '🌊' },
  { value: 'mountain', label: 'Mountain', icon: '🏔️' },
] as const;

export type RoomColor = typeof ROOM_COLORS[number]['value'];
export type RoomIcon = typeof ROOM_ICONS[number]['value'];

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
  // New visual customization fields
  color?: RoomColor;
  icon?: RoomIcon;
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
  color?: RoomColor;
  icon?: RoomIcon;
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

// Google Lyria RealTime AI Music Generation Types
// WebSocket-based real-time streaming music generation

/**
 * Musical scale options for Lyria
 * Each enum corresponds to relative major/minor keys
 */
export type LyriaScale =
  | 'C_MAJOR_A_MINOR'      // All white keys
  | 'G_MAJOR_E_MINOR'      // F#
  | 'D_MAJOR_B_MINOR'      // F#, C#
  | 'A_MAJOR_F_SHARP_MINOR'// F#, C#, G#
  | 'E_MAJOR_C_SHARP_MINOR'// F#, C#, G#, D#
  | 'B_MAJOR_G_SHARP_MINOR'// F#, C#, G#, D#, A#
  | 'F_MAJOR_D_MINOR'      // Bb
  | 'B_FLAT_MAJOR_G_MINOR' // Bb, Eb
  | 'E_FLAT_MAJOR_C_MINOR' // Bb, Eb, Ab
  | 'A_FLAT_MAJOR_F_MINOR' // Bb, Eb, Ab, Db
  | 'CHROMATIC';           // All notes

/**
 * Lyria RealTime session configuration
 */
export interface LyriaConfig {
  bpm: number;              // 60-200 BPM
  scale?: LyriaScale;       // Musical scale/key
  density: number;          // 0.0-1.0 note density
  brightness: number;       // 0.0-1.0 spectral brightness
  guidance: number;         // 0.0-6.0 prompt adherence
  temperature: number;      // 0.0-3.0 creativity/chaos
  drums: number;            // 0.0-1.0 drum presence
  bass: number;             // 0.0-1.0 bass presence
  topK?: number;            // 1-1000 sampling parameter
  seed?: number;            // Random seed for reproducibility
}

/**
 * Weighted prompt for blending multiple musical influences
 */
export interface LyriaWeightedPrompt {
  text: string;
  weight: number;           // 0.0-1.0
}

/**
 * Lyria session state
 */
export type LyriaSessionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'playing'
  | 'paused'
  | 'error';

/**
 * Lyria audio chunk received from WebSocket
 */
export interface LyriaAudioChunk {
  data: ArrayBuffer;        // Raw PCM audio data
  timestamp: number;        // Timestamp in ms
  sampleRate: 48000;        // Always 48kHz
  channels: 2;              // Always stereo
}

/**
 * Lyria session events
 */
export interface LyriaSessionEvents {
  onStateChange: (state: LyriaSessionState) => void;
  onAudioChunk: (chunk: LyriaAudioChunk) => void;
  onError: (error: Error) => void;
  onConfigApplied: (config: LyriaConfig) => void;
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
    targetStyle?: string;
    targetTempo?: number;
    targetKey?: string;
    extensionDuration?: number;
    preserveVocals?: boolean;
  };
}

// AI Generation Provider Union Type
export type AIGenerationProvider = 'lyria';

export interface AIGenerationConfig {
  provider: AIGenerationProvider;
  prompt: string;
  bpm?: number;
  scale?: LyriaScale;
  // Lyria-specific options
  lyriaConfig?: Partial<LyriaConfig>;
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
// Extended Effects Types (New Effects)
// ============================================================================

// Pitch Correction / Auto-Tune Settings
export type PitchCorrectionScale = 'major' | 'minor' | 'chromatic' | 'pentatonicMajor' | 'pentatonicMinor' | 'blues' | 'dorian' | 'mixolydian' | 'harmonicMinor';

export interface PitchCorrectionSettings {
  enabled: boolean;
  key: string; // C, C#, D, etc.
  scale: PitchCorrectionScale;
  speed: number; // 0-100 (correction speed)
  humanize: number; // 0-100 (natural variation)
  formantPreserve: boolean;
  detune: number; // -100 to +100 cents
  mix: number; // 0-100
}

// Vocal Doubler Settings
export interface VocalDoublerSettings {
  enabled: boolean;
  detune: number; // 0-50 cents
  delay: number; // 0-50 ms
  spread: number; // 0-100 (stereo width)
  depth: number; // 0-100 (modulation depth)
  mix: number; // 0-100
  voices: number; // 1-4
}

// De-Esser Settings
export type DeEsserMode = 'split' | 'wideband';

export interface DeEsserSettings {
  enabled: boolean;
  frequency: number; // 2000-10000 Hz
  threshold: number; // -60 to 0 dB
  reduction: number; // 0-24 dB
  range: number; // 0-24 dB
  attack: number; // 0.1-10 ms
  release: number; // 10-500 ms
  mode: DeEsserMode;
  listenMode: boolean;
}

// Formant Shifter Settings
export interface FormantShifterSettings {
  enabled: boolean;
  shift: number; // -12 to +12 semitones
  gender: number; // -100 to +100
  preservePitch: boolean;
  mix: number; // 0-100
}

// Harmonizer Settings
export type HarmonyType = 'octave' | 'fifth' | 'fourth' | 'third' | 'minorThird' | 'sixth' | 'powerChord' | 'majorChord' | 'minorChord' | 'thirdAndFifth' | 'thirdBelow' | 'fifthBelow' | 'octaveBelow' | 'custom';

export interface HarmonizerSettings {
  enabled: boolean;
  key: string;
  scale: 'major' | 'minor';
  harmonyType: HarmonyType;
  customIntervals: number[]; // Semitones
  voices: number; // 1-4
  spread: number; // 0-100
  shift: number; // -1200 to +1200 cents
  mix: number; // 0-100
  keyLock: boolean;
}

// Bitcrusher Settings
export interface BitcrusherSettings {
  enabled: boolean;
  bits: number; // 1-16
  sampleRate: number; // 100-44100 Hz
  mix: number; // 0-100
  dither: boolean;
}

// Ring Modulator Settings
export type RingModWaveform = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface RingModulatorSettings {
  enabled: boolean;
  frequency: number; // 20-5000 Hz
  waveform: RingModWaveform;
  mix: number; // 0-100
  lfoRate: number; // 0-10 Hz
  lfoDepth: number; // 0-100
}

// Frequency Shifter Settings
export interface FrequencyShifterSettings {
  enabled: boolean;
  shift: number; // -2000 to +2000 Hz
  feedback: number; // 0-100
  mix: number; // 0-100
  direction: 'up' | 'down' | 'both';
}

// Granular Delay Settings
export interface GranularDelaySettings {
  enabled: boolean;
  grainSize: number; // 10-500 ms
  density: number; // 0-100
  pitch: number; // -24 to +24 semitones
  pitchRandom: number; // 0-100
  position: number; // 0-2000 ms
  positionRandom: number; // 0-100
  feedback: number; // 0-100
  spread: number; // 0-100
  reverse: number; // 0-100 (probability)
  mix: number; // 0-100
  freeze: boolean;
}

// Rotary Speaker (Leslie) Settings
export type RotarySpeed = 'slow' | 'fast' | 'brake';

export interface RotarySpeakerSettings {
  enabled: boolean;
  speed: RotarySpeed;
  hornLevel: number; // 0-100
  drumLevel: number; // 0-100
  distance: number; // 0-100
  drive: number; // 0-100
  mix: number; // 0-100
}

// Auto-Pan Settings
export type AutoPanWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface AutoPanSettings {
  enabled: boolean;
  rate: number; // 0.1-20 Hz
  depth: number; // 0-100
  waveform: AutoPanWaveform;
  phase: number; // 0-360 degrees
  tempoSync: boolean;
  subdivision: DelaySubdivision;
  width: number; // 0-100
}

// Multi-Mode Filter Settings
export type MultiFilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass';
export type MultiFilterWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface MultiFilterSettings {
  enabled: boolean;
  type: MultiFilterType;
  frequency: number; // 20-20000 Hz
  resonance: number; // 0.1-30
  drive: number; // 0-100
  lfoRate: number; // 0-20 Hz
  lfoDepth: number; // 0-100
  lfoWaveform: MultiFilterWaveform;
  envelopeAmount: number; // -100 to +100
  envelopeSensitivity: number; // 0-100
  envelopeAttack: number; // ms
  envelopeRelease: number; // ms
  keyTrack: number; // -100 to +100
  tempoSync: boolean;
  subdivision: DelaySubdivision;
  mix: number; // 0-100
}

// Vibrato Settings
export interface VibratoSettings {
  enabled: boolean;
  rate: number; // 0.1-20 Hz
  depth: number; // 0-100
  waveform: AutoPanWaveform;
  stereo: number; // 0-180 degrees
  tempoSync: boolean;
  subdivision: DelaySubdivision;
}

// Transient Shaper Settings
export interface TransientShaperSettings {
  enabled: boolean;
  attack: number; // -100 to +100
  sustain: number; // -100 to +100
  attackTime: number; // 1-50 ms
  releaseTime: number; // 10-500 ms
  output: number; // -12 to +12 dB
}

// Stereo Imager Settings
export interface StereoImagerSettings {
  enabled: boolean;
  width: number; // 0-200 (100 = normal)
  midLevel: number; // -12 to +12 dB
  sideLevel: number; // -12 to +12 dB
  bassMonoFreq: number; // 20-500 Hz
  bassMonoAmount: number; // 0-100
  balance: number; // -100 to +100
}

// Exciter Settings
export type ExciterHarmonics = 'odd' | 'even' | 'both';

export interface ExciterSettings {
  enabled: boolean;
  frequency: number; // 1000-10000 Hz
  amount: number; // 0-100
  harmonics: ExciterHarmonics;
  color: number; // 0-100
  mix: number; // 0-100
}

// Multiband Compressor Settings
export interface MultibandBandSettings {
  threshold: number; // -60 to 0 dB
  ratio: number; // 1-20
  attack: number; // 0-1000 ms
  release: number; // 0-3000 ms
  gain: number; // -12 to +12 dB
  solo: boolean;
  bypass: boolean;
}

export interface MultibandCompressorSettings {
  enabled: boolean;
  lowCrossover: number; // 20-500 Hz
  highCrossover: number; // 500-10000 Hz
  low: MultibandBandSettings;
  mid: MultibandBandSettings;
  high: MultibandBandSettings;
  outputGain: number; // -12 to +12 dB
}

// Stereo Delay Settings
export interface StereoDelaySettings {
  enabled: boolean;
  leftTime: number; // 0-2000 ms
  rightTime: number; // 0-2000 ms
  leftFeedback: number; // 0-100
  rightFeedback: number; // 0-100
  crossFeed: number; // 0-100
  tone: number; // 0-100
  tempoSync: boolean;
  leftSubdivision: DelaySubdivision;
  rightSubdivision: DelaySubdivision;
  pingPong: boolean;
  mix: number; // 0-100
}

// Room Simulator Settings
export type RoomSize = 'small' | 'medium' | 'large' | 'hall';

export interface RoomSimulatorSettings {
  enabled: boolean;
  size: RoomSize;
  damping: number; // 0-100
  earlyLevel: number; // 0-100
  lateLevel: number; // 0-100
  decay: number; // 0.1-5 seconds
  preDelay: number; // 0-100 ms
  diffusion: number; // 0-100
  modulation: number; // 0-100
  mix: number; // 0-100
}

// Shimmer Reverb Settings
export interface ShimmerReverbSettings {
  enabled: boolean;
  decay: number; // 0.5-10 seconds
  shimmer: number; // 0-100
  pitch: number; // 0, 5, 7, 12, 19, 24 semitones
  damping: number; // 0-100
  tone: number; // 0-100
  modulation: number; // 0-100
  preDelay: number; // 0-100 ms
  diffusion: number; // 0-100
  mix: number; // 0-100
}

// Extended Unified Effects Chain with all new effects
export interface ExtendedEffectsChain extends UnifiedEffectsChain {
  // Vocal effects
  pitchCorrection: PitchCorrectionSettings;
  vocalDoubler: VocalDoublerSettings;
  deEsser: DeEsserSettings;
  formantShifter: FormantShifterSettings;
  harmonizer: HarmonizerSettings;
  // Creative effects
  bitcrusher: BitcrusherSettings;
  ringModulator: RingModulatorSettings;
  frequencyShifter: FrequencyShifterSettings;
  granularDelay: GranularDelaySettings;
  // Additional modulation
  rotarySpeaker: RotarySpeakerSettings;
  autoPan: AutoPanSettings;
  multiFilter: MultiFilterSettings;
  vibrato: VibratoSettings;
  // Dynamics/Utility
  transientShaper: TransientShaperSettings;
  stereoImager: StereoImagerSettings;
  exciter: ExciterSettings;
  multibandCompressor: MultibandCompressorSettings;
  // Spatial
  stereoDelay: StereoDelaySettings;
  roomSimulator: RoomSimulatorSettings;
  shimmerReverb: ShimmerReverbSettings;
}

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
