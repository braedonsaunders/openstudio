'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { getLoopById } from '@/lib/audio/loop-library';
import type { LoopTrackState, MidiNote } from '@/types/loops';

interface LoopTrackLaneProps {
  track: LoopTrackState;
  width: number;
  pixelsPerSecond?: number;
}

export function LoopTrackLane({
  track,
  width,
  pixelsPerSecond = 50,
}: LoopTrackLaneProps) {
  const { masterTempo } = useLoopTracksStore();

  // Get loop definition
  const loopDef = getLoopById(track.loopId);

  // Calculate loop duration in seconds
  const loopDuration = useMemo(() => {
    if (!loopDef) return 4;
    const effectiveBpm = track.tempoLocked ? loopDef.bpm : track.targetBpm || masterTempo;
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / effectiveBpm) * 60;
  }, [loopDef, track, masterTempo]);

  // How many iterations to show
  const iterations = Math.ceil(width / (loopDuration * pixelsPerSecond));

  // Get MIDI data
  const midiData = track.customMidiData || loopDef?.midiData || [];

  // Calculate note ranges for visualization
  const noteRange = useMemo(() => {
    if (midiData.length === 0) return { min: 36, max: 72 };
    const notes = midiData.map((n) => n.n);
    return {
      min: Math.min(...notes),
      max: Math.max(...notes),
    };
  }, [midiData]);

  const noteHeight = 72 / Math.max(1, noteRange.max - noteRange.min + 1);

  return (
    <div
      className="relative h-full bg-slate-900/50 overflow-hidden"
      style={{ width }}
    >
      {/* Loop iterations */}
      {Array.from({ length: iterations }).map((_, iteration) => (
        <div
          key={iteration}
          className="absolute top-0 bottom-0"
          style={{
            left: iteration * loopDuration * pixelsPerSecond,
            width: loopDuration * pixelsPerSecond,
          }}
        >
          {/* Loop boundary marker */}
          {iteration > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px"
              style={{ backgroundColor: `${track.color}40` }}
            />
          )}

          {/* MIDI Notes visualization */}
          {midiData.map((note, noteIndex) => (
            <MidiNoteBlock
              key={`${iteration}-${noteIndex}`}
              note={note}
              loopDuration={loopDuration}
              noteRange={noteRange}
              color={track.color}
              pixelsPerSecond={pixelsPerSecond}
              muted={track.muted}
            />
          ))}

          {/* Loop label (first iteration only) */}
          {iteration === 0 && (
            <div
              className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/80 truncate max-w-[120px]"
              style={{ backgroundColor: `${track.color}80` }}
            >
              {track.name || loopDef?.name}
            </div>
          )}
        </div>
      ))}

      {/* Playing indicator */}
      {track.isPlaying && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 bottom-0 w-px bg-white/70 animate-pulse"
            style={{
              left: '2px', // Will need to be animated based on actual position
            }}
          />
        </div>
      )}

      {/* Muted overlay */}
      {track.muted && (
        <div className="absolute inset-0 bg-slate-900/60 pointer-events-none" />
      )}
    </div>
  );
}

// MIDI Note Block Component
interface MidiNoteBlockProps {
  note: MidiNote;
  loopDuration: number;
  noteRange: { min: number; max: number };
  color: string;
  pixelsPerSecond: number;
  muted: boolean;
}

function MidiNoteBlock({
  note,
  loopDuration,
  noteRange,
  color,
  pixelsPerSecond,
  muted,
}: MidiNoteBlockProps) {
  const rangeSize = Math.max(1, noteRange.max - noteRange.min + 1);

  // Calculate position and size
  const left = note.t * loopDuration * pixelsPerSecond;
  const width = Math.max(2, note.d * loopDuration * pixelsPerSecond);
  const notePosition = (note.n - noteRange.min) / rangeSize;
  const height = Math.max(3, 72 / rangeSize);
  const top = (1 - notePosition) * (72 - height);

  // Velocity affects opacity
  const opacity = muted ? 0.3 : 0.4 + (note.v / 127) * 0.5;

  return (
    <div
      className="absolute rounded-sm"
      style={{
        left,
        top,
        width,
        height,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

// Mini Piano Roll for Loop Preview
interface LoopPianoRollProps {
  midiData: MidiNote[];
  color: string;
  height?: number;
  className?: string;
}

export function LoopPianoRoll({
  midiData,
  color,
  height = 40,
  className,
}: LoopPianoRollProps) {
  if (midiData.length === 0) {
    return (
      <div
        className={cn('bg-slate-800 rounded', className)}
        style={{ height }}
      />
    );
  }

  const notes = midiData.map((n) => n.n);
  const minNote = Math.min(...notes);
  const maxNote = Math.max(...notes);
  const rangeSize = Math.max(1, maxNote - minNote + 1);

  return (
    <div
      className={cn('relative bg-slate-800 rounded overflow-hidden', className)}
      style={{ height }}
    >
      {midiData.map((note, i) => {
        const notePosition = (note.n - minNote) / rangeSize;
        const noteHeight = Math.max(2, height / rangeSize);
        const top = (1 - notePosition) * (height - noteHeight);
        const left = `${note.t * 100}%`;
        const width = `${Math.max(2, note.d * 100)}%`;

        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left,
              top,
              width,
              height: noteHeight,
              backgroundColor: color,
              opacity: 0.4 + (note.v / 127) * 0.5,
            }}
          />
        );
      })}
    </div>
  );
}
