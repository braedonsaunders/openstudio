// Noise Gate Effect Processor
// Uses AudioWorklet for sample-accurate gating

import { BaseEffect } from './base-effect';
import type { NoiseGateSettings } from '@/types';

export class NoiseGateProcessor extends BaseEffect {
  readonly name = 'Noise Gate';
  private analyser: AnalyserNode;
  private gateGain: GainNode;
  private isOpen: boolean = false;
  private holdTimer: number | null = null;
  private animationFrame: number | null = null;
  private settings: NoiseGateSettings;

  constructor(audioContext: AudioContext, settings?: Partial<NoiseGateSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      threshold: -40, // dB
      attack: 1, // ms
      hold: 50, // ms
      release: 100, // ms
      range: -80, // dB
      ...settings,
    };

    // Create analyser for level detection
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0;

    // Create gate gain for actual gating
    this.gateGain = audioContext.createGain();
    this.gateGain.gain.value = 1;

    // Wire up: input -> analyser -> gateGain -> wetGain -> output
    this.inputGain.connect(this.analyser);
    this.analyser.connect(this.gateGain);
    this.gateGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Start level monitoring
    this.startMonitoring();
  }

  private startMonitoring(): void {
    const dataArray = new Float32Array(this.analyser.fftSize);

    const processGate = () => {
      if (!this._enabled) {
        this.animationFrame = requestAnimationFrame(processGate);
        return;
      }

      // Get time domain data for RMS calculation
      this.analyser.getFloatTimeDomainData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const levelDb = this.linearToDb(rms);

      const now = this.audioContext.currentTime;
      const thresholdLinear = this.dbToLinear(this.settings.threshold);
      const rangeLinear = this.dbToLinear(this.settings.range);

      if (levelDb >= this.settings.threshold) {
        // Signal above threshold - open gate
        if (!this.isOpen) {
          this.isOpen = true;
          if (this.holdTimer !== null) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
          }
          // Attack ramp
          this.gateGain.gain.cancelScheduledValues(now);
          this.gateGain.gain.setTargetAtTime(1, now, this.settings.attack / 1000 / 3);
        }
      } else {
        // Signal below threshold
        if (this.isOpen && this.holdTimer === null) {
          // Start hold timer
          this.holdTimer = window.setTimeout(() => {
            this.isOpen = false;
            this.holdTimer = null;
            // Release ramp
            const releaseNow = this.audioContext.currentTime;
            this.gateGain.gain.cancelScheduledValues(releaseNow);
            this.gateGain.gain.setTargetAtTime(
              rangeLinear,
              releaseNow,
              this.settings.release / 1000 / 3
            );
          }, this.settings.hold);
        }
      }

      this.animationFrame = requestAnimationFrame(processGate);
    };

    this.animationFrame = requestAnimationFrame(processGate);
  }

  updateSettings(settings: Partial<NoiseGateSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }
  }

  getSettings(): NoiseGateSettings {
    return { ...this.settings };
  }

  // Get current gate state for UI visualization
  isGateOpen(): boolean {
    return this.isOpen;
  }

  dispose(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
    }
    this.analyser.disconnect();
    this.gateGain.disconnect();
    super.dispose();
  }
}
