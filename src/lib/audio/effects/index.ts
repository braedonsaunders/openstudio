// Audio Effects Module - World-class audio processing for OpenStudio
// Exports all effect processors and utility functions

// Unified effects processor (recommended - combines all effects)
export { UnifiedEffectsProcessor, DEFAULT_UNIFIED_EFFECTS } from './unified-effects-processor';

// Core effects (individual processors)
export { NoiseGateProcessor } from './noise-gate';
export { EQProcessor } from './eq';
export { CompressorProcessor } from './compressor';
export { ReverbProcessor } from './reverb';
export { LimiterProcessor } from './limiter';
export type { EffectProcessor } from './base-effect';

// Guitar effects (individual processors)
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

// Legacy exports (deprecated - use UnifiedEffectsProcessor instead)
export { TrackEffectsProcessor } from './track-effects-processor';
export { DEFAULT_EFFECTS_CHAIN, EFFECT_PRESETS, getPresetByType } from './presets';
export { ExtendedTrackEffectsProcessor } from './extended-track-effects-processor';
export type { ExtendedEffectsSettings } from './extended-track-effects-processor';
