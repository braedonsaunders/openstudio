// Sound Engine - Web Audio based synthesizer and sampler
// Provides lightweight sounds for MIDI loops and MIDI input tracks

import type {
  SynthConfig,
  DrumKitConfig,
  EnvelopeConfig,
  MidiNote,
} from '@/types/loops';

// =============================================================================
// Voice Management
// =============================================================================

interface Voice {
  oscillators: OscillatorNode[];
  filter: BiquadFilterNode;
  ampGain: GainNode;
  filterGain: GainNode;
  noteNumber: number;
  startTime: number;
  releaseTime?: number;
  voiceId: number; // Unique ID to identify this specific voice instance
}

interface SamplerVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  noteNumber: number;
  startTime: number;
}

// =============================================================================
// Synth Presets
// =============================================================================

const SYNTH_PRESETS: Record<string, SynthConfig> = {
  'synth-bass-1': {
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.5 },
      { type: 'square', detune: -5, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 2000 },
    ampEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.1 },
    filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2 },
  },
  'synth-bass-2': {
    oscillators: [
      { type: 'square', detune: 0, gain: 0.6 },
    ],
    filter: { type: 'lowpass', cutoff: 600, resonance: 6, envAmount: 1500 },
    ampEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.8, release: 0.08 },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.15 },
  },
  '808-sub': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 1 },
    ],
    filter: { type: 'lowpass', cutoff: 200, resonance: 0, envAmount: 0 },
    ampEnvelope: { attack: 0.01, decay: 0.8, sustain: 0.3, release: 0.5 },
  },
  'synth-pad': {
    oscillators: [
      { type: 'sawtooth', detune: -7, gain: 0.3 },
      { type: 'sawtooth', detune: 7, gain: 0.3 },
      { type: 'triangle', detune: 0, gain: 0.2 },
    ],
    filter: { type: 'lowpass', cutoff: 2000, resonance: 2, envAmount: 1000 },
    ampEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.5 },
    filterEnvelope: { attack: 0.8, decay: 1.0, sustain: 0.6, release: 1.0 },
  },
  'synth-lead': {
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.5 },
      { type: 'square', detune: 12, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 3000, resonance: 3, envAmount: 2000 },
    ampEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 },
    filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
  },
  'synth-pluck': {
    oscillators: [
      { type: 'triangle', detune: 0, gain: 0.6 },
      { type: 'sawtooth', detune: 3, gain: 0.2 },
    ],
    filter: { type: 'lowpass', cutoff: 4000, resonance: 1, envAmount: 3000 },
    ampEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    filterEnvelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.2 },
  },
  'organ': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.4 },
      { type: 'sine', detune: 1200, gain: 0.3 }, // +1 octave
      { type: 'sine', detune: 1900, gain: 0.2 }, // +5th above
    ],
    filter: { type: 'lowpass', cutoff: 5000, resonance: 0, envAmount: 0 },
    ampEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.1 },
  },
};

// =============================================================================
// Drum Kit Note Mappings (General MIDI compatible)
// =============================================================================

const DRUM_NOTE_NAMES: Record<number, string> = {
  36: 'kick',
  37: 'rimshot',
  38: 'snare',
  39: 'clap',
  40: 'snare-alt',
  41: 'tom-low',
  42: 'hihat-closed',
  43: 'tom-low-2',
  44: 'hihat-pedal',
  45: 'tom-mid',
  46: 'hihat-open',
  47: 'tom-mid-2',
  48: 'tom-high',
  49: 'crash',
  50: 'tom-high-2',
  51: 'ride',
  52: 'china',
  53: 'ride-bell',
  54: 'tambourine',
  55: 'splash',
  56: 'cowbell',
};

// =============================================================================
// WebAudio Synth Class
// =============================================================================

export class WebAudioSynth {
  private context: AudioContext;
  private masterGain: GainNode;
  private outputNode: AudioNode;
  private activeVoices: Map<number, Voice> = new Map();
  private config: SynthConfig;
  private maxPolyphony = 16;
  private voiceIdCounter = 0; // Unique ID counter for voice instances

  constructor(context: AudioContext, outputNode: AudioNode, preset: string = 'synth-bass-1') {
    this.context = context;
    this.outputNode = outputNode;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(outputNode);
    this.config = SYNTH_PRESETS[preset] || SYNTH_PRESETS['synth-bass-1'];
  }

  setPreset(preset: string): void {
    if (SYNTH_PRESETS[preset]) {
      this.config = SYNTH_PRESETS[preset];
    }
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  noteOn(noteNumber: number, velocity: number, time?: number): number {
    const startTime = time ?? this.context.currentTime;

    // Steal oldest voice if at max polyphony
    if (this.activeVoices.size >= this.maxPolyphony) {
      const oldestKey = this.activeVoices.keys().next().value;
      if (oldestKey !== undefined) {
        this.noteOff(oldestKey, startTime);
      }
    }

    const frequency = this.midiToFrequency(noteNumber);
    const velocityGain = (velocity / 127) * 0.8;

    // Create oscillators
    const oscillators: OscillatorNode[] = [];
    const oscGain = this.context.createGain();
    oscGain.gain.value = 1.0; // Mix all oscillators at unity gain

    for (const oscConfig of this.config.oscillators) {
      const osc = this.context.createOscillator();
      osc.type = oscConfig.type;
      osc.frequency.value = frequency;
      osc.detune.value = oscConfig.detune;

      const individualGain = this.context.createGain();
      individualGain.gain.value = oscConfig.gain;

      osc.connect(individualGain);
      individualGain.connect(oscGain);
      osc.start(startTime);
      oscillators.push(osc);
    }

    // Create filter
    const filter = this.context.createBiquadFilter();
    filter.type = this.config.filter.type;
    filter.Q.value = this.config.filter.resonance;

    // Create amp envelope
    const ampGain = this.context.createGain();
    ampGain.gain.value = 0;

    // Connect: oscillators -> filter -> amp -> master
    oscGain.connect(filter);
    filter.connect(ampGain);
    ampGain.connect(this.masterGain);

    // Apply amp envelope
    const { attack, decay, sustain, release } = this.config.ampEnvelope;
    ampGain.gain.setValueAtTime(0, startTime);
    ampGain.gain.linearRampToValueAtTime(velocityGain, startTime + attack);
    ampGain.gain.linearRampToValueAtTime(velocityGain * sustain, startTime + attack + decay);

    // Apply filter envelope
    const baseFreq = this.config.filter.cutoff;
    const envAmount = this.config.filter.envAmount || 0;
    const filterEnv = this.config.filterEnvelope || this.config.ampEnvelope;

    filter.frequency.setValueAtTime(baseFreq, startTime);
    filter.frequency.linearRampToValueAtTime(baseFreq + envAmount, startTime + filterEnv.attack);
    filter.frequency.linearRampToValueAtTime(
      baseFreq + envAmount * filterEnv.sustain,
      startTime + filterEnv.attack + filterEnv.decay
    );

    const voice: Voice = {
      oscillators,
      filter,
      ampGain,
      filterGain: oscGain,
      noteNumber,
      startTime,
      voiceId: ++this.voiceIdCounter,
    };

    // CRITICAL FIX: Stop any existing voice on this note before replacing it.
    // Otherwise the old oscillators become orphaned and can never be stopped,
    // causing notes to drone forever (the "synth loop won't stop" bug).
    const existingVoice = this.activeVoices.get(noteNumber);
    if (existingVoice) {
      // Immediately kill the old voice's oscillators
      existingVoice.ampGain.gain.cancelScheduledValues(startTime);
      existingVoice.ampGain.gain.setValueAtTime(0, startTime);
      existingVoice.oscillators.forEach((osc) => {
        try {
          osc.stop(startTime);
        } catch {
          // Already stopped
        }
      });
    }

    this.activeVoices.set(noteNumber, voice);

    // Return the voice ID so caller can verify identity when stopping
    return voice.voiceId;
  }

  noteOff(noteNumber: number, time?: number): void {
    const voice = this.activeVoices.get(noteNumber);
    if (!voice) return;

    const releaseTime = time ?? this.context.currentTime;
    const { release } = this.config.ampEnvelope;

    // Release envelope
    voice.ampGain.gain.cancelScheduledValues(releaseTime);
    voice.ampGain.gain.setValueAtTime(voice.ampGain.gain.value, releaseTime);
    voice.ampGain.gain.linearRampToValueAtTime(0, releaseTime + release);

    // Stop oscillators after release
    voice.oscillators.forEach((osc) => {
      osc.stop(releaseTime + release + 0.1);
    });

    voice.releaseTime = releaseTime;

    // Clean up after release
    setTimeout(() => {
      if (this.activeVoices.get(noteNumber) === voice) {
        this.activeVoices.delete(noteNumber);
      }
    }, (release + 0.2) * 1000);
  }

  /**
   * Stop a note only if it's the same voice instance that was started.
   * This prevents a scheduled noteOff from stopping a DIFFERENT voice
   * that happened to use the same MIDI note number.
   */
  noteOffIfSameVoice(noteNumber: number, voiceId: number, time?: number): void {
    const voice = this.activeVoices.get(noteNumber);
    if (!voice) return;

    // Only stop if this is the SAME voice instance
    if (voice.voiceId !== voiceId) {
      return; // Voice was replaced, don't stop the new one
    }

    this.noteOff(noteNumber, time);
  }

  allNotesOff(): void {
    const now = this.context.currentTime;
    for (const noteNumber of this.activeVoices.keys()) {
      this.noteOff(noteNumber, now);
    }
  }

  /**
   * Immediately kill all sounds without release envelope
   * Use this for hard stops (e.g., stopping preview)
   */
  killAllVoices(): void {
    const now = this.context.currentTime;
    for (const voice of this.activeVoices.values()) {
      // Immediately silence
      voice.ampGain.gain.cancelScheduledValues(now);
      voice.ampGain.gain.setValueAtTime(0, now);

      // Stop all oscillators immediately
      voice.oscillators.forEach((osc) => {
        try {
          osc.stop(now);
        } catch {
          // Already stopped
        }
      });
    }
    this.activeVoices.clear();
  }

  private midiToFrequency(noteNumber: number): number {
    return 440 * Math.pow(2, (noteNumber - 69) / 12);
  }

  dispose(): void {
    this.allNotesOff();
    this.masterGain.disconnect();
  }
}

// =============================================================================
// Drum Kit Sampler
// =============================================================================

export class DrumKitSampler {
  private context: AudioContext;
  private masterGain: GainNode;
  private outputNode: AudioNode;
  private samples: Map<number, AudioBuffer> = new Map();
  private activeVoices: SamplerVoice[] = [];
  private kitId: string;

  constructor(context: AudioContext, outputNode: AudioNode, kitId: string = 'acoustic-kit') {
    this.context = context;
    this.outputNode = outputNode;
    this.kitId = kitId;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0.8;
    this.masterGain.connect(outputNode);
  }

  async loadKit(kitId: string): Promise<void> {
    this.kitId = kitId;
    this.samples.clear();

    // Generate procedural drum sounds instead of loading samples
    // This keeps the library lightweight and works offline
    await this.generateProceduralKit(kitId);
  }

  private async generateProceduralKit(kitId: string): Promise<void> {
    // Generate kick
    this.samples.set(36, this.generateKick(kitId));
    // Generate snare
    this.samples.set(38, this.generateSnare(kitId));
    // Generate clap
    this.samples.set(39, this.generateClap());
    // Generate closed hi-hat
    this.samples.set(42, this.generateHiHat(false, kitId));
    // Generate open hi-hat
    this.samples.set(46, this.generateHiHat(true, kitId));
    // Generate toms
    this.samples.set(41, this.generateTom(100, kitId));
    this.samples.set(45, this.generateTom(150, kitId));
    this.samples.set(48, this.generateTom(200, kitId));
    // Generate crash
    this.samples.set(49, this.generateCymbal(0.8));
    // Generate ride
    this.samples.set(51, this.generateCymbal(0.3));
    // Generate rimshot
    this.samples.set(37, this.generateRimshot());
  }

  private generateKick(kitId: string): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = kitId === '808-kit' ? 1.0 : 0.5;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const startFreq = kitId === '808-kit' ? 150 : 180;
    const endFreq = kitId === '808-kit' ? 40 : 50;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envDecay = kitId === '808-kit' ? 0.5 : 0.2;
      const env = Math.exp(-t / envDecay);
      const freq = startFreq * Math.exp(-t * 10) + endFreq;
      const phase = 2 * Math.PI * freq * t;
      data[i] = Math.sin(phase) * env * 0.9;

      // Add click at start
      if (t < 0.01) {
        data[i] += (Math.random() * 2 - 1) * (1 - t / 0.01) * 0.3;
      }
    }

    return buffer;
  }

  private generateSnare(kitId: string): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = 0.3;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const noiseAmount = kitId === '808-kit' ? 0.6 : 0.5;
    const toneAmount = kitId === '808-kit' ? 0.5 : 0.4;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t / 0.1);
      const noiseEnv = Math.exp(-t / 0.15);

      // Body tone (200Hz)
      const tone = Math.sin(2 * Math.PI * 200 * t) * env * toneAmount;
      // Snares (noise)
      const noise = (Math.random() * 2 - 1) * noiseEnv * noiseAmount;

      data[i] = tone + noise;
    }

    return buffer;
  }

  private generateClap(): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = 0.25;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;

      // Multiple short bursts
      let env = 0;
      for (let b = 0; b < 4; b++) {
        const burstStart = b * 0.015;
        const burstT = t - burstStart;
        if (burstT > 0 && burstT < 0.03) {
          env += Math.exp(-burstT / 0.008) * (1 - b * 0.2);
        }
      }
      // Main decay
      env += Math.exp(-t / 0.1) * 0.5;

      data[i] = (Math.random() * 2 - 1) * env * 0.7;
    }

    return buffer;
  }

  private generateHiHat(open: boolean, kitId: string): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = open ? 0.5 : 0.1;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const decay = open ? 0.2 : 0.03;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t / decay);

      // Metallic noise - sum of high frequencies
      let sample = 0;
      const freqs = [3000, 6000, 9000, 12000];
      for (const freq of freqs) {
        sample += Math.sin(2 * Math.PI * freq * t + Math.random() * 0.5) * 0.2;
      }
      // Add filtered noise
      sample += (Math.random() * 2 - 1) * 0.3;

      data[i] = sample * env * 0.5;
    }

    return buffer;
  }

  private generateTom(freqOffset: number, kitId: string): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = 0.4;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const baseFreq = 80 + freqOffset;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t / 0.15);
      const freq = baseFreq + 50 * Math.exp(-t * 20);

      data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
    }

    return buffer;
  }

  private generateCymbal(decay: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = 2.0;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t / decay);

      // Complex metallic sound
      let sample = 0;
      const freqs = [2000, 2500, 3500, 4500, 6000, 8000, 10000];
      for (let j = 0; j < freqs.length; j++) {
        const phase = Math.sin(2 * Math.PI * freqs[j] * t + Math.random() * 0.2);
        sample += phase * (1 / (j + 1)) * 0.15;
      }
      sample += (Math.random() * 2 - 1) * 0.2;

      data[i] = sample * env * 0.4;
    }

    return buffer;
  }

  private generateRimshot(): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const duration = 0.1;
    const length = sampleRate * duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t / 0.02);

      // High pitched click
      const tone = Math.sin(2 * Math.PI * 1000 * t) * 0.5;
      const noise = (Math.random() * 2 - 1) * 0.3;

      data[i] = (tone + noise) * env;
    }

    return buffer;
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  trigger(noteNumber: number, velocity: number, time?: number): void {
    // Resume context if not running
    if (this.context.state !== 'running') {
      this.context.resume();
    }

    const sample = this.samples.get(noteNumber);
    if (!sample) return;

    const startTime = time ?? this.context.currentTime;
    const velocityGain = (velocity / 127) * 0.9;

    const source = this.context.createBufferSource();
    source.buffer = sample;

    const gain = this.context.createGain();
    gain.gain.value = velocityGain;

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(startTime);

    const voice: SamplerVoice = {
      source,
      gain,
      noteNumber,
      startTime,
    };

    this.activeVoices.push(voice);

    // Cleanup after sample ends
    source.onended = () => {
      const index = this.activeVoices.indexOf(voice);
      if (index !== -1) {
        this.activeVoices.splice(index, 1);
      }
    };
  }

  /**
   * Immediately stop all playing drum samples
   */
  stopAll(): void {
    for (const voice of this.activeVoices) {
      try {
        voice.gain.gain.setValueAtTime(0, this.context.currentTime);
        voice.source.stop();
      } catch {
        // Already stopped
      }
    }
    this.activeVoices = [];
  }

  dispose(): void {
    this.stopAll();
    this.masterGain.disconnect();
  }
}

// =============================================================================
// Sound Engine Manager
// =============================================================================

export class SoundEngine {
  private context: AudioContext;
  private masterGain: GainNode;
  private synths: Map<string, WebAudioSynth> = new Map();
  private drumKits: Map<string, DrumKitSampler> = new Map();
  private outputNode: AudioNode;

  // Broadcast support for WebRTC - sends MIDI audio to other participants
  private broadcastDestination: MediaStreamAudioDestinationNode | null = null;
  private broadcastEnabled: boolean = false;

  constructor(context: AudioContext, outputNode?: AudioNode) {
    this.context = context;
    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0.8;
    this.outputNode = outputNode || context.destination;
    this.masterGain.connect(this.outputNode);
  }

  async initialize(): Promise<void> {
    // Pre-create common instruments
    await this.getOrCreateDrumKit('acoustic-kit');
    await this.getOrCreateDrumKit('808-kit');
    this.getOrCreateSynth('synth-bass-1');
  }

  getSynth(presetId: string): WebAudioSynth {
    return this.getOrCreateSynth(presetId);
  }

  private getOrCreateSynth(presetId: string): WebAudioSynth {
    let synth = this.synths.get(presetId);
    if (!synth) {
      synth = new WebAudioSynth(this.context, this.masterGain, presetId);
      this.synths.set(presetId, synth);
    }
    return synth;
  }

  async getDrumKit(kitId: string): Promise<DrumKitSampler> {
    return this.getOrCreateDrumKit(kitId);
  }

  // Synchronous getter for pre-loaded drum kits - returns null if not loaded
  getDrumKitSync(kitId: string): DrumKitSampler | null {
    return this.drumKits.get(kitId) || null;
  }

  private async getOrCreateDrumKit(kitId: string): Promise<DrumKitSampler> {
    let kit = this.drumKits.get(kitId);
    if (!kit) {
      kit = new DrumKitSampler(this.context, this.masterGain, kitId);
      await kit.loadKit(kitId);
      this.drumKits.set(kitId, kit);
    }
    return kit;
  }

  playNote(
    soundPreset: string,
    noteNumber: number,
    velocity: number,
    time?: number,
    duration?: number
  ): void {
    if (!soundPreset) {
      console.warn('[SoundEngine] No soundPreset provided, defaulting to drums/acoustic-kit');
      soundPreset = 'drums/acoustic-kit';
    }
    const [category, preset] = soundPreset.split('/');

    if (category === 'drums') {
      // Use synchronous access for pre-loaded kits (critical for timing)
      const kit = this.getDrumKitSync(preset);
      if (kit) {
        kit.trigger(noteNumber, velocity, time);
      } else {
        // Kit not loaded yet - load and trigger (may miss timing)
        this.getDrumKit(preset).then((loadedKit) => {
          loadedKit.trigger(noteNumber, velocity, time);
        });
      }
    } else {
      const synth = this.getOrCreateSynth(preset || soundPreset);
      const voiceId = synth.noteOn(noteNumber, velocity, time);

      if (duration !== undefined) {
        const noteOffTime = (time ?? this.context.currentTime) + duration;
        setTimeout(() => {
          // Use noteOffIfSameVoice to prevent stopping a DIFFERENT note
          // that was started after this one with the same pitch
          synth.noteOffIfSameVoice(noteNumber, voiceId, this.context.currentTime);
        }, (noteOffTime - this.context.currentTime) * 1000);
      }
    }
  }

  stopNote(soundPreset: string, noteNumber: number, time?: number): void {
    const [category, preset] = soundPreset.split('/');

    if (category !== 'drums') {
      const synth = this.synths.get(preset || soundPreset);
      if (synth) {
        synth.noteOff(noteNumber, time);
      }
    }
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /**
   * Enable broadcast mode for WebRTC
   * This creates a MediaStreamDestination that can be mixed with the mic input
   * to send MIDI loop audio to other participants in the jam session.
   * @returns MediaStream containing the MIDI audio output
   */
  enableBroadcast(): MediaStream {
    if (!this.broadcastDestination) {
      this.broadcastDestination = this.context.createMediaStreamDestination();
      this.masterGain.connect(this.broadcastDestination);
    }
    this.broadcastEnabled = true;
    return this.broadcastDestination.stream;
  }

  /**
   * Disable broadcast mode
   * Disconnects the broadcast destination to save resources
   */
  disableBroadcast(): void {
    if (this.broadcastDestination) {
      try {
        this.masterGain.disconnect(this.broadcastDestination);
      } catch {
        // Already disconnected
      }
    }
    this.broadcastEnabled = false;
  }

  /**
   * Get the broadcast stream if enabled
   * @returns MediaStream or null if broadcast is not enabled
   */
  getBroadcastStream(): MediaStream | null {
    return this.broadcastEnabled && this.broadcastDestination
      ? this.broadcastDestination.stream
      : null;
  }

  /**
   * Check if broadcast mode is enabled
   */
  isBroadcastEnabled(): boolean {
    return this.broadcastEnabled;
  }

  allNotesOff(): void {
    for (const synth of this.synths.values()) {
      synth.allNotesOff();
    }
  }

  /**
   * Immediately kill all sounds without release envelope
   * Use this for hard stops (e.g., stopping preview)
   */
  killAll(): void {
    for (const synth of this.synths.values()) {
      synth.killAllVoices();
    }
    // Drum samples are one-shot, but we can stop any active ones
    for (const kit of this.drumKits.values()) {
      kit.stopAll();
    }
  }

  dispose(): void {
    this.disableBroadcast();
    this.broadcastDestination = null;

    for (const synth of this.synths.values()) {
      synth.dispose();
    }
    for (const kit of this.drumKits.values()) {
      kit.dispose();
    }
    this.synths.clear();
    this.drumKits.clear();
    this.masterGain.disconnect();
  }
}

// Export available presets for UI
export const AVAILABLE_SOUND_PRESETS = {
  drums: [
    { id: 'drums/acoustic-kit', name: 'Acoustic Kit' },
    { id: 'drums/808-kit', name: '808 Kit' },
    { id: 'drums/electronic-kit', name: 'Electronic Kit' },
  ],
  bass: [
    { id: 'bass/synth-bass-1', name: 'Synth Bass 1' },
    { id: 'bass/synth-bass-2', name: 'Synth Bass 2' },
    { id: 'bass/808-sub', name: '808 Sub' },
  ],
  keys: [
    { id: 'keys/synth-pad', name: 'Synth Pad' },
    { id: 'keys/synth-pluck', name: 'Pluck' },
    { id: 'keys/organ', name: 'Organ' },
  ],
  lead: [
    { id: 'lead/synth-lead', name: 'Synth Lead' },
  ],
};
