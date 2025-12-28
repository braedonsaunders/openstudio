// Rotary Speaker (Leslie) Effect Processor
// Classic organ cabinet simulation with horn/drum rotation
// Low latency - uses modulated delays with amplitude modulation

import { BaseEffect } from '../base-effect';
import type { RotarySpeakerSettings } from '@/types';

export class RotarySpeakerProcessor extends BaseEffect {
  readonly name = 'Rotary Speaker';

  private settings: RotarySpeakerSettings;

  // Horn simulation (high frequencies)
  private hornDelay: DelayNode;
  private hornLFO: OscillatorNode;
  private hornLFOGain: GainNode;
  private hornAmGain: GainNode; // Amplitude modulation
  private hornHighPass: BiquadFilterNode;

  // Drum simulation (low frequencies)
  private drumDelay: DelayNode;
  private drumLFO: OscillatorNode;
  private drumLFOGain: GainNode;
  private drumAmGain: GainNode;
  private drumLowPass: BiquadFilterNode;

  // Stereo spread
  private hornPannerL: StereoPannerNode;
  private hornPannerR: StereoPannerNode;
  private drumPannerL: StereoPannerNode;
  private drumPannerR: StereoPannerNode;

  // Mixing
  private hornGain: GainNode;
  private drumGain: GainNode;
  private dryGain: GainNode;
  private wetGain2: GainNode;

  // Overdrive for cabinet warmth
  private driveWaveshaper: WaveShaperNode;

  // Speed parameters
  private readonly slowHornSpeed = 0.8; // Hz
  private readonly fastHornSpeed = 6.7; // Hz
  private readonly slowDrumSpeed = 0.67; // Hz
  private readonly fastDrumSpeed = 5.5; // Hz

  // Current speed (for smooth transitions)
  private targetHornSpeed: number;
  private targetDrumSpeed: number;

  constructor(audioContext: AudioContext, settings?: Partial<RotarySpeakerSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      speed: 'slow', // 'slow', 'fast', 'brake'
      hornLevel: 80, // 0-100
      drumLevel: 70, // 0-100
      distance: 50, // mic distance 0-100
      drive: 20, // 0-100
      mix: 100, // 0-100
      ...settings,
    };

    this.targetHornSpeed = this.slowHornSpeed;
    this.targetDrumSpeed = this.slowDrumSpeed;

    // Create horn section
    this.hornDelay = audioContext.createDelay(0.02);
    this.hornDelay.delayTime.value = 0.003;

    this.hornLFO = audioContext.createOscillator();
    this.hornLFO.type = 'sine';
    this.hornLFO.frequency.value = this.slowHornSpeed;

    this.hornLFOGain = audioContext.createGain();
    this.hornLFOGain.gain.value = 0.001; // Doppler effect depth

    this.hornAmGain = audioContext.createGain();

    this.hornHighPass = audioContext.createBiquadFilter();
    this.hornHighPass.type = 'highpass';
    this.hornHighPass.frequency.value = 800;
    this.hornHighPass.Q.value = 0.5;

    // Create drum section
    this.drumDelay = audioContext.createDelay(0.02);
    this.drumDelay.delayTime.value = 0.005;

    this.drumLFO = audioContext.createOscillator();
    this.drumLFO.type = 'sine';
    this.drumLFO.frequency.value = this.slowDrumSpeed;

    this.drumLFOGain = audioContext.createGain();
    this.drumLFOGain.gain.value = 0.002;

    this.drumAmGain = audioContext.createGain();

    this.drumLowPass = audioContext.createBiquadFilter();
    this.drumLowPass.type = 'lowpass';
    this.drumLowPass.frequency.value = 800;
    this.drumLowPass.Q.value = 0.5;

    // Create stereo panners for rotation effect
    this.hornPannerL = audioContext.createStereoPanner();
    this.hornPannerR = audioContext.createStereoPanner();
    this.drumPannerL = audioContext.createStereoPanner();
    this.drumPannerR = audioContext.createStereoPanner();

    // Create mix controls
    this.hornGain = audioContext.createGain();
    this.drumGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    this.wetGain2 = audioContext.createGain();

    // Create drive waveshaper
    this.driveWaveshaper = audioContext.createWaveShaper();
    this.updateDrive();

    // Wire up horn section
    this.hornLFO.connect(this.hornLFOGain);
    this.hornLFOGain.connect(this.hornDelay.delayTime);
    this.hornLFO.connect(this.hornAmGain.gain); // AM modulation

    this.inputGain.connect(this.driveWaveshaper);
    this.driveWaveshaper.connect(this.hornHighPass);
    this.hornHighPass.connect(this.hornDelay);
    this.hornDelay.connect(this.hornAmGain);
    this.hornAmGain.connect(this.hornGain);
    this.hornGain.connect(this.hornPannerL);
    this.hornGain.connect(this.hornPannerR);
    this.hornPannerL.connect(this.wetGain2);
    this.hornPannerR.connect(this.wetGain2);

    // Wire up drum section
    this.drumLFO.connect(this.drumLFOGain);
    this.drumLFOGain.connect(this.drumDelay.delayTime);
    this.drumLFO.connect(this.drumAmGain.gain);

    this.driveWaveshaper.connect(this.drumLowPass);
    this.drumLowPass.connect(this.drumDelay);
    this.drumDelay.connect(this.drumAmGain);
    this.drumAmGain.connect(this.drumGain);
    this.drumGain.connect(this.drumPannerL);
    this.drumGain.connect(this.drumPannerR);
    this.drumPannerL.connect(this.wetGain2);
    this.drumPannerR.connect(this.wetGain2);

    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Wet output
    this.wetGain2.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Start LFOs
    this.hornLFO.start();
    this.drumLFO.start();

    // Start panning animation
    this.animatePanning();

    // Apply initial settings
    this.updateSpeed();
    this.updateLevels();
    this.updateMix();
  }

  private animatePanning(): void {
    const animate = () => {
      if (!this._enabled) {
        requestAnimationFrame(animate);
        return;
      }

      const now = this.audioContext.currentTime;
      const distance = this.settings.distance / 100;

      // Calculate panning based on LFO phase (simulated)
      // Horn rotates faster and with more spread
      const hornPhase = (now * this.targetHornSpeed * 2 * Math.PI) % (2 * Math.PI);
      const hornPan = Math.sin(hornPhase) * (0.3 + distance * 0.7);

      // Drum rotates slower and with less spread
      const drumPhase = (now * this.targetDrumSpeed * 2 * Math.PI) % (2 * Math.PI);
      const drumPan = Math.sin(drumPhase) * (0.2 + distance * 0.5);

      this.hornPannerL.pan.value = -hornPan;
      this.hornPannerR.pan.value = hornPan;
      this.drumPannerL.pan.value = -drumPan;
      this.drumPannerR.pan.value = drumPan;

      requestAnimationFrame(animate);
    };
    animate();
  }

  private updateSpeed(): void {
    const now = this.audioContext.currentTime;

    switch (this.settings.speed) {
      case 'slow':
        this.targetHornSpeed = this.slowHornSpeed;
        this.targetDrumSpeed = this.slowDrumSpeed;
        break;
      case 'fast':
        this.targetHornSpeed = this.fastHornSpeed;
        this.targetDrumSpeed = this.fastDrumSpeed;
        break;
      case 'brake':
        this.targetHornSpeed = 0.1;
        this.targetDrumSpeed = 0.05;
        break;
    }

    // Smooth speed transition (Leslie motors don't change speed instantly)
    const rampTime = this.settings.speed === 'brake' ? 3 : 1.5;
    this.hornLFO.frequency.setTargetAtTime(this.targetHornSpeed, now, rampTime);
    this.drumLFO.frequency.setTargetAtTime(this.targetDrumSpeed, now, rampTime * 1.2);
  }

  private updateLevels(): void {
    const now = this.audioContext.currentTime;
    this.hornGain.gain.setTargetAtTime(this.settings.hornLevel / 100, now, 0.01);
    this.drumGain.gain.setTargetAtTime(this.settings.drumLevel / 100, now, 0.01);
  }

  private updateDrive(): void {
    const drive = this.settings.drive / 100;
    const curveLength = 8192;
    const curve = new Float32Array(curveLength);

    for (let i = 0; i < curveLength; i++) {
      const x = (i / curveLength) * 2 - 1;
      // Soft clipping with adjustable drive
      const amount = 1 + drive * 10;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }

    this.driveWaveshaper.curve = curve;
    this.driveWaveshaper.oversample = '2x';
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.wetGain2.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  updateSettings(settings: Partial<RotarySpeakerSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.speed !== undefined) {
      this.updateSpeed();
    }

    if (settings.hornLevel !== undefined || settings.drumLevel !== undefined) {
      this.updateLevels();
    }

    if (settings.drive !== undefined) {
      this.updateDrive();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): RotarySpeakerSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.hornLFO.stop();
    this.drumLFO.stop();
    this.hornLFO.disconnect();
    this.drumLFO.disconnect();
    this.hornLFOGain.disconnect();
    this.drumLFOGain.disconnect();
    this.hornDelay.disconnect();
    this.drumDelay.disconnect();
    this.hornAmGain.disconnect();
    this.drumAmGain.disconnect();
    this.hornHighPass.disconnect();
    this.drumLowPass.disconnect();
    this.hornPannerL.disconnect();
    this.hornPannerR.disconnect();
    this.drumPannerL.disconnect();
    this.drumPannerR.disconnect();
    this.hornGain.disconnect();
    this.drumGain.disconnect();
    this.dryGain.disconnect();
    this.wetGain2.disconnect();
    this.driveWaveshaper.disconnect();
    super.dispose();
  }
}
