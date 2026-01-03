'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNotationStore, type NotationFormat, type Chord, type SongSection } from '@/stores/notation-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
import { useSongsStore } from '@/stores/songs-store';
import {
  Music,
  Guitar,
  FileText,
  Hash,
  BookOpen,
  Play,
  Pause,
  Settings2,
  Eye,
  EyeOff,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit3,
  Check,
  X,
  Upload,
  Download,
  Wand2,
  LayoutGrid,
  AlignLeft,
  ScrollText,
  RefreshCw,
  Sparkles,
  FileMusic,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { parseNotationFile, NOTATION_FILE_EXTENSIONS } from '@/lib/notation';
import { authFetchJson } from '@/lib/auth-fetch';

// ============================================
// Types
// ============================================

interface NotationViewProps {
  isMaster: boolean;
  roomId: string;
  onCreateSong?: () => void;
}

// ============================================
// Chord Diagram Component (Large)
// ============================================

function LargeChordDiagram({
  chord,
  size = 'medium',
  isActive,
  showFingers = true,
  onClick,
}: {
  chord: Chord;
  size?: 'small' | 'medium' | 'large';
  isActive?: boolean;
  showFingers?: boolean;
  onClick?: () => void;
}) {
  const stringCount = 6;
  const fretCount = 5;
  const frets = chord.frets || [0, 0, 2, 2, 2, 0]; // Default A chord
  const fingers = chord.fingers || [0, 0, 1, 2, 3, 0];

  const sizes = {
    small: { width: 70, height: 95, stringSpacing: 10, fretSpacing: 14, fontSize: 11 },
    medium: { width: 100, height: 135, stringSpacing: 14, fretSpacing: 20, fontSize: 15 },
    large: { width: 140, height: 190, stringSpacing: 20, fretSpacing: 28, fontSize: 20 },
  };

  const s = sizes[size];
  const startX = (s.width - (stringCount - 1) * s.stringSpacing) / 2;
  const startY = 32;

  return (
    <motion.div
      className={cn(
        'relative rounded-lg transition-all cursor-pointer',
        isActive
          ? 'bg-indigo-500/20 ring-2 ring-indigo-500'
          : 'bg-white/5 hover:bg-white/10'
      )}
      style={{ width: s.width + 16, height: s.height + 12, padding: 8 }}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={isActive ? { boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' } : {}}
    >
      <svg width={s.width} height={s.height} viewBox={`0 0 ${s.width} ${s.height}`}>
        {/* Chord name */}
        <text
          x={s.width / 2}
          y={18}
          textAnchor="middle"
          fill={isActive ? '#818cf8' : '#ffffff'}
          fontSize={s.fontSize}
          fontWeight="bold"
          fontFamily="system-ui"
        >
          {chord.name}
        </text>

        {/* Nut */}
        <rect
          x={startX - 2}
          y={startY}
          width={(stringCount - 1) * s.stringSpacing + 4}
          height={4}
          fill={isActive ? '#818cf8' : '#ffffff'}
          rx={1}
        />

        {/* Frets */}
        {Array.from({ length: fretCount }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={startX}
            y1={startY + (i + 1) * s.fretSpacing}
            x2={startX + (stringCount - 1) * s.stringSpacing}
            y2={startY + (i + 1) * s.fretSpacing}
            stroke="#ffffff"
            strokeWidth={1}
            opacity={0.3}
          />
        ))}

        {/* Strings */}
        {Array.from({ length: stringCount }).map((_, i) => (
          <line
            key={`string-${i}`}
            x1={startX + i * s.stringSpacing}
            y1={startY}
            x2={startX + i * s.stringSpacing}
            y2={startY + fretCount * s.fretSpacing}
            stroke="#ffffff"
            strokeWidth={i === 0 ? 2 : 1}
            opacity={0.5}
          />
        ))}

        {/* Finger positions */}
        {frets.map((fret, stringIdx) => {
          const x = startX + stringIdx * s.stringSpacing;

          if (fret === -1) {
            return (
              <text
                key={`mute-${stringIdx}`}
                x={x}
                y={startY - 6}
                textAnchor="middle"
                fill="#ef4444"
                fontSize={size === 'small' ? 9 : 11}
                fontWeight="bold"
              >
                ✕
              </text>
            );
          }

          if (fret === 0) {
            return (
              <circle
                key={`open-${stringIdx}`}
                cx={x}
                cy={startY - 7}
                r={size === 'small' ? 3.5 : 5}
                fill="none"
                stroke={isActive ? '#818cf8' : '#ffffff'}
                strokeWidth={2}
              />
            );
          }

          const y = startY + (fret - 0.5) * s.fretSpacing;
          return (
            <g key={`note-${stringIdx}`}>
              <circle
                cx={x}
                cy={y}
                r={size === 'small' ? 6 : size === 'medium' ? 8 : 10}
                fill={isActive ? '#818cf8' : '#ffffff'}
              />
              {showFingers && fingers[stringIdx] > 0 && (
                <text
                  x={x}
                  y={y + (size === 'small' ? 3 : 4)}
                  textAnchor="middle"
                  fill="#000000"
                  fontSize={size === 'small' ? 8 : 10}
                  fontWeight="bold"
                >
                  {fingers[stringIdx]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Confidence indicator */}
      {chord.confidence !== undefined && chord.confidence < 0.8 && (
        <div className="absolute top-1 right-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" title={`${Math.round(chord.confidence * 100)}% confidence`} />
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// Chord Symbol Display
// ============================================

function ChordSymbol({
  chord,
  isActive,
  size = 'medium',
  onClick,
}: {
  chord: Chord;
  isActive?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}) {
  const fontSizes = { small: 'text-lg', medium: 'text-2xl', large: 'text-4xl' };

  return (
    <motion.button
      className={cn(
        'px-3 py-1.5 rounded-lg font-bold transition-all',
        fontSizes[size],
        isActive
          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
          : 'bg-white/5 text-white/80 hover:bg-white/10'
      )}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {chord.name}
      {chord.bass && <span className="text-sm opacity-70">/{chord.bass}</span>}
    </motion.button>
  );
}

// ============================================
// Section Header
// ============================================

function SectionHeader({
  section,
  isActive,
  isEditable,
  onClick,
  onEdit,
  onDelete,
}: {
  section: SongSection;
  isActive?: boolean;
  isEditable: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const colors: Record<string, string> = {
    intro: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    verse: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    chorus: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
    bridge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    solo: 'bg-green-500/20 text-green-400 border-green-500/40',
    outro: 'bg-red-500/20 text-red-400 border-red-500/40',
    breakdown: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    custom: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all',
        colors[section.type] || colors.custom,
        isActive && 'ring-2 ring-white/20 scale-105'
      )}
      onClick={onClick}
    >
      <span className="text-sm font-semibold">{section.name}</span>
      {isEditable && (
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-0.5 rounded hover:bg-white/10"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-0.5 rounded hover:bg-white/10 text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Format Selector
// ============================================

function FormatSelector({
  format,
  onChange,
}: {
  format: NotationFormat;
  onChange: (format: NotationFormat) => void;
}) {
  const formats: { id: NotationFormat; icon: typeof Music; label: string }[] = [
    { id: 'chord-chart', icon: LayoutGrid, label: 'Chord Chart' },
    { id: 'tab', icon: Guitar, label: 'Tablature' },
    { id: 'sheet', icon: Music, label: 'Sheet Music' },
    { id: 'nashville', icon: Hash, label: 'Nashville' },
    { id: 'lead-sheet', icon: BookOpen, label: 'Lead Sheet' },
  ];

  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded-lg">
      {formats.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded transition-colors',
            format === id
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          )}
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================
// Nashville Number Conversion
// ============================================

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function chordToNashville(chordName: string, key: string | null): string {
  if (!key) return chordName;

  // Parse chord root
  let root = chordName[0].toUpperCase();
  let modifier = '';
  let quality = '';

  if (chordName.length > 1 && (chordName[1] === '#' || chordName[1] === 'b')) {
    modifier = chordName[1];
    quality = chordName.slice(2);
  } else {
    quality = chordName.slice(1);
  }

  const fullRoot = root + modifier;

  // Get key root note
  let keyRoot = key[0].toUpperCase();
  if (key.length > 1 && (key[1] === '#' || key[1] === 'b')) {
    keyRoot += key[1];
  }

  // Find interval
  const keyIndex = NOTES.indexOf(keyRoot) !== -1 ? NOTES.indexOf(keyRoot) : FLAT_NOTES.indexOf(keyRoot);
  const chordIndex = NOTES.indexOf(fullRoot) !== -1 ? NOTES.indexOf(fullRoot) : FLAT_NOTES.indexOf(fullRoot);

  if (keyIndex === -1 || chordIndex === -1) return chordName;

  const interval = (chordIndex - keyIndex + 12) % 12;

  // Map interval to Nashville number
  const nashvilleMap: Record<number, string> = {
    0: '1', 1: '#1', 2: '2', 3: '#2', 4: '3', 5: '4',
    6: '#4', 7: '5', 8: '#5', 9: '6', 10: '#6', 11: '7'
  };

  let number = nashvilleMap[interval] || '?';

  // Add quality indicators
  if (quality.startsWith('m') && !quality.startsWith('maj')) {
    number = number.toLowerCase(); // Minor chords are lowercase
  } else if (quality.includes('dim')) {
    number += '°';
  } else if (quality.includes('aug')) {
    number += '+';
  }

  // Add 7th, etc.
  if (quality.includes('7')) {
    number += '7';
  } else if (quality.includes('maj7')) {
    number += 'maj7';
  }

  return number;
}

// ============================================
// Nashville Number Display
// ============================================

function NashvilleSymbol({
  chord,
  keyContext,
  isActive,
  size = 'medium',
  onClick,
}: {
  chord: Chord;
  keyContext: string | null;
  isActive?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}) {
  const fontSizes = { small: 'text-xl', medium: 'text-3xl', large: 'text-5xl' };
  const nashvilleNumber = chordToNashville(chord.name, keyContext);

  return (
    <motion.button
      className={cn(
        'px-4 py-2 rounded-lg font-bold transition-all font-mono',
        fontSizes[size],
        isActive
          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
          : 'bg-white/5 text-amber-200 hover:bg-white/10'
      )}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={chord.name}
    >
      {nashvilleNumber}
    </motion.button>
  );
}

// ============================================
// Chord Chart View
// ============================================

function ChordChartDisplay({
  chords,
  sections,
  currentBeat,
  showDiagrams,
  diagramSize,
  isEditable,
  onChordClick,
  format = 'chord-chart',
  keyContext,
  lyrics,
}: {
  chords: Chord[];
  sections: SongSection[];
  currentBeat: number;
  showDiagrams: boolean;
  diagramSize: 'small' | 'medium' | 'large';
  isEditable: boolean;
  onChordClick?: (index: number) => void;
  format?: 'chord-chart' | 'nashville' | 'lead-sheet';
  keyContext?: string | null;
  lyrics?: Array<{ text: string; startTime: number }>;
}) {
  // Group chords by section
  const chordsBySection = useMemo(() => {
    if (sections.length === 0) {
      return [{ section: null, chords }];
    }

    return sections.map((section) => ({
      section,
      chords: chords.filter(
        (c) => c.startBeat >= section.startBeat && c.startBeat < section.endBeat
      ),
    }));
  }, [chords, sections]);

  return (
    <div className="space-y-6">
      {/* Format indicator */}
      {format === 'nashville' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
          <Hash className="w-4 h-4 text-amber-400" />
          <span className="text-amber-200">Nashville Numbers</span>
          {keyContext && (
            <span className="text-amber-400 font-medium ml-auto">Key: {keyContext}</span>
          )}
        </div>
      )}

      {format === 'lead-sheet' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
          <BookOpen className="w-4 h-4 text-blue-400" />
          <span className="text-blue-200">Lead Sheet - Chords with Lyrics</span>
        </div>
      )}

      {chordsBySection.map(({ section, chords: sectionChords }, sectionIdx) => (
        <div key={section?.id || 'no-section'} className="space-y-3">
          {section && (
            <SectionHeader
              section={section}
              isActive={currentBeat >= section.startBeat && currentBeat < section.endBeat}
              isEditable={isEditable}
            />
          )}

          {/* Lead Sheet: Show chords above lyrics */}
          {format === 'lead-sheet' ? (
            <div className="space-y-1">
              {/* Chords row */}
              <div className="flex flex-wrap gap-4 text-lg font-bold text-indigo-400">
                {sectionChords.map((chord, idx) => {
                  const isActive = currentBeat >= chord.startBeat &&
                    currentBeat < chord.startBeat + chord.duration;
                  return (
                    <span
                      key={`${chord.name}-${chord.startBeat}`}
                      className={cn(
                        'px-2 py-0.5 rounded transition-colors',
                        isActive && 'bg-indigo-500/20'
                      )}
                    >
                      {chord.name}
                    </span>
                  );
                })}
              </div>
              {/* Lyrics row */}
              {lyrics && lyrics.length > 0 ? (
                <p className="text-zinc-300 text-lg leading-relaxed">
                  {lyrics.map(l => l.text).join(' ')}
                </p>
              ) : sectionChords.length > 0 && (
                <p className="text-zinc-600 text-sm italic">Add lyrics in Teleprompter view</p>
              )}
            </div>
          ) : (
            /* Standard chord display */
            <div className={cn(
              'flex flex-wrap gap-3',
              showDiagrams ? 'gap-4' : 'gap-2'
            )}>
              {sectionChords.map((chord, idx) => {
                const isActive = currentBeat >= chord.startBeat &&
                  currentBeat < chord.startBeat + chord.duration;
                const globalIdx = chords.indexOf(chord);

                if (format === 'nashville') {
                  return (
                    <NashvilleSymbol
                      key={`${chord.name}-${chord.startBeat}`}
                      chord={chord}
                      keyContext={keyContext || null}
                      isActive={isActive}
                      size={diagramSize}
                      onClick={() => onChordClick?.(globalIdx)}
                    />
                  );
                }

                return showDiagrams ? (
                  <LargeChordDiagram
                    key={`${chord.name}-${chord.startBeat}`}
                    chord={chord}
                    size={diagramSize}
                    isActive={isActive}
                    onClick={() => onChordClick?.(globalIdx)}
                  />
                ) : (
                  <ChordSymbol
                    key={`${chord.name}-${chord.startBeat}`}
                    chord={chord}
                    isActive={isActive}
                    size={diagramSize}
                    onClick={() => onChordClick?.(globalIdx)}
                  />
                );
              })}

              {sectionChords.length === 0 && (
                <div className="text-zinc-500 text-sm italic">No chords</div>
              )}
            </div>
          )}
        </div>
      ))}

      {chordsBySection.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
          <Music className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm font-medium">No chords yet</p>
          <p className="text-xs mt-1 opacity-60">
            {isEditable ? 'Add chords manually or detect from audio' : 'Waiting for chords to be added'}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// Tab Notation Display
// ============================================

function TabDisplay({
  isEditable,
  tracks,
  measures,
  currentBeat,
  onImport,
}: {
  isEditable: boolean;
  tracks: Array<{
    id: string;
    name: string;
    notes: Array<{
      pitch: string;
      duration: number;
      startBeat: number;
      string?: number;
      fret?: number;
      hammer?: boolean;
      pull?: boolean;
      slide?: 'up' | 'down';
      bend?: number;
      harmonic?: 'natural' | 'artificial';
      palmMute?: boolean;
      letRing?: boolean;
    }>;
    tuning?: string[];
  }>;
  measures: Array<{
    number: number;
    startBeat: number;
    duration: number;
  }>;
  currentBeat: number;
  onImport: () => void;
}) {
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0);
  const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
  const MEASURES_PER_ROW = 4;

  // Find tracks with notes
  const tracksWithNotes = tracks.filter(t => t.notes.length > 0);

  // Auto-select first track with notes
  useEffect(() => {
    if (tracksWithNotes.length > 0 && selectedTrackIdx >= tracksWithNotes.length) {
      setSelectedTrackIdx(0);
    }
  }, [tracksWithNotes.length, selectedTrackIdx]);

  const track = tracksWithNotes[selectedTrackIdx];

  if (!track || track.notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <Guitar className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Tablature View</p>
        <p className="text-xs mt-1 opacity-60">
          Import a Guitar Pro or MusicXML file to display tabs
        </p>
        <p className="text-xs mt-2 text-zinc-600">
          Use the "Import Tab/Sheet" button below
        </p>
      </div>
    );
  }

  // Group notes by measure
  const measureNotes = measures.map(measure => ({
    measure,
    notes: track.notes.filter(
      note => note.startBeat >= measure.startBeat &&
        note.startBeat < measure.startBeat + measure.duration
    ),
  }));

  // Group measures into rows
  const measureRows: typeof measureNotes[] = [];
  for (let i = 0; i < measureNotes.length; i += MEASURES_PER_ROW) {
    measureRows.push(measureNotes.slice(i, i + MEASURES_PER_ROW));
  }

  return (
    <div className="space-y-4 font-mono text-sm">
      {/* Track selector */}
      <div className="flex items-center gap-3 text-zinc-400 text-xs flex-wrap">
        <Guitar className="w-4 h-4" />
        {tracksWithNotes.length > 1 ? (
          <select
            value={selectedTrackIdx}
            onChange={(e) => setSelectedTrackIdx(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs"
          >
            {tracksWithNotes.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name} ({t.notes.length} notes)
              </option>
            ))}
          </select>
        ) : (
          <span className="font-medium">{track.name}</span>
        )}
        {track.tuning && (
          <span className="text-zinc-600">
            Tuning: {track.tuning.join(' ')}
          </span>
        )}
        <span className="text-zinc-600">({track.notes.length} notes)</span>
      </div>

      {/* Tab rows */}
      <div className="space-y-6">
        {measureRows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map(({ measure, notes }) => (
              <div
                key={measure.number}
                className={cn(
                  'flex-1 min-w-0 border-r border-zinc-600',
                  currentBeat >= measure.startBeat &&
                    currentBeat < measure.startBeat + measure.duration &&
                    'bg-indigo-500/10'
                )}
              >
                {/* Measure number */}
                <div className="text-[10px] text-zinc-600 mb-0.5 pl-1">
                  {measure.number}
                </div>

                {/* Tab staff */}
                <div className="relative">
                  {STRING_LABELS.map((label, stringIdx) => {
                    const stringNumber = stringIdx + 1;
                    const stringNotes = notes.filter(n => n.string === stringNumber);

                    return (
                      <div key={stringIdx} className="flex items-center h-4">
                        {measure.number === row[0].measure.number && (
                          <span className="w-3 text-zinc-500 text-[10px] shrink-0">{label}</span>
                        )}
                        <div className="flex-1 relative border-b border-zinc-700 h-full">
                          {stringNotes.map((note, noteIdx) => {
                            const position = ((note.startBeat - measure.startBeat) / measure.duration) * 100;
                            const isActive = currentBeat >= note.startBeat &&
                              currentBeat < note.startBeat + note.duration;

                            let displayFret = String(note.fret ?? '-');
                            if (note.hammer) displayFret += 'h';
                            if (note.pull) displayFret += 'p';
                            if (note.slide) displayFret = '/' + displayFret;

                            return (
                              <span
                                key={noteIdx}
                                className={cn(
                                  'absolute -translate-x-1/2 -translate-y-1/2 top-1/2 text-[10px] leading-none',
                                  isActive ? 'text-indigo-400 font-bold' : 'text-white',
                                  note.palmMute && 'text-orange-400',
                                  note.letRing && 'text-green-400',
                                  note.harmonic && 'text-cyan-400'
                                )}
                                style={{ left: `${Math.max(8, Math.min(92, position))}%` }}
                              >
                                {displayFret}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
        <span><span className="text-white">h</span> = hammer-on</span>
        <span><span className="text-white">p</span> = pull-off</span>
        <span><span className="text-white">/</span> = slide</span>
        <span><span className="text-cyan-400">●</span> = harmonic</span>
        <span><span className="text-orange-400">●</span> = palm mute</span>
        <span><span className="text-green-400">●</span> = let ring</span>
      </div>
    </div>
  );
}

// ============================================
// Sheet Music Display (Basic)
// ============================================

const NOTE_POSITIONS: Record<string, number> = {
  'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6,
};

function SheetMusicDisplay({
  tracks,
  measures,
  currentBeat,
  onImport,
}: {
  tracks: Array<{
    id: string;
    name: string;
    notes: Array<{
      pitch: string;
      duration: number;
      startBeat: number;
      string?: number;
      fret?: number;
    }>;
  }>;
  measures: Array<{
    number: number;
    startBeat: number;
    duration: number;
  }>;
  currentBeat: number;
  onImport: () => void;
}) {
  const [selectedTrackIdx, setSelectedTrackIdx] = useState(0);
  const MEASURES_PER_ROW = 4;

  // Find tracks with notes
  const tracksWithNotes = tracks.filter(t => t.notes.length > 0);

  // Auto-select first track with notes
  useEffect(() => {
    if (tracksWithNotes.length > 0 && selectedTrackIdx >= tracksWithNotes.length) {
      setSelectedTrackIdx(0);
    }
  }, [tracksWithNotes.length, selectedTrackIdx]);

  const track = tracksWithNotes[selectedTrackIdx];

  if (!track || track.notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <Music className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">Sheet Music View</p>
        <p className="text-xs mt-1 opacity-60">
          Import a MusicXML or Guitar Pro file to display notation
        </p>
        <p className="text-xs mt-2 text-zinc-600">
          Use the "Import Tab/Sheet" button below
        </p>
      </div>
    );
  }

  // Get notes grouped by measure
  const measureNotes = measures.map(measure => ({
    measure,
    notes: track.notes.filter(
      note => note.startBeat >= measure.startBeat &&
        note.startBeat < measure.startBeat + measure.duration
    ),
  }));

  // Group measures into rows
  const measureRows: typeof measureNotes[] = [];
  for (let i = 0; i < measureNotes.length; i += MEASURES_PER_ROW) {
    measureRows.push(measureNotes.slice(i, i + MEASURES_PER_ROW));
  }

  // Parse pitch to get note position on staff
  const getNotePosition = (pitch: string): number => {
    // Handle tab format (string:fret) - convert to approximate position
    if (pitch.includes(':')) {
      const [string, fret] = pitch.split(':').map(Number);
      // Standard tuning MIDI: E4(64), B3(59), G3(55), D3(50), A2(45), E2(40)
      const stringMidi = [64, 59, 55, 50, 45, 40][string - 1] || 60;
      const midi = stringMidi + fret;
      // Convert MIDI to staff position (E4 = position 2 on treble clef)
      // E4 = 64, middle line (B4) = position 4
      return Math.round((midi - 64) * 0.5) + 2;
    }

    // Handle standard pitch format (e.g., "E4", "C#5")
    const match = pitch.match(/^([A-G])(#|b)?(\d+)$/);
    if (!match) return 0;

    const [, note, , octaveStr] = match;
    const octave = parseInt(octaveStr);
    const basePosition = NOTE_POSITIONS[note] || 0;
    // E4 = position 2, each octave is 7 positions
    return basePosition + (octave - 4) * 7;
  };

  // Staff lines (5 lines for treble clef)
  const STAFF_LINES = [0, 1, 2, 3, 4];

  return (
    <div className="space-y-4">
      {/* Track selector */}
      <div className="flex items-center gap-3 text-zinc-400 text-xs">
        <Music className="w-4 h-4" />
        {tracksWithNotes.length > 1 ? (
          <select
            value={selectedTrackIdx}
            onChange={(e) => setSelectedTrackIdx(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs"
          >
            {tracksWithNotes.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name} ({t.notes.length} notes)
              </option>
            ))}
          </select>
        ) : (
          <span className="font-medium">{track.name}</span>
        )}
        <span className="text-zinc-600">({track.notes.length} notes)</span>
      </div>

      {/* Staff rows */}
      <div className="space-y-8">
        {measureRows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map(({ measure, notes }, measureIdx) => (
              <div
                key={measure.number}
                className={cn(
                  'flex-1 relative h-20 border-r border-zinc-500',
                  currentBeat >= measure.startBeat &&
                    currentBeat < measure.startBeat + measure.duration &&
                    'bg-indigo-500/10'
                )}
              >
                {/* Measure number (first measure of row only) */}
                {measureIdx === 0 && (
                  <div className="absolute -top-4 left-1 text-[10px] text-zinc-600">
                    {measure.number}
                  </div>
                )}

                {/* Staff lines */}
                {STAFF_LINES.map((lineIdx) => (
                  <div
                    key={lineIdx}
                    className="absolute w-full h-px bg-zinc-600"
                    style={{ top: `${20 + lineIdx * 15}%` }}
                  />
                ))}

                {/* Notes */}
                {notes.map((note, noteIdx) => {
                  const position = ((note.startBeat - measure.startBeat) / measure.duration) * 100;
                  const staffPos = getNotePosition(note.pitch);
                  // Map staff position to vertical position (higher note = higher on staff)
                  // Position 0 = bottom line (E4), position 8 = top line (F5)
                  const topPercent = 80 - staffPos * 7.5;
                  const isActive = currentBeat >= note.startBeat &&
                    currentBeat < note.startBeat + note.duration;

                  return (
                    <div
                      key={noteIdx}
                      className={cn(
                        'absolute w-2.5 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2',
                        isActive
                          ? 'bg-indigo-500 border border-indigo-400'
                          : 'bg-white'
                      )}
                      style={{
                        left: `${Math.max(8, Math.min(92, position))}%`,
                        top: `${Math.max(10, Math.min(90, topPercent))}%`,
                      }}
                      title={note.pitch}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Note about limitations */}
      <div className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-800">
        Basic staff view • Note positions approximated from pitch/tab data
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function NotationView({ isMaster, roomId, onCreateSong }: NotationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagrams, setShowDiagrams] = useState(true);
  const [isAddingChord, setIsAddingChord] = useState(false);
  const [newChordName, setNewChordName] = useState('');

  // Notation store
  const {
    format,
    chords,
    detectedChords,
    showDetectedChords,
    sections,
    lyrics,
    chordDiagramSize,
    isFollowing,
    currentBeat,
    isEditable,
    importedTracks,
    importedMeasures,
    importedMetadata,
    isImporting,
    importError,
    setFormat,
    addChord,
    selectChord,
    selectedChordIndex,
    setChordDiagramSize,
    toggleDetectedChords,
    toggleFollowing,
    setEditable,
    setCurrentBeat,
    importNotation,
    setImporting,
    setImportError,
  } = useNotationStore();

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio state for playback sync
  const { currentTime, isPlaying } = useAudioStore();
  const sessionTempo = useSessionTempoStore((s) => s.tempo);
  const sessionKey = useSessionTempoStore((s) => s.key);

  // Sync current beat with audio playback
  useEffect(() => {
    if (!isFollowing) return;
    // Convert time to beats (assuming 4/4 time)
    const beatsPerSecond = (sessionTempo || 120) / 60;
    const beat = currentTime * beatsPerSecond;
    setCurrentBeat(beat);
  }, [currentTime, sessionTempo, isFollowing, setCurrentBeat]);

  // Set editability based on master status
  useEffect(() => {
    setEditable(isMaster);
  }, [isMaster, setEditable]);

  // Load notation/lyrics when song changes
  const currentSongId = useSongsStore((s) => s.currentSongId);
  const getCurrentSong = useSongsStore((s) => s.getSongById);
  const updateSong = useSongsStore((s) => s.updateSong);
  const songsLoading = useSongsStore((s) => s.isLoading);
  const getSongsByRoom = useSongsStore((s) => s.getSongsByRoom);
  const songs = getSongsByRoom(roomId);
  const { setSongContext, loadFromSong, getNotationData, isDirty, markClean } = useNotationStore();

  useEffect(() => {
    if (currentSongId) {
      const song = getCurrentSong(currentSongId);
      setSongContext(currentSongId, roomId);
      loadFromSong(song?.notation, song?.lyrics);
    }
  }, [currentSongId, roomId, getCurrentSong, setSongContext, loadFromSong]);

  // Auto-save notation when it changes
  useEffect(() => {
    if (!currentSongId || !isDirty) return;

    const saveTimeout = setTimeout(() => {
      const notationData = getNotationData();
      updateSong(currentSongId, { notation: notationData });
      markClean();
      console.log('Notation auto-saved');
    }, 1000); // Debounce 1 second

    return () => clearTimeout(saveTimeout);
  }, [currentSongId, isDirty, getNotationData, updateSong, markClean]);

  // Get active chords (manual or detected)
  const activeChords = useMemo(() => {
    if (showDetectedChords && detectedChords.length > 0) {
      return detectedChords;
    }
    return chords;
  }, [chords, detectedChords, showDetectedChords]);

  // Comprehensive chord library organized by category
  const chordLibrary: Record<string, { name: string; frets: number[]; fingers: number[] }[]> = {
    'Major': [
      { name: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
      { name: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
      { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
      { name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
      { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
      { name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
      { name: 'B', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1] },
    ],
    'Minor': [
      { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
      { name: 'Bm', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
      { name: 'Cm', frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1] },
      { name: 'Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
      { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
      { name: 'Fm', frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1] },
      { name: 'Gm', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1] },
    ],
    '7th': [
      { name: 'C7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
      { name: 'D7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
      { name: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
      { name: 'G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
      { name: 'A7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
      { name: 'B7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
    ],
    'Minor 7th': [
      { name: 'Am7', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
      { name: 'Bm7', frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1] },
      { name: 'Dm7', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
      { name: 'Em7', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
      { name: 'Gm7', frets: [3, 5, 3, 3, 3, 3], fingers: [1, 3, 1, 1, 1, 1] },
    ],
    'Major 7th': [
      { name: 'Cmaj7', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
      { name: 'Dmaj7', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] },
      { name: 'Fmaj7', frets: [1, -1, 2, 2, 1, 0], fingers: [1, 0, 3, 4, 2, 0] },
      { name: 'Gmaj7', frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
      { name: 'Amaj7', frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    ],
    'Sus/Add': [
      { name: 'Csus2', frets: [-1, 3, 0, 0, 1, 0], fingers: [0, 3, 0, 0, 1, 0] },
      { name: 'Dsus2', frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
      { name: 'Dsus4', frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
      { name: 'Esus4', frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
      { name: 'Asus2', frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
      { name: 'Asus4', frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
      { name: 'Cadd9', frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
      { name: 'Gadd9', frets: [3, 0, 0, 0, 0, 3], fingers: [2, 0, 0, 0, 0, 3] },
    ],
    'Diminished/Aug': [
      { name: 'Cdim', frets: [-1, 3, 4, 2, 4, -1], fingers: [0, 1, 3, 2, 4, 0] },
      { name: 'Ddim', frets: [-1, -1, 0, 1, 0, 1], fingers: [0, 0, 0, 1, 0, 2] },
      { name: 'Edim', frets: [0, 1, 2, 0, 2, 0], fingers: [0, 1, 2, 0, 3, 0] },
      { name: 'Caug', frets: [-1, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
      { name: 'Eaug', frets: [0, 3, 2, 1, 1, 0], fingers: [0, 4, 3, 1, 2, 0] },
    ],
    'Power': [
      { name: 'C5', frets: [-1, 3, 5, 5, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
      { name: 'D5', frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 2, 0] },
      { name: 'E5', frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0] },
      { name: 'F5', frets: [1, 3, 3, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
      { name: 'G5', frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
      { name: 'A5', frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0] },
    ],
  };

  // Flat list for quick access
  const chordPresets = Object.values(chordLibrary).flat();

  // Chord builder state
  const [showChordBuilder, setShowChordBuilder] = useState(false);
  const [customChordName, setCustomChordName] = useState('');
  const [customFrets, setCustomFrets] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Major');

  const handleAddChord = (preset: typeof chordPresets[0]) => {
    addChord({
      name: preset.name,
      root: preset.name.charAt(0),
      quality: preset.name.slice(1),
      startBeat: currentBeat,
      duration: 4, // 1 bar default
      frets: preset.frets,
      fingers: preset.fingers,
    });
    setIsAddingChord(false);
  };

  // Simulate chord detection (would call actual AI service)
  const handleDetectChords = async () => {
    // TODO: Integrate with Essentia.js chord detection
    console.log('Detecting chords from audio...');
  };

  // Handle tab/sheet music file upload
  const handleTabUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentSongId) return;

    setImporting(true);
    setImportError(null);

    try {
      // Parse the file locally
      const parsed = await parseNotationFile(file);

      // Upload to R2 for storage (requires auth)
      const presignResponse = await authFetchJson('/api/notation/upload', 'POST', {
        fileName: file.name,
        fileSize: file.size,
        songId: currentSongId,
        roomId,
      });

      let storageKey: string | undefined;

      if (presignResponse.ok) {
        const { uploadUrl, key } = await presignResponse.json();
        storageKey = key;

        // Upload file to R2
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
      }

      // Import the parsed notation into the store
      importNotation(parsed, {
        name: file.name,
        key: storageKey,
      });

      // Switch to tab view if we imported tabs
      if (parsed.tracks.some(t => t.notes.some(n => n.fret !== undefined))) {
        setFormat('tab');
      }
    } catch (error) {
      console.error('Tab import error:', error);
      setImportError((error as Error).message || 'Failed to import notation file');
    }

    e.target.value = '';
  }, [currentSongId, roomId, importNotation, setImporting, setImportError, setFormat]);

  // Trigger file import dialog
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FormatSelector format={format} onChange={setFormat} />

            <div className="w-px h-5 bg-zinc-700" />

            {/* Key display */}
            {sessionKey && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 rounded text-indigo-300 text-sm">
                <span className="font-bold">{sessionKey}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle options */}
            <button
              onClick={() => setShowDiagrams(!showDiagrams)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                showDiagrams
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              {showDiagrams ? <LayoutGrid className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
              {showDiagrams ? 'Diagrams' : 'Symbols'}
            </button>

            {detectedChords.length > 0 && (
              <button
                onClick={toggleDetectedChords}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                  showDetectedChords
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Wand2 className="w-3.5 h-3.5" />
                AI Detected
              </button>
            )}

            <button
              onClick={toggleFollowing}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                isFollowing
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <ScrollText className="w-3.5 h-3.5" />
              Follow
            </button>

            {isMaster && (
              <>
                <div className="w-px h-5 bg-zinc-700" />
                <button
                  onClick={handleDetectChords}
                  className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded text-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Detect
                </button>
              </>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'p-1.5 rounded transition-colors',
                showSettings
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">Diagram Size:</span>
                  <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setChordDiagramSize(size)}
                        className={cn(
                          'px-2 py-0.5 rounded capitalize transition-colors',
                          chordDiagramSize === size
                            ? 'bg-white/10 text-white'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 relative">
        {/* No Song Overlay */}
        {songs.length === 0 && !songsLoading && (
          <div className="absolute inset-0 z-10 bg-zinc-950/95 backdrop-blur-[1px] flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <Music className="w-6 h-6 text-zinc-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-400">No songs yet</p>
                <p className="text-xs text-zinc-600 mt-0.5">Create a song to add notation</p>
              </div>
              {onCreateSong && (
                <button
                  onClick={onCreateSong}
                  className="mt-1 px-3 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Song
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hidden file input for imports */}
        <input
          ref={fileInputRef}
          type="file"
          accept={NOTATION_FILE_EXTENSIONS.join(',')}
          onChange={handleTabUpload}
          className="hidden"
        />

        {/* Import status */}
        {isImporting && (
          <div className="flex items-center justify-center gap-2 py-4 text-indigo-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Importing notation file...</span>
          </div>
        )}

        {importError && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{importError}</span>
            <button
              onClick={() => setImportError(null)}
              className="ml-auto p-1 hover:bg-red-500/20 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Imported file info */}
        {importedMetadata?.sourceFile && (
          <div className="flex items-center gap-2 p-2 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs">
            <FileMusic className="w-4 h-4 shrink-0" />
            <span>
              Imported from: <span className="font-medium">{importedMetadata.sourceFile.name}</span>
            </span>
            {importedMetadata.title && (
              <span className="text-emerald-300">• {importedMetadata.title}</span>
            )}
            {importedMetadata.artist && (
              <span className="text-emerald-300/70">by {importedMetadata.artist}</span>
            )}
          </div>
        )}

        {format === 'chord-chart' || format === 'nashville' || format === 'lead-sheet' ? (
          <ChordChartDisplay
            chords={activeChords}
            sections={sections}
            currentBeat={currentBeat}
            showDiagrams={showDiagrams && format === 'chord-chart'}
            diagramSize={chordDiagramSize}
            isEditable={isEditable}
            onChordClick={selectChord}
            format={format}
            keyContext={sessionKey}
            lyrics={lyrics}
          />
        ) : format === 'tab' ? (
          <TabDisplay
            isEditable={isEditable}
            tracks={importedTracks}
            measures={importedMeasures}
            currentBeat={currentBeat}
            onImport={handleImportClick}
          />
        ) : format === 'sheet' ? (
          <SheetMusicDisplay
            tracks={importedTracks}
            measures={importedMeasures}
            currentBeat={currentBeat}
            onImport={handleImportClick}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">Unknown Format</p>
          </div>
        )}
      </div>

      {/* Add Chord Panel (for room owner) */}
      {isEditable && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isAddingChord ? (
              <motion.div
                key="chord-panel-expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-400">Add Chord</span>
                      <button
                        onClick={() => setShowChordBuilder(!showChordBuilder)}
                        className={cn(
                          'px-2 py-0.5 text-[10px] rounded transition-colors',
                          showChordBuilder
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-white/5 text-zinc-500 hover:text-white'
                        )}
                      >
                        {showChordBuilder ? 'Library' : 'Custom'}
                      </button>
                    </div>
                    <button
                      onClick={() => setIsAddingChord(false)}
                      className="p-1 text-zinc-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {showChordBuilder ? (
                    /* Custom Chord Builder */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customChordName}
                          onChange={(e) => setCustomChordName(e.target.value)}
                          placeholder="Chord name (e.g. Cmaj7)"
                          className="flex-1 px-2 py-1.5 text-sm bg-white/5 border border-zinc-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white placeholder-zinc-600"
                        />
                        <button
                          onClick={() => {
                            if (customChordName.trim()) {
                              addChord({
                                name: customChordName.trim(),
                                root: customChordName.charAt(0),
                                quality: customChordName.slice(1),
                                startBeat: currentBeat,
                                duration: 4,
                                frets: customFrets,
                                fingers: [0, 0, 0, 0, 0, 0],
                              });
                              setCustomChordName('');
                              setCustomFrets([0, 0, 0, 0, 0, 0]);
                              setIsAddingChord(false);
                            }
                          }}
                          disabled={!customChordName.trim()}
                          className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500 w-12">Frets:</span>
                        {customFrets.map((fret, idx) => (
                          <div key={idx} className="flex flex-col items-center">
                            <span className="text-[8px] text-zinc-600 mb-0.5">{['E', 'A', 'D', 'G', 'B', 'e'][idx]}</span>
                            <input
                              type="number"
                              min={-1}
                              max={12}
                              value={fret}
                              onChange={(e) => {
                                const newFrets = [...customFrets];
                                newFrets[idx] = parseInt(e.target.value) || 0;
                                setCustomFrets(newFrets);
                              }}
                              className="w-8 px-1 py-0.5 text-xs text-center bg-white/5 border border-zinc-700 rounded text-white"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-600">Use -1 for muted strings, 0 for open strings</p>
                    </div>
                  ) : (
                    /* Chord Library with Categories */
                    <div className="space-y-2">
                      {/* Category tabs */}
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(chordLibrary).map((category) => (
                          <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={cn(
                              'px-2 py-0.5 text-[10px] rounded transition-colors',
                              selectedCategory === category
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-white/5 text-zinc-500 hover:text-white'
                            )}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                      {/* Chord buttons for selected category */}
                      <div className="flex flex-wrap gap-1.5">
                        {chordLibrary[selectedCategory]?.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => handleAddChord(preset)}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-xs font-medium text-white transition-colors"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="chord-panel-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="p-2 flex items-center justify-center gap-2"
              >
                <button
                  onClick={() => setIsAddingChord(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Chord
                </button>
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors disabled:opacity-50"
                >
                  {isImporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Import Tab/Sheet
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Playback indicator */}
      {isPlaying && isFollowing && (
        <div className="absolute top-14 right-4 flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">Following</span>
        </div>
      )}
    </div>
  );
}
