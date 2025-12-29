// Extended Effects Processor
// Combines ALL effects (original 15 + 20 new effects) into a unified signal chain
// Organized by category for efficient processing and low latency

import { UnifiedEffectsProcessor, DEFAULT_UNIFIED_EFFECTS } from './unified-effects-processor';

// Import new vocal effects
import { PitchCorrectionProcessor } from './vocal/pitch-correction';
import { VocalDoublerProcessor } from './vocal/vocal-doubler';
import { DeEsserProcessor } from './vocal/de-esser';
import { FormantShifterProcessor } from './vocal/formant-shifter';
import { HarmonizerProcessor } from './vocal/harmonizer';

// Import new creative effects
import { BitcrusherProcessor } from './creative/bitcrusher';
import { RingModulatorProcessor } from './creative/ring-modulator';
import { FrequencyShifterProcessor } from './creative/frequency-shifter';
import { GranularDelayProcessor } from './creative/granular-delay';

// Import new modulation effects
import { RotarySpeakerProcessor } from './modulation/rotary-speaker';
import { AutoPanProcessor } from './modulation/auto-pan';
import { MultiFilterProcessor } from './modulation/multi-filter';
import { VibratoProcessor } from './modulation/vibrato';

// Import new dynamics/utility effects
import { TransientShaperProcessor } from './dynamics/transient-shaper';
import { StereoImagerProcessor } from './dynamics/stereo-imager';
import { ExciterProcessor } from './dynamics/exciter';
import { MultibandCompressorProcessor } from './dynamics/multiband-compressor';

// Import new spatial effects
import { StereoDelayProcessor } from './spatial/stereo-delay';
import { RoomSimulatorProcessor } from './spatial/room-simulator';
import { ShimmerReverbProcessor } from './spatial/shimmer-reverb';

import type { ExtendedEffectsChain } from '@/types';

// Default settings for all new effects
export const DEFAULT_EXTENDED_EFFECTS: Omit<ExtendedEffectsChain, keyof typeof DEFAULT_UNIFIED_EFFECTS> = {
  // Vocal effects
  pitchCorrection: {
    enabled: false,
    key: 'C',
    scale: 'major',
    speed: 50,
    humanize: 20,
    formantPreserve: true,
    detune: 0,
    mix: 100,
  },
  vocalDoubler: {
    enabled: false,
    detune: 8,
    delay: 15,
    spread: 50,
    depth: 30,
    mix: 50,
    voices: 2,
  },
  deEsser: {
    enabled: false,
    frequency: 6000,
    threshold: -20,
    reduction: 6,
    range: 12,
    attack: 0.5,
    release: 50,
    mode: 'split',
    listenMode: false,
  },
  formantShifter: {
    enabled: false,
    shift: 0,
    gender: 0,
    preservePitch: true,
    mix: 100,
  },
  harmonizer: {
    enabled: false,
    key: 'C',
    scale: 'major',
    harmonyType: 'third',
    customIntervals: [4],
    voices: 1,
    spread: 50,
    shift: 0,
    mix: 50,
    keyLock: true,
  },
  // Creative effects
  bitcrusher: {
    enabled: false,
    bits: 8,
    sampleRate: 22050,
    mix: 100,
    dither: false,
  },
  ringModulator: {
    enabled: false,
    frequency: 440,
    waveform: 'sine',
    mix: 50,
    lfoRate: 0,
    lfoDepth: 0,
  },
  frequencyShifter: {
    enabled: false,
    shift: 0,
    feedback: 0,
    mix: 50,
    direction: 'up',
  },
  granularDelay: {
    enabled: false,
    grainSize: 100,
    density: 50,
    pitch: 0,
    pitchRandom: 0,
    position: 500,
    positionRandom: 0,
    feedback: 30,
    spread: 50,
    reverse: 0,
    mix: 50,
    freeze: false,
  },
  // Additional modulation
  rotarySpeaker: {
    enabled: false,
    speed: 'slow',
    hornLevel: 80,
    drumLevel: 70,
    distance: 50,
    drive: 20,
    mix: 100,
  },
  autoPan: {
    enabled: false,
    rate: 2,
    depth: 100,
    waveform: 'sine',
    phase: 0,
    tempoSync: false,
    subdivision: '1/4',
    width: 100,
  },
  multiFilter: {
    enabled: false,
    type: 'lowpass',
    frequency: 1000,
    resonance: 5,
    drive: 0,
    lfoRate: 0,
    lfoDepth: 0,
    lfoWaveform: 'sine',
    envelopeAmount: 0,
    envelopeSensitivity: 50,
    envelopeAttack: 10,
    envelopeRelease: 100,
    keyTrack: 0,
    tempoSync: false,
    subdivision: '1/4',
    mix: 100,
  },
  vibrato: {
    enabled: false,
    rate: 5,
    depth: 50,
    waveform: 'sine',
    stereo: 0,
    tempoSync: false,
    subdivision: '1/8',
  },
  // Dynamics/Utility
  transientShaper: {
    enabled: false,
    attack: 0,
    sustain: 0,
    attackTime: 5,
    releaseTime: 50,
    output: 0,
  },
  stereoImager: {
    enabled: false,
    width: 100,
    midLevel: 0,
    sideLevel: 0,
    bassMonoFreq: 120,
    bassMonoAmount: 0,
    balance: 0,
  },
  exciter: {
    enabled: false,
    frequency: 3000,
    amount: 30,
    harmonics: 'odd',
    color: 50,
    mix: 50,
  },
  multibandCompressor: {
    enabled: false,
    lowCrossover: 200,
    highCrossover: 2000,
    low: {
      threshold: -20,
      ratio: 4,
      attack: 20,
      release: 200,
      gain: 0,
      solo: false,
      bypass: false,
    },
    mid: {
      threshold: -18,
      ratio: 3,
      attack: 15,
      release: 150,
      gain: 0,
      solo: false,
      bypass: false,
    },
    high: {
      threshold: -15,
      ratio: 2.5,
      attack: 10,
      release: 100,
      gain: 0,
      solo: false,
      bypass: false,
    },
    outputGain: 0,
  },
  // Spatial
  stereoDelay: {
    enabled: false,
    leftTime: 375,
    rightTime: 500,
    leftFeedback: 30,
    rightFeedback: 30,
    crossFeed: 20,
    tone: 80,
    tempoSync: false,
    leftSubdivision: '1/4',
    rightSubdivision: '1/4D',
    pingPong: false,
    mix: 30,
  },
  roomSimulator: {
    enabled: false,
    size: 'medium',
    damping: 50,
    earlyLevel: 70,
    lateLevel: 50,
    decay: 1.5,
    preDelay: 10,
    diffusion: 70,
    modulation: 20,
    mix: 30,
  },
  shimmerReverb: {
    enabled: false,
    decay: 3,
    shimmer: 50,
    pitch: 12,
    damping: 40,
    tone: 70,
    modulation: 30,
    preDelay: 20,
    diffusion: 80,
    mix: 40,
  },
};

// Full default chain combining original and new effects
export const DEFAULT_FULL_EFFECTS: ExtendedEffectsChain = {
  ...DEFAULT_UNIFIED_EFFECTS,
  ...DEFAULT_EXTENDED_EFFECTS,
};

/**
 * Extended Effects Processor
 *
 * Signal flow organized by category:
 *
 * INPUT
 *   → Pitch Correction (vocals)
 *   → De-Esser (vocals)
 *   → [Original 15 effects from UnifiedEffectsProcessor]
 *   → Vocal Doubler
 *   → Harmonizer
 *   → Formant Shifter
 *   → Transient Shaper
 *   → Exciter
 *   → Multi-band Compressor
 *   → Bitcrusher
 *   → Ring Modulator
 *   → Frequency Shifter
 *   → Vibrato
 *   → Rotary Speaker
 *   → Auto-Pan
 *   → Multi Filter
 *   → Granular Delay
 *   → Stereo Delay
 *   → Room Simulator
 *   → Shimmer Reverb
 *   → Stereo Imager
 * OUTPUT
 */
export class ExtendedEffectsProcessor {
  private audioContext: AudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Core effects processor (original 15)
  private coreProcessor: UnifiedEffectsProcessor;

  // New vocal effects
  private pitchCorrection: PitchCorrectionProcessor;
  private vocalDoubler: VocalDoublerProcessor;
  private deEsser: DeEsserProcessor;
  private formantShifter: FormantShifterProcessor;
  private harmonizer: HarmonizerProcessor;

  // New creative effects
  private bitcrusher: BitcrusherProcessor;
  private ringModulator: RingModulatorProcessor;
  private frequencyShifter: FrequencyShifterProcessor;
  private granularDelay: GranularDelayProcessor;

  // New modulation effects
  private rotarySpeaker: RotarySpeakerProcessor;
  private autoPan: AutoPanProcessor;
  private multiFilter: MultiFilterProcessor;
  private vibrato: VibratoProcessor;

  // New dynamics/utility effects
  private transientShaper: TransientShaperProcessor;
  private stereoImager: StereoImagerProcessor;
  private exciter: ExciterProcessor;
  private multibandCompressor: MultibandCompressorProcessor;

  // New spatial effects
  private stereoDelay: StereoDelayProcessor;
  private roomSimulator: RoomSimulatorProcessor;
  private shimmerReverb: ShimmerReverbProcessor;

  private settings: ExtendedEffectsChain;
  private onSettingsChange?: (settings: ExtendedEffectsChain) => void;

  // Console error interception for BiquadFilterNode instability detection
  private originalConsoleWarn: typeof console.warn | null = null;
  private isRecovering: boolean = false;
  private lastRecoveryTime: number = 0;
  private recoveryDebounceMs: number = 1000; // Minimum time between recoveries

  constructor(
    audioContext: AudioContext,
    initialSettings?: Partial<ExtendedEffectsChain>,
    onSettingsChange?: (settings: ExtendedEffectsChain) => void
  ) {
    this.audioContext = audioContext;
    this.onSettingsChange = onSettingsChange;

    // Merge with defaults
    this.settings = this.mergeSettings(initialSettings);

    // Create input/output
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();

    // Create core processor (original 15 effects)
    this.coreProcessor = new UnifiedEffectsProcessor(audioContext, this.settings);

    // Create new vocal effects
    this.pitchCorrection = new PitchCorrectionProcessor(audioContext, this.settings.pitchCorrection);
    this.deEsser = new DeEsserProcessor(audioContext, this.settings.deEsser);
    this.vocalDoubler = new VocalDoublerProcessor(audioContext, this.settings.vocalDoubler);
    this.formantShifter = new FormantShifterProcessor(audioContext, this.settings.formantShifter);
    this.harmonizer = new HarmonizerProcessor(audioContext, this.settings.harmonizer);

    // Create new creative effects
    this.bitcrusher = new BitcrusherProcessor(audioContext, this.settings.bitcrusher);
    this.ringModulator = new RingModulatorProcessor(audioContext, this.settings.ringModulator);
    this.frequencyShifter = new FrequencyShifterProcessor(audioContext, this.settings.frequencyShifter);
    this.granularDelay = new GranularDelayProcessor(audioContext, this.settings.granularDelay);

    // Create new modulation effects
    this.rotarySpeaker = new RotarySpeakerProcessor(audioContext, this.settings.rotarySpeaker);
    this.autoPan = new AutoPanProcessor(audioContext, this.settings.autoPan);
    this.multiFilter = new MultiFilterProcessor(audioContext, this.settings.multiFilter);
    this.vibrato = new VibratoProcessor(audioContext, this.settings.vibrato);

    // Create new dynamics/utility effects
    this.transientShaper = new TransientShaperProcessor(audioContext, this.settings.transientShaper);
    this.stereoImager = new StereoImagerProcessor(audioContext, this.settings.stereoImager);
    this.exciter = new ExciterProcessor(audioContext, this.settings.exciter);
    this.multibandCompressor = new MultibandCompressorProcessor(audioContext, this.settings.multibandCompressor);

    // Create new spatial effects
    this.stereoDelay = new StereoDelayProcessor(audioContext, this.settings.stereoDelay);
    this.roomSimulator = new RoomSimulatorProcessor(audioContext, this.settings.roomSimulator);
    this.shimmerReverb = new ShimmerReverbProcessor(audioContext, this.settings.shimmerReverb);

    // Wire up signal chain
    this.wireSignalChain();

    // Set up console interception for BiquadFilterNode error detection
    this.setupErrorDetection();
  }

  // Set up console interception to detect BiquadFilterNode instability
  private setupErrorDetection(): void {
    // Store original console.warn
    this.originalConsoleWarn = console.warn.bind(console);

    // Override console.warn to detect BiquadFilterNode errors
    console.warn = (...args: unknown[]) => {
      // Call original first
      if (this.originalConsoleWarn) {
        this.originalConsoleWarn(...args);
      }

      // Check for BiquadFilterNode instability error
      const message = args.join(' ');
      if (message.includes('BiquadFilterNode') && message.includes('state is bad')) {
        this.handleFilterInstability();
      }
    };
  }

  // Handle BiquadFilterNode instability by triggering recovery
  private handleFilterInstability(): void {
    const now = Date.now();

    // Debounce recovery to prevent repeated triggering
    if (this.isRecovering || (now - this.lastRecoveryTime) < this.recoveryDebounceMs) {
      return;
    }

    this.isRecovering = true;
    this.lastRecoveryTime = now;

    console.log('[ExtendedEffectsProcessor] BiquadFilterNode instability detected - initiating auto-recovery');

    // Use setTimeout to break out of the current call stack
    setTimeout(() => {
      try {
        this.recoverFromError();
      } finally {
        this.isRecovering = false;
      }
    }, 10);
  }

  // Restore original console.warn when disposed
  private restoreConsole(): void {
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
      this.originalConsoleWarn = null;
    }
  }

  private wireSignalChain(): void {
    // Signal flow:
    // Input → Pitch Correction → De-Esser → Core (15 effects) →
    // Vocal Doubler → Harmonizer → Formant Shifter →
    // Transient Shaper → Exciter → Multiband Comp →
    // Bitcrusher → Ring Mod → Freq Shifter → Vibrato →
    // Rotary → Auto-Pan → Multi Filter →
    // Granular Delay → Stereo Delay → Room Sim → Shimmer Reverb →
    // Stereo Imager → Output

    this.inputGain.connect(this.pitchCorrection.getInputNode());
    this.pitchCorrection.connect(this.deEsser.getInputNode());
    this.deEsser.connect(this.coreProcessor.getInputNode());
    this.coreProcessor.connect(this.vocalDoubler.getInputNode());
    this.vocalDoubler.connect(this.harmonizer.getInputNode());
    this.harmonizer.connect(this.formantShifter.getInputNode());
    this.formantShifter.connect(this.transientShaper.getInputNode());
    this.transientShaper.connect(this.exciter.getInputNode());
    this.exciter.connect(this.multibandCompressor.getInputNode());
    this.multibandCompressor.connect(this.bitcrusher.getInputNode());
    this.bitcrusher.connect(this.ringModulator.getInputNode());
    this.ringModulator.connect(this.frequencyShifter.getInputNode());
    this.frequencyShifter.connect(this.vibrato.getInputNode());
    this.vibrato.connect(this.rotarySpeaker.getInputNode());
    this.rotarySpeaker.connect(this.autoPan.getInputNode());
    this.autoPan.connect(this.multiFilter.getInputNode());
    this.multiFilter.connect(this.granularDelay.getInputNode());
    this.granularDelay.connect(this.stereoDelay.getInputNode());
    this.stereoDelay.connect(this.roomSimulator.getInputNode());
    this.roomSimulator.connect(this.shimmerReverb.getInputNode());
    this.shimmerReverb.connect(this.stereoImager.getInputNode());
    this.stereoImager.connect(this.outputGain);
  }

  private mergeSettings(initial?: Partial<ExtendedEffectsChain>): ExtendedEffectsChain {
    return {
      ...DEFAULT_FULL_EFFECTS,
      ...initial,
      // Deep merge for nested objects
      pitchCorrection: { ...DEFAULT_FULL_EFFECTS.pitchCorrection, ...initial?.pitchCorrection },
      vocalDoubler: { ...DEFAULT_FULL_EFFECTS.vocalDoubler, ...initial?.vocalDoubler },
      deEsser: { ...DEFAULT_FULL_EFFECTS.deEsser, ...initial?.deEsser },
      formantShifter: { ...DEFAULT_FULL_EFFECTS.formantShifter, ...initial?.formantShifter },
      harmonizer: { ...DEFAULT_FULL_EFFECTS.harmonizer, ...initial?.harmonizer },
      bitcrusher: { ...DEFAULT_FULL_EFFECTS.bitcrusher, ...initial?.bitcrusher },
      ringModulator: { ...DEFAULT_FULL_EFFECTS.ringModulator, ...initial?.ringModulator },
      frequencyShifter: { ...DEFAULT_FULL_EFFECTS.frequencyShifter, ...initial?.frequencyShifter },
      granularDelay: { ...DEFAULT_FULL_EFFECTS.granularDelay, ...initial?.granularDelay },
      rotarySpeaker: { ...DEFAULT_FULL_EFFECTS.rotarySpeaker, ...initial?.rotarySpeaker },
      autoPan: { ...DEFAULT_FULL_EFFECTS.autoPan, ...initial?.autoPan },
      multiFilter: { ...DEFAULT_FULL_EFFECTS.multiFilter, ...initial?.multiFilter },
      vibrato: { ...DEFAULT_FULL_EFFECTS.vibrato, ...initial?.vibrato },
      transientShaper: { ...DEFAULT_FULL_EFFECTS.transientShaper, ...initial?.transientShaper },
      stereoImager: { ...DEFAULT_FULL_EFFECTS.stereoImager, ...initial?.stereoImager },
      exciter: { ...DEFAULT_FULL_EFFECTS.exciter, ...initial?.exciter },
      multibandCompressor: {
        ...DEFAULT_FULL_EFFECTS.multibandCompressor,
        ...initial?.multibandCompressor,
        low: { ...DEFAULT_FULL_EFFECTS.multibandCompressor.low, ...initial?.multibandCompressor?.low },
        mid: { ...DEFAULT_FULL_EFFECTS.multibandCompressor.mid, ...initial?.multibandCompressor?.mid },
        high: { ...DEFAULT_FULL_EFFECTS.multibandCompressor.high, ...initial?.multibandCompressor?.high },
      },
      stereoDelay: { ...DEFAULT_FULL_EFFECTS.stereoDelay, ...initial?.stereoDelay },
      roomSimulator: { ...DEFAULT_FULL_EFFECTS.roomSimulator, ...initial?.roomSimulator },
      shimmerReverb: { ...DEFAULT_FULL_EFFECTS.shimmerReverb, ...initial?.shimmerReverb },
    };
  }

  // Public API
  getInputNode(): GainNode {
    return this.inputGain;
  }

  getOutputNode(): GainNode {
    return this.outputGain;
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  disconnect(): void {
    this.outputGain.disconnect();
  }

  // Update settings for any effect
  updateSettings(settings: Partial<ExtendedEffectsChain>): void {
    // Update core effects (original 15)
    this.coreProcessor.updateSettings(settings);

    // Update new vocal effects
    if (settings.pitchCorrection) {
      this.settings.pitchCorrection = { ...this.settings.pitchCorrection, ...settings.pitchCorrection };
      this.pitchCorrection.updateSettings(settings.pitchCorrection);
    }
    if (settings.vocalDoubler) {
      this.settings.vocalDoubler = { ...this.settings.vocalDoubler, ...settings.vocalDoubler };
      this.vocalDoubler.updateSettings(settings.vocalDoubler);
    }
    if (settings.deEsser) {
      this.settings.deEsser = { ...this.settings.deEsser, ...settings.deEsser };
      this.deEsser.updateSettings(settings.deEsser);
    }
    if (settings.formantShifter) {
      this.settings.formantShifter = { ...this.settings.formantShifter, ...settings.formantShifter };
      this.formantShifter.updateSettings(settings.formantShifter);
    }
    if (settings.harmonizer) {
      this.settings.harmonizer = { ...this.settings.harmonizer, ...settings.harmonizer };
      this.harmonizer.updateSettings(settings.harmonizer);
    }

    // Update new creative effects
    if (settings.bitcrusher) {
      this.settings.bitcrusher = { ...this.settings.bitcrusher, ...settings.bitcrusher };
      this.bitcrusher.updateSettings(settings.bitcrusher);
    }
    if (settings.ringModulator) {
      this.settings.ringModulator = { ...this.settings.ringModulator, ...settings.ringModulator };
      this.ringModulator.updateSettings(settings.ringModulator);
    }
    if (settings.frequencyShifter) {
      this.settings.frequencyShifter = { ...this.settings.frequencyShifter, ...settings.frequencyShifter };
      this.frequencyShifter.updateSettings(settings.frequencyShifter);
    }
    if (settings.granularDelay) {
      this.settings.granularDelay = { ...this.settings.granularDelay, ...settings.granularDelay };
      this.granularDelay.updateSettings(settings.granularDelay);
    }

    // Update new modulation effects
    if (settings.rotarySpeaker) {
      this.settings.rotarySpeaker = { ...this.settings.rotarySpeaker, ...settings.rotarySpeaker };
      this.rotarySpeaker.updateSettings(settings.rotarySpeaker);
    }
    if (settings.autoPan) {
      this.settings.autoPan = { ...this.settings.autoPan, ...settings.autoPan };
      this.autoPan.updateSettings(settings.autoPan);
    }
    if (settings.multiFilter) {
      this.settings.multiFilter = { ...this.settings.multiFilter, ...settings.multiFilter };
      this.multiFilter.updateSettings(settings.multiFilter);
    }
    if (settings.vibrato) {
      this.settings.vibrato = { ...this.settings.vibrato, ...settings.vibrato };
      this.vibrato.updateSettings(settings.vibrato);
    }

    // Update new dynamics effects
    if (settings.transientShaper) {
      this.settings.transientShaper = { ...this.settings.transientShaper, ...settings.transientShaper };
      this.transientShaper.updateSettings(settings.transientShaper);
    }
    if (settings.stereoImager) {
      this.settings.stereoImager = { ...this.settings.stereoImager, ...settings.stereoImager };
      this.stereoImager.updateSettings(settings.stereoImager);
    }
    if (settings.exciter) {
      this.settings.exciter = { ...this.settings.exciter, ...settings.exciter };
      this.exciter.updateSettings(settings.exciter);
    }
    if (settings.multibandCompressor) {
      this.settings.multibandCompressor = {
        ...this.settings.multibandCompressor,
        ...settings.multibandCompressor,
      };
      this.multibandCompressor.updateSettings(settings.multibandCompressor);
    }

    // Update new spatial effects
    if (settings.stereoDelay) {
      this.settings.stereoDelay = { ...this.settings.stereoDelay, ...settings.stereoDelay };
      this.stereoDelay.updateSettings(settings.stereoDelay);
    }
    if (settings.roomSimulator) {
      this.settings.roomSimulator = { ...this.settings.roomSimulator, ...settings.roomSimulator };
      this.roomSimulator.updateSettings(settings.roomSimulator);
    }
    if (settings.shimmerReverb) {
      this.settings.shimmerReverb = { ...this.settings.shimmerReverb, ...settings.shimmerReverb };
      this.shimmerReverb.updateSettings(settings.shimmerReverb);
    }

    this.notifySettingsChange();
  }

  // Set tempo for tempo-synced effects
  setTempo(bpm: number): void {
    this.coreProcessor.setTempo(bpm);
    this.autoPan.setTempo(bpm);
    this.multiFilter.setTempo(bpm);
    this.vibrato.setTempo(bpm);
    this.granularDelay.setTempo(bpm);
    this.stereoDelay.setTempo(bpm);
  }

  // Set key for key-aware effects (pitch correction, harmonizer)
  setKey(key: string, scale: 'major' | 'minor' = 'major'): void {
    this.pitchCorrection.setKey(key, scale);
    this.harmonizer.setKey(key, scale);
  }

  getSettings(): ExtendedEffectsChain {
    return {
      ...this.coreProcessor.getSettings(),
      pitchCorrection: this.pitchCorrection.getSettings(),
      vocalDoubler: this.vocalDoubler.getSettings(),
      deEsser: this.deEsser.getSettings(),
      formantShifter: this.formantShifter.getSettings(),
      harmonizer: this.harmonizer.getSettings(),
      bitcrusher: this.bitcrusher.getSettings(),
      ringModulator: this.ringModulator.getSettings(),
      frequencyShifter: this.frequencyShifter.getSettings(),
      granularDelay: this.granularDelay.getSettings(),
      rotarySpeaker: this.rotarySpeaker.getSettings(),
      autoPan: this.autoPan.getSettings(),
      multiFilter: this.multiFilter.getSettings(),
      vibrato: this.vibrato.getSettings(),
      transientShaper: this.transientShaper.getSettings(),
      stereoImager: this.stereoImager.getSettings(),
      exciter: this.exciter.getSettings(),
      multibandCompressor: this.multibandCompressor.getSettings(),
      stereoDelay: this.stereoDelay.getSettings(),
      roomSimulator: this.roomSimulator.getSettings(),
      shimmerReverb: this.shimmerReverb.getSettings(),
    };
  }

  // Get all enabled effects for UI
  getEnabledEffects(): string[] {
    const enabled: string[] = [];

    // Core effects
    enabled.push(...this.coreProcessor.getEnabledEffects());

    // New effects
    if (this.settings.pitchCorrection.enabled) enabled.push('Pitch Correction');
    if (this.settings.vocalDoubler.enabled) enabled.push('Vocal Doubler');
    if (this.settings.deEsser.enabled) enabled.push('De-Esser');
    if (this.settings.formantShifter.enabled) enabled.push('Formant Shifter');
    if (this.settings.harmonizer.enabled) enabled.push('Harmonizer');
    if (this.settings.bitcrusher.enabled) enabled.push('Bitcrusher');
    if (this.settings.ringModulator.enabled) enabled.push('Ring Mod');
    if (this.settings.frequencyShifter.enabled) enabled.push('Freq Shift');
    if (this.settings.granularDelay.enabled) enabled.push('Granular');
    if (this.settings.rotarySpeaker.enabled) enabled.push('Leslie');
    if (this.settings.autoPan.enabled) enabled.push('Auto-Pan');
    if (this.settings.multiFilter.enabled) enabled.push('Filter');
    if (this.settings.vibrato.enabled) enabled.push('Vibrato');
    if (this.settings.transientShaper.enabled) enabled.push('Transient');
    if (this.settings.stereoImager.enabled) enabled.push('Stereo');
    if (this.settings.exciter.enabled) enabled.push('Exciter');
    if (this.settings.multibandCompressor.enabled) enabled.push('MB Comp');
    if (this.settings.stereoDelay.enabled) enabled.push('Stereo Dly');
    if (this.settings.roomSimulator.enabled) enabled.push('Room');
    if (this.settings.shimmerReverb.enabled) enabled.push('Shimmer');

    return enabled;
  }

  // Get metering data for UI
  getMeteringData(): {
    noiseGateOpen: boolean;
    compressorReduction: number;
    limiterReduction: number;
    deEsserReduction: number;
    multibandReduction: { low: number; mid: number; high: number };
  } {
    const coreMetering = this.coreProcessor.getMeteringData();
    return {
      ...coreMetering,
      deEsserReduction: this.deEsser.getGainReduction(),
      multibandReduction: this.multibandCompressor.getGainReduction(),
    };
  }

  // Get estimated latency
  getEstimatedLatency(): number {
    let latency = this.coreProcessor.getEstimatedLatency();

    // Add latency for pitch-based effects
    if (this.settings.pitchCorrection.enabled) latency += 46; // FFT window
    if (this.settings.harmonizer.enabled) latency += 30;

    // Most other effects add minimal latency
    const enabledCount = this.getEnabledEffects().length - this.coreProcessor.getEnabledEffects().length;
    latency += enabledCount * 0.1;

    return latency;
  }

  private notifySettingsChange(): void {
    this.onSettingsChange?.(this.getSettings());
  }

  // Reset to defaults
  reset(): void {
    this.updateSettings(DEFAULT_FULL_EFFECTS);
  }

  // Set low-latency mode (delegates to core processor)
  setLowLatencyMode(enabled: boolean): void {
    this.coreProcessor.setLowLatencyMode(enabled);
  }

  // Recover all effects from error state - resets filters and bypasses all effects
  recoverFromError(): void {
    console.warn('[ExtendedEffectsProcessor] Attempting full recovery from error state');

    try {
      // Recover core processor
      this.coreProcessor.recoverFromError();

      // Recover all extended effects
      this.pitchCorrection.recoverFromError();
      this.vocalDoubler.recoverFromError();
      this.deEsser.recoverFromError();
      this.formantShifter.recoverFromError();
      this.harmonizer.recoverFromError();

      this.bitcrusher.recoverFromError();
      this.ringModulator.recoverFromError();
      this.frequencyShifter.recoverFromError();
      this.granularDelay.recoverFromError();

      this.rotarySpeaker.recoverFromError();
      this.autoPan.recoverFromError();
      this.multiFilter.recoverFromError();
      this.vibrato.recoverFromError();

      this.transientShaper.recoverFromError();
      this.stereoImager.recoverFromError();
      this.exciter.recoverFromError();
      this.multibandCompressor.recoverFromError();

      this.stereoDelay.recoverFromError();
      this.roomSimulator.recoverFromError();
      this.shimmerReverb.recoverFromError();

      console.log('[ExtendedEffectsProcessor] Recovery complete - all effects bypassed');
    } catch (e) {
      console.error('[ExtendedEffectsProcessor] Recovery failed:', e);
    }
  }

  // Check if all effects are healthy
  isHealthy(): boolean {
    try {
      // Quick check - verify output gain is not producing NaN
      const outputValue = this.outputGain.gain.value;
      return Number.isFinite(outputValue) && !Number.isNaN(outputValue);
    } catch {
      return false;
    }
  }

  // Clean up
  dispose(): void {
    // Restore original console.warn
    this.restoreConsole();

    this.disconnect();
    this.coreProcessor.dispose();

    this.pitchCorrection.dispose();
    this.vocalDoubler.dispose();
    this.deEsser.dispose();
    this.formantShifter.dispose();
    this.harmonizer.dispose();

    this.bitcrusher.dispose();
    this.ringModulator.dispose();
    this.frequencyShifter.dispose();
    this.granularDelay.dispose();

    this.rotarySpeaker.dispose();
    this.autoPan.dispose();
    this.multiFilter.dispose();
    this.vibrato.dispose();

    this.transientShaper.dispose();
    this.stereoImager.dispose();
    this.exciter.dispose();
    this.multibandCompressor.dispose();

    this.stereoDelay.dispose();
    this.roomSimulator.dispose();
    this.shimmerReverb.dispose();

    this.inputGain.disconnect();
  }
}
