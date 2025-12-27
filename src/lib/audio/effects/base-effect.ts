// Base class for audio effect processors

export interface EffectProcessor {
  readonly name: string;
  readonly enabled: boolean;

  // Connect to audio graph
  connect(destination: AudioNode): void;
  disconnect(): void;

  // Get input node (where audio comes in)
  getInputNode(): AudioNode;

  // Get output node (where audio goes out)
  getOutputNode(): AudioNode;

  // Enable/disable the effect (bypass when disabled)
  setEnabled(enabled: boolean): void;

  // Clean up resources
  dispose(): void;
}

export abstract class BaseEffect implements EffectProcessor {
  abstract readonly name: string;
  protected _enabled: boolean = false;
  protected audioContext: AudioContext;
  protected inputGain: GainNode;
  protected outputGain: GainNode;
  protected bypassGain: GainNode;
  protected wetGain: GainNode;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;

    // Create gain nodes for routing
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.bypassGain = audioContext.createGain();
    this.wetGain = audioContext.createGain();

    // Default to bypassed
    this.bypassGain.gain.value = 1;
    this.wetGain.gain.value = 0;

    // Connect bypass path
    this.inputGain.connect(this.bypassGain);
    this.bypassGain.connect(this.outputGain);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    const now = this.audioContext.currentTime;

    // Smooth crossfade between bypass and wet signal
    if (enabled) {
      this.bypassGain.gain.setTargetAtTime(0, now, 0.01);
      this.wetGain.gain.setTargetAtTime(1, now, 0.01);
    } else {
      this.bypassGain.gain.setTargetAtTime(1, now, 0.01);
      this.wetGain.gain.setTargetAtTime(0, now, 0.01);
    }
  }

  getInputNode(): AudioNode {
    return this.inputGain;
  }

  getOutputNode(): AudioNode {
    return this.outputGain;
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  disconnect(): void {
    this.outputGain.disconnect();
  }

  dispose(): void {
    this.disconnect();
    this.inputGain.disconnect();
    this.bypassGain.disconnect();
    this.wetGain.disconnect();
  }

  // Helper to convert dB to linear gain
  protected dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Helper to convert linear gain to dB
  protected linearToDb(linear: number): number {
    return 20 * Math.log10(Math.max(linear, 0.0001));
  }
}
