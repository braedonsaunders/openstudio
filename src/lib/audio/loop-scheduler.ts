// Loop Scheduler - Sample-accurate MIDI loop playback
// Handles timing, synchronization, and loop repetition

import type { MidiNote, LoopDefinition, LoopTrackState } from '@/types/loops';
import { SoundEngine } from './sound-engine';

// =============================================================================
// Types
// =============================================================================

interface ScheduledNote {
  noteNumber: number;
  velocity: number;
  startTime: number;
  duration: number;
  soundPreset: string;
}

interface ActiveLoop {
  trackId: string;
  loopDef: LoopDefinition;
  trackState: LoopTrackState;
  scheduledNotes: ScheduledNote[];
  nextLoopTime: number;
  iteration: number;
  lookaheadTimer?: NodeJS.Timeout;
}

// =============================================================================
// Loop Scheduler
// =============================================================================

export class LoopScheduler {
  private context: AudioContext;
  private soundEngine: SoundEngine;
  private activeLoops: Map<string, ActiveLoop> = new Map();
  private lookaheadTime = 0.25; // 250ms lookahead for safety margin
  private scheduleInterval = 20; // 20ms schedule interval for responsiveness
  private masterTempo = 120; // BPM
  private masterKey?: string;
  private isPlaying = false;
  private globalStartTime = 0;

  constructor(context: AudioContext, soundEngine: SoundEngine) {
    this.context = context;
    this.soundEngine = soundEngine;
  }

  setMasterTempo(bpm: number): void {
    this.masterTempo = Math.max(40, Math.min(240, bpm));
  }

  getMasterTempo(): number {
    return this.masterTempo;
  }

  setMasterKey(key: string | undefined): void {
    this.masterKey = key;
  }

  // Start a loop track
  startLoop(
    trackId: string,
    loopDef: LoopDefinition,
    trackState: LoopTrackState,
    syncTimestamp: number
  ): void {
    // Stop existing loop if any
    this.stopLoop(trackId);

    // Calculate audio context start time from wall clock
    const now = Date.now();
    const delay = Math.max(0, syncTimestamp - now) / 1000;
    const audioStartTime = this.context.currentTime + delay;

    // Apply tempo adaptation if not locked
    const effectiveBpm = trackState.tempoLocked
      ? loopDef.bpm
      : trackState.targetBpm || this.masterTempo;

    // Calculate loop duration in seconds
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    const loopDuration = (totalBeats / effectiveBpm) * 60;

    const activeLoop: ActiveLoop = {
      trackId,
      loopDef,
      trackState,
      scheduledNotes: [],
      nextLoopTime: audioStartTime,
      iteration: 0,
    };

    this.activeLoops.set(trackId, activeLoop);

    // Start the scheduling loop
    this.scheduleLoopIteration(activeLoop, loopDuration);
  }

  // Stop a loop track
  stopLoop(trackId: string): void {
    const loop = this.activeLoops.get(trackId);
    if (loop) {
      if (loop.lookaheadTimer) {
        clearTimeout(loop.lookaheadTimer);
      }
      this.activeLoops.delete(trackId);
    }
  }

  // Stop all loops
  stopAll(): void {
    for (const trackId of this.activeLoops.keys()) {
      this.stopLoop(trackId);
    }
    // Use killAll() for immediate stop - no release envelope
    // This prevents notes from continuing to play after stop
    this.soundEngine.killAll();
  }

  // Update loop track state (volume, effects, etc)
  updateLoopTrack(trackId: string, updates: Partial<LoopTrackState>): void {
    const loop = this.activeLoops.get(trackId);
    if (loop) {
      const wasMuted = loop.trackState.muted;
      loop.trackState = { ...loop.trackState, ...updates };

      // If mute was toggled ON, immediately kill all notes to prevent scheduled notes from playing
      if (updates.muted === true && !wasMuted) {
        this.soundEngine.killAll();
      }
    }
  }

  // Schedule notes within the lookahead window, called repeatedly
  private scheduleLoopIteration(loop: ActiveLoop, loopDuration: number): void {
    const { loopDef, trackState } = loop;
    const currentTime = this.context.currentTime;
    const lookaheadEnd = currentTime + this.lookaheadTime;

    // Get sound preset - use loopDef as fallback if trackState doesn't have it
    const soundPreset = trackState.soundPreset || loopDef.soundPreset;

    // Get MIDI data (possibly with humanization)
    let midiData = trackState.customMidiData || loopDef.midiData;

    // Apply humanization if enabled (only on first pass of each iteration)
    if (trackState.humanizeEnabled) {
      midiData = this.humanizeMidi(midiData, trackState.humanizeTiming, trackState.humanizeVelocity);
    }

    // Calculate transpose amount for key adaptation
    let transpose = trackState.transposeAmount || 0;
    if (!trackState.keyLocked && this.masterKey && loopDef.key) {
      transpose = this.calculateTranspose(loopDef.key, trackState.targetKey || this.masterKey);
    }

    let scheduledCount = 0;
    let loopStartTime = loop.nextLoopTime;

    // Schedule notes across multiple loop iterations if needed
    // This handles cases where lookahead spans multiple loops
    while (loopStartTime <= lookaheadEnd) {
      for (const note of midiData) {
        const noteTime = loopStartTime + note.t * loopDuration;
        const noteDuration = note.d * loopDuration;

        // Skip notes in the past
        if (noteTime < currentTime - 0.01) continue;

        // Skip notes beyond lookahead
        if (noteTime > lookaheadEnd) continue;

        // Check if this note was already scheduled (by time)
        const alreadyScheduled = loop.scheduledNotes.some(
          (sn) => Math.abs(sn.startTime - noteTime) < 0.001 && sn.noteNumber === (loopDef.category === 'drums' ? note.n : note.n + transpose)
        );
        if (alreadyScheduled) continue;

        // Apply volume
        const velocity = Math.round(note.v * trackState.volume);

        // Apply transpose (skip for drums)
        const noteNumber = loopDef.category === 'drums'
          ? note.n
          : note.n + transpose;

        if (!trackState.muted && velocity > 0) {
          this.soundEngine.playNote(
            soundPreset,
            noteNumber,
            velocity,
            noteTime,
            noteDuration
          );
          scheduledCount++;
        }

        loop.scheduledNotes.push({
          noteNumber,
          velocity,
          startTime: noteTime,
          duration: noteDuration,
          soundPreset: soundPreset,
        });
      }

      // Move to next loop iteration
      loopStartTime += loopDuration;
    }

    // Update nextLoopTime to the start of the next unscheduled iteration
    // This is the iteration that starts after our current lookahead window
    while (loop.nextLoopTime + loopDuration <= currentTime) {
      loop.nextLoopTime += loopDuration;
      loop.iteration++;
      // Clean up old scheduled notes to prevent memory growth
      loop.scheduledNotes = loop.scheduledNotes.filter(
        (sn) => sn.startTime >= currentTime - 0.5
      );
    }

    // Set up next scheduling check - always check at regular intervals
    loop.lookaheadTimer = setTimeout(() => {
      if (this.activeLoops.has(loop.trackId)) {
        this.scheduleLoopIteration(loop, loopDuration);
      }
    }, this.scheduleInterval);
  }

  // Apply humanization to MIDI data
  private humanizeMidi(
    midiData: MidiNote[],
    timingAmount: number,
    velocityAmount: number
  ): MidiNote[] {
    return midiData.map((note) => ({
      ...note,
      t: note.t + (Math.random() * 2 - 1) * timingAmount,
      v: Math.max(1, Math.min(127, note.v + (Math.random() * 2 - 1) * velocityAmount * 127)),
    }));
  }

  // Calculate semitone transpose between keys
  private calculateTranspose(fromKey: string, toKey: string): number {
    const noteToSemitone: Record<string, number> = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
    };

    // Extract root note (ignore minor/major suffix)
    const fromRoot = fromKey.replace('m', '').trim();
    const toRoot = toKey.replace('m', '').trim();

    const fromSemi = noteToSemitone[fromRoot] ?? 0;
    const toSemi = noteToSemitone[toRoot] ?? 0;

    let diff = toSemi - fromSemi;

    // Choose closest transposition (-6 to +5)
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;

    return diff;
  }

  // Get current playback position for a loop (0-1 normalized)
  getLoopPosition(trackId: string): number {
    const loop = this.activeLoops.get(trackId);
    if (!loop) return 0;

    const { loopDef, trackState, nextLoopTime } = loop;
    const effectiveBpm = trackState.tempoLocked
      ? loopDef.bpm
      : trackState.targetBpm || this.masterTempo;

    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    const loopDuration = (totalBeats / effectiveBpm) * 60;

    const loopStartTime = nextLoopTime - loopDuration;
    const elapsed = this.context.currentTime - loopStartTime;

    return (elapsed / loopDuration) % 1;
  }

  // Check if a loop is currently playing
  isLoopPlaying(trackId: string): boolean {
    return this.activeLoops.has(trackId);
  }

  // Get all active loop track IDs
  getActiveLoopIds(): string[] {
    return Array.from(this.activeLoops.keys());
  }

  dispose(): void {
    this.stopAll();
  }
}
