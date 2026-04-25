// MIDI Input Handler - Web MIDI API integration
// Handles MIDI device discovery, connection, and message parsing

import type { MidiDeviceInfo, MidiChannel, MidiInputSettings } from '@/types/loops';

// =============================================================================
// MIDI Message Types
// =============================================================================

export interface MidiNoteMessage {
  type: 'noteon' | 'noteoff';
  channel: number;
  note: number;
  velocity: number;
  timestamp: number;
}

export interface MidiControlMessage {
  type: 'controlchange';
  channel: number;
  controller: number;
  value: number;
  timestamp: number;
}

export interface MidiPitchBendMessage {
  type: 'pitchbend';
  channel: number;
  value: number; // -8192 to 8191
  timestamp: number;
}

export type MidiMessage = MidiNoteMessage | MidiControlMessage | MidiPitchBendMessage;

// =============================================================================
// MIDI Input Manager
// =============================================================================

type MidiMessageCallback = (message: MidiMessage) => void;
type MidiDeviceCallback = (devices: MidiDeviceInfo[]) => void;

export class MidiInputManager {
  private midiAccess: MIDIAccess | null = null;
  private activeInputs: Map<string, MIDIInput> = new Map();
  private listeners: Set<MidiMessageCallback> = new Set();
  private deviceListeners: Set<MidiDeviceCallback> = new Set();
  private channelFilter: MidiChannel = 'all';
  private noteMapping: Map<number, number> = new Map();
  private velocityCurve: 'linear' | 'soft' | 'hard' = 'linear';

  async initialize(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported in this browser');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });

      // Listen for device changes
      this.midiAccess.onstatechange = () => {
        this.notifyDeviceChange();
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      return false;
    }
  }

  isSupported(): boolean {
    return 'requestMIDIAccess' in navigator;
  }

  isInitialized(): boolean {
    return this.midiAccess !== null;
  }

  // Get list of available MIDI input devices
  getDevices(): MidiDeviceInfo[] {
    if (!this.midiAccess) return [];

    const devices: MidiDeviceInfo[] = [];

    for (const [id, input] of this.midiAccess.inputs) {
      devices.push({
        id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        state: input.state,
        type: 'input',
      });
    }

    return devices;
  }

  // Connect to a specific MIDI device
  connect(deviceId: string): boolean {
    if (!this.midiAccess) return false;

    const input = this.midiAccess.inputs.get(deviceId);
    if (!input) {
      console.warn('MIDI device not found:', deviceId);
      return false;
    }

    // Disconnect if already connected
    this.disconnect(deviceId);

    // Set up message handler
    input.onmidimessage = (event) => {
      this.handleMidiMessage(event);
    };

    this.activeInputs.set(deviceId, input);
    console.log('Connected to MIDI device:', input.name);

    return true;
  }

  // Disconnect from a MIDI device
  disconnect(deviceId: string): void {
    const input = this.activeInputs.get(deviceId);
    if (input) {
      input.onmidimessage = null;
      this.activeInputs.delete(deviceId);
      console.log('Disconnected from MIDI device:', input.name);
    }
  }

  // Disconnect from all devices
  disconnectAll(): void {
    for (const deviceId of this.activeInputs.keys()) {
      this.disconnect(deviceId);
    }
  }

  // Set channel filter
  setChannelFilter(channel: MidiChannel): void {
    this.channelFilter = channel;
  }

  // Set note mapping (for drums, etc)
  setNoteMapping(mapping: Record<number, number>): void {
    this.noteMapping.clear();
    for (const [from, to] of Object.entries(mapping)) {
      this.noteMapping.set(parseInt(from), to);
    }
  }

  // Set velocity curve
  setVelocityCurve(curve: 'linear' | 'soft' | 'hard'): void {
    this.velocityCurve = curve;
  }

  // Apply settings from MidiInputSettings
  applySettings(settings: MidiInputSettings): void {
    this.setChannelFilter(settings.channel);
    this.setVelocityCurve(settings.velocityCurve);
    if (settings.noteMapping) {
      this.setNoteMapping(settings.noteMapping);
    }
    if (settings.deviceId) {
      this.connect(settings.deviceId);
    }
  }

  // Add message listener
  onMessage(callback: MidiMessageCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Add device change listener
  onDeviceChange(callback: MidiDeviceCallback): () => void {
    this.deviceListeners.add(callback);
    return () => {
      this.deviceListeners.delete(callback);
    };
  }

  // Handle incoming MIDI messages
  private handleMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 1) return;

    const statusByte = data[0];
    const channel = (statusByte & 0x0f) + 1; // MIDI channels are 1-indexed
    const messageType = statusByte & 0xf0;

    // Apply channel filter
    if (this.channelFilter !== 'all' && channel !== this.channelFilter) {
      return;
    }

    let message: MidiMessage | null = null;

    switch (messageType) {
      case 0x90: // Note On
        if (data.length >= 3) {
          const velocity = data[2];
          if (velocity === 0) {
            // Note On with velocity 0 is actually Note Off
            message = {
              type: 'noteoff',
              channel,
              note: this.mapNote(data[1]),
              velocity: 0,
              timestamp: event.timeStamp,
            };
          } else {
            message = {
              type: 'noteon',
              channel,
              note: this.mapNote(data[1]),
              velocity: this.applyVelocityCurve(velocity),
              timestamp: event.timeStamp,
            };
          }
        }
        break;

      case 0x80: // Note Off
        if (data.length >= 3) {
          message = {
            type: 'noteoff',
            channel,
            note: this.mapNote(data[1]),
            velocity: data[2],
            timestamp: event.timeStamp,
          };
        }
        break;

      case 0xb0: // Control Change
        if (data.length >= 3) {
          message = {
            type: 'controlchange',
            channel,
            controller: data[1],
            value: data[2],
            timestamp: event.timeStamp,
          };
        }
        break;

      case 0xe0: // Pitch Bend
        if (data.length >= 3) {
          const value = (data[2] << 7) | data[1];
          message = {
            type: 'pitchbend',
            channel,
            value: value - 8192, // Center at 0
            timestamp: event.timeStamp,
          };
        }
        break;
    }

    if (message) {
      this.notifyListeners(message);
    }
  }

  private mapNote(note: number): number {
    return this.noteMapping.get(note) ?? note;
  }

  private applyVelocityCurve(velocity: number): number {
    const normalized = velocity / 127;

    let curved: number;
    switch (this.velocityCurve) {
      case 'soft':
        // Square root curve - more sensitive at low velocities
        curved = Math.sqrt(normalized);
        break;
      case 'hard':
        // Square curve - less sensitive at low velocities
        curved = normalized * normalized;
        break;
      case 'linear':
      default:
        curved = normalized;
    }

    return Math.round(curved * 127);
  }

  private notifyListeners(message: MidiMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in MIDI message listener:', error);
      }
    }
  }

  private notifyDeviceChange(): void {
    const devices = this.getDevices();
    for (const listener of this.deviceListeners) {
      try {
        listener(devices);
      } catch (error) {
        console.error('Error in MIDI device listener:', error);
      }
    }
  }

  dispose(): void {
    this.disconnectAll();
    this.listeners.clear();
    this.deviceListeners.clear();
    this.midiAccess = null;
  }
}

// =============================================================================
// Arpeggiator
// =============================================================================

export class Arpeggiator {
  private heldNotes: number[] = [];
  private currentIndex = 0;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private mode: 'up' | 'down' | 'updown' | 'random' | 'order' = 'up';
  private rate = 125; // ms between notes (1/8 at 120 BPM)
  private octaves = 1;
  private gate = 0.8; // Note length as fraction of interval
  private direction = 1; // 1 for up, -1 for down (for updown mode)

  private onNote?: (note: number, velocity: number, duration: number) => void;

  setMode(mode: 'up' | 'down' | 'updown' | 'random' | 'order'): void {
    this.mode = mode;
    this.currentIndex = 0;
    this.direction = 1;
  }

  setRate(bpm: number, division: '1/4' | '1/8' | '1/16' | '1/32'): void {
    const beatDuration = 60000 / bpm;
    const divisionMap = {
      '1/4': 1,
      '1/8': 0.5,
      '1/16': 0.25,
      '1/32': 0.125,
    };
    this.rate = beatDuration * divisionMap[division];
  }

  setOctaves(octaves: 1 | 2 | 3 | 4): void {
    this.octaves = octaves;
  }

  setGate(gate: number): void {
    this.gate = Math.max(0.1, Math.min(1, gate));
  }

  setOnNote(callback: (note: number, velocity: number, duration: number) => void): void {
    this.onNote = callback;
  }

  noteOn(note: number): void {
    if (!this.heldNotes.includes(note)) {
      this.heldNotes.push(note);
      this.heldNotes.sort((a, b) => a - b);

      if (!this.isRunning && this.heldNotes.length > 0) {
        this.start();
      }
    }
  }

  noteOff(note: number): void {
    const index = this.heldNotes.indexOf(note);
    if (index !== -1) {
      this.heldNotes.splice(index, 1);

      if (this.heldNotes.length === 0) {
        this.stop();
      }
    }
  }

  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentIndex = 0;
    this.direction = 1;

    this.tick();
    this.intervalId = setInterval(() => this.tick(), this.rate);
  }

  private stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private tick(): void {
    if (this.heldNotes.length === 0) return;

    const notes = this.expandNotes();
    if (notes.length === 0) return;

    // Get current note
    const note = notes[this.currentIndex % notes.length];
    const duration = this.rate * this.gate;

    // Trigger note
    this.onNote?.(note, 100, duration);

    // Advance index based on mode
    this.advanceIndex(notes.length);
  }

  private expandNotes(): number[] {
    const expanded: number[] = [];

    for (let oct = 0; oct < this.octaves; oct++) {
      for (const note of this.heldNotes) {
        expanded.push(note + oct * 12);
      }
    }

    return expanded;
  }

  private advanceIndex(length: number): void {
    switch (this.mode) {
      case 'up':
        this.currentIndex = (this.currentIndex + 1) % length;
        break;

      case 'down':
        this.currentIndex = (this.currentIndex - 1 + length) % length;
        break;

      case 'updown':
        this.currentIndex += this.direction;
        if (this.currentIndex >= length - 1) {
          this.direction = -1;
        } else if (this.currentIndex <= 0) {
          this.direction = 1;
        }
        break;

      case 'random':
        this.currentIndex = Math.floor(Math.random() * length);
        break;

      case 'order':
        // Play in the order notes were pressed
        this.currentIndex = (this.currentIndex + 1) % this.heldNotes.length;
        break;
    }
  }

  dispose(): void {
    this.stop();
    this.heldNotes = [];
  }
}

// Singleton instance
let midiManager: MidiInputManager | null = null;

export function getMidiManager(): MidiInputManager {
  if (!midiManager) {
    midiManager = new MidiInputManager();
  }
  return midiManager;
}
