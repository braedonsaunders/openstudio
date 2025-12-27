// Guitar Effects Processor
// Manages the complete guitar-specific effects chain
// Integrates with the main track effects processor

import { OverdriveProcessor } from './overdrive';
import { DistortionProcessor } from './distortion';
import { AmpSimulatorProcessor } from './amp-simulator';
import { CabinetSimulatorProcessor } from './cabinet-simulator';
import { DelayProcessor } from './delay';
import { ChorusProcessor } from './chorus';
import { FlangerProcessor } from './flanger';
import { PhaserProcessor } from './phaser';
import { WahProcessor } from './wah';
import { TremoloProcessor } from './tremolo';
import type {
  GuitarEffectsChain,
  OverdriveSettings,
  DistortionSettings,
  AmpSimulatorSettings,
  CabinetSimulatorSettings,
  DelaySettings,
  ChorusSettings,
  FlangerSettings,
  PhaserSettings,
  WahSettings,
  TremoloSettings,
} from '@/types';

// Default settings for guitar effects chain
export const DEFAULT_GUITAR_EFFECTS: GuitarEffectsChain = {
  wah: {
    enabled: false,
    mode: 'auto',
    frequency: 0.5,
    rate: 2,
    depth: 0.8,
    baseFrequency: 350,
    maxFrequency: 2500,
    q: 5,
    sensitivity: 0.5,
    attack: 0.05,
    release: 0.2,
    mix: 1,
  },
  overdrive: {
    enabled: false,
    drive: 0.5,
    tone: 0.5,
    level: 0.5,
  },
  distortion: {
    enabled: false,
    amount: 0.5,
    type: 'classic',
    tone: 0.5,
    level: 0.5,
  },
  ampSimulator: {
    enabled: false,
    type: 'crunch',
    gain: 0.5,
    bass: 0.5,
    mid: 0.5,
    treble: 0.5,
    presence: 0.5,
    master: 0.5,
  },
  cabinet: {
    enabled: false,
    type: '4x12',
    micPosition: 'center',
    mix: 1.0,
    roomLevel: 0.2,
  },
  chorus: {
    enabled: false,
    rate: 1.5,
    depth: 0.5,
    delay: 3.5,
    feedback: 0,
    spread: 180,
    mix: 0.5,
  },
  flanger: {
    enabled: false,
    rate: 0.5,
    depth: 0.5,
    delay: 2,
    feedback: 0.5,
    mix: 0.5,
    negative: false,
  },
  phaser: {
    enabled: false,
    rate: 0.5,
    depth: 0.5,
    baseFrequency: 350,
    octaves: 3,
    stages: 4,
    feedback: 0.3,
    q: 1,
    mix: 0.5,
  },
  delay: {
    enabled: false,
    type: 'digital',
    time: 0.4,
    feedback: 0.3,
    mix: 0.3,
    tone: 0.8,
    modulation: 0.1,
    pingPongSpread: 0.5,
    tempo: 120,
    tempoSync: false,
    subdivision: '1/4',
  },
  tremolo: {
    enabled: false,
    rate: 5,
    depth: 0.5,
    spread: 0,
    waveform: 'sine',
  },
};

export class GuitarEffectsProcessor {
  private audioContext: AudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Effect processors in signal chain order
  private wah: WahProcessor;
  private overdrive: OverdriveProcessor;
  private distortion: DistortionProcessor;
  private ampSimulator: AmpSimulatorProcessor;
  private cabinet: CabinetSimulatorProcessor;
  private chorus: ChorusProcessor;
  private flanger: FlangerProcessor;
  private phaser: PhaserProcessor;
  private delay: DelayProcessor;
  private tremolo: TremoloProcessor;

  private settings: GuitarEffectsChain;
  private onSettingsChange?: (settings: GuitarEffectsChain) => void;

  constructor(
    audioContext: AudioContext,
    initialSettings?: Partial<GuitarEffectsChain>,
    onSettingsChange?: (settings: GuitarEffectsChain) => void
  ) {
    this.audioContext = audioContext;
    this.onSettingsChange = onSettingsChange;

    // Merge with defaults
    this.settings = this.mergeSettings(initialSettings);

    // Create input/output gain nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();

    // Create effect processors in signal chain order
    // Typical guitar signal chain:
    // Wah -> Overdrive/Distortion -> Amp -> Cabinet -> Modulation -> Delay -> Tremolo

    this.wah = new WahProcessor(audioContext, this.settings.wah);
    this.overdrive = new OverdriveProcessor(audioContext, this.settings.overdrive);
    this.distortion = new DistortionProcessor(audioContext, this.settings.distortion);
    this.ampSimulator = new AmpSimulatorProcessor(audioContext, this.settings.ampSimulator);
    this.cabinet = new CabinetSimulatorProcessor(audioContext, this.settings.cabinet);
    this.chorus = new ChorusProcessor(audioContext, this.settings.chorus);
    this.flanger = new FlangerProcessor(audioContext, this.settings.flanger);
    this.phaser = new PhaserProcessor(audioContext, this.settings.phaser);
    this.delay = new DelayProcessor(audioContext, this.settings.delay);
    this.tremolo = new TremoloProcessor(audioContext, this.settings.tremolo);

    // Wire up the effects chain:
    // input -> wah -> overdrive -> distortion -> ampSimulator -> cabinet
    //       -> chorus -> flanger -> phaser -> delay -> tremolo -> output
    this.inputGain.connect(this.wah.getInputNode());
    this.wah.connect(this.overdrive.getInputNode());
    this.overdrive.connect(this.distortion.getInputNode());
    this.distortion.connect(this.ampSimulator.getInputNode());
    this.ampSimulator.connect(this.cabinet.getInputNode());
    this.cabinet.connect(this.chorus.getInputNode());
    this.chorus.connect(this.flanger.getInputNode());
    this.flanger.connect(this.phaser.getInputNode());
    this.phaser.connect(this.delay.getInputNode());
    this.delay.connect(this.tremolo.getInputNode());
    this.tremolo.connect(this.outputGain);
  }

  private mergeSettings(initial?: Partial<GuitarEffectsChain>): GuitarEffectsChain {
    return {
      wah: { ...DEFAULT_GUITAR_EFFECTS.wah, ...initial?.wah },
      overdrive: { ...DEFAULT_GUITAR_EFFECTS.overdrive, ...initial?.overdrive },
      distortion: { ...DEFAULT_GUITAR_EFFECTS.distortion, ...initial?.distortion },
      ampSimulator: { ...DEFAULT_GUITAR_EFFECTS.ampSimulator, ...initial?.ampSimulator },
      cabinet: { ...DEFAULT_GUITAR_EFFECTS.cabinet, ...initial?.cabinet },
      chorus: { ...DEFAULT_GUITAR_EFFECTS.chorus, ...initial?.chorus },
      flanger: { ...DEFAULT_GUITAR_EFFECTS.flanger, ...initial?.flanger },
      phaser: { ...DEFAULT_GUITAR_EFFECTS.phaser, ...initial?.phaser },
      delay: { ...DEFAULT_GUITAR_EFFECTS.delay, ...initial?.delay },
      tremolo: { ...DEFAULT_GUITAR_EFFECTS.tremolo, ...initial?.tremolo },
    };
  }

  // Get input node (where audio comes in)
  getInputNode(): GainNode {
    return this.inputGain;
  }

  // Get output node (where audio goes out)
  getOutputNode(): GainNode {
    return this.outputGain;
  }

  // Connect output to destination
  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  // Disconnect output
  disconnect(): void {
    this.outputGain.disconnect();
  }

  // Update entire effects chain
  updateSettings(settings: Partial<GuitarEffectsChain>): void {
    if (settings.wah) {
      this.settings.wah = { ...this.settings.wah, ...settings.wah };
      this.wah.updateSettings(settings.wah);
    }

    if (settings.overdrive) {
      this.settings.overdrive = { ...this.settings.overdrive, ...settings.overdrive };
      this.overdrive.updateSettings(settings.overdrive);
    }

    if (settings.distortion) {
      this.settings.distortion = { ...this.settings.distortion, ...settings.distortion };
      this.distortion.updateSettings(settings.distortion);
    }

    if (settings.ampSimulator) {
      this.settings.ampSimulator = { ...this.settings.ampSimulator, ...settings.ampSimulator };
      this.ampSimulator.updateSettings(settings.ampSimulator);
    }

    if (settings.cabinet) {
      this.settings.cabinet = { ...this.settings.cabinet, ...settings.cabinet };
      this.cabinet.updateSettings(settings.cabinet);
    }

    if (settings.chorus) {
      this.settings.chorus = { ...this.settings.chorus, ...settings.chorus };
      this.chorus.updateSettings(settings.chorus);
    }

    if (settings.flanger) {
      this.settings.flanger = { ...this.settings.flanger, ...settings.flanger };
      this.flanger.updateSettings(settings.flanger);
    }

    if (settings.phaser) {
      this.settings.phaser = { ...this.settings.phaser, ...settings.phaser };
      this.phaser.updateSettings(settings.phaser);
    }

    if (settings.delay) {
      this.settings.delay = { ...this.settings.delay, ...settings.delay };
      this.delay.updateSettings(settings.delay);
    }

    if (settings.tremolo) {
      this.settings.tremolo = { ...this.settings.tremolo, ...settings.tremolo };
      this.tremolo.updateSettings(settings.tremolo);
    }

    this.notifySettingsChange();
  }

  // Individual effect updates
  updateWah(settings: Partial<WahSettings>): void {
    this.settings.wah = { ...this.settings.wah, ...settings };
    this.wah.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateOverdrive(settings: Partial<OverdriveSettings>): void {
    this.settings.overdrive = { ...this.settings.overdrive, ...settings };
    this.overdrive.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateDistortion(settings: Partial<DistortionSettings>): void {
    this.settings.distortion = { ...this.settings.distortion, ...settings };
    this.distortion.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateAmpSimulator(settings: Partial<AmpSimulatorSettings>): void {
    this.settings.ampSimulator = { ...this.settings.ampSimulator, ...settings };
    this.ampSimulator.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateCabinet(settings: Partial<CabinetSimulatorSettings>): void {
    this.settings.cabinet = { ...this.settings.cabinet, ...settings };
    this.cabinet.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateChorus(settings: Partial<ChorusSettings>): void {
    this.settings.chorus = { ...this.settings.chorus, ...settings };
    this.chorus.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateFlanger(settings: Partial<FlangerSettings>): void {
    this.settings.flanger = { ...this.settings.flanger, ...settings };
    this.flanger.updateSettings(settings);
    this.notifySettingsChange();
  }

  updatePhaser(settings: Partial<PhaserSettings>): void {
    this.settings.phaser = { ...this.settings.phaser, ...settings };
    this.phaser.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateDelay(settings: Partial<DelaySettings>): void {
    this.settings.delay = { ...this.settings.delay, ...settings };
    this.delay.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateTremolo(settings: Partial<TremoloSettings>): void {
    this.settings.tremolo = { ...this.settings.tremolo, ...settings };
    this.tremolo.updateSettings(settings);
    this.notifySettingsChange();
  }

  // Toggle individual effects
  setWahEnabled(enabled: boolean): void {
    this.updateWah({ enabled });
  }

  setOverdriveEnabled(enabled: boolean): void {
    this.updateOverdrive({ enabled });
  }

  setDistortionEnabled(enabled: boolean): void {
    this.updateDistortion({ enabled });
  }

  setAmpSimulatorEnabled(enabled: boolean): void {
    this.updateAmpSimulator({ enabled });
  }

  setCabinetEnabled(enabled: boolean): void {
    this.updateCabinet({ enabled });
  }

  setChorusEnabled(enabled: boolean): void {
    this.updateChorus({ enabled });
  }

  setFlangerEnabled(enabled: boolean): void {
    this.updateFlanger({ enabled });
  }

  setPhaserEnabled(enabled: boolean): void {
    this.updatePhaser({ enabled });
  }

  setDelayEnabled(enabled: boolean): void {
    this.updateDelay({ enabled });
  }

  setTremoloEnabled(enabled: boolean): void {
    this.updateTremolo({ enabled });
  }

  // Set tempo for tempo-synced effects
  setTempo(bpm: number): void {
    this.delay.setTempo(bpm);
  }

  // Get current settings
  getSettings(): GuitarEffectsChain {
    return {
      wah: this.wah.getSettings(),
      overdrive: this.overdrive.getSettings(),
      distortion: this.distortion.getSettings(),
      ampSimulator: this.ampSimulator.getSettings(),
      cabinet: this.cabinet.getSettings(),
      chorus: this.chorus.getSettings(),
      flanger: this.flanger.getSettings(),
      phaser: this.phaser.getSettings(),
      delay: this.delay.getSettings(),
      tremolo: this.tremolo.getSettings(),
    };
  }

  // Get list of enabled effects for UI display
  getEnabledEffects(): string[] {
    const enabled: string[] = [];
    if (this.settings.wah.enabled) enabled.push('Wah');
    if (this.settings.overdrive.enabled) enabled.push('Overdrive');
    if (this.settings.distortion.enabled) enabled.push('Distortion');
    if (this.settings.ampSimulator.enabled) enabled.push('Amp');
    if (this.settings.cabinet.enabled) enabled.push('Cabinet');
    if (this.settings.chorus.enabled) enabled.push('Chorus');
    if (this.settings.flanger.enabled) enabled.push('Flanger');
    if (this.settings.phaser.enabled) enabled.push('Phaser');
    if (this.settings.delay.enabled) enabled.push('Delay');
    if (this.settings.tremolo.enabled) enabled.push('Tremolo');
    return enabled;
  }

  // Load preset
  loadPreset(effectsChain: GuitarEffectsChain): void {
    this.updateSettings(effectsChain);
  }

  // Reset to defaults
  reset(): void {
    this.updateSettings(DEFAULT_GUITAR_EFFECTS);
  }

  private notifySettingsChange(): void {
    this.onSettingsChange?.(this.getSettings());
  }

  // Clean up resources
  dispose(): void {
    this.disconnect();
    this.wah.dispose();
    this.overdrive.dispose();
    this.distortion.dispose();
    this.ampSimulator.dispose();
    this.cabinet.dispose();
    this.chorus.dispose();
    this.flanger.dispose();
    this.phaser.dispose();
    this.delay.dispose();
    this.tremolo.dispose();
    this.inputGain.disconnect();
  }
}
