// Stereo Delay Effect Processor
// Independent L/R delay times with cross-feedback
// Tempo sync support

import { BaseEffect } from '../base-effect';
import type { StereoDelaySettings } from '@/types';

export class StereoDelayProcessor extends BaseEffect {
  readonly name = 'Stereo Delay';

  private settings: StereoDelaySettings;

  // Stereo splitting
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;

  // Delay lines
  private delayLeft: DelayNode;
  private delayRight: DelayNode;

  // Feedback
  private feedbackLeft: GainNode;
  private feedbackRight: GainNode;
  private crossFeedLR: GainNode; // Left to Right
  private crossFeedRL: GainNode; // Right to Left

  // Filters in feedback
  private filterLeft: BiquadFilterNode;
  private filterRight: BiquadFilterNode;

  // Mixing
  private dryGain: GainNode;
  private wetLeft: GainNode;
  private wetRight: GainNode;

  // Tempo sync
  private currentBpm: number = 120;

  constructor(audioContext: AudioContext, settings?: Partial<StereoDelaySettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      leftTime: 375, // ms (0-2000)
      rightTime: 500, // ms (0-2000)
      leftFeedback: 30, // 0-100
      rightFeedback: 30, // 0-100
      crossFeed: 20, // 0-100
      tone: 80, // 0-100 (brightness)
      tempoSync: false,
      leftSubdivision: '1/4',
      rightSubdivision: '1/4D', // Dotted quarter
      pingPong: false,
      mix: 30, // 0-100
      ...settings,
    };

    // Create channel splitter/merger
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);

    // Create delay lines (max 3 seconds)
    this.delayLeft = audioContext.createDelay(3);
    this.delayRight = audioContext.createDelay(3);

    // Create feedback gains
    this.feedbackLeft = audioContext.createGain();
    this.feedbackRight = audioContext.createGain();
    this.crossFeedLR = audioContext.createGain();
    this.crossFeedRL = audioContext.createGain();

    // Create filters
    this.filterLeft = audioContext.createBiquadFilter();
    this.filterLeft.type = 'lowpass';
    this.filterLeft.Q.value = 0.5;
    this.registerFilter(this.filterLeft);

    this.filterRight = audioContext.createBiquadFilter();
    this.filterRight.type = 'lowpass';
    this.filterRight.Q.value = 0.5;
    this.registerFilter(this.filterRight);

    // Create wet/dry
    this.dryGain = audioContext.createGain();
    this.wetLeft = audioContext.createGain();
    this.wetRight = audioContext.createGain();

    // Wire up signal chain
    // Split stereo input
    this.inputGain.connect(this.splitter);

    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Left delay path
    this.splitter.connect(this.delayLeft, 0);
    this.delayLeft.connect(this.filterLeft);
    this.filterLeft.connect(this.wetLeft);
    this.wetLeft.connect(this.merger, 0, 0);

    // Right delay path
    this.splitter.connect(this.delayRight, 1);
    this.delayRight.connect(this.filterRight);
    this.filterRight.connect(this.wetRight);
    this.wetRight.connect(this.merger, 0, 1);

    // Feedback paths
    this.filterLeft.connect(this.feedbackLeft);
    this.feedbackLeft.connect(this.delayLeft);

    this.filterRight.connect(this.feedbackRight);
    this.feedbackRight.connect(this.delayRight);

    // Cross-feedback
    this.filterLeft.connect(this.crossFeedLR);
    this.crossFeedLR.connect(this.delayRight);

    this.filterRight.connect(this.crossFeedRL);
    this.crossFeedRL.connect(this.delayLeft);

    // Output
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateDelayTimes();
    this.updateFeedback();
    this.updateTone();
    this.updateMix();
  }

  private updateDelayTimes(): void {
    const now = this.audioContext.currentTime;

    let leftTime: number;
    let rightTime: number;

    if (this.settings.tempoSync && this.currentBpm > 0) {
      leftTime = this.getSubdivisionTime(this.settings.leftSubdivision);
      rightTime = this.getSubdivisionTime(this.settings.rightSubdivision);
    } else {
      leftTime = this.settings.leftTime / 1000;
      rightTime = this.settings.rightTime / 1000;
    }

    // Clamp to valid range
    leftTime = Math.max(0.001, Math.min(2.9, leftTime));
    rightTime = Math.max(0.001, Math.min(2.9, rightTime));

    this.delayLeft.delayTime.setTargetAtTime(leftTime, now, 0.01);
    this.delayRight.delayTime.setTargetAtTime(rightTime, now, 0.01);
  }

  private getSubdivisionTime(subdivision: string): number {
    const beatDuration = 60 / this.currentBpm;

    switch (subdivision) {
      case '1/1': return beatDuration * 4;
      case '1/2': return beatDuration * 2;
      case '1/2D': return beatDuration * 3;
      case '1/2T': return beatDuration * 4 / 3;
      case '1/4': return beatDuration;
      case '1/4D': return beatDuration * 1.5;
      case '1/4T': return beatDuration * 2 / 3;
      case '1/8': return beatDuration / 2;
      case '1/8D': return beatDuration * 0.75;
      case '1/8T': return beatDuration / 3;
      case '1/16': return beatDuration / 4;
      case '1/16D': return beatDuration * 0.375;
      case '1/16T': return beatDuration / 6;
      default: return beatDuration;
    }
  }

  private updateFeedback(): void {
    const now = this.audioContext.currentTime;

    // Limit feedback to prevent runaway
    const leftFb = Math.min(0.95, this.settings.leftFeedback / 100);
    const rightFb = Math.min(0.95, this.settings.rightFeedback / 100);
    const crossFb = Math.min(0.5, this.settings.crossFeed / 100);

    if (this.settings.pingPong) {
      // Ping pong: full cross-feedback, no self-feedback
      this.feedbackLeft.gain.setTargetAtTime(0, now, 0.01);
      this.feedbackRight.gain.setTargetAtTime(0, now, 0.01);
      this.crossFeedLR.gain.setTargetAtTime(leftFb, now, 0.01);
      this.crossFeedRL.gain.setTargetAtTime(rightFb, now, 0.01);
    } else {
      // Normal stereo delay
      this.feedbackLeft.gain.setTargetAtTime(leftFb, now, 0.01);
      this.feedbackRight.gain.setTargetAtTime(rightFb, now, 0.01);
      this.crossFeedLR.gain.setTargetAtTime(crossFb, now, 0.01);
      this.crossFeedRL.gain.setTargetAtTime(crossFb, now, 0.01);
    }
  }

  private updateTone(): void {
    // Map tone 0-100 to filter frequency 500-15000 Hz
    const freq = 500 + (this.settings.tone / 100) * 14500;

    this.safeSetFilterFrequency(this.filterLeft, freq);
    this.safeSetFilterFrequency(this.filterRight, freq);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.wetLeft.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
    this.wetRight.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  setTempo(bpm: number): void {
    this.currentBpm = bpm;
    if (this.settings.tempoSync) {
      this.updateDelayTimes();
    }
  }

  updateSettings(settings: Partial<StereoDelaySettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.leftTime !== undefined ||
        settings.rightTime !== undefined ||
        settings.tempoSync !== undefined ||
        settings.leftSubdivision !== undefined ||
        settings.rightSubdivision !== undefined) {
      this.updateDelayTimes();
    }

    if (settings.leftFeedback !== undefined ||
        settings.rightFeedback !== undefined ||
        settings.crossFeed !== undefined ||
        settings.pingPong !== undefined) {
      this.updateFeedback();
    }

    if (settings.tone !== undefined) {
      this.updateTone();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): StereoDelaySettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.splitter.disconnect();
    this.merger.disconnect();
    this.delayLeft.disconnect();
    this.delayRight.disconnect();
    this.feedbackLeft.disconnect();
    this.feedbackRight.disconnect();
    this.crossFeedLR.disconnect();
    this.crossFeedRL.disconnect();
    this.filterLeft.disconnect();
    this.filterRight.disconnect();
    this.dryGain.disconnect();
    this.wetLeft.disconnect();
    this.wetRight.disconnect();
    super.dispose();
  }
}
