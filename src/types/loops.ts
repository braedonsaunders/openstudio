// Loop Tracks Type Definitions

import type { TrackEffectsChain } from './index';

// =============================================================================
// MIDI Note Types
// =============================================================================

export interface MidiNote {
  t: number;     // Time (0-1 normalized to loop length)
  n: number;     // MIDI note number (0-127)
  v: number;     // Velocity (0-127)
  d: number;     // Duration (0-1 normalized)
}

// =============================================================================
// Loop Library Types
// =============================================================================

export type LoopCategory = 'drums' | 'bass' | 'keys' | 'guitar' | 'synth' | 'full-beats';

export interface LoopSubcategory {
  id: string;
  name: string;
  loopCount: number;
}

export interface LoopCategoryInfo {
  id: LoopCategory;
  name: string;
  icon: string;
  subcategories: LoopSubcategory[];
}

export interface LoopDefinition {
  id: string;
  name: string;
  category: LoopCategory;
  subcategory: string;

  // Musical properties
  bpm: number;
  bars: number;
  timeSignature: [number, number];
  key?: string;

  // MIDI data
  midiData: MidiNote[];

  // Sound mapping
  soundPreset: string;

  // Metadata
  tags: string[];
  intensity: 1 | 2 | 3 | 4 | 5;
  complexity: 1 | 2 | 3 | 4 | 5;
}

// =============================================================================
// Loop Track Instance (stored in database)
// =============================================================================

export interface LoopTrackState {
  id: string;
  roomId: string;

  // Creator info
  createdBy?: string;
  createdByName?: string;

  // Loop definition
  loopId: string;
  customMidiData?: MidiNote[];

  // Playback state
  isPlaying: boolean;
  startTime?: number;
  loopStartBeat: number;

  // Sound configuration
  soundPreset: string;
  soundSettings: Record<string, unknown>;

  // Musical adaptation
  tempoLocked: boolean;
  targetBpm?: number;
  keyLocked: boolean;
  targetKey?: string;
  transposeAmount: number;

  // Mixer settings
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;

  // Effects
  effects: TrackEffectsChain;

  // Humanization
  humanizeEnabled: boolean;
  humanizeTiming: number;
  humanizeVelocity: number;

  // Display
  color: string;
  name?: string;
  position: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Sound Engine Types
// =============================================================================

export type SoundBankType = 'sampler' | 'synth' | 'drumkit';

export interface SoundBankInfo {
  id: string;
  name: string;
  type: SoundBankType;
  category: string;
}

export interface OscillatorConfig {
  type: OscillatorType;
  detune: number;
  gain: number;
}

export interface FilterConfig {
  type: BiquadFilterType;
  cutoff: number;
  resonance: number;
  envAmount: number;
}

export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface SynthConfig {
  oscillators: OscillatorConfig[];
  filter: FilterConfig;
  ampEnvelope: EnvelopeConfig;
  filterEnvelope?: EnvelopeConfig;
  lfo?: {
    rate: number;
    depth: number;
    target: 'pitch' | 'filter' | 'amplitude';
  };
}

export interface DrumKitConfig {
  samples: {
    [noteNumber: number]: {
      url: string;
      name: string;
    };
  };
}

export interface SamplerConfig {
  samples: {
    [noteNumber: number]: {
      url: string;
      baseNote: number;
    };
  };
  loop?: boolean;
  envelope?: EnvelopeConfig;
}

// =============================================================================
// MIDI Input Types
// =============================================================================

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
  type: 'input' | 'output';
}

export type MidiChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 'all';

export interface ArpeggiatorSettings {
  enabled: boolean;
  mode: 'up' | 'down' | 'updown' | 'random' | 'order';
  rate: '1/4' | '1/8' | '1/16' | '1/32';
  octaves: 1 | 2 | 3 | 4;
  gate: number; // 0-1
}

export interface MidiInputSettings {
  deviceId: string | null;
  deviceName?: string;
  channel: MidiChannel;
  soundBank: string;
  soundPreset: string;
  noteMapping?: Record<number, number>;
  arpeggiator?: ArpeggiatorSettings;
  velocityCurve: 'linear' | 'soft' | 'hard';
}

// =============================================================================
// Extended UserTrack type for MIDI
// =============================================================================

export type UserTrackType = 'audio' | 'midi';

// =============================================================================
// Loop Sync Events
// =============================================================================

export interface LoopPlayEvent {
  type: 'looptrack:play';
  trackId: string;
  syncTimestamp: number;
  loopStartBeat: number;
}

export interface LoopStopEvent {
  type: 'looptrack:stop';
  trackId: string;
}

export interface LoopAddEvent {
  type: 'looptrack:add';
  track: LoopTrackState;
}

export interface LoopRemoveEvent {
  type: 'looptrack:remove';
  trackId: string;
}

export interface LoopUpdateEvent {
  type: 'looptrack:update';
  trackId: string;
  changes: Partial<LoopTrackState>;
}

export interface LoopSyncEvent {
  type: 'looptrack:sync';
  tracks: LoopTrackState[];
}

export type LoopTrackEvent =
  | LoopPlayEvent
  | LoopStopEvent
  | LoopAddEvent
  | LoopRemoveEvent
  | LoopUpdateEvent
  | LoopSyncEvent;

// =============================================================================
// Instant Band Presets
// =============================================================================

export interface InstantBandPreset {
  id: string;
  name: string;
  description: string;
  loops: string[]; // Loop IDs
  bpmRange: [number, number];
  genre: string;
}
