// Delay Effect Processor
// Multi-mode delay with feedback, tempo sync, and modulation
// Based on Tone.js FeedbackDelay with additional features

import { BaseEffect } from '../base-effect';
import type { DelaySettings } from '@/types';

export type DelayType = 'digital' | 'analog' | 'tape' | 'pingpong' | 'reverse';

export class DelayProcessor extends BaseEffect {
  readonly name = 'Delay';

  // Main delay lines
  private delayLeft: DelayNode;
  private delayRight: DelayNode;

  // Feedback network
  private feedbackGainLeft: GainNode;
  private feedbackGainRight: GainNode;
  private feedbackFilter: BiquadFilterNode;

  // Wet/dry mixing
  private delayWetGain: GainNode;
  private delayDryGain: GainNode;

  // Modulation (for analog/tape character)
  private modulationOscillator: OscillatorNode;
  private modulationGain: GainNode;

  // Tone control
  private toneFilter: BiquadFilterNode;

  private settings: DelaySettings;

  constructor(audioContext: AudioContext, settings?: Partial<DelaySettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      type: 'digital',
      time: 0.4, // Delay time in seconds (0.01 - 2.0)
      feedback: 0.3, // 0-1
      mix: 0.3, // 0-1
      tone: 0.8, // 0-1, brightness of echoes
      modulation: 0.1, // 0-1, for analog/tape types
      pingPongSpread: 0.5, // 0-1, stereo spread for ping-pong
      tempo: 120, // BPM for tempo sync
      tempoSync: false,
      subdivision: '1/4', // Note value when synced
      ...settings,
    };

    // Create delay nodes with max 2 second delay
    this.delayLeft = audioContext.createDelay(2.0);
    this.delayRight = audioContext.createDelay(2.0);

    // Create feedback network
    this.feedbackGainLeft = audioContext.createGain();
    this.feedbackGainRight = audioContext.createGain();
    this.feedbackFilter = audioContext.createBiquadFilter();

    // Create wet/dry mix
    this.delayWetGain = audioContext.createGain();
    this.delayDryGain = audioContext.createGain();

    // Create modulation oscillator
    this.modulationOscillator = audioContext.createOscillator();
    this.modulationGain = audioContext.createGain();

    // Create tone filter
    this.toneFilter = audioContext.createBiquadFilter();

    // Configure feedback filter (for analog/tape warmth)
    this.feedbackFilter.type = 'lowpass';
    this.feedbackFilter.Q.value = 0.7;
    this.registerFilter(this.feedbackFilter);

    // Configure tone filter
    this.toneFilter.type = 'lowpass';
    this.toneFilter.Q.value = 0.7;
    this.registerFilter(this.toneFilter);

    // Configure modulation
    this.modulationOscillator.type = 'sine';
    this.modulationOscillator.frequency.value = 0.5; // Slow modulation

    // Wire up basic signal flow
    this.wireUpSignalChain();

    // Start modulation oscillator
    this.modulationOscillator.start();

    // Apply initial settings
    this.updateDelay();
    this.updateFeedback();
    this.updateMix();
    this.updateTone();
    this.updateModulation();
  }

  private wireUpSignalChain(): void {
    // Dry path
    this.inputGain.connect(this.delayDryGain);
    this.delayDryGain.connect(this.outputGain);

    // Standard stereo delay path
    // Left channel
    this.inputGain.connect(this.delayLeft);
    this.delayLeft.connect(this.toneFilter);
    this.toneFilter.connect(this.delayWetGain);

    // Right channel (for ping-pong this will have different time)
    this.inputGain.connect(this.delayRight);
    this.delayRight.connect(this.toneFilter);

    // Feedback path through filter
    this.delayLeft.connect(this.feedbackFilter);
    this.feedbackFilter.connect(this.feedbackGainLeft);
    this.feedbackGainLeft.connect(this.delayLeft);

    this.delayRight.connect(this.feedbackFilter);
    this.feedbackFilter.connect(this.feedbackGainRight);
    this.feedbackGainRight.connect(this.delayRight);

    // Cross-feedback for ping-pong
    // Will be enabled/disabled based on type

    // Modulation connections
    this.modulationOscillator.connect(this.modulationGain);
    this.modulationGain.connect(this.delayLeft.delayTime);
    this.modulationGain.connect(this.delayRight.delayTime);

    // Wet output
    this.delayWetGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  /**
   * Calculate delay time from tempo and subdivision
   */
  private getTempoSyncedTime(): number {
    if (!this.settings.tempoSync) {
      return this.settings.time;
    }

    const beatDuration = 60 / this.settings.tempo; // Quarter note in seconds

    const subdivisionMultipliers: Record<string, number> = {
      '1/1': 4,
      '1/2': 2,
      '1/2D': 3, // Dotted half
      '1/4': 1,
      '1/4D': 1.5, // Dotted quarter
      '1/4T': 2 / 3, // Triplet quarter
      '1/8': 0.5,
      '1/8D': 0.75,
      '1/8T': 1 / 3,
      '1/16': 0.25,
      '1/16D': 0.375,
      '1/16T': 1 / 6,
    };

    const multiplier = subdivisionMultipliers[this.settings.subdivision] || 1;
    return Math.min(beatDuration * multiplier, 2.0); // Cap at max delay
  }

  private updateDelay(): void {
    const now = this.audioContext.currentTime;
    const delayTime = this.getTempoSyncedTime();

    if (this.settings.type === 'pingpong') {
      // Ping-pong: Left is full time, right is half or offset
      const spread = this.settings.pingPongSpread;
      this.delayLeft.delayTime.setTargetAtTime(delayTime, now, 0.01);
      this.delayRight.delayTime.setTargetAtTime(delayTime * (0.5 + spread * 0.5), now, 0.01);
    } else {
      this.delayLeft.delayTime.setTargetAtTime(delayTime, now, 0.01);
      this.delayRight.delayTime.setTargetAtTime(delayTime, now, 0.01);
    }
  }

  private updateFeedback(): void {
    const now = this.audioContext.currentTime;
    // Limit feedback to prevent runaway
    const feedback = Math.min(this.settings.feedback, 0.95);

    this.feedbackGainLeft.gain.setTargetAtTime(feedback, now, 0.01);
    this.feedbackGainRight.gain.setTargetAtTime(feedback, now, 0.01);

    // Adjust feedback filter based on delay type
    const filterFreq = this.getTypeFilterFrequency();
    this.safeSetFilterFrequency(this.feedbackFilter, filterFreq);
  }

  private getTypeFilterFrequency(): number {
    switch (this.settings.type) {
      case 'analog':
        return 3000; // Darker, more filtered
      case 'tape':
        return 4000; // Warm tape sound
      case 'digital':
      case 'pingpong':
      default:
        return 12000; // Brighter, cleaner
    }
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;

    // Equal power crossfade
    const wet = Math.sqrt(this.settings.mix);
    const dry = Math.sqrt(1 - this.settings.mix);

    this.delayWetGain.gain.setTargetAtTime(wet, now, 0.01);
    this.delayDryGain.gain.setTargetAtTime(dry, now, 0.01);
  }

  private updateTone(): void {
    // Map tone 0-1 to frequency 2000Hz - 16000Hz
    const frequency = 2000 + this.settings.tone * 14000;
    this.safeSetFilterFrequency(this.toneFilter, frequency);
  }

  private updateModulation(): void {
    const now = this.audioContext.currentTime;

    // Modulation depth based on delay type
    let modDepth = this.settings.modulation;
    let modRate = 0.5;

    switch (this.settings.type) {
      case 'tape':
        // Tape has wow and flutter
        modDepth *= 0.003; // 3ms max modulation
        modRate = 0.3 + Math.random() * 0.4; // Variable rate
        break;
      case 'analog':
        // Analog has slight drift
        modDepth *= 0.002;
        modRate = 0.2;
        break;
      default:
        modDepth = 0; // No modulation for digital
    }

    this.modulationGain.gain.setTargetAtTime(modDepth, now, 0.01);
    this.modulationOscillator.frequency.setTargetAtTime(modRate, now, 0.01);
  }

  /**
   * Set tempo for tempo-synced delay
   */
  setTempo(bpm: number): void {
    this.settings.tempo = bpm;
    if (this.settings.tempoSync) {
      this.updateDelay();
    }
  }

  updateSettings(settings: Partial<DelaySettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (
      settings.time !== undefined ||
      settings.tempo !== undefined ||
      settings.tempoSync !== undefined ||
      settings.subdivision !== undefined ||
      settings.type !== undefined ||
      settings.pingPongSpread !== undefined
    ) {
      this.updateDelay();
    }

    if (settings.feedback !== undefined || settings.type !== undefined) {
      this.updateFeedback();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }

    if (settings.tone !== undefined) {
      this.updateTone();
    }

    if (settings.modulation !== undefined || settings.type !== undefined) {
      this.updateModulation();
    }
  }

  getSettings(): DelaySettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.modulationOscillator.stop();
    this.modulationOscillator.disconnect();
    this.modulationGain.disconnect();
    this.delayLeft.disconnect();
    this.delayRight.disconnect();
    this.feedbackGainLeft.disconnect();
    this.feedbackGainRight.disconnect();
    this.feedbackFilter.disconnect();
    this.delayWetGain.disconnect();
    this.delayDryGain.disconnect();
    this.toneFilter.disconnect();
    super.dispose();
  }
}
