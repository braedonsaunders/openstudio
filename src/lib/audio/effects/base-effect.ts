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

    // CRITICAL: Stabilize all registered filters BEFORE changing bypass/wet gains
    // This prevents BiquadFilterNode instability ("state is bad") when toggling effects
    if (!enabled) {
      // When disabling: stabilize filters first, then crossfade to bypass
      this.stabilizeAllFilters();
    }

    // Smooth crossfade between bypass and wet signal
    if (enabled) {
      this.bypassGain.gain.setTargetAtTime(0, now, 0.01);
      this.wetGain.gain.setTargetAtTime(1, now, 0.01);
    } else {
      this.bypassGain.gain.setTargetAtTime(1, now, 0.01);
      this.wetGain.gain.setTargetAtTime(0, now, 0.01);
    }
  }

  // Stabilize all registered filters to prevent instability
  // Called automatically when effect is disabled
  protected stabilizeAllFilters(): void {
    for (const filter of this.registeredFilters) {
      this.stabilizeFilter(filter);
    }
  }

  // Stabilize a single filter by canceling automation and resetting to safe values
  protected stabilizeFilter(filter: BiquadFilterNode): void {
    try {
      const now = this.audioContext.currentTime;

      // Cancel all pending automation immediately
      filter.frequency.cancelScheduledValues(now);
      filter.Q.cancelScheduledValues(now);
      filter.gain.cancelScheduledValues(now);

      // Get current values, clamping to safe ranges
      const currentFreq = Math.max(
        BaseEffect.SAFE_FREQUENCY_MIN,
        Math.min(BaseEffect.SAFE_FREQUENCY_MAX, filter.frequency.value || 1000)
      );
      const currentQ = Math.max(
        BaseEffect.SAFE_Q_MIN,
        Math.min(BaseEffect.SAFE_Q_MAX, filter.Q.value || 1)
      );
      const currentGain = Math.max(
        BaseEffect.SAFE_GAIN_MIN,
        Math.min(BaseEffect.SAFE_GAIN_MAX, filter.gain.value || 0)
      );

      // Check for NaN/Infinity and replace with safe defaults
      const safeFreq = Number.isFinite(currentFreq) ? currentFreq : 1000;
      const safeQ = Number.isFinite(currentQ) ? currentQ : 1;
      const safeGain = Number.isFinite(currentGain) ? currentGain : 0;

      // Set to safe values immediately to prevent any residual bad state
      filter.frequency.setValueAtTime(safeFreq, now);
      filter.Q.setValueAtTime(safeQ, now);
      filter.gain.setValueAtTime(safeGain, now);
    } catch {
      // Ignore errors during stabilization - filter may already be in error state
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

  // Safe filter parameter ranges to prevent instability
  protected static readonly SAFE_FREQUENCY_MIN = 20;
  protected static readonly SAFE_FREQUENCY_MAX = 20000;
  protected static readonly SAFE_Q_MIN = 0.0001;
  protected static readonly SAFE_Q_MAX = 30;
  protected static readonly SAFE_GAIN_MIN = -40;
  protected static readonly SAFE_GAIN_MAX = 40;

  // Get filter info string for logging
  private getFilterInfo(filter: BiquadFilterNode): string {
    try {
      return `type=${filter.type}, freq=${filter.frequency.value.toFixed(1)}Hz, Q=${filter.Q.value.toFixed(2)}, gain=${filter.gain.value.toFixed(1)}dB`;
    } catch {
      return 'type=unknown';
    }
  }

  // Safely set a filter frequency with clamping and error handling
  protected safeSetFilterFrequency(
    filter: BiquadFilterNode,
    frequency: number,
    timeConstant: number = 0.02
  ): void {
    try {
      const safeFreq = Math.max(
        BaseEffect.SAFE_FREQUENCY_MIN,
        Math.min(BaseEffect.SAFE_FREQUENCY_MAX, frequency)
      );
      const now = this.audioContext.currentTime;
      filter.frequency.setTargetAtTime(safeFreq, now, timeConstant);
    } catch (e) {
      console.warn(`[${this.name}] Filter FREQUENCY error (${this.getFilterInfo(filter)}, attempted=${frequency}):`, e);
      this.resetFilter(filter, 'frequency');
    }
  }

  // Safely set a filter Q with clamping and error handling
  protected safeSetFilterQ(
    filter: BiquadFilterNode,
    q: number,
    timeConstant: number = 0.02
  ): void {
    try {
      const safeQ = Math.max(
        BaseEffect.SAFE_Q_MIN,
        Math.min(BaseEffect.SAFE_Q_MAX, q)
      );
      const now = this.audioContext.currentTime;
      filter.Q.setTargetAtTime(safeQ, now, timeConstant);
    } catch (e) {
      console.warn(`[${this.name}] Filter Q error (${this.getFilterInfo(filter)}, attempted=${q}):`, e);
      this.resetFilter(filter, 'Q');
    }
  }

  // Safely set a filter gain with clamping and error handling
  protected safeSetFilterGain(
    filter: BiquadFilterNode,
    gain: number,
    timeConstant: number = 0.02
  ): void {
    try {
      const safeGain = Math.max(
        BaseEffect.SAFE_GAIN_MIN,
        Math.min(BaseEffect.SAFE_GAIN_MAX, gain)
      );
      // Check for NaN/Infinity
      if (!Number.isFinite(safeGain)) {
        console.warn(`[${this.name}] Invalid gain value: ${gain}, using 0 (${this.getFilterInfo(filter)})`);
        filter.gain.setTargetAtTime(0, this.audioContext.currentTime, timeConstant);
        return;
      }
      const now = this.audioContext.currentTime;
      filter.gain.setTargetAtTime(safeGain, now, timeConstant);
    } catch (e) {
      console.warn(`[${this.name}] Filter GAIN error (${this.getFilterInfo(filter)}, attempted=${gain}):`, e);
      this.resetFilter(filter, 'gain');
    }
  }

  // Reset a filter to safe default state
  // Uses smooth transitions to avoid coefficient discontinuities that cause instability
  protected resetFilter(filter: BiquadFilterNode, reason?: string): void {
    try {
      const filterInfo = this.getFilterInfo(filter);
      console.warn(`[${this.name}] Resetting filter (${filterInfo})${reason ? ` - reason: ${reason}` : ''}`);

      const now = this.audioContext.currentTime;
      // Use cancelScheduledValues to clear any pending automation
      filter.frequency.cancelScheduledValues(now);
      filter.Q.cancelScheduledValues(now);
      filter.gain.cancelScheduledValues(now);

      // CRITICAL: Use setTargetAtTime with a small time constant instead of setValueAtTime
      // Abrupt parameter changes via setValueAtTime can cause filter coefficient discontinuities
      // that lead to "state is bad" instability errors, especially for allpass filters
      const smoothingTime = 0.005; // 5ms smoothing to prevent discontinuities

      // First, hold current values briefly to allow any pending automation to settle
      filter.frequency.setValueAtTime(filter.frequency.value || 1000, now);
      filter.Q.setValueAtTime(filter.Q.value || 1, now);
      filter.gain.setValueAtTime(filter.gain.value || 0, now);

      // Then smoothly transition to safe values
      filter.frequency.setTargetAtTime(1000, now, smoothingTime);
      filter.Q.setTargetAtTime(1, now, smoothingTime);
      filter.gain.setTargetAtTime(0, now, smoothingTime);

      console.log(`[${this.name}] Filter reset complete`);
    } catch (e) {
      console.error(`[${this.name}] Failed to reset filter:`, e);
    }
  }

  // Prepare a filter for modulation by ensuring it's in a stable state
  // Call this BEFORE connecting any modulation sources
  protected prepareFilterForModulation(filter: BiquadFilterNode): void {
    try {
      const now = this.audioContext.currentTime;
      // Cancel any pending automation
      filter.frequency.cancelScheduledValues(now);
      filter.Q.cancelScheduledValues(now);
      filter.gain.cancelScheduledValues(now);

      // Hold current value to create a stable baseline
      const currentFreq = Math.max(
        BaseEffect.SAFE_FREQUENCY_MIN,
        Math.min(BaseEffect.SAFE_FREQUENCY_MAX, filter.frequency.value || 1000)
      );
      filter.frequency.setValueAtTime(currentFreq, now);
    } catch (e) {
      console.warn(`[${this.name}] Error preparing filter for modulation:`, e);
    }
  }

  // Safely zero a gain node before disconnecting/connecting modulation
  protected zeroGainImmediate(gainNode: GainNode): void {
    try {
      const now = this.audioContext.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(0, now);
    } catch {
      // Ignore errors
    }
  }

  // Check if a value is safe (not NaN, not Infinity)
  protected isSafeValue(value: number): boolean {
    return Number.isFinite(value) && !Number.isNaN(value);
  }

  // Track all filters for recovery
  protected registeredFilters: BiquadFilterNode[] = [];

  // Register a filter for automatic recovery
  protected registerFilter(filter: BiquadFilterNode): void {
    this.registeredFilters.push(filter);
  }

  // Recover from an error state - resets all filters and re-enables bypass
  public recoverFromError(): void {
    console.warn(`[${this.name}] Attempting recovery from error state (${this.registeredFilters.length} filters registered)`);

    try {
      // Reset all registered filters to safe values
      for (let i = 0; i < this.registeredFilters.length; i++) {
        const filter = this.registeredFilters[i];
        console.log(`[${this.name}] Recovering filter ${i + 1}/${this.registeredFilters.length}: ${this.getFilterInfo(filter)}`);
        this.resetFilter(filter, 'error recovery');
      }

      // Force bypass mode to ensure audio passes through
      const now = this.audioContext.currentTime;
      this.bypassGain.gain.cancelScheduledValues(now);
      this.wetGain.gain.cancelScheduledValues(now);
      this.bypassGain.gain.setValueAtTime(1, now);
      this.wetGain.gain.setValueAtTime(0, now);
      this._enabled = false;

      console.log(`[${this.name}] Recovery successful - effect bypassed`);
    } catch (e) {
      console.error(`[${this.name}] Recovery failed:`, e);
    }
  }

  // Check if the effect is in a healthy state
  public isHealthy(): boolean {
    try {
      // Check if audio context is still running
      if (this.audioContext.state !== 'running') {
        return false;
      }

      // Verify gain nodes are not producing NaN
      const testGain = this.outputGain.gain.value;
      return this.isSafeValue(testGain);
    } catch {
      return false;
    }
  }
}
