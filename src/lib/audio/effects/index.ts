// Audio Effects Module - World-class audio processing for OpenStudio
// Exports all effect processors and utility functions

// Core effects
export { NoiseGateProcessor } from './noise-gate';
export { EQProcessor } from './eq';
export { CompressorProcessor } from './compressor';
export { ReverbProcessor } from './reverb';
export { LimiterProcessor } from './limiter';
export { TrackEffectsProcessor } from './track-effects-processor';
export { DEFAULT_EFFECTS_CHAIN, EFFECT_PRESETS, getPresetByType } from './presets';
export type { EffectProcessor } from './base-effect';

// Guitar effects
export {
  OverdriveProcessor,
  DistortionProcessor,
  AmpSimulatorProcessor,
  CabinetSimulatorProcessor,
  DelayProcessor,
  ChorusProcessor,
  FlangerProcessor,
  PhaserProcessor,
  WahProcessor,
  TremoloProcessor,
  GuitarEffectsProcessor,
  GUITAR_PRESETS,
  getGuitarPreset,
} from './guitar';

// Extended processor with guitar effects integration
export { ExtendedTrackEffectsProcessor } from './extended-track-effects-processor';
export type { ExtendedEffectsSettings } from './extended-track-effects-processor';
