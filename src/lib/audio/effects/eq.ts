// Parametric EQ Effect Processor
// Professional 4-band EQ with high/low shelf and 2 parametric bands

import { BaseEffect } from './base-effect';
import type { EQSettings, EQBand } from '@/types';

const DEFAULT_BANDS: EQBand[] = [
  { frequency: 80, gain: 0, q: 0.7, type: 'lowshelf' },
  { frequency: 400, gain: 0, q: 1.0, type: 'peaking' },
  { frequency: 2500, gain: 0, q: 1.0, type: 'peaking' },
  { frequency: 8000, gain: 0, q: 0.7, type: 'highshelf' },
];

export class EQProcessor extends BaseEffect {
  readonly name = 'EQ';
  private filters: BiquadFilterNode[];
  private settings: EQSettings;

  constructor(audioContext: AudioContext, settings?: Partial<EQSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      bands: settings?.bands || [...DEFAULT_BANDS],
    };

    // Create filter nodes for each band
    this.filters = this.settings.bands.map((band) => {
      const filter = audioContext.createBiquadFilter();
      this.updateFilter(filter, band);
      return filter;
    });

    // Chain filters together
    let prevNode: AudioNode = this.inputGain;
    for (const filter of this.filters) {
      prevNode.connect(filter);
      prevNode = filter;
    }

    // Connect last filter to wet gain
    prevNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  private updateFilter(filter: BiquadFilterNode, band: EQBand): void {
    filter.type = band.type;
    filter.frequency.value = band.frequency;
    filter.gain.value = band.gain;
    filter.Q.value = band.q;
  }

  updateSettings(settings: Partial<EQSettings>): void {
    if (settings.enabled !== undefined) {
      this.settings.enabled = settings.enabled;
      this.setEnabled(settings.enabled);
    }

    if (settings.bands) {
      this.settings.bands = settings.bands;

      // Update existing filters or create new ones
      while (this.filters.length < settings.bands.length) {
        const filter = this.audioContext.createBiquadFilter();
        this.filters.push(filter);
      }

      // Update each filter
      settings.bands.forEach((band, index) => {
        if (index < this.filters.length) {
          this.updateFilter(this.filters[index], band);
        }
      });

      // Reconnect if band count changed
      if (this.filters.length !== settings.bands.length) {
        this.reconnectFilters();
      }
    }
  }

  private reconnectFilters(): void {
    // Disconnect all filters
    for (const filter of this.filters) {
      filter.disconnect();
    }

    // Disconnect inputGain from the first filter if it exists
    if (this.filters.length > 0) {
      try {
        this.inputGain.disconnect(this.filters[0]);
      } catch {
        // Connection may not exist
      }
    }

    // Reconnect in series
    let prevNode: AudioNode = this.inputGain;
    for (let i = 0; i < this.settings.bands.length && i < this.filters.length; i++) {
      prevNode.connect(this.filters[i]);
      prevNode = this.filters[i];
    }
    prevNode.connect(this.wetGain);
  }

  updateBand(index: number, updates: Partial<EQBand>): void {
    if (index < 0 || index >= this.settings.bands.length) return;

    const band = { ...this.settings.bands[index], ...updates };
    this.settings.bands[index] = band;

    if (index < this.filters.length) {
      const filter = this.filters[index];
      const now = this.audioContext.currentTime;

      if (updates.type) filter.type = updates.type;
      if (updates.frequency !== undefined) {
        filter.frequency.setTargetAtTime(updates.frequency, now, 0.01);
      }
      if (updates.gain !== undefined) {
        filter.gain.setTargetAtTime(updates.gain, now, 0.01);
      }
      if (updates.q !== undefined) {
        filter.Q.setTargetAtTime(updates.q, now, 0.01);
      }
    }
  }

  getSettings(): EQSettings {
    return {
      enabled: this.settings.enabled,
      bands: this.settings.bands.map((b) => ({ ...b })),
    };
  }

  getBandCount(): number {
    return this.settings.bands.length;
  }

  // Get frequency response for visualization
  getFrequencyResponse(frequencyArray: Float32Array<ArrayBuffer>): { magnitude: Float32Array<ArrayBuffer>; phase: Float32Array<ArrayBuffer> } {
    const magResponse = new Float32Array(frequencyArray.length);
    const phaseResponse = new Float32Array(frequencyArray.length);
    const tempMag = new Float32Array(frequencyArray.length);
    const tempPhase = new Float32Array(frequencyArray.length);

    // Initialize magnitude to 1 (0 dB)
    for (let i = 0; i < magResponse.length; i++) {
      magResponse[i] = 1;
      phaseResponse[i] = 0;
    }

    // Accumulate response from each filter
    for (let i = 0; i < this.settings.bands.length && i < this.filters.length; i++) {
      this.filters[i].getFrequencyResponse(frequencyArray, tempMag, tempPhase);
      for (let j = 0; j < magResponse.length; j++) {
        magResponse[j] *= tempMag[j];
        phaseResponse[j] += tempPhase[j];
      }
    }

    return { magnitude: magResponse, phase: phaseResponse };
  }

  dispose(): void {
    for (const filter of this.filters) {
      filter.disconnect();
    }
    this.filters = [];
    super.dispose();
  }
}
