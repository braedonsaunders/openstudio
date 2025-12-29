// Shimmer Reverb Effect Processor
// Reverb with pitch-shifted feedback for ethereal sounds
// Higher latency due to pitch shifting

import { BaseEffect } from '../base-effect';
import type { ShimmerReverbSettings } from '@/types';

export class ShimmerReverbProcessor extends BaseEffect {
  readonly name = 'Shimmer Reverb';

  private settings: ShimmerReverbSettings;

  // Pre-delay
  private preDelay: DelayNode;

  // Main reverb network
  private reverbDelay1: DelayNode;
  private reverbDelay2: DelayNode;
  private reverbDelay3: DelayNode;
  private reverbDelay4: DelayNode;

  // Feedback gains
  private feedback1: GainNode;
  private feedback2: GainNode;
  private feedback3: GainNode;
  private feedback4: GainNode;

  // Pitch shift simulation (via modulated delays)
  private shimmerDelay: DelayNode;
  private shimmerLFO: OscillatorNode;
  private shimmerLFOGain: GainNode;
  private shimmerFeedback: GainNode;

  // Modulation for movement
  private modLFO: OscillatorNode;
  private modGain1: GainNode;
  private modGain2: GainNode;

  // Damping/tone
  private dampingFilter: BiquadFilterNode;
  private toneFilter: BiquadFilterNode;

  // Mixing
  private dryGain: GainNode;
  private reverbMix: GainNode;
  private shimmerMix: GainNode;

  // Allpass diffusers
  private allpass1: BiquadFilterNode;
  private allpass2: BiquadFilterNode;

  constructor(audioContext: AudioContext, settings?: Partial<ShimmerReverbSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      decay: 3, // seconds (0.5-10)
      shimmer: 50, // 0-100 (amount of pitch-shifted content)
      pitch: 12, // semitones (0, 5, 7, 12, 19, 24)
      damping: 40, // 0-100
      tone: 70, // 0-100 (brightness)
      modulation: 30, // 0-100
      preDelay: 20, // ms
      diffusion: 80, // 0-100
      mix: 40, // 0-100
      ...settings,
    };

    // Pre-delay
    this.preDelay = audioContext.createDelay(0.2);

    // Create reverb delay network (FDN)
    this.reverbDelay1 = audioContext.createDelay(0.2);
    this.reverbDelay2 = audioContext.createDelay(0.2);
    this.reverbDelay3 = audioContext.createDelay(0.2);
    this.reverbDelay4 = audioContext.createDelay(0.2);

    // Set prime-ratio delay times for dense reverb
    this.reverbDelay1.delayTime.value = 0.0293;
    this.reverbDelay2.delayTime.value = 0.0371;
    this.reverbDelay3.delayTime.value = 0.0411;
    this.reverbDelay4.delayTime.value = 0.0437;

    // Feedback gains
    this.feedback1 = audioContext.createGain();
    this.feedback2 = audioContext.createGain();
    this.feedback3 = audioContext.createGain();
    this.feedback4 = audioContext.createGain();

    // Shimmer (pitch-shifted feedback path)
    this.shimmerDelay = audioContext.createDelay(0.1);
    this.shimmerDelay.delayTime.value = 0.02;

    this.shimmerLFO = audioContext.createOscillator();
    this.shimmerLFO.type = 'sawtooth';

    this.shimmerLFOGain = audioContext.createGain();
    this.shimmerFeedback = audioContext.createGain();

    // Modulation
    this.modLFO = audioContext.createOscillator();
    this.modLFO.type = 'sine';
    this.modLFO.frequency.value = 0.5;

    this.modGain1 = audioContext.createGain();
    this.modGain2 = audioContext.createGain();

    // Filters
    this.dampingFilter = audioContext.createBiquadFilter();
    this.dampingFilter.type = 'lowpass';
    this.dampingFilter.Q.value = 0.5;
    this.registerFilter(this.dampingFilter);

    this.toneFilter = audioContext.createBiquadFilter();
    this.toneFilter.type = 'highshelf';
    this.toneFilter.frequency.value = 4000;
    this.registerFilter(this.toneFilter);

    // Allpass diffusers - CRITICAL: these must be registered for stability
    this.allpass1 = audioContext.createBiquadFilter();
    this.allpass1.type = 'allpass';
    this.allpass1.frequency.value = 1500;
    this.allpass1.Q.value = 0.5;
    this.registerFilter(this.allpass1);

    this.allpass2 = audioContext.createBiquadFilter();
    this.allpass2.type = 'allpass';
    this.allpass2.frequency.value = 3000;
    this.allpass2.Q.value = 0.5;
    this.registerFilter(this.allpass2);

    // Mixing
    this.dryGain = audioContext.createGain();
    this.reverbMix = audioContext.createGain();
    this.shimmerMix = audioContext.createGain();

    // Wire up signal chain
    // CRITICAL: Use getWetPathInput() to prevent filter instability when disabled
    // Dry path (goes through wetPathGate for proper bypass)
    this.getWetPathInput().connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Pre-delay and diffusion
    this.getWetPathInput().connect(this.preDelay);
    this.preDelay.connect(this.allpass1);
    this.allpass1.connect(this.allpass2);

    // FDN reverb network
    this.allpass2.connect(this.reverbDelay1);
    this.allpass2.connect(this.reverbDelay2);
    this.allpass2.connect(this.reverbDelay3);
    this.allpass2.connect(this.reverbDelay4);

    // Feedback with damping
    this.reverbDelay1.connect(this.dampingFilter);
    this.reverbDelay2.connect(this.dampingFilter);
    this.reverbDelay3.connect(this.dampingFilter);
    this.reverbDelay4.connect(this.dampingFilter);

    this.dampingFilter.connect(this.feedback1);
    this.dampingFilter.connect(this.feedback2);
    this.dampingFilter.connect(this.feedback3);
    this.dampingFilter.connect(this.feedback4);

    this.feedback1.connect(this.reverbDelay1);
    this.feedback2.connect(this.reverbDelay2);
    this.feedback3.connect(this.reverbDelay3);
    this.feedback4.connect(this.reverbDelay4);

    // Modulation on delay times
    this.modLFO.connect(this.modGain1);
    this.modLFO.connect(this.modGain2);
    this.modGain1.connect(this.reverbDelay1.delayTime);
    this.modGain2.connect(this.reverbDelay3.delayTime);

    // Shimmer path (from reverb output)
    this.dampingFilter.connect(this.shimmerDelay);
    this.shimmerDelay.connect(this.shimmerFeedback);
    this.shimmerFeedback.connect(this.reverbDelay2);

    // Shimmer LFO modulates delay for pitch effect
    this.shimmerLFO.connect(this.shimmerLFOGain);
    this.shimmerLFOGain.connect(this.shimmerDelay.delayTime);

    // Output mixing
    this.dampingFilter.connect(this.toneFilter);
    this.toneFilter.connect(this.reverbMix);
    this.shimmerDelay.connect(this.shimmerMix);

    this.reverbMix.connect(this.wetGain);
    this.shimmerMix.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Start oscillators
    this.shimmerLFO.start();
    this.modLFO.start();

    // Apply initial settings
    this.updateDecay();
    this.updateShimmer();
    this.updateDamping();
    this.updateTone();
    this.updateModulation();
    this.updatePreDelay();
    this.updateMix();
  }

  private updateDecay(): void {
    const now = this.audioContext.currentTime;

    // Calculate feedback for decay time
    const avgDelay = 0.038;
    const decay = this.settings.decay;
    const fb = Math.pow(10, -3 * avgDelay / decay);
    const clampedFb = Math.min(0.95, fb);

    this.feedback1.gain.setTargetAtTime(clampedFb * 0.25, now, 0.01);
    this.feedback2.gain.setTargetAtTime(clampedFb * 0.25, now, 0.01);
    this.feedback3.gain.setTargetAtTime(clampedFb * 0.25, now, 0.01);
    this.feedback4.gain.setTargetAtTime(clampedFb * 0.25, now, 0.01);
  }

  private updateShimmer(): void {
    const now = this.audioContext.currentTime;

    // Shimmer amount
    const shimmer = this.settings.shimmer / 100;
    this.shimmerFeedback.gain.setTargetAtTime(shimmer * 0.5, now, 0.01);
    this.shimmerMix.gain.setTargetAtTime(shimmer * 0.3, now, 0.01);

    // Pitch (affects LFO frequency for pitch shift effect)
    // Higher pitch = faster "grain" playback simulation
    const pitchRatio = Math.pow(2, this.settings.pitch / 12);
    const lfoFreq = (pitchRatio - 1) * 10 + 1;
    this.shimmerLFO.frequency.setTargetAtTime(lfoFreq, now, 0.01);

    // LFO depth affects pitch shift depth
    const lfoDepth = 0.005 * (this.settings.pitch / 12);
    this.shimmerLFOGain.gain.setTargetAtTime(lfoDepth, now, 0.01);
  }

  private updateDamping(): void {
    const now = this.audioContext.currentTime;
    const freq = 20000 - (this.settings.damping / 100) * 17000;
    this.dampingFilter.frequency.setTargetAtTime(freq, now, 0.01);
  }

  private updateTone(): void {
    const now = this.audioContext.currentTime;
    // Tone: -12 to +12 dB high shelf
    const gain = ((this.settings.tone / 100) * 24) - 12;
    this.toneFilter.gain.setTargetAtTime(gain, now, 0.01);
  }

  private updateModulation(): void {
    const now = this.audioContext.currentTime;
    const mod = this.settings.modulation / 100;

    this.modLFO.frequency.setTargetAtTime(0.3 + mod * 0.5, now, 0.01);
    this.modGain1.gain.setTargetAtTime(mod * 0.002, now, 0.01);
    this.modGain2.gain.setTargetAtTime(mod * 0.0015, now, 0.01);
  }

  private updatePreDelay(): void {
    const now = this.audioContext.currentTime;
    this.preDelay.delayTime.setTargetAtTime(this.settings.preDelay / 1000, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.reverbMix.gain.setTargetAtTime(Math.sqrt(mix) * 0.7, now, 0.01);
  }

  updateSettings(settings: Partial<ShimmerReverbSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.decay !== undefined) {
      this.updateDecay();
    }

    if (settings.shimmer !== undefined || settings.pitch !== undefined) {
      this.updateShimmer();
    }

    if (settings.damping !== undefined) {
      this.updateDamping();
    }

    if (settings.tone !== undefined) {
      this.updateTone();
    }

    if (settings.modulation !== undefined) {
      this.updateModulation();
    }

    if (settings.preDelay !== undefined) {
      this.updatePreDelay();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): ShimmerReverbSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.shimmerLFO.stop();
    this.modLFO.stop();
    this.shimmerLFO.disconnect();
    this.modLFO.disconnect();

    this.preDelay.disconnect();
    this.reverbDelay1.disconnect();
    this.reverbDelay2.disconnect();
    this.reverbDelay3.disconnect();
    this.reverbDelay4.disconnect();
    this.feedback1.disconnect();
    this.feedback2.disconnect();
    this.feedback3.disconnect();
    this.feedback4.disconnect();
    this.shimmerDelay.disconnect();
    this.shimmerLFOGain.disconnect();
    this.shimmerFeedback.disconnect();
    this.modGain1.disconnect();
    this.modGain2.disconnect();
    this.dampingFilter.disconnect();
    this.toneFilter.disconnect();
    this.allpass1.disconnect();
    this.allpass2.disconnect();
    this.dryGain.disconnect();
    this.reverbMix.disconnect();
    this.shimmerMix.disconnect();
    super.dispose();
  }
}
