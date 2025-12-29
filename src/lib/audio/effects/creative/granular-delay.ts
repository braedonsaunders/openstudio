// Granular Delay Effect Processor
// Granular processing of delayed signal for texture
// Variable latency based on grain size

import { BaseEffect } from '../base-effect';
import type { GranularDelaySettings } from '@/types';

export class GranularDelayProcessor extends BaseEffect {
  readonly name = 'Granular Delay';

  private settings: GranularDelaySettings;

  // Multiple delay lines for grain playback
  private delayLines: DelayNode[] = [];
  private grainGains: GainNode[] = [];
  private grainPanners: StereoPannerNode[] = [];

  // LFOs for grain modulation
  private grainLFOs: OscillatorNode[] = [];
  private grainLFOGains: GainNode[] = [];

  // Master controls
  private dryGain: GainNode;
  private wetMasterGain: GainNode;
  private feedbackGain: GainNode;
  private feedbackDelay: DelayNode;

  // Filter in feedback path
  private feedbackFilter: BiquadFilterNode;

  // Number of grain voices
  private numGrains = 8;

  // Grain scheduling
  private grainIndex = 0;
  private lastGrainTime = 0;

  constructor(audioContext: AudioContext, settings?: Partial<GranularDelaySettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      grainSize: 100, // ms (10-500)
      density: 50, // 0-100 (grains per second)
      pitch: 0, // semitones (-24 to +24)
      pitchRandom: 0, // 0-100 (randomization)
      position: 500, // ms delay (0-2000)
      positionRandom: 0, // 0-100 (position randomization)
      feedback: 30, // 0-100
      spread: 50, // stereo spread 0-100
      reverse: 0, // 0-100 (probability of reverse grains)
      mix: 50, // 0-100
      freeze: false, // freeze the buffer
      ...settings,
    };

    // Create grain voices
    for (let i = 0; i < this.numGrains; i++) {
      // Delay line (max 3 seconds)
      const delay = audioContext.createDelay(3);
      this.delayLines.push(delay);

      // Grain gain (for envelope)
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      this.grainGains.push(gain);

      // Stereo panner
      const panner = audioContext.createStereoPanner();
      this.grainPanners.push(panner);

      // LFO for pitch/position variation
      const lfo = audioContext.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1 + Math.random() * 0.5;
      this.grainLFOs.push(lfo);

      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 0.01;
      this.grainLFOGains.push(lfoGain);

      // Wire up grain voice
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      delay.connect(gain);
      gain.connect(panner);

      lfo.start();
    }

    // Master controls
    this.dryGain = audioContext.createGain();
    this.wetMasterGain = audioContext.createGain();
    this.feedbackGain = audioContext.createGain();
    this.feedbackDelay = audioContext.createDelay(3);
    this.feedbackDelay.delayTime.value = 0.5;

    // Feedback filter
    this.feedbackFilter = audioContext.createBiquadFilter();
    this.feedbackFilter.type = 'lowpass';
    this.feedbackFilter.frequency.value = 8000;
    this.feedbackFilter.Q.value = 0.5;
    this.registerFilter(this.feedbackFilter);

    // Wire up main signal chain
    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Connect input to all grain delays
    for (const delay of this.delayLines) {
      this.inputGain.connect(delay);
    }

    // Connect all grain outputs to master wet
    for (const panner of this.grainPanners) {
      panner.connect(this.wetMasterGain);
    }

    // Wet to output
    this.wetMasterGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Feedback path
    this.wetMasterGain.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.feedbackFilter);
    this.feedbackFilter.connect(this.feedbackGain);

    // Apply initial settings
    this.updateGrains();
    this.updateFeedback();
    this.updateMix();

    // Start grain scheduling
    this.scheduleGrains();
  }

  private scheduleGrains(): void {
    const now = this.audioContext.currentTime;

    if (!this.settings.enabled) {
      setTimeout(() => this.scheduleGrains(), 50);
      return;
    }

    // Calculate grain interval from density
    const grainsPerSecond = (this.settings.density / 100) * 20 + 1; // 1-21 grains/sec
    const grainInterval = 1 / grainsPerSecond;

    if (now - this.lastGrainTime >= grainInterval) {
      this.triggerGrain();
      this.lastGrainTime = now;
    }

    // Schedule next check
    setTimeout(() => this.scheduleGrains(), 10);
  }

  private triggerGrain(): void {
    const now = this.audioContext.currentTime;
    const grainDuration = this.settings.grainSize / 1000;

    // Get next grain voice
    const voice = this.grainIndex % this.numGrains;
    this.grainIndex++;

    const gain = this.grainGains[voice];
    const delay = this.delayLines[voice];
    const panner = this.grainPanners[voice];
    const lfoGain = this.grainLFOGains[voice];

    // Calculate position with randomization
    let position = this.settings.position / 1000;
    if (this.settings.positionRandom > 0) {
      const randomRange = (this.settings.positionRandom / 100) * position;
      position += (Math.random() - 0.5) * 2 * randomRange;
    }
    position = Math.max(0.01, Math.min(2.9, position));

    // Set delay time
    delay.delayTime.setValueAtTime(position, now);

    // Calculate pitch variation (affects LFO depth)
    let pitchDepth = 0.001 + Math.abs(this.settings.pitch) * 0.001;
    if (this.settings.pitchRandom > 0) {
      pitchDepth *= 1 + (Math.random() - 0.5) * (this.settings.pitchRandom / 50);
    }
    lfoGain.gain.setValueAtTime(pitchDepth, now);

    // Random panning
    const spread = this.settings.spread / 100;
    const pan = (Math.random() - 0.5) * 2 * spread;
    panner.pan.setValueAtTime(pan, now);

    // Grain envelope (Hanning window)
    const attackTime = grainDuration * 0.3;
    const releaseTime = grainDuration * 0.3;
    const sustainTime = grainDuration * 0.4;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1 / this.numGrains, now + attackTime);
    gain.gain.setValueAtTime(1 / this.numGrains, now + attackTime + sustainTime);
    gain.gain.linearRampToValueAtTime(0, now + grainDuration);
  }

  private updateGrains(): void {
    const now = this.audioContext.currentTime;
    const position = this.settings.position / 1000;

    for (let i = 0; i < this.numGrains; i++) {
      // Set base delay time
      this.delayLines[i].delayTime.setTargetAtTime(position, now, 0.05);

      // Update stereo spread
      const spread = this.settings.spread / 100;
      const pan = ((i / (this.numGrains - 1)) * 2 - 1) * spread;
      this.grainPanners[i].pan.setTargetAtTime(pan, now, 0.01);
    }
  }

  private updateFeedback(): void {
    const now = this.audioContext.currentTime;
    const feedback = Math.min(0.95, this.settings.feedback / 100);
    this.feedbackGain.gain.setTargetAtTime(feedback, now, 0.01);
    this.feedbackDelay.delayTime.setTargetAtTime(this.settings.position / 1000, now, 0.05);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.wetMasterGain.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  // Set tempo for sync features
  setTempo(bpm: number): void {
    // Could be used for tempo-synced grain density
    const beatMs = 60000 / bpm;
    // Optionally sync position to beat divisions
  }

  updateSettings(settings: Partial<GranularDelaySettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.grainSize !== undefined ||
        settings.position !== undefined ||
        settings.positionRandom !== undefined ||
        settings.spread !== undefined) {
      this.updateGrains();
    }

    if (settings.feedback !== undefined) {
      this.updateFeedback();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): GranularDelaySettings {
    return { ...this.settings };
  }

  dispose(): void {
    for (const lfo of this.grainLFOs) {
      lfo.stop();
      lfo.disconnect();
    }
    for (const lfoGain of this.grainLFOGains) {
      lfoGain.disconnect();
    }
    for (const delay of this.delayLines) {
      delay.disconnect();
    }
    for (const gain of this.grainGains) {
      gain.disconnect();
    }
    for (const panner of this.grainPanners) {
      panner.disconnect();
    }

    this.dryGain.disconnect();
    this.wetMasterGain.disconnect();
    this.feedbackGain.disconnect();
    this.feedbackDelay.disconnect();
    this.feedbackFilter.disconnect();
    super.dispose();
  }
}
