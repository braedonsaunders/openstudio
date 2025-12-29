// Chorus Effect Processor
// Stereo chorus with LFO-modulated delays
// Based on Tone.js Chorus algorithm

import { BaseEffect } from '../base-effect';
import type { ChorusSettings } from '@/types';

export class ChorusProcessor extends BaseEffect {
  readonly name = 'Chorus';

  // Delay lines for left and right
  private delayLeft: DelayNode;
  private delayRight: DelayNode;

  // LFO oscillators (offset for stereo)
  private lfoLeft: OscillatorNode;
  private lfoRight: OscillatorNode;

  // LFO depth control
  private lfoGainLeft: GainNode;
  private lfoGainRight: GainNode;

  // Mixing
  private chorusWetGain: GainNode;
  private chorusDryGain: GainNode;

  // High pass to remove mud
  private highPassFilter: BiquadFilterNode;

  private settings: ChorusSettings;

  constructor(audioContext: AudioContext, settings?: Partial<ChorusSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      rate: 1.5, // LFO rate in Hz (0.1 - 10)
      depth: 0.5, // Modulation depth 0-1
      delay: 3.5, // Base delay time in ms (2 - 20)
      feedback: 0, // Feedback amount 0-1
      spread: 180, // Stereo spread in degrees (0 - 180)
      mix: 0.5, // Wet/dry mix 0-1
      ...settings,
    };

    // Create delay lines
    this.delayLeft = audioContext.createDelay(0.1); // Max 100ms
    this.delayRight = audioContext.createDelay(0.1);

    // Create LFO oscillators
    this.lfoLeft = audioContext.createOscillator();
    this.lfoRight = audioContext.createOscillator();

    // Create LFO gain controls
    this.lfoGainLeft = audioContext.createGain();
    this.lfoGainRight = audioContext.createGain();

    // Create mix controls
    this.chorusWetGain = audioContext.createGain();
    this.chorusDryGain = audioContext.createGain();

    // Create high pass filter
    this.highPassFilter = audioContext.createBiquadFilter();

    // Configure LFOs
    this.lfoLeft.type = 'sine';
    this.lfoRight.type = 'sine';

    // Configure high pass
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 100;
    this.highPassFilter.Q.value = 0.7;
    this.registerFilter(this.highPassFilter);

    // Wire up the signal chain
    this.wireUpSignalChain();

    // Start LFOs
    this.lfoLeft.start();
    this.lfoRight.start();

    // Apply initial settings
    this.updateRate();
    this.updateDepth();
    this.updateDelay();
    this.updateSpread();
    this.updateMix();
  }

  private wireUpSignalChain(): void {
    // Dry path
    this.inputGain.connect(this.chorusDryGain);
    this.chorusDryGain.connect(this.outputGain);

    // Wet path - Left channel
    this.inputGain.connect(this.delayLeft);
    this.delayLeft.connect(this.highPassFilter);
    this.highPassFilter.connect(this.chorusWetGain);

    // Wet path - Right channel
    this.inputGain.connect(this.delayRight);
    this.delayRight.connect(this.highPassFilter);

    // LFO -> delay time modulation
    this.lfoLeft.connect(this.lfoGainLeft);
    this.lfoGainLeft.connect(this.delayLeft.delayTime);

    this.lfoRight.connect(this.lfoGainRight);
    this.lfoGainRight.connect(this.delayRight.delayTime);

    // Wet to output through wetGain (from base class)
    this.chorusWetGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  private updateRate(): void {
    const now = this.audioContext.currentTime;
    this.lfoLeft.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
    this.lfoRight.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;
    // Convert depth 0-1 to actual delay modulation range
    // Depth controls how much the delay time varies around the center
    const delayMs = this.settings.delay / 1000;
    const depthSeconds = this.settings.depth * delayMs;

    this.lfoGainLeft.gain.setTargetAtTime(depthSeconds, now, 0.01);
    this.lfoGainRight.gain.setTargetAtTime(depthSeconds, now, 0.01);
  }

  private updateDelay(): void {
    const now = this.audioContext.currentTime;
    // Set base delay time (center point of modulation)
    const delaySeconds = this.settings.delay / 1000;

    this.delayLeft.delayTime.setTargetAtTime(delaySeconds, now, 0.01);
    this.delayRight.delayTime.setTargetAtTime(delaySeconds, now, 0.01);

    // Also update depth since it depends on delay
    this.updateDepth();
  }

  private updateSpread(): void {
    // Spread controls the phase offset between left and right LFOs
    // 0 = mono, 180 = full stereo (opposite phases)
    const now = this.audioContext.currentTime;

    // Stop and restart LFOs with phase offset
    // Since we can't set phase directly, we offset the start time
    const phaseOffset = (this.settings.spread / 360) * (1 / this.settings.rate);

    // For simplicity, we'll adjust the right LFO frequency slightly
    // to create a slowly drifting phase relationship
    // This is an approximation but works well for chorus

    // Actually, for proper stereo spread, we invert the LFO depth for one channel
    // when spread is 180 degrees
    const spreadFactor = Math.cos((this.settings.spread * Math.PI) / 180);
    const leftDepth = this.settings.depth * (this.settings.delay / 1000);
    const rightDepth = leftDepth * spreadFactor;

    this.lfoGainRight.gain.setTargetAtTime(rightDepth, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;

    // Equal power crossfade
    const wet = Math.sqrt(this.settings.mix);
    const dry = Math.sqrt(1 - this.settings.mix);

    this.chorusWetGain.gain.setTargetAtTime(wet, now, 0.01);
    this.chorusDryGain.gain.setTargetAtTime(dry, now, 0.01);
  }

  updateSettings(settings: Partial<ChorusSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.rate !== undefined) {
      this.updateRate();
    }

    if (settings.depth !== undefined) {
      this.updateDepth();
    }

    if (settings.delay !== undefined) {
      this.updateDelay();
    }

    if (settings.spread !== undefined) {
      this.updateSpread();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): ChorusSettings {
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
    this.chorusWetGain.disconnect();
    this.chorusDryGain.disconnect();
    this.highPassFilter.disconnect();
    super.dispose();
  }
}
