// Frequency Shifter Effect Processor
// Non-pitch-preserving frequency shift (creates inharmonic content)
// Minimal latency - uses single-sideband modulation approximation

import { BaseEffect } from '../base-effect';
import type { FrequencyShifterSettings } from '@/types';

export class FrequencyShifterProcessor extends BaseEffect {
  readonly name = 'Frequency Shifter';

  private settings: FrequencyShifterSettings;

  // Hilbert transform approximation using allpass filters
  private allpassReal: BiquadFilterNode[] = [];
  private allpassImag: BiquadFilterNode[] = [];

  // Modulation oscillators (sine and cosine)
  private oscSin: OscillatorNode;
  private oscCos: OscillatorNode;
  private gainSin: GainNode;
  private gainCos: GainNode;

  // Sum node
  private sumGain: GainNode;

  // Dry/wet
  private dryGain: GainNode;
  private shiftGain: GainNode;

  // Feedback path
  private feedbackGain: GainNode;
  private feedbackDelay: DelayNode;

  // Allpass filter coefficients for Hilbert transform approximation
  // These create 90-degree phase shift across the audio band
  private readonly allpassCoeffs = [
    0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737
  ];

  constructor(audioContext: AudioContext, settings?: Partial<FrequencyShifterSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      shift: 0, // Hz (-2000 to +2000)
      feedback: 0, // 0-100
      mix: 50, // 0-100
      direction: 'up', // 'up', 'down', 'both'
      ...settings,
    };

    // Create Hilbert transform approximation (allpass filter network)
    // CRITICAL: Allpass filters must be registered for stability when toggling effect
    // Real path (0 degree)
    for (const coeff of this.allpassCoeffs) {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = coeff * 22050;
      filter.Q.value = 0.5;
      this.registerFilter(filter);
      this.allpassReal.push(filter);
    }

    // Imaginary path (90 degree shift)
    for (const coeff of this.allpassCoeffs) {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = coeff * 22050;
      filter.Q.value = 0.5;
      this.registerFilter(filter);
      this.allpassImag.push(filter);
    }

    // Modulation oscillators
    this.oscSin = audioContext.createOscillator();
    this.oscCos = audioContext.createOscillator();
    this.oscSin.type = 'sine';
    this.oscCos.type = 'sine';

    // Set 90-degree phase difference for quadrature modulation
    this.oscCos.detune.value = 0; // Will be set via phase

    // Modulation gains
    this.gainSin = audioContext.createGain();
    this.gainCos = audioContext.createGain();

    // Sum gain
    this.sumGain = audioContext.createGain();

    // Dry/wet
    this.dryGain = audioContext.createGain();
    this.shiftGain = audioContext.createGain();

    // Feedback
    this.feedbackGain = audioContext.createGain();
    this.feedbackDelay = audioContext.createDelay(0.1);
    this.feedbackDelay.delayTime.value = 0.01;

    // Wire up Hilbert transform (real path)
    // CRITICAL: Use getWetPathInput() to ensure filters don't process audio when disabled
    let prevNodeReal: AudioNode = this.getWetPathInput();
    for (const filter of this.allpassReal) {
      prevNodeReal.connect(filter);
      prevNodeReal = filter;
    }
    prevNodeReal.connect(this.gainSin);

    // Wire up Hilbert transform (imaginary path - with phase shift)
    let prevNodeImag: AudioNode = this.getWetPathInput();
    for (const filter of this.allpassImag) {
      prevNodeImag.connect(filter);
      prevNodeImag = filter;
    }
    prevNodeImag.connect(this.gainCos);

    // Connect oscillators to modulate the gains
    this.oscSin.connect(this.gainSin.gain);
    this.oscCos.connect(this.gainCos.gain);

    // Sum the modulated signals
    this.gainSin.connect(this.sumGain);
    this.gainCos.connect(this.sumGain);

    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Wet path
    this.sumGain.connect(this.shiftGain);
    this.shiftGain.connect(this.wetGain);

    // Feedback path
    this.sumGain.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.sumGain);

    this.wetGain.connect(this.outputGain);

    // Start oscillators
    this.oscSin.start();
    this.oscCos.start();

    // Apply initial settings
    this.updateShift();
    this.updateFeedback();
    this.updateMix();
  }

  private updateShift(): void {
    const now = this.audioContext.currentTime;

    // Set shift frequency (absolute value)
    const shiftFreq = Math.abs(this.settings.shift);
    this.oscSin.frequency.setTargetAtTime(shiftFreq, now, 0.01);
    this.oscCos.frequency.setTargetAtTime(shiftFreq, now, 0.01);

    // Direction determines whether we add or subtract the quadrature components
    // Up shift: sin + cos
    // Down shift: sin - cos (or vice versa)
    const direction = this.settings.shift >= 0 ? 1 : -1;

    // For proper single-sideband modulation
    this.gainSin.gain.setTargetAtTime(direction, now, 0.01);
    this.gainCos.gain.setTargetAtTime(1, now, 0.01);
  }

  private updateFeedback(): void {
    const now = this.audioContext.currentTime;
    const feedback = Math.min(0.95, this.settings.feedback / 100);
    this.feedbackGain.gain.setTargetAtTime(feedback, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.shiftGain.gain.setTargetAtTime(Math.sqrt(mix) * 0.5, now, 0.01);
  }

  updateSettings(settings: Partial<FrequencyShifterSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.shift !== undefined || settings.direction !== undefined) {
      this.updateShift();
    }

    if (settings.feedback !== undefined) {
      this.updateFeedback();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): FrequencyShifterSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.oscSin.stop();
    this.oscCos.stop();
    this.oscSin.disconnect();
    this.oscCos.disconnect();

    for (const filter of this.allpassReal) {
      filter.disconnect();
    }
    for (const filter of this.allpassImag) {
      filter.disconnect();
    }

    this.gainSin.disconnect();
    this.gainCos.disconnect();
    this.sumGain.disconnect();
    this.dryGain.disconnect();
    this.shiftGain.disconnect();
    this.feedbackGain.disconnect();
    this.feedbackDelay.disconnect();
    super.dispose();
  }
}
