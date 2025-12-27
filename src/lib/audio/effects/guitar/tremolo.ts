// Tremolo Effect Processor
// Classic amplitude modulation effect
// Based on Tone.js Tremolo with stereo spread option

import { BaseEffect } from '../base-effect';
import type { TremoloSettings } from '@/types';

export type TremoloWaveform = 'sine' | 'triangle' | 'square' | 'sawtooth';

export class TremoloProcessor extends BaseEffect {
  readonly name = 'Tremolo';

  // LFO oscillators for left and right channels
  private lfoLeft: OscillatorNode;
  private lfoRight: OscillatorNode;

  // Amplitude modulation gain nodes
  private amplitudeLeft: GainNode;
  private amplitudeRight: GainNode;

  // LFO depth control
  private lfoDepthLeft: GainNode;
  private lfoDepthRight: GainNode;

  // Stereo splitter/merger
  private splitter: ChannelSplitterNode;
  private merger: ChannelMergerNode;

  // Base level (1 - depth to ensure audio doesn't fully cut)
  private baseLevelLeft: ConstantSourceNode;
  private baseLevelRight: ConstantSourceNode;

  private settings: TremoloSettings;

  constructor(audioContext: AudioContext, settings?: Partial<TremoloSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      rate: 5, // LFO rate in Hz (0.1 - 20)
      depth: 0.5, // Modulation depth 0-1
      spread: 0, // Stereo spread in degrees (0 - 180)
      waveform: 'sine', // LFO waveform
      ...settings,
    };

    // Create LFO oscillators
    this.lfoLeft = audioContext.createOscillator();
    this.lfoRight = audioContext.createOscillator();

    // Create amplitude modulators
    this.amplitudeLeft = audioContext.createGain();
    this.amplitudeRight = audioContext.createGain();

    // Create LFO depth controls
    this.lfoDepthLeft = audioContext.createGain();
    this.lfoDepthRight = audioContext.createGain();

    // Create stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);

    // Create base level sources
    this.baseLevelLeft = audioContext.createConstantSource();
    this.baseLevelRight = audioContext.createConstantSource();

    // Wire up the signal chain
    this.wireUpSignalChain();

    // Start oscillators and constant sources
    this.lfoLeft.start();
    this.lfoRight.start();
    this.baseLevelLeft.start();
    this.baseLevelRight.start();

    // Apply initial settings
    this.updateRate();
    this.updateDepth();
    this.updateSpread();
    this.updateWaveform();
  }

  private wireUpSignalChain(): void {
    // Split input into stereo channels
    this.inputGain.connect(this.splitter);

    // Left channel: splitter -> amplitudeLeft -> merger
    this.splitter.connect(this.amplitudeLeft, 0);
    this.amplitudeLeft.connect(this.merger, 0, 0);

    // Right channel: splitter -> amplitudeRight -> merger
    this.splitter.connect(this.amplitudeRight, 1);
    this.amplitudeRight.connect(this.merger, 0, 1);

    // Merger to wet gain
    this.merger.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // LFO modulates amplitude gain
    // LFO -> depth -> amplitude.gain
    this.lfoLeft.connect(this.lfoDepthLeft);
    this.lfoDepthLeft.connect(this.amplitudeLeft.gain);

    this.lfoRight.connect(this.lfoDepthRight);
    this.lfoDepthRight.connect(this.amplitudeRight.gain);

    // Base level provides the "floor" (1 - depth)
    this.baseLevelLeft.connect(this.amplitudeLeft.gain);
    this.baseLevelRight.connect(this.amplitudeRight.gain);
  }

  private updateRate(): void {
    const now = this.audioContext.currentTime;
    this.lfoLeft.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
    this.lfoRight.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;

    // Depth controls the amplitude modulation range
    // At depth 1.0, amplitude goes from 0 to 1 (full tremolo)
    // At depth 0.5, amplitude goes from 0.5 to 1

    // LFO output is -1 to 1, we want to modulate around (1 - depth/2)
    // with range of depth/2 in each direction
    const halfDepth = this.settings.depth / 2;

    // Base level is the center point
    const baseLevel = 1 - halfDepth;
    this.baseLevelLeft.offset.setTargetAtTime(baseLevel, now, 0.01);
    this.baseLevelRight.offset.setTargetAtTime(baseLevel, now, 0.01);

    // LFO depth controls the modulation amount
    this.lfoDepthLeft.gain.setTargetAtTime(halfDepth, now, 0.01);
    this.lfoDepthRight.gain.setTargetAtTime(halfDepth, now, 0.01);
  }

  private updateSpread(): void {
    // Spread creates stereo tremolo by phase-offsetting the LFOs
    // 0 = mono (both channels in phase)
    // 180 = full stereo (channels in opposite phase)

    // We can't directly set phase, so we invert the right LFO at 180 degrees
    // or use varying amounts of inverted signal based on spread

    const now = this.audioContext.currentTime;
    const spreadRadians = (this.settings.spread * Math.PI) / 180;

    // At 0 degrees: right depth = left depth (in phase)
    // At 180 degrees: right depth = -left depth (opposite phase)
    const rightPhaseMultiplier = Math.cos(spreadRadians);
    const halfDepth = this.settings.depth / 2;

    this.lfoDepthRight.gain.setTargetAtTime(halfDepth * rightPhaseMultiplier, now, 0.01);
  }

  private updateWaveform(): void {
    this.lfoLeft.type = this.settings.waveform;
    this.lfoRight.type = this.settings.waveform;
  }

  updateSettings(settings: Partial<TremoloSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.rate !== undefined) {
      this.updateRate();
    }

    if (settings.depth !== undefined) {
      this.updateDepth();
      // Spread depends on depth
      this.updateSpread();
    }

    if (settings.spread !== undefined) {
      this.updateSpread();
    }

    if (settings.waveform !== undefined) {
      this.updateWaveform();
    }
  }

  getSettings(): TremoloSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.lfoLeft.stop();
    this.lfoRight.stop();
    this.baseLevelLeft.stop();
    this.baseLevelRight.stop();
    this.lfoLeft.disconnect();
    this.lfoRight.disconnect();
    this.lfoDepthLeft.disconnect();
    this.lfoDepthRight.disconnect();
    this.amplitudeLeft.disconnect();
    this.amplitudeRight.disconnect();
    this.splitter.disconnect();
    this.merger.disconnect();
    this.baseLevelLeft.disconnect();
    this.baseLevelRight.disconnect();
    super.dispose();
  }
}
