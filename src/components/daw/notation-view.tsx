'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNotationStore, type NotationFormat, type Chord, type SongSection } from '@/stores/notation-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
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
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface NotationViewProps {
  isMaster: boolean;
  roomId: string;
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
}: {
  chords: Chord[];
  sections: SongSection[];
  currentBeat: number;
  showDiagrams: boolean;
  diagramSize: 'small' | 'medium' | 'large';
  isEditable: boolean;
  onChordClick?: (index: number) => void;
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
      {chordsBySection.map(({ section, chords: sectionChords }, sectionIdx) => (
        <div key={section?.id || 'no-section'} className="space-y-3">
          {section && (
            <SectionHeader
              section={section}
              isActive={currentBeat >= section.startBeat && currentBeat < section.endBeat}
              isEditable={isEditable}
            />
          )}

          <div className={cn(
            'flex flex-wrap gap-3',
            showDiagrams ? 'gap-4' : 'gap-2'
          )}>
            {sectionChords.map((chord, idx) => {
              const isActive = currentBeat >= chord.startBeat &&
                currentBeat < chord.startBeat + chord.duration;
              const globalIdx = chords.indexOf(chord);

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
// Tab Notation Display (Placeholder)
// ============================================

function TabDisplay({
  isEditable,
}: {
  isEditable: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
      <Guitar className="w-12 h-12 mb-3 opacity-40" />
      <p className="text-sm font-medium">Tablature View</p>
      <p className="text-xs mt-1 opacity-60">
        Import a Guitar Pro or MusicXML file to display tabs
      </p>
      {isEditable && (
        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
          <Upload className="w-4 h-4" />
          <span className="text-sm">Import Tab File</span>
        </button>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function NotationView({ isMaster, roomId }: NotationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagrams, setShowDiagrams] = useState(true);
  const [isAddingChord, setIsAddingChord] = useState(false);
  const [newChordName, setNewChordName] = useState('');

  // Notation store
  const {
    format,
    key,
    tempo,
    chords,
    detectedChords,
    showDetectedChords,
    sections,
    currentSectionId,
    chordDiagramSize,
    highlightCurrentChord,
    autoScroll,
    isFollowing,
    currentBeat,
    isEditable,
    setFormat,
    addChord,
    removeChord,
    selectChord,
    selectedChordIndex,
    setChordDiagramSize,
    toggleDetectedChords,
    toggleAutoScroll,
    toggleFollowing,
    setEditable,
    setCurrentBeat,
    clear,
  } = useNotationStore();

  // Audio state for playback sync
  const { currentTime, isPlaying } = useAudioStore();
  const sessionTempo = useSessionTempoStore((s) => s.tempo);
  const sessionKey = useSessionTempoStore((s) => s.key);

  // Sync current beat with audio playback
  useEffect(() => {
    if (!isFollowing) return;
    // Convert time to beats (assuming 4/4 time)
    const beatsPerSecond = (sessionTempo || tempo) / 60;
    const beat = currentTime * beatsPerSecond;
    setCurrentBeat(beat);
  }, [currentTime, sessionTempo, tempo, isFollowing, setCurrentBeat]);

  // Set editability based on master status
  useEffect(() => {
    setEditable(isMaster);
  }, [isMaster, setEditable]);

  // Get active chords (manual or detected)
  const activeChords = useMemo(() => {
    if (showDetectedChords && detectedChords.length > 0) {
      return detectedChords;
    }
    return chords;
  }, [chords, detectedChords, showDetectedChords]);

  // Common chord presets for quick add
  const chordPresets: { name: string; frets: number[]; fingers: number[] }[] = [
    { name: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    { name: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    { name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    { name: 'Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  ];

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

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FormatSelector format={format} onChange={setFormat} />

            <div className="w-px h-5 bg-zinc-700" />

            {/* Key & Tempo display */}
            <div className="flex items-center gap-2 text-sm">
              {(sessionKey || key) && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/20 rounded text-indigo-300">
                  <span className="font-bold">{sessionKey || key}</span>
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded text-zinc-400">
                <span className="font-mono">{sessionTempo || tempo}</span>
                <span className="text-xs opacity-60">BPM</span>
              </div>
            </div>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {format === 'chord-chart' || format === 'nashville' || format === 'lead-sheet' ? (
          <ChordChartDisplay
            chords={activeChords}
            sections={sections}
            currentBeat={currentBeat}
            showDiagrams={showDiagrams && format === 'chord-chart'}
            diagramSize={chordDiagramSize}
            isEditable={isEditable}
            onChordClick={selectChord}
          />
        ) : format === 'tab' ? (
          <TabDisplay isEditable={isEditable} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">Sheet Music View</p>
            <p className="text-xs mt-1 opacity-60">
              Coming soon - Import MusicXML files
            </p>
          </div>
        )}
      </div>

      {/* Add Chord Panel (for room owner) */}
      {isEditable && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <AnimatePresence>
            {isAddingChord ? (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400">Quick Add Chord</span>
                    <button
                      onClick={() => setIsAddingChord(false)}
                      className="p-1 text-zinc-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {chordPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleAddChord(preset)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-sm font-medium text-white transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-2 flex items-center justify-center"
              >
                <button
                  onClick={() => setIsAddingChord(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Chord
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
