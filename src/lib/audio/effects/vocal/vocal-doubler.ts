// Vocal Doubler Effect Processor
// Creates natural-sounding vocal thickness with subtle pitch and time variations
// Very low latency - uses simple detune and micro-delays

import { BaseEffect } from '../base-effect';
import type { VocalDoublerSettings } from '@/types';

export class VocalDoublerProcessor extends BaseEffect {
  readonly name = 'Vocal Doubler';

  private settings: VocalDoublerSettings;

  // Delay lines for left/right doubling
  private delayLeft: DelayNode;
  private delayRight: DelayNode;

  // Detune via playback rate modulation (simulated with delay modulation)
  private lfoLeft: OscillatorNode;
  private lfoRight: OscillatorNode;
  private lfoGainLeft: GainNode;
  private lfoGainRight: GainNode;

  // Stereo separation
  private panLeft: StereoPannerNode;
  private panRight: StereoPannerNode;

  // Mixing
  private dryGain: GainNode;
  private wetGainLeft: GainNode;
  private wetGainRight: GainNode;

  // High-pass filter to remove mud
  private highPass: BiquadFilterNode;

  constructor(audioContext: AudioContext, settings?: Partial<VocalDoublerSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      detune: 8, // cents (0-50)
      delay: 15, // ms (0-50)
      spread: 50, // stereo width 0-100
      depth: 30, // modulation depth 0-100
      mix: 50, // wet/dry 0-100
      voices: 2, // number of doubled voices (1-4)
      ...settings,
    };

    // Create delay lines (max 100ms)
    this.delayLeft = audioContext.createDelay(0.1);
    this.delayRight = audioContext.createDelay(0.1);

    // Create LFO for subtle pitch variation
    this.lfoLeft = audioContext.createOscillator();
    this.lfoRight = audioContext.createOscillator();
    this.lfoLeft.type = 'sine';
    this.lfoRight.type = 'sine';
    this.lfoLeft.frequency.value = 0.5; // Very slow modulation
    this.lfoRight.frequency.value = 0.7; // Slightly different for natural feel

    // LFO gain (controls modulation depth)
    this.lfoGainLeft = audioContext.createGain();
    this.lfoGainRight = audioContext.createGain();

    // Stereo panners
    this.panLeft = audioContext.createStereoPanner();
    this.panRight = audioContext.createStereoPanner();

    // Mix gains
    this.dryGain = audioContext.createGain();
    this.wetGainLeft = audioContext.createGain();
    this.wetGainRight = audioContext.createGain();

    // High-pass to keep things clean
    this.highPass = audioContext.createBiquadFilter();
    this.highPass.type = 'highpass';
    this.highPass.frequency.value = 80;
    this.highPass.Q.value = 0.7;
    this.registerFilter(this.highPass);

    // Wire up signal chain
    // CRITICAL: Use getWetPathInput() to prevent filter instability when disabled
    // Dry path (goes through wetPathGate for proper bypass)
    this.getWetPathInput().connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Wet path - left voice
    this.getWetPathInput().connect(this.delayLeft);
    this.delayLeft.connect(this.highPass);
    this.highPass.connect(this.wetGainLeft);
    this.wetGainLeft.connect(this.panLeft);
    this.panLeft.connect(this.wetGain);

    // Wet path - right voice
    this.getWetPathInput().connect(this.delayRight);
    this.delayRight.connect(this.wetGainRight);
    this.wetGainRight.connect(this.panRight);
    this.panRight.connect(this.wetGain);

    // LFO modulation of delay time (creates pitch variation)
    this.lfoLeft.connect(this.lfoGainLeft);
    this.lfoGainLeft.connect(this.delayLeft.delayTime);
    this.lfoRight.connect(this.lfoGainRight);
    this.lfoGainRight.connect(this.delayRight.delayTime);

    // Output
    this.wetGain.connect(this.outputGain);

    // Start LFOs
    this.lfoLeft.start();
    this.lfoRight.start();

    // Apply initial settings
    this.updateDelay();
    this.updateDetune();
    this.updateSpread();
    this.updateMix();
  }

  private updateDelay(): void {
    const now = this.audioContext.currentTime;
    const baseDelay = this.settings.delay / 1000;

    // Slightly different delays for natural doubling
    this.delayLeft.delayTime.setTargetAtTime(baseDelay * 0.9, now, 0.01);
    this.delayRight.delayTime.setTargetAtTime(baseDelay * 1.1, now, 0.01);
  }

  private updateDetune(): void {
    const now = this.audioContext.currentTime;

    // Convert cents to delay modulation depth
    // 1 cent ≈ 0.06% pitch change
    // For a 20ms delay, 1ms modulation ≈ 50 cents variation
    const detuneMs = (this.settings.detune / 50) * 0.002; // Max 2ms modulation
    const depth = this.settings.depth / 100;

    this.lfoGainLeft.gain.setTargetAtTime(detuneMs * depth, now, 0.01);
    this.lfoGainRight.gain.setTargetAtTime(-detuneMs * depth, now, 0.01); // Opposite direction
  }

  private updateSpread(): void {
    const now = this.audioContext.currentTime;
    const spread = this.settings.spread / 100;

    this.panLeft.pan.setTargetAtTime(-spread, now, 0.01);
    this.panRight.pan.setTargetAtTime(spread, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    // Equal power crossfade
    const wetLevel = Math.sqrt(mix) * 0.5; // Each doubled voice at half level
    const dryLevel = Math.sqrt(1 - mix * 0.5); // Keep some dry signal

    this.dryGain.gain.setTargetAtTime(dryLevel, now, 0.01);
    this.wetGainLeft.gain.setTargetAtTime(wetLevel, now, 0.01);
    this.wetGainRight.gain.setTargetAtTime(wetLevel, now, 0.01);
  }

  updateSettings(settings: Partial<VocalDoublerSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.delay !== undefined) {
      this.updateDelay();
    }

    if (settings.detune !== undefined || settings.depth !== undefined) {
      this.updateDetune();
    }

    if (settings.spread !== undefined) {
      this.updateSpread();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): VocalDoublerSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.lfoLeft.stop();
    this.lfoRight.stop();
    this.lfoLeft.disconnect();
    this.lfoRight.disconnect();
    this.lfoGainLeft.disconnect();
    this.lfoGainRight.disconnect();
    this.delayLeft.disconnect();
    this.delayRight.disconnect();
    this.panLeft.disconnect();
    this.panRight.disconnect();
    this.dryGain.disconnect();
    this.wetGainLeft.disconnect();
    this.wetGainRight.disconnect();
    this.highPass.disconnect();
    super.dispose();
  }
}
