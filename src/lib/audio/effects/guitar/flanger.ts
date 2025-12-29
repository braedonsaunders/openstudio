// Flanger Effect Processor
// Short modulated delay with feedback for jet-like sweeping effect
// Classic flanger with adjustable rate, depth, and feedback

import { BaseEffect } from '../base-effect';
import type { FlangerSettings } from '@/types';

export class FlangerProcessor extends BaseEffect {
  readonly name = 'Flanger';

  // Delay line
  private delay: DelayNode;

  // LFO for modulation
  private lfo: OscillatorNode;
  private lfoGain: GainNode;

  // Feedback network
  private feedbackGain: GainNode;
  private feedbackInvert: GainNode; // For negative feedback option

  // Mixing
  private flangerWetGain: GainNode;
  private flangerDryGain: GainNode;

  private settings: FlangerSettings;

  constructor(audioContext: AudioContext, settings?: Partial<FlangerSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      rate: 0.5, // LFO rate in Hz (0.05 - 5)
      depth: 0.5, // Modulation depth 0-1
      delay: 2, // Base delay time in ms (0.5 - 10)
      feedback: 0.5, // Feedback amount 0-1
      mix: 0.5, // Wet/dry mix 0-1
      negative: false, // Negative feedback for different character
      ...settings,
    };

    // Create delay line (max 20ms for flanger)
    this.delay = audioContext.createDelay(0.02);

    // Create LFO
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();

    // Create feedback network
    this.feedbackGain = audioContext.createGain();
    this.feedbackInvert = audioContext.createGain();

    // Create mix controls
    this.flangerWetGain = audioContext.createGain();
    this.flangerDryGain = audioContext.createGain();

    // Configure LFO
    this.lfo.type = 'sine';

    // Wire up the signal chain
    this.wireUpSignalChain();

    // Start LFO
    this.lfo.start();

    // Apply initial settings
    this.updateRate();
    this.updateDepth();
    this.updateDelay();
    this.updateFeedback();
    this.updateMix();
  }

  private wireUpSignalChain(): void {
    // Dry path - routes through wetGain so it's blocked when effect is disabled
    this.inputGain.connect(this.flangerDryGain);
    this.flangerDryGain.connect(this.wetGain);

    // Wet path through delay - starts from wetPathGate
    this.getWetPathInput().connect(this.delay);
    this.delay.connect(this.flangerWetGain);

    // Feedback loop
    this.delay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.feedbackInvert);
    this.feedbackInvert.connect(this.delay);

    // LFO modulates delay time
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.delay.delayTime);

    // Wet to output through base class wetGain
    this.flangerWetGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  private updateRate(): void {
    const now = this.audioContext.currentTime;
    this.lfo.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;
    // Depth controls LFO modulation range
    // For flanger, we modulate between near-zero and 2x the base delay
    const baseDelay = this.settings.delay / 1000;
    const modulationDepth = baseDelay * this.settings.depth;

    this.lfoGain.gain.setTargetAtTime(modulationDepth, now, 0.01);
  }

  private updateDelay(): void {
    const now = this.audioContext.currentTime;
    const delaySeconds = this.settings.delay / 1000;

    this.delay.delayTime.setTargetAtTime(delaySeconds, now, 0.01);

    // Update depth since it depends on delay
    this.updateDepth();
  }

  private updateFeedback(): void {
    const now = this.audioContext.currentTime;
    // Limit feedback to prevent oscillation
    const feedback = Math.min(this.settings.feedback, 0.95);

    this.feedbackGain.gain.setTargetAtTime(feedback, now, 0.01);

    // Negative feedback creates a different frequency response (notches become peaks)
    this.feedbackInvert.gain.setTargetAtTime(
      this.settings.negative ? -1 : 1,
      now,
      0.01
    );
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;

    // Equal power crossfade
    const wet = Math.sqrt(this.settings.mix);
    const dry = Math.sqrt(1 - this.settings.mix);

    this.flangerWetGain.gain.setTargetAtTime(wet, now, 0.01);
    this.flangerDryGain.gain.setTargetAtTime(dry, now, 0.01);
  }

  updateSettings(settings: Partial<FlangerSettings>): void {
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

    if (settings.feedback !== undefined || settings.negative !== undefined) {
      this.updateFeedback();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): FlangerSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.delay.disconnect();
    this.feedbackGain.disconnect();
    this.feedbackInvert.disconnect();
    this.flangerWetGain.disconnect();
    this.flangerDryGain.disconnect();
    super.dispose();
  }
}
