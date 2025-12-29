// Cabinet Simulator Processor
// IR-based cabinet emulation with built-in algorithmic fallbacks
// Simulates different speaker cabinet types and microphone positions

import { BaseEffect } from '../base-effect';
import type { CabinetSimulatorSettings } from '@/types';

export type CabinetType = '1x12' | '2x12' | '4x12' | '1x15' | '2x10' | 'direct';
export type MicPosition = 'center' | 'edge' | 'room' | 'blend';

// Cabinet characteristics for algorithmic simulation
const CABINET_PARAMS = {
  '1x12': { lowCut: 80, highCut: 6000, resonance: 120, character: 0.7 },
  '2x12': { lowCut: 70, highCut: 6500, resonance: 100, character: 0.8 },
  '4x12': { lowCut: 60, highCut: 5500, resonance: 80, character: 0.9 },
  '1x15': { lowCut: 50, highCut: 4500, resonance: 70, character: 0.6 },
  '2x10': { lowCut: 90, highCut: 7000, resonance: 150, character: 0.75 },
  direct: { lowCut: 30, highCut: 16000, resonance: 0, character: 0.5 },
};

const MIC_PARAMS = {
  center: { brightness: 1.2, presence: 1.0, roomLevel: 0 },
  edge: { brightness: 0.7, presence: 0.8, roomLevel: 0 },
  room: { brightness: 0.9, presence: 0.6, roomLevel: 0.5 },
  blend: { brightness: 1.0, presence: 0.9, roomLevel: 0.2 },
};

export class CabinetSimulatorProcessor extends BaseEffect {
  readonly name = 'Cabinet Simulator';

  // Convolver for IR-based simulation
  private convolver: ConvolverNode;
  private convolverGain: GainNode;

  // Algorithmic cabinet simulation (fallback and layer)
  private lowCutFilter: BiquadFilterNode;
  private highCutFilter: BiquadFilterNode;
  private resonanceFilter: BiquadFilterNode;
  private characterFilter: BiquadFilterNode;

  // Microphone simulation
  private presenceFilter: BiquadFilterNode;
  private roomSimulator: ConvolverNode;
  private roomGain: GainNode;

  // Mixing
  private dryGain: GainNode;
  private algorithmicGain: GainNode;

  private settings: CabinetSimulatorSettings;
  private customIRLoaded: boolean = false;

  constructor(audioContext: AudioContext, settings?: Partial<CabinetSimulatorSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      type: '4x12',
      micPosition: 'center',
      mix: 1.0, // Fully wet by default for cab sim
      roomLevel: 0.2,
      customIRUrl: undefined,
      ...settings,
    };

    // Create convolver nodes
    this.convolver = audioContext.createConvolver();
    this.convolverGain = audioContext.createGain();

    // Create algorithmic filter chain
    this.lowCutFilter = audioContext.createBiquadFilter();
    this.highCutFilter = audioContext.createBiquadFilter();
    this.resonanceFilter = audioContext.createBiquadFilter();
    this.characterFilter = audioContext.createBiquadFilter();

    // Create mic simulation
    this.presenceFilter = audioContext.createBiquadFilter();
    this.roomSimulator = audioContext.createConvolver();
    this.roomGain = audioContext.createGain();

    // Create mixing nodes
    this.dryGain = audioContext.createGain();
    this.algorithmicGain = audioContext.createGain();

    // Configure and register filters for stability
    this.lowCutFilter.type = 'highpass';
    this.lowCutFilter.Q.value = 0.7;
    this.registerFilter(this.lowCutFilter);

    this.highCutFilter.type = 'lowpass';
    this.highCutFilter.Q.value = 0.7;
    this.registerFilter(this.highCutFilter);

    this.resonanceFilter.type = 'peaking';
    this.resonanceFilter.Q.value = 2.0;
    this.registerFilter(this.resonanceFilter);

    this.characterFilter.type = 'peaking';
    this.characterFilter.frequency.value = 2500;
    this.characterFilter.Q.value = 1.5;
    this.registerFilter(this.characterFilter);

    this.presenceFilter.type = 'highshelf';
    this.presenceFilter.frequency.value = 4000;
    this.presenceFilter.Q.value = 0.7;
    this.registerFilter(this.presenceFilter);

    // Wire up algorithmic path:
    // input -> lowCut -> highCut -> resonance -> character -> presence -> algorithmicGain
    this.inputGain.connect(this.lowCutFilter);
    this.lowCutFilter.connect(this.highCutFilter);
    this.highCutFilter.connect(this.resonanceFilter);
    this.resonanceFilter.connect(this.characterFilter);
    this.characterFilter.connect(this.presenceFilter);
    this.presenceFilter.connect(this.algorithmicGain);

    // Add room simulation (parallel path)
    this.presenceFilter.connect(this.roomSimulator);
    this.roomSimulator.connect(this.roomGain);
    this.roomGain.connect(this.algorithmicGain);

    // Convolver path (for custom IRs)
    this.inputGain.connect(this.convolver);
    this.convolver.connect(this.convolverGain);

    // Mix both paths to output
    this.algorithmicGain.connect(this.wetGain);
    this.convolverGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Dry path for mix control
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);

    // Initialize
    this.generateAlgorithmicCabinetIR();
    this.generateRoomIR();
    this.updateCabinet();
    this.updateMicPosition();
    this.updateMix();
  }

  /**
   * Generate an algorithmic impulse response for the cabinet
   */
  private generateAlgorithmicCabinetIR(): void {
    const params = CABINET_PARAMS[this.settings.type];
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * 0.1); // 100ms impulse

    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    // Generate cabinet impulse response
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;

      // Fast initial transient
      const transient = i === 0 ? 1.0 : 0;

      // Early reflections from cabinet walls
      let earlyReflections = 0;
      if (i > 10 && i < 500) {
        const reflectionDecay = Math.exp(-50 * t);
        if (Math.random() < 0.1) {
          earlyReflections = (Math.random() - 0.5) * reflectionDecay * 0.3;
        }
      }

      // Speaker cone resonance (low frequency component)
      const resonance = Math.sin(2 * Math.PI * params.resonance * t) *
        Math.exp(-20 * t) * 0.2 * (params.resonance > 0 ? 1 : 0);

      // Diffuse tail
      const tail = (Math.random() - 0.5) * Math.exp(-30 * t) * 0.1;

      // Combine components
      leftChannel[i] = transient + earlyReflections + resonance + tail;
      rightChannel[i] = transient + earlyReflections * 0.95 + resonance + tail * 1.05;
    }

    // Normalize
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
      maxVal = Math.max(maxVal, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
    }
    if (maxVal > 0) {
      for (let i = 0; i < length; i++) {
        leftChannel[i] /= maxVal;
        rightChannel[i] /= maxVal;
      }
    }

    // Only use convolver if we have a custom IR
    // Otherwise rely on the filter chain
  }

  /**
   * Generate room ambience IR
   */
  private generateRoomIR(): void {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * 0.3); // 300ms room

    const buffer = this.audioContext.createBuffer(2, length, sampleRate);
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-4 * t);

      // Sparse early reflections
      let reflection = 0;
      if (Math.random() < 0.01) {
        reflection = (Math.random() - 0.5) * decay;
      }

      // Diffuse reverb tail
      const diffuse = (Math.random() - 0.5) * decay * 0.3;

      leftChannel[i] = reflection + diffuse;
      rightChannel[i] = reflection * 0.9 + diffuse * 1.1;
    }

    // Normalize
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
      maxVal = Math.max(maxVal, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
    }
    if (maxVal > 0) {
      for (let i = 0; i < length; i++) {
        leftChannel[i] = (leftChannel[i] / maxVal) * 0.5;
        rightChannel[i] = (rightChannel[i] / maxVal) * 0.5;
      }
    }

    this.roomSimulator.buffer = buffer;
  }

  /**
   * Load a custom impulse response from URL
   */
  async loadCustomIR(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.convolver.buffer = audioBuffer;
      this.customIRLoaded = true;

      // When using custom IR, disable algorithmic path
      this.algorithmicGain.gain.value = 0;
      this.convolverGain.gain.value = 1;
    } catch (error) {
      console.error('Failed to load cabinet IR:', error);
      this.customIRLoaded = false;
    }
  }

  private updateCabinet(): void {
    const params = CABINET_PARAMS[this.settings.type];
    const now = this.audioContext.currentTime;

    // Update filter frequencies
    this.lowCutFilter.frequency.setTargetAtTime(params.lowCut, now, 0.01);
    this.highCutFilter.frequency.setTargetAtTime(params.highCut, now, 0.01);

    // Resonance peak
    if (params.resonance > 0) {
      this.resonanceFilter.frequency.setTargetAtTime(params.resonance, now, 0.01);
      this.resonanceFilter.gain.setTargetAtTime(4, now, 0.01);
    } else {
      this.resonanceFilter.gain.setTargetAtTime(0, now, 0.01);
    }

    // Character (mid-range)
    const characterGain = (params.character - 0.5) * 6;
    this.characterFilter.gain.setTargetAtTime(characterGain, now, 0.01);

    // If not using custom IR, ensure algorithmic path is active
    if (!this.customIRLoaded) {
      this.algorithmicGain.gain.setTargetAtTime(1, now, 0.01);
      this.convolverGain.gain.setTargetAtTime(0, now, 0.01);
    }
  }

  private updateMicPosition(): void {
    const params = MIC_PARAMS[this.settings.micPosition];
    const now = this.audioContext.currentTime;

    // Adjust presence based on mic position
    const presenceGain = (params.brightness - 1) * 6;
    this.presenceFilter.gain.setTargetAtTime(presenceGain, now, 0.01);

    // Room level
    this.roomGain.gain.setTargetAtTime(params.roomLevel * this.settings.roomLevel, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;

    // Equal power crossfade
    const wet = Math.sqrt(this.settings.mix);
    const dry = Math.sqrt(1 - this.settings.mix);

    this.dryGain.gain.setTargetAtTime(dry, now, 0.01);
    // Wet is controlled by algorithmicGain or convolverGain
  }

  updateSettings(settings: Partial<CabinetSimulatorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.type !== undefined) {
      this.updateCabinet();
    }

    if (settings.micPosition !== undefined || settings.roomLevel !== undefined) {
      this.updateMicPosition();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }

    if (settings.customIRUrl !== undefined && settings.customIRUrl) {
      this.loadCustomIR(settings.customIRUrl);
    }
  }

  getSettings(): CabinetSimulatorSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.convolver.disconnect();
    this.convolverGain.disconnect();
    this.lowCutFilter.disconnect();
    this.highCutFilter.disconnect();
    this.resonanceFilter.disconnect();
    this.characterFilter.disconnect();
    this.presenceFilter.disconnect();
    this.roomSimulator.disconnect();
    this.roomGain.disconnect();
    this.dryGain.disconnect();
    this.algorithmicGain.disconnect();
    super.dispose();
  }
}
