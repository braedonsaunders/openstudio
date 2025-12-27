// Guitar Effects Module
// A comprehensive suite of guitar-specific effects for OpenStudio

export { OverdriveProcessor } from './overdrive';
export { DistortionProcessor } from './distortion';
export { AmpSimulatorProcessor } from './amp-simulator';
export { CabinetSimulatorProcessor } from './cabinet-simulator';
export { DelayProcessor } from './delay';
export { ChorusProcessor } from './chorus';
export { FlangerProcessor } from './flanger';
export { PhaserProcessor } from './phaser';
export { WahProcessor } from './wah';
export { TremoloProcessor } from './tremolo';
export { GuitarEffectsProcessor } from './guitar-effects-processor';
export { GUITAR_PRESETS, getGuitarPreset, getPresetsByCategory, getPresetCategories } from './guitar-presets';
export { DEFAULT_GUITAR_EFFECTS } from './guitar-effects-processor';
