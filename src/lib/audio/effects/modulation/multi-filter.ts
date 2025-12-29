// Multi-Mode Filter Effect Processor
// Dedicated resonant filter with envelope follower and LFO
// Zero latency - uses native BiquadFilterNode

import { BaseEffect } from '../base-effect';
import type { MultiFilterSettings } from '@/types';

export class MultiFilterProcessor extends BaseEffect {
  readonly name = 'Filter';

  private settings: MultiFilterSettings;

  // Main filter
  private filter: BiquadFilterNode;

  // LFO modulation
  private lfo: OscillatorNode;
  private lfoGain: GainNode;

  // Envelope follower
  private envelopeAnalyser: AnalyserNode;
  private envelopeFilter: BiquadFilterNode;
  private animationFrameId: number | null = null;
  private envelopeData: Float32Array<ArrayBuffer>;

  // Drive/saturation
  private driveWaveshaper: WaveShaperNode;
  private driveGain: GainNode;

  // Mixing
  private dryGain: GainNode;
  private filterGain: GainNode;

  // Tempo sync
  private currentBpm: number = 120;

  // Throttling for envelope follower
  private lastEnvelopeUpdate: number = 0;
  private envelopeUpdateInterval: number = 33; // ~30fps

  constructor(audioContext: AudioContext, settings?: Partial<MultiFilterSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      type: 'lowpass', // lowpass, highpass, bandpass, notch, allpass
      frequency: 1000, // Hz (20-20000)
      resonance: 5, // Q (0.1-30)
      drive: 0, // 0-100
      lfoRate: 0, // Hz (0 = off, 0.1-20)
      lfoDepth: 0, // 0-100
      lfoWaveform: 'sine',
      envelopeAmount: 0, // -100 to +100
      envelopeSensitivity: 50, // 0-100
      envelopeAttack: 10, // ms
      envelopeRelease: 100, // ms
      keyTrack: 0, // -100 to +100 (follow pitch)
      tempoSync: false,
      subdivision: '1/4',
      mix: 100, // 0-100
      ...settings,
    };

    // Create main filter
    this.filter = audioContext.createBiquadFilter();
    this.filter.type = this.settings.type;
    this.registerFilter(this.filter);

    // Create LFO
    this.lfo = audioContext.createOscillator();
    this.lfo.type = this.settings.lfoWaveform;

    this.lfoGain = audioContext.createGain();

    // Create envelope follower
    this.envelopeAnalyser = audioContext.createAnalyser();
    this.envelopeAnalyser.fftSize = 256;
    this.envelopeData = new Float32Array(this.envelopeAnalyser.fftSize) as Float32Array<ArrayBuffer>;

    this.envelopeFilter = audioContext.createBiquadFilter();
    this.envelopeFilter.type = 'lowpass';
    this.envelopeFilter.frequency.value = 20;
    this.registerFilter(this.envelopeFilter);

    // Create drive
    this.driveWaveshaper = audioContext.createWaveShaper();
    this.driveGain = audioContext.createGain();

    // Create mixing
    this.dryGain = audioContext.createGain();
    this.filterGain = audioContext.createGain();

    // Wire up signal chain
    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Filter path
    this.inputGain.connect(this.driveWaveshaper);
    this.driveWaveshaper.connect(this.driveGain);
    this.driveGain.connect(this.filter);
    this.filter.connect(this.filterGain);
    this.filterGain.connect(this.wetGain);

    // Envelope follower (parallel analysis path)
    this.inputGain.connect(this.envelopeAnalyser);

    // LFO -> filter frequency modulation
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    this.wetGain.connect(this.outputGain);

    // Start LFO
    this.lfo.start();

    // Apply initial settings
    this.updateFilter();
    this.updateLFO();
    this.updateDrive();
    this.updateMix();

    // Start envelope follower if needed
    if (this.settings.envelopeAmount !== 0) {
      this.startEnvelopeFollower();
    }

    // If starting disabled, zero out LFO to prevent filter modulation
    if (!this.settings.enabled) {
      this.lfoGain.gain.value = 0;
    }
  }

  private startEnvelopeFollower(): void {
    if (this.animationFrameId !== null) return;

    const follow = () => {
      // Throttle updates to prevent filter instability
      const now = performance.now();
      if (now - this.lastEnvelopeUpdate < this.envelopeUpdateInterval) {
        this.animationFrameId = requestAnimationFrame(follow);
        return;
      }
      this.lastEnvelopeUpdate = now;

      try {
        this.envelopeAnalyser.getFloatTimeDomainData(this.envelopeData);

        // Calculate RMS
        let rms = 0;
        for (let i = 0; i < this.envelopeData.length; i++) {
          rms += this.envelopeData[i] * this.envelopeData[i];
        }
        rms = Math.sqrt(rms / this.envelopeData.length);

        // Check for valid values
        if (!this.isSafeValue(rms)) {
          this.animationFrameId = requestAnimationFrame(follow);
          return;
        }

        // Scale by sensitivity
        const sensitivity = this.settings.envelopeSensitivity / 50;
        const envelope = Math.min(1, rms * sensitivity * 10);

        // Apply to filter frequency
        const baseFreq = this.settings.frequency;
        const envelopeAmount = this.settings.envelopeAmount / 100;
        const modulation = envelope * envelopeAmount * baseFreq * 4;

        const targetFreq = Math.max(20, Math.min(20000, baseFreq + modulation));
        const attackTime = Math.max(0.01, this.settings.envelopeAttack / 1000);
        this.safeSetFilterFrequency(this.filter, targetFreq, attackTime);
      } catch (e) {
        console.warn('[Filter] Envelope follower error:', e);
      }

      this.animationFrameId = requestAnimationFrame(follow);
    };
    follow();
  }

  private stopEnvelopeFollower(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateFilter(): void {
    try {
      this.filter.type = this.settings.type;
      this.safeSetFilterFrequency(this.filter, this.settings.frequency);
      this.safeSetFilterQ(this.filter, this.settings.resonance);
    } catch (e) {
      console.warn('[Filter] Error updating filter:', e);
      this.resetFilter(this.filter);
    }
  }

  private updateLFO(): void {
    const now = this.audioContext.currentTime;

    this.lfo.type = this.settings.lfoWaveform;

    let rate: number;
    if (this.settings.tempoSync && this.currentBpm > 0) {
      const beatDuration = 60 / this.currentBpm;
      const subdivisionMultiplier = this.getSubdivisionMultiplier();
      rate = 1 / (beatDuration * subdivisionMultiplier);
    } else {
      rate = this.settings.lfoRate;
    }

    this.lfo.frequency.setTargetAtTime(rate, now, 0.01);

    // LFO depth in Hz
    const depth = (this.settings.lfoDepth / 100) * this.settings.frequency * 2;
    this.lfoGain.gain.setTargetAtTime(depth, now, 0.01);
  }

  private getSubdivisionMultiplier(): number {
    switch (this.settings.subdivision) {
      case '1/1': return 4;
      case '1/2': return 2;
      case '1/4': return 1;
      case '1/8': return 0.5;
      case '1/16': return 0.25;
      default: return 1;
    }
  }

  private updateDrive(): void {
    const drive = this.settings.drive / 100;

    if (drive === 0) {
      this.driveWaveshaper.curve = null;
      this.driveGain.gain.value = 1;
    } else {
      const curveLength = 8192;
      const curve = new Float32Array(curveLength);

      for (let i = 0; i < curveLength; i++) {
        const x = (i / curveLength) * 2 - 1;
        const amount = 1 + drive * 20;
        curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
      }

      this.driveWaveshaper.curve = curve;
      this.driveWaveshaper.oversample = '2x';
      this.driveGain.gain.value = 1 / (1 + drive * 0.5);
    }
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.filterGain.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  setTempo(bpm: number): void {
    this.currentBpm = bpm;
    if (this.settings.tempoSync) {
      this.updateLFO();
    }
  }

  // Override setEnabled to stop LFO modulation when disabled
  setEnabled(enabled: boolean): void {
    super.setEnabled(enabled);
    const now = this.audioContext.currentTime;

    if (!enabled) {
      // Stop LFO modulation to prevent filter instability when disabled
      this.lfoGain.gain.setTargetAtTime(0, now, 0.01);
      this.stopEnvelopeFollower();
    } else {
      // Restore LFO modulation
      this.updateLFO();
      if (this.settings.envelopeAmount !== 0) {
        this.startEnvelopeFollower();
      }
    }
  }

  updateSettings(settings: Partial<MultiFilterSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.type !== undefined ||
        settings.frequency !== undefined ||
        settings.resonance !== undefined) {
      this.updateFilter();
    }

    if (settings.lfoRate !== undefined ||
        settings.lfoDepth !== undefined ||
        settings.lfoWaveform !== undefined ||
        settings.tempoSync !== undefined ||
        settings.subdivision !== undefined) {
      this.updateLFO();
    }

    if (settings.envelopeAmount !== undefined) {
      if (settings.envelopeAmount !== 0) {
        this.startEnvelopeFollower();
      } else {
        this.stopEnvelopeFollower();
      }
    }

    if (settings.drive !== undefined) {
      this.updateDrive();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): MultiFilterSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.stopEnvelopeFollower();
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.filter.disconnect();
    this.envelopeAnalyser.disconnect();
    this.envelopeFilter.disconnect();
    this.driveWaveshaper.disconnect();
    this.driveGain.disconnect();
    this.dryGain.disconnect();
    this.filterGain.disconnect();
    super.dispose();
  }
}
