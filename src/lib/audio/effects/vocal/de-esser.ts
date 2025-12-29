// De-Esser Effect Processor
// Frequency-specific dynamics processing for sibilance control
// Very low latency - uses split-band detection with fast attack

import { BaseEffect } from '../base-effect';
import type { DeEsserSettings } from '@/types';

export class DeEsserProcessor extends BaseEffect {
  readonly name = 'De-Esser';

  private settings: DeEsserSettings;

  // Detection path (sidechain)
  private detectionFilter: BiquadFilterNode;
  private detectionGain: GainNode;
  private analyser: AnalyserNode;

  // Processing path
  private reductionGain: GainNode;
  private dynamicRange: DynamicsCompressorNode;

  // Shelving filter for broadband reduction
  private highShelf: BiquadFilterNode;

  // State
  private gainReduction: number = 0;
  private animationFrameId: number | null = null;
  private analysisData: Float32Array<ArrayBuffer>;
  private lastUpdateTime: number = 0;
  private updateIntervalMs: number = 33; // ~30fps instead of 60fps

  constructor(audioContext: AudioContext, settings?: Partial<DeEsserSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      frequency: 6000, // Hz (2000-10000)
      threshold: -20, // dB (-60 to 0)
      reduction: 6, // dB (0-24)
      range: 12, // dB (0-24) - max reduction
      attack: 0.5, // ms (0.1-10)
      release: 50, // ms (10-500)
      mode: 'split', // 'split' = reduce only sibilance, 'wideband' = reduce all
      listenMode: false, // Monitor sibilance only
      ...settings,
    };

    // Create detection filter (bandpass to isolate sibilance)
    this.detectionFilter = audioContext.createBiquadFilter();
    this.detectionFilter.type = 'bandpass';
    this.detectionFilter.Q.value = 2;
    this.registerFilter(this.detectionFilter);

    // Detection gain
    this.detectionGain = audioContext.createGain();

    // Analyser for level detection
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analysisData = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

    // Dynamics compressor for fast sibilance reduction
    this.dynamicRange = audioContext.createDynamicsCompressor();
    this.dynamicRange.ratio.value = 20; // High ratio for limiting
    this.dynamicRange.knee.value = 0; // Hard knee for precise control

    // High shelf for frequency-targeted reduction
    this.highShelf = audioContext.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.registerFilter(this.highShelf);

    // Reduction gain (applied based on detection)
    this.reductionGain = audioContext.createGain();

    // Wire up signal chain
    // Detection path (parallel, doesn't affect output)
    this.inputGain.connect(this.detectionFilter);
    this.detectionFilter.connect(this.detectionGain);
    this.detectionGain.connect(this.analyser);

    // Main processing path
    this.inputGain.connect(this.dynamicRange);
    this.dynamicRange.connect(this.highShelf);
    this.highShelf.connect(this.reductionGain);
    this.reductionGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateFrequency();
    this.updateDynamics();

    // Start monitoring when enabled
    if (this.settings.enabled) {
      this.startMonitoring();
    }
  }

  private startMonitoring(): void {
    if (this.animationFrameId !== null) return;

    const monitor = () => {
      // Throttle updates to prevent filter instability
      const now = performance.now();
      if (now - this.lastUpdateTime < this.updateIntervalMs) {
        this.animationFrameId = requestAnimationFrame(monitor);
        return;
      }
      this.lastUpdateTime = now;

      try {
        this.analyser.getFloatTimeDomainData(this.analysisData);

        // Calculate RMS of sibilance band
        let rms = 0;
        for (let i = 0; i < this.analysisData.length; i++) {
          rms += this.analysisData[i] * this.analysisData[i];
        }
        rms = Math.sqrt(rms / this.analysisData.length);

        // Convert to dB - check for valid values
        if (!this.isSafeValue(rms)) {
          this.animationFrameId = requestAnimationFrame(monitor);
          return;
        }

        const levelDb = 20 * Math.log10(Math.max(rms, 0.0001));

        // Calculate gain reduction
        if (levelDb > this.settings.threshold) {
          const overThreshold = levelDb - this.settings.threshold;
          this.gainReduction = Math.min(overThreshold, this.settings.range);

          // Apply reduction to high shelf using safe method
          const reductionGain = -this.gainReduction * (this.settings.reduction / 12);
          this.safeSetFilterGain(this.highShelf, reductionGain, Math.max(0.001, this.settings.attack / 1000));
        } else {
          // Release
          this.safeSetFilterGain(this.highShelf, 0, Math.max(0.01, this.settings.release / 1000));
          this.gainReduction = Math.max(0, this.gainReduction - 0.5);
        }
      } catch (e) {
        console.warn('[De-Esser] Monitoring error:', e);
      }

      this.animationFrameId = requestAnimationFrame(monitor);
    };
    monitor();
  }

  private stopMonitoring(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateFrequency(): void {
    this.safeSetFilterFrequency(this.detectionFilter, this.settings.frequency);
    this.safeSetFilterFrequency(this.highShelf, this.settings.frequency * 0.8);
  }

  private updateDynamics(): void {
    const now = this.audioContext.currentTime;

    this.dynamicRange.threshold.setTargetAtTime(this.settings.threshold, now, 0.01);
    this.dynamicRange.attack.setTargetAtTime(this.settings.attack / 1000, now, 0.01);
    this.dynamicRange.release.setTargetAtTime(this.settings.release / 1000, now, 0.01);
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) {
      // CRITICAL: Stop monitoring BEFORE calling super.setEnabled
      // This prevents any pending envelope-driven filter changes during stabilization
      this.stopMonitoring();

      // Reset the high shelf filter to neutral gain to prevent any stuck reduction
      const now = this.audioContext.currentTime;
      try {
        this.highShelf.gain.cancelScheduledValues(now);
        this.highShelf.gain.setValueAtTime(0, now);
      } catch {
        // Ignore errors if filter is already in error state
      }
    }

    super.setEnabled(enabled);

    if (enabled) {
      this.startMonitoring();
    }
  }

  updateSettings(settings: Partial<DeEsserSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.frequency !== undefined) {
      this.updateFrequency();
    }

    if (settings.threshold !== undefined ||
        settings.attack !== undefined ||
        settings.release !== undefined) {
      this.updateDynamics();
    }
  }

  getSettings(): DeEsserSettings {
    return { ...this.settings };
  }

  // Get current gain reduction for UI
  getGainReduction(): number {
    return this.gainReduction;
  }

  dispose(): void {
    this.stopMonitoring();
    this.detectionFilter.disconnect();
    this.detectionGain.disconnect();
    this.analyser.disconnect();
    this.dynamicRange.disconnect();
    this.highShelf.disconnect();
    this.reductionGain.disconnect();
    super.dispose();
  }
}
