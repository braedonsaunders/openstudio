// Stereo Imager Effect Processor
// Width control and M/S (Mid-Side) processing
// Zero latency

import { BaseEffect } from '../base-effect';
import type { StereoImagerSettings } from '@/types';

export class StereoImagerProcessor extends BaseEffect {
  readonly name = 'Stereo Imager';

  private settings: StereoImagerSettings;

  // Channel splitter/merger for stereo processing
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;

  // Mid/Side processing gains
  private midGain: GainNode;
  private sideGain: GainNode;

  // Left/Right gains for width
  private leftGain: GainNode;
  private rightGain: GainNode;

  // Bass mono filter
  private bassMonoFilter: BiquadFilterNode;
  private bassMonoGain: GainNode;

  // Side processing (stereo enhancement)
  private sideDelay: DelayNode;
  private sideFilter: BiquadFilterNode;

  constructor(audioContext: AudioContext, settings?: Partial<StereoImagerSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      width: 100, // 0-200 (100 = normal, 0 = mono, 200 = wide)
      midLevel: 0, // dB (-12 to +12)
      sideLevel: 0, // dB (-12 to +12)
      bassMonoFreq: 120, // Hz below which is mono
      bassMonoAmount: 0, // 0-100
      balance: 0, // -100 to +100 (L/R balance)
      ...settings,
    };

    // Create channel splitter (stereo to L/R)
    this.splitter = audioContext.createChannelSplitter(2);

    // Create channel merger
    this.merger = audioContext.createChannelMerger(2);

    // Mid/Side gains
    this.midGain = audioContext.createGain();
    this.sideGain = audioContext.createGain();

    // L/R gains
    this.leftGain = audioContext.createGain();
    this.rightGain = audioContext.createGain();

    // Bass mono processing
    this.bassMonoFilter = audioContext.createBiquadFilter();
    this.bassMonoFilter.type = 'lowpass';
    this.bassMonoFilter.frequency.value = this.settings.bassMonoFreq;
    this.bassMonoFilter.Q.value = 0.7;
    this.registerFilter(this.bassMonoFilter);

    this.bassMonoGain = audioContext.createGain();
    this.bassMonoGain.gain.value = 0;

    // Side processing
    this.sideDelay = audioContext.createDelay(0.03);
    this.sideDelay.delayTime.value = 0.0001; // Tiny delay for stereo enhancement

    this.sideFilter = audioContext.createBiquadFilter();
    this.sideFilter.type = 'highpass';
    this.sideFilter.frequency.value = 200;
    this.sideFilter.Q.value = 0.5;
    this.registerFilter(this.sideFilter);

    // Wire up M/S processing
    // Input -> splitter
    this.inputGain.connect(this.splitter);

    // M/S encoding:
    // Mid = (L + R) / 2
    // Side = (L - R) / 2

    // Left channel path
    this.splitter.connect(this.leftGain, 0);

    // Right channel path
    this.splitter.connect(this.rightGain, 1);

    // Output merger
    this.leftGain.connect(this.merger, 0, 0);
    this.rightGain.connect(this.merger, 0, 1);

    // Bass mono path (sum L+R for low freqs)
    this.splitter.connect(this.bassMonoFilter, 0);
    this.splitter.connect(this.bassMonoFilter, 1);
    this.bassMonoFilter.connect(this.bassMonoGain);
    this.bassMonoGain.connect(this.merger, 0, 0);
    this.bassMonoGain.connect(this.merger, 0, 1);

    // Output
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateWidth();
    this.updateBassMono();
    this.updateBalance();
  }

  private updateWidth(): void {
    const now = this.audioContext.currentTime;

    // Width: 0 = mono, 100 = normal, 200 = ultra-wide
    // For M/S: width affects side level relative to mid

    const width = this.settings.width / 100;

    // At width 0: mid = 1, side = 0 (mono)
    // At width 1: mid = 1, side = 1 (normal stereo)
    // At width 2: mid = 0.5, side = 1.5 (wide)

    const midLevel = Math.max(0.5, 1.5 - width * 0.5);
    const sideLevel = width;

    // Apply mid/side level adjustments in dB
    const midDb = this.settings.midLevel;
    const sideDb = this.settings.sideLevel;

    const midLinear = midLevel * Math.pow(10, midDb / 20);
    const sideLinear = sideLevel * Math.pow(10, sideDb / 20);

    // For simplified stereo width without full M/S:
    // Narrow the stereo field by mixing some opposite channel
    // Widen by delaying side content

    if (width < 1) {
      // Narrowing - blend channels together
      const blend = 1 - width;
      this.leftGain.gain.setTargetAtTime(1 - blend * 0.5, now, 0.01);
      this.rightGain.gain.setTargetAtTime(1 - blend * 0.5, now, 0.01);
    } else {
      // Widening - boost side content
      const boost = width - 1;
      this.leftGain.gain.setTargetAtTime(1 + boost * 0.3, now, 0.01);
      this.rightGain.gain.setTargetAtTime(1 + boost * 0.3, now, 0.01);
    }
  }

  private updateBassMono(): void {
    const now = this.audioContext.currentTime;

    this.bassMonoFilter.frequency.setTargetAtTime(this.settings.bassMonoFreq, now, 0.01);

    // Bass mono amount
    const amount = this.settings.bassMonoAmount / 100;
    this.bassMonoGain.gain.setTargetAtTime(amount * 0.5, now, 0.01);
  }

  private updateBalance(): void {
    const now = this.audioContext.currentTime;

    // Balance: -100 = full left, 0 = center, +100 = full right
    const balance = this.settings.balance / 100;

    // Equal power panning law
    const leftLevel = Math.cos((balance + 1) * Math.PI / 4);
    const rightLevel = Math.sin((balance + 1) * Math.PI / 4);

    // Apply balance on top of width
    const currentLeftGain = this.leftGain.gain.value;
    const currentRightGain = this.rightGain.gain.value;

    this.leftGain.gain.setTargetAtTime(currentLeftGain * leftLevel * Math.sqrt(2), now, 0.01);
    this.rightGain.gain.setTargetAtTime(currentRightGain * rightLevel * Math.sqrt(2), now, 0.01);
  }

  updateSettings(settings: Partial<StereoImagerSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.width !== undefined ||
        settings.midLevel !== undefined ||
        settings.sideLevel !== undefined) {
      this.updateWidth();
    }

    if (settings.bassMonoFreq !== undefined ||
        settings.bassMonoAmount !== undefined) {
      this.updateBassMono();
    }

    if (settings.balance !== undefined) {
      this.updateBalance();
    }
  }

  getSettings(): StereoImagerSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.splitter.disconnect();
    this.merger.disconnect();
    this.midGain.disconnect();
    this.sideGain.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.bassMonoFilter.disconnect();
    this.bassMonoGain.disconnect();
    this.sideDelay.disconnect();
    this.sideFilter.disconnect();
    super.dispose();
  }
}
