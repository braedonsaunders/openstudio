// Room Simulator Effect Processor
// Early reflections focused spatial effect
// Low latency - uses tapped delay line

import { BaseEffect } from '../base-effect';
import type { RoomSimulatorSettings } from '@/types';

// Early reflection tap positions (in ms) for different room sizes
const ROOM_TAPS = {
  small: [
    { time: 5, gain: 0.8, pan: -0.3 },
    { time: 8, gain: 0.6, pan: 0.4 },
    { time: 12, gain: 0.5, pan: -0.5 },
    { time: 18, gain: 0.4, pan: 0.6 },
    { time: 25, gain: 0.3, pan: -0.2 },
    { time: 35, gain: 0.2, pan: 0.3 },
  ],
  medium: [
    { time: 10, gain: 0.7, pan: -0.4 },
    { time: 18, gain: 0.55, pan: 0.5 },
    { time: 28, gain: 0.45, pan: -0.6 },
    { time: 40, gain: 0.35, pan: 0.7 },
    { time: 55, gain: 0.25, pan: -0.3 },
    { time: 75, gain: 0.15, pan: 0.4 },
  ],
  large: [
    { time: 20, gain: 0.65, pan: -0.5 },
    { time: 35, gain: 0.5, pan: 0.6 },
    { time: 55, gain: 0.4, pan: -0.7 },
    { time: 80, gain: 0.3, pan: 0.8 },
    { time: 110, gain: 0.2, pan: -0.4 },
    { time: 150, gain: 0.1, pan: 0.5 },
  ],
  hall: [
    { time: 30, gain: 0.6, pan: -0.6 },
    { time: 55, gain: 0.45, pan: 0.7 },
    { time: 85, gain: 0.35, pan: -0.8 },
    { time: 120, gain: 0.25, pan: 0.9 },
    { time: 170, gain: 0.15, pan: -0.5 },
    { time: 230, gain: 0.08, pan: 0.6 },
  ],
};

export class RoomSimulatorProcessor extends BaseEffect {
  readonly name = 'Room Simulator';

  private settings: RoomSimulatorSettings;

  // Early reflection delays
  private erDelays: DelayNode[] = [];
  private erGains: GainNode[] = [];
  private erPanners: StereoPannerNode[] = [];

  // Late reverb (simple feedback delay network)
  private lateDelay1: DelayNode;
  private lateDelay2: DelayNode;
  private lateFeedback1: GainNode;
  private lateFeedback2: GainNode;
  private lateFilter: BiquadFilterNode;

  // Damping
  private dampingFilter: BiquadFilterNode;

  // Mixing
  private dryGain: GainNode;
  private earlyGain: GainNode;
  private lateGain: GainNode;

  // Pre-delay
  private preDelay: DelayNode;

  private numTaps = 6;

  constructor(audioContext: AudioContext, settings?: Partial<RoomSimulatorSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      size: 'medium', // 'small', 'medium', 'large', 'hall'
      damping: 50, // 0-100 (high frequency absorption)
      earlyLevel: 70, // 0-100
      lateLevel: 50, // 0-100
      decay: 1.5, // seconds (0.1-5)
      preDelay: 10, // ms (0-100)
      diffusion: 70, // 0-100
      modulation: 20, // 0-100
      mix: 30, // 0-100
      ...settings,
    };

    // Create early reflection taps
    for (let i = 0; i < this.numTaps; i++) {
      const delay = audioContext.createDelay(0.5);
      const gain = audioContext.createGain();
      const panner = audioContext.createStereoPanner();

      this.erDelays.push(delay);
      this.erGains.push(gain);
      this.erPanners.push(panner);
    }

    // Create late reverb
    this.lateDelay1 = audioContext.createDelay(0.5);
    this.lateDelay2 = audioContext.createDelay(0.5);
    this.lateFeedback1 = audioContext.createGain();
    this.lateFeedback2 = audioContext.createGain();

    this.lateFilter = audioContext.createBiquadFilter();
    this.lateFilter.type = 'lowpass';
    this.lateFilter.Q.value = 0.5;
    this.registerFilter(this.lateFilter);

    // Damping filter
    this.dampingFilter = audioContext.createBiquadFilter();
    this.dampingFilter.type = 'lowpass';
    this.dampingFilter.Q.value = 0.5;
    this.registerFilter(this.dampingFilter);

    // Pre-delay
    this.preDelay = audioContext.createDelay(0.2);

    // Mixing
    this.dryGain = audioContext.createGain();
    this.earlyGain = audioContext.createGain();
    this.lateGain = audioContext.createGain();

    // Wire up signal chain
    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Pre-delay
    this.inputGain.connect(this.preDelay);

    // Early reflections
    for (let i = 0; i < this.numTaps; i++) {
      this.preDelay.connect(this.erDelays[i]);
      this.erDelays[i].connect(this.erGains[i]);
      this.erGains[i].connect(this.erPanners[i]);
      this.erPanners[i].connect(this.earlyGain);
    }
    this.earlyGain.connect(this.wetGain);

    // Late reverb (simple FDN)
    this.preDelay.connect(this.lateDelay1);
    this.lateDelay1.connect(this.dampingFilter);
    this.dampingFilter.connect(this.lateFeedback1);
    this.lateFeedback1.connect(this.lateDelay2);
    this.lateDelay2.connect(this.lateFilter);
    this.lateFilter.connect(this.lateFeedback2);
    this.lateFeedback2.connect(this.lateDelay1);
    this.lateFilter.connect(this.lateGain);
    this.lateGain.connect(this.wetGain);

    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateRoom();
    this.updateDamping();
    this.updateDecay();
    this.updatePreDelay();
    this.updateMix();
  }

  private updateRoom(): void {
    const now = this.audioContext.currentTime;
    const taps = ROOM_TAPS[this.settings.size] || ROOM_TAPS.medium;

    for (let i = 0; i < this.numTaps; i++) {
      const tap = taps[i];
      this.erDelays[i].delayTime.setTargetAtTime(tap.time / 1000, now, 0.01);
      this.erGains[i].gain.setTargetAtTime(tap.gain, now, 0.01);
      this.erPanners[i].pan.setTargetAtTime(tap.pan, now, 0.01);
    }

    // Update late reverb delay times based on room size
    const sizeMultiplier = {
      small: 0.5,
      medium: 1,
      large: 1.5,
      hall: 2,
    }[this.settings.size] || 1;

    this.lateDelay1.delayTime.setTargetAtTime(0.037 * sizeMultiplier, now, 0.01);
    this.lateDelay2.delayTime.setTargetAtTime(0.041 * sizeMultiplier, now, 0.01);
  }

  private updateDamping(): void {
    const now = this.audioContext.currentTime;

    // Map damping 0-100 to filter frequency 20000-2000 Hz
    const freq = 20000 - (this.settings.damping / 100) * 18000;
    this.dampingFilter.frequency.setTargetAtTime(freq, now, 0.01);
    this.lateFilter.frequency.setTargetAtTime(freq * 0.8, now, 0.01);
  }

  private updateDecay(): void {
    const now = this.audioContext.currentTime;

    // Calculate feedback for desired decay time
    // Approximate: feedback = 10^(-3 * delay / decay)
    const delay1 = 0.037;
    const delay2 = 0.041;
    const decay = this.settings.decay;

    const fb1 = Math.pow(10, -3 * delay1 / decay);
    const fb2 = Math.pow(10, -3 * delay2 / decay);

    // Clamp to prevent runaway
    this.lateFeedback1.gain.setTargetAtTime(Math.min(0.95, fb1), now, 0.01);
    this.lateFeedback2.gain.setTargetAtTime(Math.min(0.95, fb2), now, 0.01);
  }

  private updatePreDelay(): void {
    const now = this.audioContext.currentTime;
    this.preDelay.delayTime.setTargetAtTime(this.settings.preDelay / 1000, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.earlyGain.gain.setTargetAtTime(
      Math.sqrt(mix) * (this.settings.earlyLevel / 100),
      now,
      0.01
    );
    this.lateGain.gain.setTargetAtTime(
      Math.sqrt(mix) * (this.settings.lateLevel / 100),
      now,
      0.01
    );
  }

  updateSettings(settings: Partial<RoomSimulatorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.size !== undefined) {
      this.updateRoom();
    }

    if (settings.damping !== undefined) {
      this.updateDamping();
    }

    if (settings.decay !== undefined) {
      this.updateDecay();
    }

    if (settings.preDelay !== undefined) {
      this.updatePreDelay();
    }

    if (settings.mix !== undefined ||
        settings.earlyLevel !== undefined ||
        settings.lateLevel !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): RoomSimulatorSettings {
    return { ...this.settings };
  }

  dispose(): void {
    for (const delay of this.erDelays) {
      delay.disconnect();
    }
    for (const gain of this.erGains) {
      gain.disconnect();
    }
    for (const panner of this.erPanners) {
      panner.disconnect();
    }

    this.lateDelay1.disconnect();
    this.lateDelay2.disconnect();
    this.lateFeedback1.disconnect();
    this.lateFeedback2.disconnect();
    this.lateFilter.disconnect();
    this.dampingFilter.disconnect();
    this.preDelay.disconnect();
    this.dryGain.disconnect();
    this.earlyGain.disconnect();
    this.lateGain.disconnect();
    super.dispose();
  }
}
