// Metronome Engine - Sample-accurate metronome with WebRTC broadcast support
// Generates click sounds synchronized with playback

import type { MetronomeSettings } from '@/stores/metronome-store';

export type ClickType = 'digital' | 'woodblock' | 'cowbell' | 'hihat' | 'rimshot';

interface MetronomeCallbacks {
  onBeat: (beat: number, isAccent: boolean) => void;
  onBpmChange?: (bpm: number) => void;
}

// =============================================================================
// Click Sound Generators
// =============================================================================

/**
 * Generate a digital/synthesized click sound
 */
function generateDigitalClick(
  context: AudioContext,
  destination: AudioNode,
  time: number,
  isAccent: boolean,
  volume: number
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  // Higher frequency for accent
  osc.frequency.value = isAccent ? 1500 : 1000;
  osc.type = 'sine';

  // Sharp attack, quick decay
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume * (isAccent ? 1 : 0.7), time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  filter.type = 'highpass';
  filter.frequency.value = 500;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  osc.start(time);
  osc.stop(time + 0.05);
}

/**
 * Generate a woodblock-style click sound
 */
function generateWoodblockClick(
  context: AudioContext,
  destination: AudioNode,
  time: number,
  isAccent: boolean,
  volume: number
): void {
  const osc1 = context.createOscillator();
  const osc2 = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  // Two oscillators for richer woodblock tone
  osc1.frequency.value = isAccent ? 800 : 650;
  osc2.frequency.value = isAccent ? 1200 : 1000;
  osc1.type = 'triangle';
  osc2.type = 'triangle';

  // Quick percussive envelope
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume * (isAccent ? 0.8 : 0.5), time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

  filter.type = 'bandpass';
  filter.frequency.value = isAccent ? 1000 : 800;
  filter.Q.value = 2;

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.1);
  osc2.stop(time + 0.1);
}

/**
 * Generate a cowbell-style click sound
 */
function generateCowbellClick(
  context: AudioContext,
  destination: AudioNode,
  time: number,
  isAccent: boolean,
  volume: number
): void {
  const osc1 = context.createOscillator();
  const osc2 = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  // Classic cowbell frequencies (approximate)
  osc1.frequency.value = isAccent ? 587 : 540;
  osc2.frequency.value = isAccent ? 845 : 800;
  osc1.type = 'square';
  osc2.type = 'square';

  // Cowbell envelope
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume * (isAccent ? 0.6 : 0.4), time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

  filter.type = 'bandpass';
  filter.frequency.value = 700;
  filter.Q.value = 3;

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(destination);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.25);
  osc2.stop(time + 0.25);
}

/**
 * Generate a hi-hat-style click sound
 */
function generateHihatClick(
  context: AudioContext,
  destination: AudioNode,
  time: number,
  isAccent: boolean,
  volume: number
): void {
  // Use noise for hi-hat
  const bufferSize = context.sampleRate * 0.1;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  noise.buffer = buffer;

  const gain = context.createGain();
  const highpass = context.createBiquadFilter();
  const bandpass = context.createBiquadFilter();

  highpass.type = 'highpass';
  highpass.frequency.value = isAccent ? 8000 : 7000;

  bandpass.type = 'bandpass';
  bandpass.frequency.value = isAccent ? 10000 : 9000;
  bandpass.Q.value = 1;

  // Tight hi-hat envelope
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume * (isAccent ? 0.5 : 0.3), time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.08 : 0.05));

  noise.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(destination);

  noise.start(time);
  noise.stop(time + 0.1);
}

/**
 * Generate a rimshot-style click sound
 */
function generateRimshotClick(
  context: AudioContext,
  destination: AudioNode,
  time: number,
  isAccent: boolean,
  volume: number
): void {
  // Noise component (stick hit)
  const bufferSize = context.sampleRate * 0.05;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  }

  const noise = context.createBufferSource();
  noise.buffer = buffer;

  // Tone component (rim resonance)
  const osc = context.createOscillator();
  osc.frequency.value = isAccent ? 350 : 300;
  osc.type = 'triangle';

  const noiseGain = context.createGain();
  const toneGain = context.createGain();
  const masterGain = context.createGain();
  const highpass = context.createBiquadFilter();

  highpass.type = 'highpass';
  highpass.frequency.value = 1000;

  // Noise envelope
  noiseGain.gain.setValueAtTime(0, time);
  noiseGain.gain.linearRampToValueAtTime(volume * (isAccent ? 0.7 : 0.5), time + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

  // Tone envelope
  toneGain.gain.setValueAtTime(0, time);
  toneGain.gain.linearRampToValueAtTime(volume * (isAccent ? 0.4 : 0.25), time + 0.002);
  toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

  noise.connect(highpass);
  highpass.connect(noiseGain);
  noiseGain.connect(masterGain);

  osc.connect(toneGain);
  toneGain.connect(masterGain);

  masterGain.connect(destination);

  noise.start(time);
  noise.stop(time + 0.05);
  osc.start(time);
  osc.stop(time + 0.08);
}

// =============================================================================
// Metronome Engine
// =============================================================================

export class MetronomeEngine {
  private context: AudioContext;
  private masterGain: GainNode;
  private broadcastDestination: MediaStreamAudioDestinationNode | null = null;
  private broadcastGain: GainNode | null = null;

  private bpm: number = 120;
  private beatsPerBar: number = 4;
  private beatUnit: number = 4;
  private volume: number = 0.7;
  private clickType: ClickType = 'digital';
  private accentFirstBeat: boolean = true;

  private isRunning: boolean = false;
  private nextBeatTime: number = 0;
  private currentBeat: number = 0;
  private scheduleAheadTime: number = 0.1; // 100ms lookahead
  private schedulerInterval: number = 25; // 25ms schedule interval
  private schedulerTimer: NodeJS.Timeout | null = null;

  private callbacks: MetronomeCallbacks | null = null;

  // Sync reference for aligning with playback
  private syncStartTime: number | null = null;
  private syncOffset: number = 0;

  constructor(context: AudioContext, destination?: AudioNode) {
    this.context = context;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(destination || context.destination);
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(240, bpm));
  }

  getBpm(): number {
    return this.bpm;
  }

  setBeatsPerBar(beats: number): void {
    this.beatsPerBar = Math.max(1, Math.min(16, beats));
  }

  setBeatUnit(unit: number): void {
    this.beatUnit = unit;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setTargetAtTime(
      this.volume,
      this.context.currentTime,
      0.01
    );
  }

  setClickType(type: ClickType): void {
    this.clickType = type;
  }

  setAccentFirstBeat(accent: boolean): void {
    this.accentFirstBeat = accent;
  }

  setCallbacks(callbacks: MetronomeCallbacks): void {
    this.callbacks = callbacks;
  }

  // ==========================================================================
  // Broadcast (WebRTC)
  // ==========================================================================

  /**
   * Enable broadcast mode - creates a MediaStream of metronome audio
   * that can be sent over WebRTC to other users
   */
  enableBroadcast(): MediaStream {
    if (this.broadcastDestination) {
      return this.broadcastDestination.stream;
    }

    this.broadcastDestination = this.context.createMediaStreamDestination();
    this.broadcastGain = this.context.createGain();
    this.broadcastGain.gain.value = this.volume;
    this.broadcastGain.connect(this.broadcastDestination);

    return this.broadcastDestination.stream;
  }

  /**
   * Disable broadcast mode
   */
  disableBroadcast(): void {
    if (this.broadcastGain) {
      this.broadcastGain.disconnect();
      this.broadcastGain = null;
    }
    this.broadcastDestination = null;
  }

  /**
   * Get the broadcast MediaStream (if enabled)
   */
  getBroadcastStream(): MediaStream | null {
    return this.broadcastDestination?.stream || null;
  }

  /**
   * Check if broadcast is enabled
   */
  isBroadcastEnabled(): boolean {
    return this.broadcastDestination !== null;
  }

  // ==========================================================================
  // Playback Control
  // ==========================================================================

  /**
   * Start the metronome
   * @param syncTimestamp Optional wall clock time to sync with (for network sync)
   * @param offset Optional offset in seconds from the sync point
   */
  start(syncTimestamp?: number, offset: number = 0): void {
    if (this.isRunning) {
      this.stop();
    }

    this.isRunning = true;
    this.currentBeat = 0;
    this.syncOffset = offset;

    if (syncTimestamp !== undefined) {
      // Sync with network timestamp
      const now = Date.now();
      const delay = Math.max(0, syncTimestamp - now) / 1000;
      this.nextBeatTime = this.context.currentTime + delay;
      this.syncStartTime = syncTimestamp;
    } else {
      // Start immediately
      this.nextBeatTime = this.context.currentTime;
      this.syncStartTime = null;
    }

    // Account for offset (e.g., if playback started mid-track)
    if (offset > 0) {
      const beatDuration = 60 / this.bpm;
      const beatsElapsed = Math.floor(offset / beatDuration);
      const timeIntoCurrentBeat = offset % beatDuration;

      this.currentBeat = beatsElapsed % this.beatsPerBar;
      this.nextBeatTime = this.context.currentTime - timeIntoCurrentBeat + beatDuration;
    }

    this.scheduleBeats();
  }

  /**
   * Stop the metronome
   */
  stop(): void {
    this.isRunning = false;
    this.currentBeat = 0;

    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    this.callbacks?.onBeat(0, false);
  }

  /**
   * Check if metronome is running
   */
  isPlaying(): boolean {
    return this.isRunning;
  }

  /**
   * Get current beat (1-indexed for display)
   */
  getCurrentBeat(): number {
    return this.currentBeat + 1;
  }

  // ==========================================================================
  // Scheduling
  // ==========================================================================

  private scheduleBeats(): void {
    if (!this.isRunning) return;

    const beatDuration = 60 / this.bpm;

    // Schedule beats that fall within the lookahead window
    while (this.nextBeatTime < this.context.currentTime + this.scheduleAheadTime) {
      const isAccent = this.accentFirstBeat && this.currentBeat === 0;

      // Schedule the click sound
      this.scheduleClick(this.nextBeatTime, isAccent);

      // Notify callback (schedule this to fire at the right time)
      const beatToReport = this.currentBeat + 1; // 1-indexed
      const timeUntilBeat = (this.nextBeatTime - this.context.currentTime) * 1000;

      if (timeUntilBeat > 0) {
        setTimeout(() => {
          this.callbacks?.onBeat(beatToReport, isAccent);
        }, timeUntilBeat);
      } else {
        this.callbacks?.onBeat(beatToReport, isAccent);
      }

      // Advance to next beat
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
      this.nextBeatTime += beatDuration;
    }

    // Schedule next scheduling iteration
    this.schedulerTimer = setTimeout(
      () => this.scheduleBeats(),
      this.schedulerInterval
    );
  }

  private scheduleClick(time: number, isAccent: boolean): void {
    // Generate click for local playback
    this.generateClick(this.masterGain, time, isAccent);

    // Generate click for broadcast (if enabled)
    if (this.broadcastGain) {
      this.generateClick(this.broadcastGain, time, isAccent);
    }
  }

  private generateClick(destination: AudioNode, time: number, isAccent: boolean): void {
    switch (this.clickType) {
      case 'digital':
        generateDigitalClick(this.context, destination, time, isAccent, this.volume);
        break;
      case 'woodblock':
        generateWoodblockClick(this.context, destination, time, isAccent, this.volume);
        break;
      case 'cowbell':
        generateCowbellClick(this.context, destination, time, isAccent, this.volume);
        break;
      case 'hihat':
        generateHihatClick(this.context, destination, time, isAccent, this.volume);
        break;
      case 'rimshot':
        generateRimshotClick(this.context, destination, time, isAccent, this.volume);
        break;
    }
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  /**
   * Update settings from store
   * Note: BPM, beatsPerBar, and beatUnit are managed separately via session-tempo-store
   */
  updateSettings(settings: Partial<MetronomeSettings>): void {
    if (settings.volume !== undefined) this.setVolume(settings.volume);
    if (settings.clickType !== undefined) this.setClickType(settings.clickType);
    if (settings.accentFirstBeat !== undefined) this.setAccentFirstBeat(settings.accentFirstBeat);

    // Handle broadcast toggle
    if (settings.broadcastEnabled !== undefined) {
      if (settings.broadcastEnabled && !this.isBroadcastEnabled()) {
        this.enableBroadcast();
      } else if (!settings.broadcastEnabled && this.isBroadcastEnabled()) {
        this.disableBroadcast();
      }
    }
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    this.stop();
    this.disableBroadcast();
    this.masterGain.disconnect();
  }
}
