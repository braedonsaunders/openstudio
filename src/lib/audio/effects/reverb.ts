// Reverb Effect Processor
// Algorithmic reverb using multiple delay lines and filters

import { BaseEffect } from './base-effect';
import type { ReverbSettings } from '@/types';

// Pre-computed impulse response generation for different reverb types
const REVERB_PARAMS = {
  room: { decay: 0.8, diffusion: 0.5, density: 0.7, earlyLevel: 0.8 },
  hall: { decay: 2.5, diffusion: 0.8, density: 0.9, earlyLevel: 0.6 },
  plate: { decay: 1.5, diffusion: 0.9, density: 0.95, earlyLevel: 0.3 },
  spring: { decay: 1.2, diffusion: 0.4, density: 0.5, earlyLevel: 0.7 },
  ambient: { decay: 4.0, diffusion: 0.95, density: 0.98, earlyLevel: 0.4 },
};

export class ReverbProcessor extends BaseEffect {
  readonly name = 'Reverb';
  private convolver: ConvolverNode;
  private dryGain: GainNode;
  private reverbWetGain: GainNode;
  private preDelayNode: DelayNode;
  private lowCutFilter: BiquadFilterNode;
  private highCutFilter: BiquadFilterNode;
  private settings: ReverbSettings;
  private currentImpulseBuffer: AudioBuffer | null = null;

  constructor(audioContext: AudioContext, settings?: Partial<ReverbSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      type: 'room',
      mix: 0.3,
      decay: 1.5,
      preDelay: 20,
      highCut: 8000,
      lowCut: 200,
      ...settings,
    };

    // Create nodes
    this.convolver = audioContext.createConvolver();
    this.dryGain = audioContext.createGain();
    this.reverbWetGain = audioContext.createGain();
    this.preDelayNode = audioContext.createDelay(0.1); // Max 100ms pre-delay
    this.lowCutFilter = audioContext.createBiquadFilter();
    this.highCutFilter = audioContext.createBiquadFilter();

    // Configure filters
    this.lowCutFilter.type = 'highpass';
    this.lowCutFilter.frequency.value = this.settings.lowCut;
    this.lowCutFilter.Q.value = 0.7;
    this.registerFilter(this.lowCutFilter);

    this.highCutFilter.type = 'lowpass';
    this.highCutFilter.frequency.value = this.settings.highCut;
    this.highCutFilter.Q.value = 0.7;
    this.registerFilter(this.highCutFilter);

    // Set initial gains
    this.updateMix();
    this.preDelayNode.delayTime.value = this.settings.preDelay / 1000;

    // Wire up:
    // input -> lowCut -> highCut -> preDelay -> convolver -> reverbWet -> wetGain -> output
    //      \-> dryGain -> wetGain -> output
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    this.inputGain.connect(this.lowCutFilter);
    this.lowCutFilter.connect(this.highCutFilter);
    this.highCutFilter.connect(this.preDelayNode);
    this.preDelayNode.connect(this.convolver);
    this.convolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.wetGain);

    this.wetGain.connect(this.outputGain);

    // Generate initial impulse response
    this.generateImpulseResponse();
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    // Equal power crossfade
    const wetLevel = Math.sqrt(this.settings.mix);
    const dryLevel = Math.sqrt(1 - this.settings.mix);

    this.dryGain.gain.setTargetAtTime(dryLevel, now, 0.01);
    this.reverbWetGain.gain.setTargetAtTime(wetLevel, now, 0.01);
  }

  private async generateImpulseResponse(): Promise<void> {
    const params = REVERB_PARAMS[this.settings.type];
    const sampleRate = this.audioContext.sampleRate;
    const decayTime = this.settings.decay * params.decay;
    const length = Math.floor(sampleRate * decayTime);

    // Create stereo buffer
    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    // Generate noise-based impulse with decay
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-3 * t / decayTime);

      // Add early reflections
      let early = 0;
      if (t < 0.1) {
        const earlyDecay = Math.exp(-30 * t);
        // Simulate early reflections with sparse impulses
        if (Math.random() < 0.02 * params.earlyLevel) {
          early = (Math.random() - 0.5) * 2 * earlyDecay * params.earlyLevel;
        }
      }

      // Late diffuse reverb (filtered noise)
      const diffuse = (Math.random() - 0.5) * 2 * decay * params.diffusion;

      // Slight stereo decorrelation
      const stereoOffset = (Math.random() - 0.5) * 0.1 * params.density;

      leftChannel[i] = early + diffuse;
      rightChannel[i] = early + diffuse + stereoOffset;
    }

    // Apply density smoothing (simple low-pass on the impulse)
    const smoothingFactor = 1 - params.density * 0.3;
    for (let i = 1; i < length; i++) {
      leftChannel[i] = leftChannel[i] * (1 - smoothingFactor) + leftChannel[i - 1] * smoothingFactor;
      rightChannel[i] = rightChannel[i] * (1 - smoothingFactor) + rightChannel[i - 1] * smoothingFactor;
    }

    // Normalize
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
      maxVal = Math.max(maxVal, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
    }
    if (maxVal > 0) {
      const normFactor = 0.7 / maxVal;
      for (let i = 0; i < length; i++) {
        leftChannel[i] *= normFactor;
        rightChannel[i] *= normFactor;
      }
    }

    this.currentImpulseBuffer = buffer;
    this.convolver.buffer = buffer;
  }

  updateSettings(settings: Partial<ReverbSettings>): void {
    const needsNewImpulse =
      settings.type !== undefined ||
      settings.decay !== undefined;

    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }

    if (settings.preDelay !== undefined) {
      const now = this.audioContext.currentTime;
      this.preDelayNode.delayTime.setTargetAtTime(settings.preDelay / 1000, now, 0.01);
    }

    if (settings.lowCut !== undefined) {
      this.safeSetFilterFrequency(this.lowCutFilter, settings.lowCut);
    }

    if (settings.highCut !== undefined) {
      this.safeSetFilterFrequency(this.highCutFilter, settings.highCut);
    }

    if (needsNewImpulse) {
      this.generateImpulseResponse();
    }
  }

  getSettings(): ReverbSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.convolver.disconnect();
    this.dryGain.disconnect();
    this.reverbWetGain.disconnect();
    this.preDelayNode.disconnect();
    this.lowCutFilter.disconnect();
    this.highCutFilter.disconnect();
    super.dispose();
  }
}
