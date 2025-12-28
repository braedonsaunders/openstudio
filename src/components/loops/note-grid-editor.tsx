'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { MidiNote } from '@/types/loops';
import {
  getInstrument,
  midiToNoteName,
} from '@/lib/audio/instrument-registry';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { Copy, Scissors, Volume2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface NoteGridEditorProps {
  instrumentId: string;
  notes: MidiNote[];
  bars: number;
  timeSignature: [number, number];
  bpm: number;
  gridResolution?: number;
  onChange: (notes: MidiNote[]) => void;
  onPreviewNote?: (note: number, velocity: number) => void;
  isPlaying?: boolean;
  playbackPosition?: number;
  className?: string;
  isDark?: boolean;
}

interface GridCell {
  col: number;
  row: number;
  noteNumber: number;
  t: number;
}

// =============================================================================
// Constants
// =============================================================================

const CELL_WIDTH = 24;
const CELL_HEIGHT = 20;
const LABEL_WIDTH = 48;
const HEADER_HEIGHT = 24;
const MIN_NOTE_WIDTH = 4;

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
  const gridContentRef = useRef<HTMLDivElement>(null);

  // State
  const [selectedVelocity, setSelectedVelocity] = useState(100);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'add' | 'remove'>('add');

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

  // Extend state - KEY FIX: store original duration
  const [isExtending, setIsExtending] = useState(false);
  const [extendNoteIndex, setExtendNoteIndex] = useState<number | null>(null);
  const [extendOriginalDuration, setExtendOriginalDuration] = useState(0);
  const [extendStartX, setExtendStartX] = useState(0);

  // Audio
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
  const cellDuration = 1 / totalColumns;

  // Grid dimensions
  const gridWidth = totalColumns * CELL_WIDTH;

  // Generate note rows
  const noteRows = useMemo(() => {
    const rows: { note: number; label: string }[] = [];

    if (isDrums && instrument?.drumMap) {
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
      for (let note = noteRange.max; note >= noteRange.min; note--) {
        rows.push({
          note,
          label: midiToNoteName(note),
        });
      }
    }

    return rows;
  }, [noteRange, isDrums, instrument]);

  const gridHeight = noteRows.length * CELL_HEIGHT;

  // Initialize audio
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

  // Play note preview - IMMEDIATELY plays sound
  const playPreview = useCallback(async (noteNumber: number, velocity: number) => {
    await initAudio();
    if (soundEngineRef.current) {
      // Play with short duration for preview
      soundEngineRef.current.playNote(instrumentId, noteNumber, velocity, undefined, 0.15);
    }
    onPreviewNote?.(noteNumber, velocity);
  }, [initAudio, instrumentId, onPreviewNote]);

  // Find note at position (considering duration)
  const getNoteAtCell = useCallback((t: number, noteNumber: number): { index: number; note: MidiNote } | null => {
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.n === noteNumber && t >= n.t && t < n.t + n.d) {
        return { index: i, note: n };
      }
    }
    return null;
  }, [notes]);

  // Handle cell mouse down
  const handleCellMouseDown = useCallback((cell: GridCell, e: React.MouseEvent) => {
    e.preventDefault();

    const existingNote = getNoteAtCell(cell.t, cell.noteNumber);

    if (existingNote) {
      // CLICK-TO-PLAY: ALWAYS play the note sound when clicking on it
      playPreview(existingNote.note.n, existingNote.note.v);

      // Check if clicking near the end of a note to extend it
      const noteEnd = existingNote.note.t + existingNote.note.d;
      const cellEnd = cell.t + cellDuration;
      const isNearEnd = Math.abs(noteEnd - cellEnd) < cellDuration * 0.5;

      if (isNearEnd && existingNote.note.d >= cellDuration) {
        setIsExtending(true);
        setExtendNoteIndex(existingNote.index);
        setExtendOriginalDuration(existingNote.note.d);
        setExtendStartX(e.clientX);
        return;
      }

      if (e.shiftKey) {
        // Shift+click: Toggle selection
        setSelectedNotes(prev => {
          const next = new Set(prev);
          if (next.has(existingNote.index)) {
            next.delete(existingNote.index);
          } else {
            next.add(existingNote.index);
          }
          return next;
        });
      } else if (e.altKey || e.metaKey) {
        // Alt/Cmd+click: Remove note
        const newNotes = notes.filter((_, i) => i !== existingNote.index);
        onChange(newNotes);
        setSelectedNotes(new Set());
      } else {
        // Regular click: Start dragging if selected, otherwise select it
        if (selectedNotes.has(existingNote.index)) {
          setIsDragging(true);
          setDragStartX(e.clientX);
          setDragOffset(0);
        } else {
          setSelectedNotes(new Set([existingNote.index]));
          setIsDragging(true);
          setDragStartX(e.clientX);
          setDragOffset(0);
        }
      }
    } else {
      // Empty cell: Add note
      const newNote: MidiNote = {
        t: cell.t,
        n: cell.noteNumber,
        v: selectedVelocity,
        d: cellDuration,
      };
      onChange([...notes, newNote]);
      playPreview(cell.noteNumber, selectedVelocity);
      setDrawMode('add');
      setIsDrawing(true);
      setSelectedNotes(new Set());
    }
  }, [notes, onChange, getNoteAtCell, selectedVelocity, cellDuration, playPreview, selectedNotes]);

  // Handle cell mouse enter (for drawing)
  const handleCellEnter = useCallback((cell: GridCell) => {
    setHoveredCell(cell);

    if (!isDrawing || isDragging || isExtending) return;

    const existingNote = getNoteAtCell(cell.t, cell.noteNumber);

    if (drawMode === 'add' && !existingNote) {
      const newNote: MidiNote = {
        t: cell.t,
        n: cell.noteNumber,
        v: selectedVelocity,
        d: cellDuration,
      };
      onChange([...notes, newNote]);
      playPreview(cell.noteNumber, selectedVelocity);
    } else if (drawMode === 'remove' && existingNote) {
      const newNotes = notes.filter((_, i) => i !== existingNote.index);
      onChange(newNotes);
    }
  }, [isDrawing, isDragging, isExtending, drawMode, notes, onChange, getNoteAtCell, selectedVelocity, cellDuration, playPreview]);

  // Handle mouse move (global for dragging/extending)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const cellOffset = Math.round(dx / CELL_WIDTH);
      setDragOffset(cellOffset);
    }

    if (isExtending && extendNoteIndex !== null) {
      const dx = e.clientX - extendStartX;
      const cellExtend = Math.round(dx / CELL_WIDTH);

      // Calculate new duration from ORIGINAL duration, not current
      const originalCells = Math.round(extendOriginalDuration / cellDuration);
      const newCells = Math.max(1, originalCells + cellExtend);
      const newDuration = newCells * cellDuration;

      // Ensure note doesn't extend past the end of the loop
      const note = notes[extendNoteIndex];
      if (note) {
        const maxDuration = 1 - note.t;
        const clampedDuration = Math.min(newDuration, maxDuration);

        const newNotes = [...notes];
        newNotes[extendNoteIndex] = { ...note, d: clampedDuration };
        onChange(newNotes);
      }
    }
  }, [isDragging, isExtending, dragStartX, extendStartX, extendNoteIndex, extendOriginalDuration, notes, cellDuration, onChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragOffset !== 0) {
      const timeOffset = dragOffset * cellDuration;
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
    setExtendNoteIndex(null);
    setExtendOriginalDuration(0);
    setDragOffset(0);
  }, [isDragging, dragOffset, selectedNotes, notes, cellDuration, onChange]);

  // Handle mouse leave
  const handleMouseLeave = () => {
    setHoveredCell(null);
    if (isDrawing) setIsDrawing(false);
  };

  // Copy selected notes
  const copySelectedNotes = useCallback(() => {
    if (selectedNotes.size === 0) return;

    const selectedList = Array.from(selectedNotes).map(i => notes[i]).filter(Boolean);
    if (selectedList.length === 0) return;

    const minT = Math.min(...selectedList.map(n => n.t));
    const maxT = Math.max(...selectedList.map(n => n.t + n.d));
    const duration = maxT - minT;

    const newNotes = selectedList
      .map(n => ({ ...n, t: n.t + duration }))
      .filter(n => n.t + n.d <= 1);

    if (newNotes.length > 0) {
      onChange([...notes, ...newNotes]);
      setSelectedNotes(new Set());
    }
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
        e.preventDefault();
        deleteSelectedNotes();
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
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
        ? `rgba(251, 146, 60, ${0.7 + intensity * 0.3})`
        : `rgba(249, 115, 22, ${0.6 + intensity * 0.4})`;
    }
    return isDark
      ? `rgba(99, 102, 241, ${0.6 + intensity * 0.4})`
      : `rgba(99, 102, 241, ${0.5 + intensity * 0.5})`;
  };

  // Generate column headers
  const columnHeaders = useMemo(() => {
    const headers: { label: string; isDownbeat: boolean; isBarStart: boolean }[] = [];
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
      });
    }
    return headers;
  }, [totalColumns, gridResolution, beatsPerBar]);

  // Calculate playhead position
  const playheadX = playbackPosition * gridWidth;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      <div className={cn(
        'flex items-center gap-4 mb-3 p-2 rounded-lg',
        isDark ? 'bg-gray-800' : 'bg-slate-100'
      )}>
        <Volume2 className={cn('w-4 h-4', isDark ? 'text-gray-400' : 'text-slate-500')} />
        <span className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-slate-700')}>
          Velocity:
        </span>
        <input
          type="range"
          min={1}
          max={127}
          value={selectedVelocity}
          onChange={(e) => setSelectedVelocity(parseInt(e.target.value))}
          className="flex-1 max-w-32 h-2 rounded-lg appearance-none cursor-pointer bg-slate-300 dark:bg-gray-600"
        />
        <span className={cn('text-sm w-8 text-center font-mono', isDark ? 'text-gray-400' : 'text-slate-600')}>
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

      {/* Grid container with proper structure */}
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-auto border rounded-lg select-none',
          isDark ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-white'
        )}
        style={{ maxHeight: '400px' }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {/* Scrollable content wrapper */}
        <div
          ref={gridContentRef}
          className="relative"
          style={{
            width: LABEL_WIDTH + gridWidth,
            minHeight: HEADER_HEIGHT + gridHeight
          }}
        >
          {/* Playhead - positioned relative to grid content, FULL HEIGHT */}
          {isPlaying && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                left: LABEL_WIDTH + playheadX,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'linear-gradient(to bottom, #ef4444 0%, #ef4444 100%)',
                boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              }}
            >
              {/* Playhead triangle */}
              <div
                className="absolute -top-0"
                style={{
                  left: -4,
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '6px solid #ef4444',
                }}
              />
            </div>
          )}

          {/* Header row */}
          <div
            className={cn(
              'sticky top-0 z-20 flex',
              isDark ? 'bg-gray-800' : 'bg-slate-50'
            )}
            style={{ height: HEADER_HEIGHT }}
          >
            {/* Corner cell */}
            <div
              className={cn(
                'sticky left-0 z-30 flex items-center justify-center border-r border-b',
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'
              )}
              style={{ width: LABEL_WIDTH, height: HEADER_HEIGHT }}
            />
            {/* Column headers */}
            {columnHeaders.map((header, col) => (
              <div
                key={col}
                className={cn(
                  'flex items-center justify-center text-xs font-medium border-r border-b',
                  header.isBarStart
                    ? isDark ? 'border-r-indigo-500/70 text-indigo-400 bg-indigo-500/10' : 'border-r-indigo-400 text-indigo-600 bg-indigo-50'
                    : header.isDownbeat
                      ? isDark ? 'border-r-gray-500 text-gray-400' : 'border-r-slate-400 text-slate-500'
                      : isDark ? 'border-r-gray-700 text-gray-500' : 'border-r-slate-200 text-slate-400',
                  isDark ? 'border-b-gray-700' : 'border-b-slate-200'
                )}
                style={{ width: CELL_WIDTH, height: HEADER_HEIGHT }}
              >
                {header.label}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {noteRows.map((row, rowIndex) => {
            const isC = !isDrums && row.label.startsWith('C') && !row.label.includes('#');

            return (
              <div key={row.note} className="flex" style={{ height: CELL_HEIGHT }}>
                {/* Row label */}
                <div
                  className={cn(
                    'sticky left-0 z-10 flex items-center justify-end pr-2 text-xs font-mono border-r border-b',
                    isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-slate-50 text-slate-600 border-slate-200',
                    isC && (isDark ? 'bg-gray-700 text-gray-300 font-semibold' : 'bg-slate-100 text-slate-700 font-semibold')
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
                  const barNum = Math.floor(beat / beatsPerBar);

                  // Check for note
                  const noteAtCell = getNoteAtCell(t, row.note);
                  const isNoteStart = noteAtCell && Math.abs(noteAtCell.note.t - t) < 0.0001;
                  const isSelected = noteAtCell && selectedNotes.has(noteAtCell.index);

                  // Calculate note width
                  let notePixelWidth = 0;
                  if (isNoteStart && noteAtCell) {
                    notePixelWidth = noteAtCell.note.d * totalColumns * CELL_WIDTH;
                  }

                  const cell: GridCell = { col, row: rowIndex, noteNumber: row.note, t };

                  return (
                    <div
                      key={col}
                      className={cn(
                        'relative border-r border-b cursor-crosshair transition-colors',
                        isBarStart
                          ? isDark ? 'border-r-indigo-500/50' : 'border-r-indigo-300'
                          : isDownbeat
                            ? isDark ? 'border-r-gray-500/70' : 'border-r-slate-300'
                            : isDark ? 'border-r-gray-700/50' : 'border-r-slate-200',
                        isDark ? 'border-b-gray-700/50' : 'border-b-slate-200',
                        // Row highlighting
                        isC && !noteAtCell && (isDark ? 'bg-gray-800/40' : 'bg-slate-50/60'),
                        // Bar alternation
                        barNum % 2 === 1 && !noteAtCell && (isDark ? 'bg-gray-800/20' : 'bg-slate-50/40'),
                        // Hover
                        !noteAtCell && (isDark ? 'hover:bg-indigo-500/10' : 'hover:bg-indigo-50')
                      )}
                      style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                      onMouseDown={(e) => handleCellMouseDown(cell, e)}
                      onMouseEnter={() => handleCellEnter(cell)}
                    >
                      {/* Render note */}
                      {isNoteStart && noteAtCell && (
                        <div
                          className={cn(
                            'absolute top-0.5 bottom-0.5 left-0 rounded-sm cursor-pointer z-10',
                            'transition-shadow',
                            isSelected ? 'ring-2 ring-orange-400 ring-offset-1' : 'hover:brightness-110',
                            isDragging && isSelected ? 'opacity-60' : ''
                          )}
                          style={{
                            width: Math.max(MIN_NOTE_WIDTH, notePixelWidth - 2),
                            backgroundColor: getVelocityColor(noteAtCell.note.v, isSelected || false),
                            transform: isDragging && isSelected ? `translateX(${dragOffset * CELL_WIDTH}px)` : undefined,
                          }}
                        >
                          {/* Extend handle - visible on wider notes */}
                          {notePixelWidth > CELL_WIDTH && (
                            <div
                              className={cn(
                                'absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-sm',
                                'transition-colors',
                                isDark ? 'hover:bg-white/20' : 'hover:bg-black/10'
                              )}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsExtending(true);
                                setExtendNoteIndex(noteAtCell.index);
                                setExtendOriginalDuration(noteAtCell.note.d);
                                setExtendStartX(e.clientX);
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Help text */}
      <div className={cn(
        'mt-2 text-xs flex items-center gap-4 flex-wrap',
        isDark ? 'text-gray-500' : 'text-slate-400'
      )}>
        <span>Click to add • Click note to play</span>
        <span>Alt+click to remove</span>
        <span>Shift+click to select</span>
        <span>Drag edge to extend</span>
        <span>Ctrl+C to copy</span>
      </div>
    </div>
  );
}
