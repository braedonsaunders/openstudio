// Audio Effects Module - World-class audio processing for OpenStudio
// Exports all effect processors and utility functions

export { NoiseGateProcessor } from './noise-gate';
export { EQProcessor } from './eq';
export { CompressorProcessor } from './compressor';
export { ReverbProcessor } from './reverb';
export { LimiterProcessor } from './limiter';
export { TrackEffectsProcessor } from './track-effects-processor';
export { DEFAULT_EFFECTS_CHAIN, EFFECT_PRESETS, getPresetByType } from './presets';
export type { EffectProcessor } from './base-effect';
