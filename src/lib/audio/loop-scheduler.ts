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
  private lookaheadTime = 0.15; // 150ms lookahead (increased from 100ms)
  private scheduleInterval = 25; // 25ms schedule interval
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
    this.soundEngine.allNotesOff();
  }

  // Update loop track state (volume, effects, etc)
  updateLoopTrack(trackId: string, updates: Partial<LoopTrackState>): void {
    const loop = this.activeLoops.get(trackId);
    if (loop) {
      loop.trackState = { ...loop.trackState, ...updates };
    }
  }

  // Schedule one iteration of the loop
  private scheduleLoopIteration(loop: ActiveLoop, loopDuration: number): void {
    const { loopDef, trackState, nextLoopTime, iteration } = loop;

    // Get sound preset - use loopDef as fallback if trackState doesn't have it
    const soundPreset = trackState.soundPreset || loopDef.soundPreset;

    // Get MIDI data (possibly with humanization)
    let midiData = trackState.customMidiData || loopDef.midiData;

    if (iteration === 0) {
      console.log('[LoopScheduler] First iteration:', {
        trackId: loop.trackId,
        loopDuration,
        nextLoopTime: nextLoopTime.toFixed(3),
        currentTime: this.context.currentTime.toFixed(3),
        delta: (nextLoopTime - this.context.currentTime).toFixed(3),
        lookahead: this.lookaheadTime,
        midiNotes: midiData?.length,
        preset: soundPreset,
        muted: trackState.muted,
        contextState: this.context.state,
      });
    }

    // Apply humanization if enabled
    if (trackState.humanizeEnabled) {
      midiData = this.humanizeMidi(midiData, trackState.humanizeTiming, trackState.humanizeVelocity);
    }

    // Calculate transpose amount for key adaptation
    let transpose = trackState.transposeAmount || 0;
    if (!trackState.keyLocked && this.masterKey && loopDef.key) {
      transpose = this.calculateTranspose(loopDef.key, trackState.targetKey || this.masterKey);
    }

    let scheduledCount = 0;

    // Schedule each note
    for (const note of midiData) {
      const noteTime = nextLoopTime + note.t * loopDuration;
      const noteDuration = note.d * loopDuration;

      // Only schedule notes within the lookahead window (use <= for edge case)
      if (noteTime <= this.context.currentTime + this.lookaheadTime) {
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
    }

    if (iteration === 0) {
      console.log('[LoopScheduler] Scheduled notes in first iteration:', scheduledCount);
    }

    // Schedule next iteration
    const nextIterationTime = nextLoopTime + loopDuration;
    loop.nextLoopTime = nextIterationTime;
    loop.iteration++;

    // Set up lookahead timer
    const timeUntilNextCheck = Math.max(10, (nextLoopTime - this.context.currentTime) * 1000 - this.scheduleInterval);

    loop.lookaheadTimer = setTimeout(() => {
      if (this.activeLoops.has(loop.trackId)) {
        this.scheduleLoopIteration(loop, loopDuration);
      }
    }, timeUntilNextCheck);
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
