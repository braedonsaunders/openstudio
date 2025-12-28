'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { MidiNote } from '@/types/loops';
import {
  getInstrument,
  midiToNoteName,
  type InstrumentDefinition,
} from '@/lib/audio/instrument-registry';
import { SoundEngine } from '@/lib/audio/sound-engine';

// =============================================================================
// Types
// =============================================================================

interface NoteGridEditorProps {
  instrumentId: string;
  notes: MidiNote[];
  bars: number;
  timeSignature: [number, number];
  bpm: number;
  gridResolution?: number; // Subdivisions per beat (4 = 16th notes)
  onChange: (notes: MidiNote[]) => void;
  onPreviewNote?: (note: number, velocity: number) => void;
  className?: string;
  isDark?: boolean;
}

interface GridCell {
  beat: number;
  subdivision: number;
  noteNumber: number;
  t: number; // Normalized time position
}

// =============================================================================
// Constants
// =============================================================================

const CELL_WIDTH = 24;
const CELL_HEIGHT = 20;
const LABEL_WIDTH = 48;
const HEADER_HEIGHT = 24;

// =============================================================================
// Component
// =============================================================================

export function NoteGridEditor({
  instrumentId,
  notes,
  bars,
  timeSignature,
  bpm,
  gridResolution = 4,
  onChange,
  onPreviewNote,
  className,
  isDark = false,
}: NoteGridEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'add' | 'remove'>('add');
  const [selectedVelocity, setSelectedVelocity] = useState(100);
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);

  // Audio preview
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);

  // Get instrument info
  const instrument = useMemo(() => getInstrument(instrumentId), [instrumentId]);
  const noteRange = instrument?.noteRange || { min: 36, max: 84 };
  const isDrums = instrument?.layout === 'drums';

  // Calculate grid dimensions
  const beatsPerBar = timeSignature[0];
  const totalBeats = bars * beatsPerBar;
  const totalColumns = totalBeats * gridResolution;

  // Generate note rows
  const noteRows = useMemo(() => {
    const rows: { note: number; label: string }[] = [];

    if (isDrums && instrument?.drumMap) {
      // For drums, only show mapped notes
      const mappedNotes = Object.keys(instrument.drumMap)
        .map(Number)
        .filter(n => n >= noteRange.min && n <= noteRange.max)
        .sort((a, b) => b - a);

      for (const note of mappedNotes) {
        rows.push({
          note,
          label: instrument.drumMap[note]?.shortName || `${note}`,
        });
      }
    } else {
      // For melodic instruments, show full range
      for (let note = noteRange.max; note >= noteRange.min; note--) {
        rows.push({
          note,
          label: midiToNoteName(note),
        });
      }
    }

    return rows;
  }, [noteRange, isDrums, instrument]);

  // Initialize audio for preview
  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      soundEngineRef.current = new SoundEngine(audioContextRef.current);
      await soundEngineRef.current.initialize();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  // Play note preview
  const playPreview = useCallback(async (noteNumber: number, velocity: number) => {
    await initAudio();
    if (soundEngineRef.current) {
      soundEngineRef.current.playNote(instrumentId, noteNumber, velocity, undefined, 0.2);
    }
    onPreviewNote?.(noteNumber, velocity);
  }, [initAudio, instrumentId, onPreviewNote]);

  // Find note at position
  const findNoteAtPosition = useCallback((t: number, noteNumber: number): number => {
    const tolerance = 0.5 / (totalBeats * gridResolution); // Half a grid cell
    return notes.findIndex(
      (n) => Math.abs(n.t - t) < tolerance && n.n === noteNumber
    );
  }, [notes, totalBeats, gridResolution]);

  // Handle cell click
  const handleCellClick = useCallback((cell: GridCell) => {
    const existingIndex = findNoteAtPosition(cell.t, cell.noteNumber);

    if (existingIndex !== -1) {
      // Remove note
      const newNotes = notes.filter((_, i) => i !== existingIndex);
      onChange(newNotes);
      setDrawMode('remove');
    } else {
      // Add note
      const newNote: MidiNote = {
        t: cell.t,
        n: cell.noteNumber,
        v: selectedVelocity,
        d: 1 / (totalBeats * gridResolution), // Default to one grid cell duration
      };
      onChange([...notes, newNote]);
      playPreview(cell.noteNumber, selectedVelocity);
      setDrawMode('add');
    }
  }, [notes, onChange, findNoteAtPosition, selectedVelocity, totalBeats, gridResolution, playPreview]);

  // Handle drag drawing
  const handleCellEnter = useCallback((cell: GridCell) => {
    if (!isDrawing) return;

    const existingIndex = findNoteAtPosition(cell.t, cell.noteNumber);

    if (drawMode === 'add' && existingIndex === -1) {
      const newNote: MidiNote = {
        t: cell.t,
        n: cell.noteNumber,
        v: selectedVelocity,
        d: 1 / (totalBeats * gridResolution),
      };
      onChange([...notes, newNote]);
      playPreview(cell.noteNumber, selectedVelocity);
    } else if (drawMode === 'remove' && existingIndex !== -1) {
      const newNotes = notes.filter((_, i) => i !== existingIndex);
      onChange(newNotes);
    }
  }, [isDrawing, drawMode, notes, onChange, findNoteAtPosition, selectedVelocity, totalBeats, gridResolution, playPreview]);

  // Mouse handlers
  const handleMouseDown = (cell: GridCell) => {
    setIsDrawing(true);
    handleCellClick(cell);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
    setHoveredCell(null);
  };

  // Check if a cell has a note
  const hasNote = useCallback((t: number, noteNumber: number): MidiNote | undefined => {
    const tolerance = 0.5 / (totalBeats * gridResolution);
    return notes.find(
      (n) => Math.abs(n.t - t) < tolerance && n.n === noteNumber
    );
  }, [notes, totalBeats, gridResolution]);

  // Get velocity color
  const getVelocityColor = (velocity: number): string => {
    const intensity = velocity / 127;
    if (isDark) {
      return `rgba(99, 102, 241, ${0.4 + intensity * 0.6})`;
    }
    return `rgba(99, 102, 241, ${0.3 + intensity * 0.7})`;
  };

  // Generate column headers (beat numbers)
  const columnHeaders = useMemo(() => {
    const headers: { label: string; isDownbeat: boolean; isBarStart: boolean }[] = [];
    for (let col = 0; col < totalColumns; col++) {
      const beat = Math.floor(col / gridResolution);
      const subdivision = col % gridResolution;
      const isBarStart = beat % beatsPerBar === 0 && subdivision === 0;
      const isDownbeat = subdivision === 0;

      headers.push({
        label: isDownbeat ? `${beat + 1}` : '',
        isDownbeat,
        isBarStart,
      });
    }
    return headers;
  }, [totalColumns, gridResolution, beatsPerBar]);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Velocity control */}
      <div className={cn(
        'flex items-center gap-4 mb-3 p-2 rounded-lg',
        isDark ? 'bg-gray-800' : 'bg-slate-100'
      )}>
        <span className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-slate-700')}>
          Velocity:
        </span>
        <input
          type="range"
          min={1}
          max={127}
          value={selectedVelocity}
          onChange={(e) => setSelectedVelocity(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-gray-700"
        />
        <span className={cn('text-sm w-8 text-center', isDark ? 'text-gray-400' : 'text-slate-600')}>
          {selectedVelocity}
        </span>
      </div>

      {/* Grid container */}
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-auto border rounded-lg',
          isDark ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-white'
        )}
        style={{ maxHeight: '400px' }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header row (beat numbers) */}
        <div
          className="sticky top-0 z-10 flex"
          style={{ marginLeft: LABEL_WIDTH }}
        >
          {columnHeaders.map((header, col) => (
            <div
              key={col}
              className={cn(
                'flex items-center justify-center text-xs border-r border-b',
                header.isBarStart
                  ? isDark ? 'border-r-gray-500' : 'border-r-slate-400'
                  : isDark ? 'border-gray-700' : 'border-slate-200',
                isDark ? 'bg-gray-800 text-gray-400 border-b-gray-700' : 'bg-slate-50 text-slate-500 border-b-slate-200'
              )}
              style={{ width: CELL_WIDTH, height: HEADER_HEIGHT }}
            >
              {header.label}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        <div className="relative">
          {noteRows.map((row) => (
            <div key={row.note} className="flex">
              {/* Row label */}
              <div
                className={cn(
                  'sticky left-0 z-10 flex items-center justify-end pr-2 text-xs font-mono border-r border-b',
                  isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-slate-50 text-slate-600 border-slate-200',
                  // Highlight C notes for piano layout
                  !isDrums && row.label.startsWith('C') && !row.label.includes('#')
                    ? isDark ? 'bg-gray-700' : 'bg-slate-100'
                    : ''
                )}
                style={{ width: LABEL_WIDTH, height: CELL_HEIGHT }}
              >
                {row.label}
              </div>

              {/* Grid cells */}
              {Array.from({ length: totalColumns }, (_, col) => {
                const beat = Math.floor(col / gridResolution);
                const subdivision = col % gridResolution;
                const isBarStart = beat % beatsPerBar === 0 && subdivision === 0;
                const isDownbeat = subdivision === 0;
                const t = col / totalColumns;

                const note = hasNote(t, row.note);
                const isHovered = hoveredCell?.t === t && hoveredCell?.noteNumber === row.note;

                return (
                  <div
                    key={col}
                    className={cn(
                      'border-r border-b cursor-pointer transition-colors',
                      isBarStart
                        ? isDark ? 'border-r-gray-500' : 'border-r-slate-400'
                        : isDownbeat
                          ? isDark ? 'border-r-gray-600' : 'border-r-slate-300'
                          : isDark ? 'border-gray-700' : 'border-slate-200',
                      isDark ? 'border-b-gray-700' : 'border-b-slate-200',
                      !note && !isHovered && (isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-100'),
                      // Highlight C rows
                      !isDrums && row.label.startsWith('C') && !row.label.includes('#') && !note
                        ? isDark ? 'bg-gray-800/50' : 'bg-slate-50'
                        : ''
                    )}
                    style={{
                      width: CELL_WIDTH,
                      height: CELL_HEIGHT,
                      backgroundColor: note ? getVelocityColor(note.v) : undefined,
                    }}
                    onMouseDown={() => handleMouseDown({ beat, subdivision, noteNumber: row.note, t })}
                    onMouseEnter={() => {
                      setHoveredCell({ beat, subdivision, noteNumber: row.note, t });
                      handleCellEnter({ beat, subdivision, noteNumber: row.note, t });
                    }}
                  >
                    {note && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-indigo-300"
                          style={{ opacity: 0.4 + (note.v / 127) * 0.6 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Help text */}
      <div className={cn(
        'mt-2 text-xs',
        isDark ? 'text-gray-500' : 'text-slate-400'
      )}>
        Click to add/remove notes. Click and drag to draw multiple notes.
      </div>
    </div>
  );
}
