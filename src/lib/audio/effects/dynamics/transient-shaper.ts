// Transient Shaper Effect Processor
// Control attack and sustain independently
// Very low latency - uses envelope detection

import { BaseEffect } from '../base-effect';
import type { TransientShaperSettings } from '@/types';

export class TransientShaperProcessor extends BaseEffect {
  readonly name = 'Transient Shaper';

  private settings: TransientShaperSettings;

  // Envelope detection
  private analyser: AnalyserNode;
  private analysisData: Float32Array<ArrayBuffer>;

  // Attack path
  private attackGain: GainNode;
  private attackFilter: BiquadFilterNode;

  // Sustain path
  private sustainGain: GainNode;
  private sustainFilter: BiquadFilterNode;

  // Output
  private outputMix: GainNode;

  // State
  private animationFrameId: number | null = null;
  private previousEnvelope: number = 0;
  private attackLevel: number = 0;

  constructor(audioContext: AudioContext, settings?: Partial<TransientShaperSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      attack: 0, // -100 to +100
      sustain: 0, // -100 to +100
      attackTime: 5, // ms (1-50)
      releaseTime: 50, // ms (10-500)
      output: 0, // dB (-12 to +12)
      ...settings,
    };

    // Create envelope analyser
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analysisData = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

    // Attack path - emphasizes transients
    this.attackFilter = audioContext.createBiquadFilter();
    this.attackFilter.type = 'highshelf';
    this.attackFilter.frequency.value = 2000;
    this.attackFilter.gain.value = 0;
    this.registerFilter(this.attackFilter);

    this.attackGain = audioContext.createGain();

    // Sustain path - emphasizes body
    this.sustainFilter = audioContext.createBiquadFilter();
    this.sustainFilter.type = 'lowshelf';
    this.sustainFilter.frequency.value = 500;
    this.sustainFilter.gain.value = 0;
    this.registerFilter(this.sustainFilter);

    this.sustainGain = audioContext.createGain();

    // Output mix
    this.outputMix = audioContext.createGain();

    // Wire up signal chain - start from wetPathGate to block filters when disabled
    // Analysis path (parallel) - also gated
    this.getWetPathInput().connect(this.analyser);

    // Attack processing
    this.getWetPathInput().connect(this.attackFilter);
    this.attackFilter.connect(this.attackGain);
    this.attackGain.connect(this.outputMix);

    // Sustain processing
    this.getWetPathInput().connect(this.sustainFilter);
    this.sustainFilter.connect(this.sustainGain);
    this.sustainGain.connect(this.outputMix);

    // Output
    this.outputMix.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateGains();
    this.updateOutput();

    if (this.settings.enabled) {
      this.startEnvelopeFollower();
    }
  }

  private startEnvelopeFollower(): void {
    if (this.animationFrameId !== null) return;

    const follow = () => {
      this.analyser.getFloatTimeDomainData(this.analysisData);

      // Calculate current envelope (peak)
      let peak = 0;
      for (let i = 0; i < this.analysisData.length; i++) {
        peak = Math.max(peak, Math.abs(this.analysisData[i]));
      }

      // Detect transient (attack phase)
      const envelopeDiff = peak - this.previousEnvelope;
      const attackTimeConst = this.settings.attackTime / 1000;
      const releaseTimeConst = this.settings.releaseTime / 1000;

      if (envelopeDiff > 0) {
        // Attack phase - rising envelope
        this.attackLevel = Math.min(1, this.attackLevel + envelopeDiff * 10);
      } else {
        // Release phase
        this.attackLevel *= Math.exp(-1 / (releaseTimeConst * 60));
      }

      this.previousEnvelope = peak;

      // Apply attack/sustain shaping
      const now = this.audioContext.currentTime;

      // Attack boost/cut based on transient detection
      const attackAmount = this.settings.attack / 100;
      const attackGainValue = 1 + (attackAmount * this.attackLevel);
      this.attackGain.gain.setTargetAtTime(
        Math.max(0, Math.min(2, attackGainValue)),
        now,
        attackTimeConst
      );

      // Sustain is inverse of attack detection
      const sustainAmount = this.settings.sustain / 100;
      const sustainLevel = 1 - this.attackLevel;
      const sustainGainValue = 1 + (sustainAmount * sustainLevel);
      this.sustainGain.gain.setTargetAtTime(
        Math.max(0, Math.min(2, sustainGainValue)),
        now,
        releaseTimeConst
      );

      this.animationFrameId = requestAnimationFrame(follow);
    };
    follow();
  }

  private stopEnvelopeFollower(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateGains(): void {
    const now = this.audioContext.currentTime;

    // Set filter gains for attack/sustain emphasis
    this.attackFilter.gain.setTargetAtTime(this.settings.attack / 10, now, 0.01);
    this.sustainFilter.gain.setTargetAtTime(this.settings.sustain / 10, now, 0.01);
  }

  private updateOutput(): void {
    const now = this.audioContext.currentTime;
    const linearGain = Math.pow(10, this.settings.output / 20);
    this.outputMix.gain.setTargetAtTime(linearGain, now, 0.01);
  }

  setEnabled(enabled: boolean): void {
    super.setEnabled(enabled);

    if (enabled) {
      this.startEnvelopeFollower();
    } else {
      this.stopEnvelopeFollower();
    }
  }

  updateSettings(settings: Partial<TransientShaperSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.attack !== undefined || settings.sustain !== undefined) {
      this.updateGains();
    }

    if (settings.output !== undefined) {
      this.updateOutput();
    }
  }

  getSettings(): TransientShaperSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.stopEnvelopeFollower();
    this.analyser.disconnect();
    this.attackFilter.disconnect();
    this.attackGain.disconnect();
    this.sustainFilter.disconnect();
    this.sustainGain.disconnect();
    this.outputMix.disconnect();
    super.dispose();
  }
}
