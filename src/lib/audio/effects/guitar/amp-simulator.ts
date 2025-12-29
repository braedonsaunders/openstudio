// Amp Simulator Processor
// Full guitar amplifier emulation with preamp, tonestack, and power amp sections
// Based on classic tube amp circuits (Marshall, Fender, Mesa-style)

import { BaseEffect } from '../base-effect';
import type { AmpSimulatorSettings } from '@/types';

export type AmpType = 'clean' | 'crunch' | 'highgain' | 'british' | 'american' | 'modern';

// Tonestack frequency centers for different amp types
const TONESTACK_PARAMS = {
  clean: { bassFreq: 100, midFreq: 800, trebleFreq: 3200, presence: 5000 },
  crunch: { bassFreq: 120, midFreq: 650, trebleFreq: 3000, presence: 4500 },
  highgain: { bassFreq: 80, midFreq: 500, trebleFreq: 4000, presence: 6000 },
  british: { bassFreq: 100, midFreq: 1000, trebleFreq: 3500, presence: 5500 },
  american: { bassFreq: 80, midFreq: 700, trebleFreq: 2800, presence: 4000 },
  modern: { bassFreq: 60, midFreq: 400, trebleFreq: 4500, presence: 7000 },
};

export class AmpSimulatorProcessor extends BaseEffect {
  readonly name = 'Amp Simulator';

  // Input stage
  private inputFilter: BiquadFilterNode;
  private inputGainNode: GainNode;

  // Preamp stage (gain + saturation)
  private preampGain: GainNode;
  private preampWaveshaper: WaveShaperNode;

  // Tonestack (3-band EQ)
  private bassFilter: BiquadFilterNode;
  private midFilter: BiquadFilterNode;
  private trebleFilter: BiquadFilterNode;

  // Power amp stage
  private powerAmpGain: GainNode;
  private powerAmpWaveshaper: WaveShaperNode;
  private presenceFilter: BiquadFilterNode;

  // Output
  private masterGain: GainNode;

  private settings: AmpSimulatorSettings;

  constructor(audioContext: AudioContext, settings?: Partial<AmpSimulatorSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      type: 'crunch',
      gain: 0.5, // Preamp gain 0-1
      bass: 0.5, // 0-1
      mid: 0.5, // 0-1
      treble: 0.5, // 0-1
      presence: 0.5, // 0-1
      master: 0.5, // Master volume 0-1
      ...settings,
    };

    // Create input stage nodes
    this.inputFilter = audioContext.createBiquadFilter();
    this.inputGainNode = audioContext.createGain();

    // Create preamp stage
    this.preampGain = audioContext.createGain();
    this.preampWaveshaper = audioContext.createWaveShaper();

    // Create tonestack
    this.bassFilter = audioContext.createBiquadFilter();
    this.midFilter = audioContext.createBiquadFilter();
    this.trebleFilter = audioContext.createBiquadFilter();

    // Create power amp stage
    this.powerAmpGain = audioContext.createGain();
    this.powerAmpWaveshaper = audioContext.createWaveShaper();
    this.presenceFilter = audioContext.createBiquadFilter();

    // Create output
    this.masterGain = audioContext.createGain();

    // Configure input stage and register filters for stability
    this.inputFilter.type = 'highpass';
    this.inputFilter.frequency.value = 60; // Remove sub-bass rumble
    this.inputFilter.Q.value = 0.7;
    this.registerFilter(this.inputFilter);
    this.inputGainNode.gain.value = 1;

    // Configure tonestack filters
    this.bassFilter.type = 'lowshelf';
    this.registerFilter(this.bassFilter);
    this.registerFilter(this.midFilter);
    this.registerFilter(this.trebleFilter);
    this.registerFilter(this.presenceFilter);
    this.bassFilter.Q.value = 0.7;

    this.midFilter.type = 'peaking';
    this.midFilter.Q.value = 1.0;

    this.trebleFilter.type = 'highshelf';
    this.trebleFilter.Q.value = 0.7;

    // Configure presence (high frequency boost in power amp)
    this.presenceFilter.type = 'highshelf';
    this.presenceFilter.Q.value = 0.7;

    // Use 4x oversampling for waveshapers
    this.preampWaveshaper.oversample = '4x';
    this.powerAmpWaveshaper.oversample = '4x';

    // Wire up the signal chain - start from wetPathGate to allow disabling:
    // wetPathGate -> inputFilter -> inputGain -> preampGain -> preampWaveshaper
    // -> bass -> mid -> treble -> powerAmpGain -> powerAmpWaveshaper
    // -> presence -> masterGain -> wetGain -> output

    this.getWetPathInput().connect(this.inputFilter);
    this.inputFilter.connect(this.inputGainNode);
    this.inputGainNode.connect(this.preampGain);
    this.preampGain.connect(this.preampWaveshaper);
    this.preampWaveshaper.connect(this.bassFilter);
    this.bassFilter.connect(this.midFilter);
    this.midFilter.connect(this.trebleFilter);
    this.trebleFilter.connect(this.powerAmpGain);
    this.powerAmpGain.connect(this.powerAmpWaveshaper);
    this.powerAmpWaveshaper.connect(this.presenceFilter);
    this.presenceFilter.connect(this.masterGain);
    this.masterGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateAmpType();
    this.updateGain();
    this.updateTonestack();
    this.updateMaster();
  }

  /**
   * Generate preamp tube saturation curve
   * Asymmetric clipping like real tubes
   */
  private generatePreampCurve(gain: number): Float32Array<ArrayBuffer> {
    const samples = 8192;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);

    // Map gain 0-1 to drive factor
    const k = 1 + gain * 30;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      // Asymmetric tube-like saturation
      // Positive side saturates more gently
      if (x >= 0) {
        curve[i] = Math.tanh(k * x * 0.9);
      } else {
        // Negative side has harder clipping
        curve[i] = Math.tanh(k * x * 1.1);
      }
    }

    return curve;
  }

  /**
   * Generate power amp saturation curve
   * Softer, more compression-like saturation
   */
  private generatePowerAmpCurve(): Float32Array<ArrayBuffer> {
    const samples = 8192;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      // Power amp: softer saturation with gentle compression
      // Uses a polynomial approximation of tube behavior
      if (Math.abs(x) < 0.6) {
        curve[i] = x;
      } else {
        // Soft knee compression above threshold
        const sign = Math.sign(x);
        const abs = Math.abs(x);
        curve[i] = sign * (0.6 + 0.4 * Math.tanh((abs - 0.6) * 5));
      }
    }

    return curve;
  }

  private updateAmpType(): void {
    const params = TONESTACK_PARAMS[this.settings.type];

    // Update tonestack frequencies with safe methods
    this.safeSetFilterFrequency(this.bassFilter, params.bassFreq);
    this.safeSetFilterFrequency(this.midFilter, params.midFreq);
    this.safeSetFilterFrequency(this.trebleFilter, params.trebleFreq);
    this.safeSetFilterFrequency(this.presenceFilter, params.presence);

    // Adjust mid Q based on amp type
    const midQ = this.settings.type === 'modern' ? 1.5 : 1.0;
    this.safeSetFilterQ(this.midFilter, midQ);
  }

  private updateGain(): void {
    const gain = this.settings.gain;
    const now = this.audioContext.currentTime;

    // Preamp gain: exponential scaling for musical response
    // Low gain = clean, high gain = heavily saturated
    const preampGainValue = Math.pow(10, gain * 2) / 10; // 0.1 to 10
    this.preampGain.gain.setTargetAtTime(preampGainValue, now, 0.01);

    // Update saturation curve
    this.preampWaveshaper.curve = this.generatePreampCurve(gain);

    // Power amp gain (relatively constant)
    this.powerAmpGain.gain.setTargetAtTime(1.5, now, 0.01);
    this.powerAmpWaveshaper.curve = this.generatePowerAmpCurve();
  }

  private updateTonestack(): void {
    const now = this.audioContext.currentTime;

    // Map 0-1 to dB gain (-15 to +15)
    const bassGain = (this.settings.bass - 0.5) * 30;
    const midGain = (this.settings.mid - 0.5) * 24;
    const trebleGain = (this.settings.treble - 0.5) * 30;
    const presenceGain = (this.settings.presence - 0.5) * 20;

    this.bassFilter.gain.setTargetAtTime(bassGain, now, 0.01);
    this.midFilter.gain.setTargetAtTime(midGain, now, 0.01);
    this.trebleFilter.gain.setTargetAtTime(trebleGain, now, 0.01);
    this.presenceFilter.gain.setTargetAtTime(presenceGain, now, 0.01);
  }

  private updateMaster(): void {
    const now = this.audioContext.currentTime;
    // Master volume with slight compensation for gain staging
    const masterValue = this.settings.master * 0.8;
    this.masterGain.gain.setTargetAtTime(masterValue, now, 0.01);
  }

  updateSettings(settings: Partial<AmpSimulatorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.type !== undefined) {
      this.updateAmpType();
    }

    if (settings.gain !== undefined) {
      this.updateGain();
    }

    if (
      settings.bass !== undefined ||
      settings.mid !== undefined ||
      settings.treble !== undefined ||
      settings.presence !== undefined
    ) {
      this.updateTonestack();
    }

    if (settings.master !== undefined) {
      this.updateMaster();
    }
  }

  getSettings(): AmpSimulatorSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.inputFilter.disconnect();
    this.inputGainNode.disconnect();
    this.preampGain.disconnect();
    this.preampWaveshaper.disconnect();
    this.bassFilter.disconnect();
    this.midFilter.disconnect();
    this.trebleFilter.disconnect();
    this.powerAmpGain.disconnect();
    this.powerAmpWaveshaper.disconnect();
    this.presenceFilter.disconnect();
    this.masterGain.disconnect();
    super.dispose();
  }
}
