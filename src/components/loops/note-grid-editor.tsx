'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { MidiNote } from '@/types/loops';
import {
  getInstrument,
  midiToNoteName,
} from '@/lib/audio/instrument-registry';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { Copy, Scissors } from 'lucide-react';

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
  isPlaying?: boolean;
  playbackPosition?: number; // 0-1 normalized position
  className?: string;
  isDark?: boolean;
}

interface GridCell {
  beat: number;
  subdivision: number;
  noteNumber: number;
  t: number; // Normalized time position
}

interface SelectedNote {
  index: number;
  note: MidiNote;
}

// =============================================================================
// Constants
// =============================================================================

const CELL_WIDTH = 28;
const CELL_HEIGHT = 22;
const LABEL_WIDTH = 52;
const HEADER_HEIGHT = 28;

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
  isPlaying = false,
  playbackPosition = 0,
  className,
  isDark = false,
}: NoteGridEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'add' | 'remove'>('add');
  const [selectedVelocity, setSelectedVelocity] = useState(100);
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isExtending, setIsExtending] = useState(false);
  const [extendingNoteIndex, setExtendingNoteIndex] = useState<number | null>(null);

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
  const gridWidth = totalColumns * CELL_WIDTH;

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
    const tolerance = 0.5 / totalColumns;
    return notes.findIndex(
      (n) => Math.abs(n.t - t) < tolerance && n.n === noteNumber
    );
  }, [notes, totalColumns]);

  // Check if note is within a cell (including duration)
  const getNoteAtCell = useCallback((t: number, noteNumber: number): { index: number; note: MidiNote } | null => {
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.n === noteNumber && t >= n.t && t < n.t + n.d) {
        return { index: i, note: n };
      }
    }
    return null;
  }, [notes]);

  // Handle cell click
  const handleCellClick = useCallback((cell: GridCell, e: React.MouseEvent) => {
    // Check if clicking on existing note
    const existingNote = getNoteAtCell(cell.t, cell.noteNumber);

    if (existingNote) {
      if (e.shiftKey) {
        // Shift+click to toggle selection
        setSelectedNotes(prev => {
          const next = new Set(prev);
          if (next.has(existingNote.index)) {
            next.delete(existingNote.index);
          } else {
            next.add(existingNote.index);
          }
          return next;
        });
      } else if (selectedNotes.has(existingNote.index)) {
        // Click on selected note - deselect all
        setSelectedNotes(new Set());
      } else {
        // Click to remove note
        const newNotes = notes.filter((_, i) => i !== existingNote.index);
        onChange(newNotes);
        setSelectedNotes(new Set());
        setDrawMode('remove');
      }
    } else {
      // Add note
      const newNote: MidiNote = {
        t: cell.t,
        n: cell.noteNumber,
        v: selectedVelocity,
        d: 1 / totalColumns, // Default to one grid cell duration
      };
      onChange([...notes, newNote]);
      playPreview(cell.noteNumber, selectedVelocity);
      setDrawMode('add');
      setSelectedNotes(new Set());
    }
  }, [notes, onChange, getNoteAtCell, selectedVelocity, totalColumns, playPreview, selectedNotes]);

  // Handle drag drawing
  const handleCellEnter = useCallback((cell: GridCell) => {
    if (!isDrawing || isDragging || isExtending) return;

    const existingNote = getNoteAtCell(cell.t, cell.noteNumber);

    if (drawMode === 'add' && !existingNote) {
      const newNote: MidiNote = {
        t: cell.t,
        n: cell.noteNumber,
        v: selectedVelocity,
        d: 1 / totalColumns,
      };
      onChange([...notes, newNote]);
      playPreview(cell.noteNumber, selectedVelocity);
    } else if (drawMode === 'remove' && existingNote) {
      const newNotes = notes.filter((_, i) => i !== existingNote.index);
      onChange(newNotes);
    }
  }, [isDrawing, isDragging, isExtending, drawMode, notes, onChange, getNoteAtCell, selectedVelocity, totalColumns, playPreview]);

  // Mouse handlers
  const handleMouseDown = (cell: GridCell, e: React.MouseEvent) => {
    const existingNote = getNoteAtCell(cell.t, cell.noteNumber);

    if (existingNote && !e.shiftKey) {
      // Check if clicking on the right edge to extend
      const noteEndT = existingNote.note.t + existingNote.note.d;
      const cellEndT = cell.t + (1 / totalColumns);

      if (Math.abs(noteEndT - cellEndT) < 0.01) {
        // Start extending
        setIsExtending(true);
        setExtendingNoteIndex(existingNote.index);
        setDragStartX(e.clientX);
        return;
      }

      // Start dragging if note is selected
      if (selectedNotes.has(existingNote.index) || selectedNotes.size === 0) {
        setSelectedNotes(new Set([existingNote.index]));
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragOffset(0);
        return;
      }
    }

    setIsDrawing(true);
    handleCellClick(cell, e);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const cellOffset = Math.round(dx / CELL_WIDTH);
      setDragOffset(cellOffset);
    }

    if (isExtending && extendingNoteIndex !== null) {
      const dx = e.clientX - dragStartX;
      const cellExtend = Math.max(0, Math.round(dx / CELL_WIDTH));
      const note = notes[extendingNoteIndex];
      if (note) {
        const newDuration = (1 / totalColumns) * (Math.round(note.d * totalColumns) + cellExtend);
        const newNotes = [...notes];
        newNotes[extendingNoteIndex] = { ...note, d: Math.max(1 / totalColumns, newDuration) };
        onChange(newNotes);
      }
    }
  }, [isDragging, isExtending, dragStartX, extendingNoteIndex, notes, totalColumns, onChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragOffset !== 0) {
      // Apply drag offset to selected notes
      const timeOffset = dragOffset / totalColumns;
      const newNotes = notes.map((note, i) => {
        if (selectedNotes.has(i)) {
          const newT = Math.max(0, Math.min(1 - note.d, note.t + timeOffset));
          return { ...note, t: newT };
        }
        return note;
      });
      onChange(newNotes);
    }

    setIsDrawing(false);
    setIsDragging(false);
    setIsExtending(false);
    setExtendingNoteIndex(null);
    setDragOffset(0);
  }, [isDragging, dragOffset, selectedNotes, notes, totalColumns, onChange]);

  const handleMouseLeave = () => {
    setIsDrawing(false);
    setHoveredCell(null);
    setIsDragging(false);
    setIsExtending(false);
    setDragOffset(0);
  };

  // Copy selected notes
  const copySelectedNotes = useCallback(() => {
    if (selectedNotes.size === 0) return;

    const selectedNotesList = Array.from(selectedNotes).map(i => notes[i]);
    const minT = Math.min(...selectedNotesList.map(n => n.t));
    const maxT = Math.max(...selectedNotesList.map(n => n.t + n.d));
    const duration = maxT - minT;

    // Copy notes to the end of the pattern
    const newNotes = selectedNotesList.map(n => ({
      ...n,
      t: n.t + duration,
    })).filter(n => n.t + n.d <= 1); // Only add notes that fit

    onChange([...notes, ...newNotes]);
    setSelectedNotes(new Set());
  }, [selectedNotes, notes, onChange]);

  // Delete selected notes
  const deleteSelectedNotes = useCallback(() => {
    if (selectedNotes.size === 0) return;
    const newNotes = notes.filter((_, i) => !selectedNotes.has(i));
    onChange(newNotes);
    setSelectedNotes(new Set());
  }, [selectedNotes, notes, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedNotes();
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        copySelectedNotes();
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedNotes(new Set(notes.map((_, i) => i)));
      }
      if (e.key === 'Escape') {
        setSelectedNotes(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedNotes, copySelectedNotes, notes]);

  // Get velocity color
  const getVelocityColor = (velocity: number, isSelected: boolean): string => {
    const intensity = velocity / 127;
    if (isSelected) {
      return isDark
        ? `rgba(251, 146, 60, ${0.6 + intensity * 0.4})`
        : `rgba(249, 115, 22, ${0.5 + intensity * 0.5})`;
    }
    if (isDark) {
      return `rgba(99, 102, 241, ${0.5 + intensity * 0.5})`;
    }
    return `rgba(99, 102, 241, ${0.4 + intensity * 0.6})`;
  };

  // Generate column headers (beat numbers)
  const columnHeaders = useMemo(() => {
    const headers: { label: string; isDownbeat: boolean; isBarStart: boolean; barNum: number }[] = [];
    for (let col = 0; col < totalColumns; col++) {
      const beat = Math.floor(col / gridResolution);
      const subdivision = col % gridResolution;
      const barNum = Math.floor(beat / beatsPerBar) + 1;
      const isBarStart = beat % beatsPerBar === 0 && subdivision === 0;
      const isDownbeat = subdivision === 0;

      headers.push({
        label: isBarStart ? `${barNum}` : isDownbeat ? `${(beat % beatsPerBar) + 1}` : '',
        isDownbeat,
        isBarStart,
        barNum,
      });
    }
    return headers;
  }, [totalColumns, gridResolution, beatsPerBar]);

  // Calculate playhead position
  const playheadLeft = LABEL_WIDTH + (playbackPosition * gridWidth);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
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
          className="flex-1 max-w-32 h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-gray-700"
        />
        <span className={cn('text-sm w-8 text-center', isDark ? 'text-gray-400' : 'text-slate-600')}>
          {selectedVelocity}
        </span>

        {selectedNotes.size > 0 && (
          <>
            <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />
            <button
              onClick={copySelectedNotes}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              )}
              title="Copy selection (Ctrl+C)"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
            <button
              onClick={deleteSelectedNotes}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                'bg-red-100 text-red-600 hover:bg-red-200',
                isDark && 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
              )}
              title="Delete selection (Del)"
            >
              <Scissors className="w-3 h-3" />
              Delete
            </button>
            <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-slate-400')}>
              {selectedNotes.size} selected
            </span>
          </>
        )}
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
        onMouseMove={handleMouseMove}
      >
        {/* Playhead */}
        {isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{
              left: playheadLeft,
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
          </div>
        )}

        {/* Header row (bar/beat numbers) */}
        <div
          className="sticky top-0 z-10 flex"
          style={{ marginLeft: LABEL_WIDTH }}
        >
          {columnHeaders.map((header, col) => (
            <div
              key={col}
              className={cn(
                'flex items-center justify-center text-xs font-medium border-r border-b',
                header.isBarStart
                  ? isDark ? 'border-r-indigo-500 bg-gray-700' : 'border-r-indigo-400 bg-indigo-50'
                  : header.isDownbeat
                    ? isDark ? 'border-r-gray-500' : 'border-r-slate-400'
                    : isDark ? 'border-gray-700' : 'border-slate-200',
                isDark ? 'bg-gray-800 text-gray-400 border-b-gray-700' : 'bg-slate-50 text-slate-500 border-b-slate-200',
                header.isBarStart && (isDark ? 'text-indigo-400' : 'text-indigo-600')
              )}
              style={{ width: CELL_WIDTH, height: HEADER_HEIGHT }}
            >
              {header.label}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        <div ref={gridRef} className="relative">
          {noteRows.map((row) => (
            <div key={row.note} className="flex">
              {/* Row label */}
              <div
                className={cn(
                  'sticky left-0 z-10 flex items-center justify-end pr-2 text-xs font-mono border-r border-b',
                  isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-slate-50 text-slate-600 border-slate-200',
                  // Highlight C notes for piano layout
                  !isDrums && row.label.startsWith('C') && !row.label.includes('#')
                    ? isDark ? 'bg-gray-700 font-semibold' : 'bg-slate-100 font-semibold'
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

                // Check for note at this cell
                const noteAtCell = getNoteAtCell(t, row.note);
                const isNoteStart = noteAtCell && Math.abs(noteAtCell.note.t - t) < 0.001;
                const isSelected = noteAtCell && selectedNotes.has(noteAtCell.index);
                const isHovered = hoveredCell?.t === t && hoveredCell?.noteNumber === row.note;

                // Calculate note width for display
                let noteWidth = 0;
                if (isNoteStart && noteAtCell) {
                  noteWidth = noteAtCell.note.d * totalColumns * CELL_WIDTH;
                }

                return (
                  <div
                    key={col}
                    className={cn(
                      'relative border-r border-b cursor-pointer transition-colors',
                      isBarStart
                        ? isDark ? 'border-r-indigo-500/50' : 'border-r-indigo-300'
                        : isDownbeat
                          ? isDark ? 'border-r-gray-500' : 'border-r-slate-300'
                          : isDark ? 'border-gray-700' : 'border-slate-200',
                      isDark ? 'border-b-gray-700' : 'border-b-slate-200',
                      !noteAtCell && !isHovered && (isDark ? 'hover:bg-gray-700/50' : 'hover:bg-slate-100'),
                      // Highlight C rows
                      !isDrums && row.label.startsWith('C') && !row.label.includes('#') && !noteAtCell
                        ? isDark ? 'bg-gray-800/30' : 'bg-slate-50/50'
                        : '',
                      // Bar background alternation
                      Math.floor(beat / beatsPerBar) % 2 === 1 && !noteAtCell
                        ? isDark ? 'bg-gray-800/20' : 'bg-slate-50/30'
                        : ''
                    )}
                    style={{
                      width: CELL_WIDTH,
                      height: CELL_HEIGHT,
                    }}
                    onMouseDown={(e) => handleMouseDown({ beat, subdivision, noteNumber: row.note, t }, e)}
                    onMouseEnter={() => {
                      setHoveredCell({ beat, subdivision, noteNumber: row.note, t });
                      handleCellEnter({ beat, subdivision, noteNumber: row.note, t });
                    }}
                  >
                    {/* Render note */}
                    {isNoteStart && noteAtCell && (
                      <div
                        className={cn(
                          'absolute top-0.5 bottom-0.5 left-0.5 rounded-sm z-10',
                          isSelected ? 'ring-2 ring-orange-400' : '',
                          isDragging && isSelected ? 'opacity-60' : ''
                        )}
                        style={{
                          width: Math.max(noteWidth - 4, CELL_WIDTH - 4),
                          backgroundColor: getVelocityColor(noteAtCell.note.v, isSelected || false),
                          transform: isDragging && isSelected ? `translateX(${dragOffset * CELL_WIDTH}px)` : undefined,
                        }}
                      >
                        {/* Extend handle */}
                        <div
                          className={cn(
                            'absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize',
                            'hover:bg-white/20 rounded-r-sm'
                          )}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsExtending(true);
                            setExtendingNoteIndex(noteAtCell.index);
                            setDragStartX(e.clientX);
                          }}
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
        'mt-2 text-xs flex items-center gap-4',
        isDark ? 'text-gray-500' : 'text-slate-400'
      )}>
        <span>Click to add/remove notes</span>
        <span>Drag edge to extend</span>
        <span>Shift+click to select</span>
        <span>Ctrl+C to copy</span>
      </div>
    </div>
  );
}
