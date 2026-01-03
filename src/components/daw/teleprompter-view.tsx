'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useNotationStore, type LyricLine } from '@/stores/notation-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSongsStore } from '@/stores/songs-store';
import {
  ScrollText,
  Settings2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  Minus,
  Edit3,
  Trash2,
  Upload,
  Download,
  Eye,
  EyeOff,
  Type,
  AlignCenter,
  AlignLeft,
  Moon,
  Sun,
  Music,
  Timer,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface TeleprompterViewProps {
  isMaster: boolean;
  roomId: string;
  onCreateSong?: () => void;
}

type ScrollMode = 'auto' | 'manual' | 'karaoke';
type TextAlign = 'left' | 'center';
type ThemeMode = 'dark' | 'light' | 'contrast';

// ============================================
// Lyric Line Component
// ============================================

function LyricLineDisplay({
  line,
  isActive,
  isPast,
  isUpcoming,
  progress,
  fontSize,
  textAlign,
  themeMode,
  isEditing,
  onEdit,
  onDelete,
  isEditable,
}: {
  line: LyricLine;
  isActive: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  progress: number; // 0-1 for karaoke highlighting
  fontSize: number;
  textAlign: TextAlign;
  themeMode: ThemeMode;
  isEditing?: boolean;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
  isEditable: boolean;
}) {
  const [editText, setEditText] = useState(line.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onEdit?.(editText);
  };

  const handleCancel = () => {
    setEditText(line.text);
    onEdit?.(line.text);
  };

  // Theme-based colors
  const colors = {
    dark: {
      active: 'text-white',
      past: 'text-zinc-600',
      upcoming: 'text-zinc-400',
      highlight: 'text-indigo-400',
    },
    light: {
      active: 'text-gray-900',
      past: 'text-gray-400',
      upcoming: 'text-gray-600',
      highlight: 'text-indigo-600',
    },
    contrast: {
      active: 'text-yellow-400',
      past: 'text-zinc-700',
      upcoming: 'text-zinc-300',
      highlight: 'text-yellow-300',
    },
  };

  const theme = colors[themeMode];

  if (isEditing) {
    return (
      <div className="flex items-start gap-2 py-2">
        <textarea
          ref={inputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className={cn(
            'flex-1 p-2 bg-white/5 border border-zinc-700 rounded-lg resize-none',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500'
          )}
          style={{ fontSize }}
          rows={2}
        />
        <div className="flex flex-col gap-1">
          <button
            onClick={handleSave}
            className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1.5 bg-zinc-700/50 text-zinc-400 rounded hover:bg-zinc-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Karaoke-style word highlighting
  const renderKaraokeText = () => {
    if (!isActive || !line.syllables || line.syllables.length === 0) {
      return line.text;
    }

    const currentTime = line.startTime + progress * (line.endTime - line.startTime);

    return line.syllables.map((syllable, idx) => {
      const isHighlighted = currentTime >= syllable.startTime;
      return (
        <span
          key={idx}
          className={cn(
            'transition-colors duration-100',
            isHighlighted ? theme.highlight : theme.active
          )}
        >
          {syllable.text}
        </span>
      );
    });
  };

  return (
    <motion.div
      className={cn(
        'relative py-2 transition-all duration-300 group',
        textAlign === 'center' ? 'text-center' : 'text-left',
        isPast && theme.past,
        isUpcoming && theme.upcoming,
        isActive && cn(theme.active, 'scale-105 font-semibold')
      )}
      style={{ fontSize }}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isActive ? 1 : isPast ? 0.4 : 0.7,
        y: 0,
        scale: isActive ? 1.05 : 1,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Active line indicator */}
      {isActive && (
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full"
          layoutId="active-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}

      {/* Lyric text */}
      <div className={cn('px-4', isActive && 'pl-6')}>
        {progress > 0 && isActive ? renderKaraokeText() : line.text}
      </div>

      {/* Edit controls (hover) */}
      {isEditable && !isActive && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button
            onClick={() => onEdit?.(line.text)}
            className="p-1 text-zinc-500 hover:text-white hover:bg-white/10 rounded"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// Countdown Timer
// ============================================

function CountdownTimer({
  seconds,
  isVisible,
}: {
  seconds: number;
  isVisible: boolean;
}) {
  if (!isVisible || seconds <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
    >
      <div className="text-9xl font-bold text-white/20">
        {Math.ceil(seconds)}
      </div>
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function TeleprompterView({ isMaster, roomId, onCreateSong }: TeleprompterViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scrollMode, setScrollMode] = useState<ScrollMode>('auto');
  const [fontSize, setFontSize] = useState(28);
  const [textAlign, setTextAlign] = useState<TextAlign>('center');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [showCountdown, setShowCountdown] = useState(true);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLineText, setNewLineText] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // Notation store (lyrics are stored here)
  const {
    lyrics,
    showLyrics,
    isEditable,
    addLyricLine,
    updateLyricLine,
    removeLyricLine,
    setEditable,
  } = useNotationStore();

  // Audio state
  const { currentTime, isPlaying, duration } = useAudioStore();

  // Set editability based on master status
  useEffect(() => {
    setEditable(isMaster);
  }, [isMaster, setEditable]);

  // Load lyrics when song changes
  const currentSongId = useSongsStore((s) => s.currentSongId);
  const getCurrentSong = useSongsStore((s) => s.getSongById);
  const songsLoading = useSongsStore((s) => s.isLoading);
  const getSongsByRoom = useSongsStore((s) => s.getSongsByRoom);
  const songs = getSongsByRoom(roomId);
  const { setSongContext, loadFromSong } = useNotationStore();

  useEffect(() => {
    if (currentSongId) {
      const song = getCurrentSong(currentSongId);
      setSongContext(currentSongId, roomId);
      loadFromSong(song?.notation, song?.lyrics);
    }
  }, [currentSongId, roomId, getCurrentSong, setSongContext, loadFromSong]);

  // Find current, past, and upcoming lines
  const { currentLine, pastLines, upcomingLines } = useMemo(() => {
    let current: LyricLine | null = null;
    const past: LyricLine[] = [];
    const upcoming: LyricLine[] = [];

    for (const line of lyrics) {
      if (currentTime >= line.startTime && currentTime < line.endTime) {
        current = line;
      } else if (currentTime >= line.endTime) {
        past.push(line);
      } else {
        upcoming.push(line);
      }
    }

    return { currentLine: current, pastLines: past, upcomingLines: upcoming };
  }, [lyrics, currentTime]);

  // Calculate progress within current line (for karaoke mode)
  const currentProgress = useMemo(() => {
    if (!currentLine) return 0;
    const lineProgress = (currentTime - currentLine.startTime) / (currentLine.endTime - currentLine.startTime);
    return Math.max(0, Math.min(1, lineProgress));
  }, [currentLine, currentTime]);

  // Auto-scroll to current line
  useEffect(() => {
    if (scrollMode !== 'auto' || !currentLine || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const currentElement = container.querySelector(`[data-line-id="${currentLine.id}"]`);

    if (currentElement) {
      const elementTop = (currentElement as HTMLElement).offsetTop;
      const containerHeight = container.clientHeight;
      const scrollTarget = elementTop - containerHeight / 3;

      container.scrollTo({
        top: scrollTarget,
        behavior: 'smooth',
      });
    }
  }, [currentLine?.id, scrollMode]);

  // Countdown before song starts
  useEffect(() => {
    if (!isPlaying || lyrics.length === 0) {
      setCountdownSeconds(0);
      return;
    }

    const firstLine = lyrics[0];
    if (currentTime < firstLine.startTime && currentTime >= 0) {
      setCountdownSeconds(firstLine.startTime - currentTime);
    } else {
      setCountdownSeconds(0);
    }
  }, [currentTime, isPlaying, lyrics]);

  // Handle adding new line
  const handleAddLine = () => {
    if (!newLineText.trim()) return;

    addLyricLine({
      text: newLineText.trim(),
      startTime: currentTime,
      endTime: currentTime + 4, // Default 4 second duration
    });

    setNewLineText('');
    setIsAddingLine(false);
  };

  // Handle line edit
  const handleEditLine = (id: string, text: string) => {
    updateLyricLine(id, { text });
    setEditingLineId(null);
  };

  // Theme backgrounds
  const themeBg = {
    dark: 'bg-zinc-950',
    light: 'bg-gray-100',
    contrast: 'bg-black',
  };

  const themeText = {
    dark: 'text-white',
    light: 'text-gray-900',
    contrast: 'text-white',
  };

  return (
    <div className={cn('h-full flex flex-col overflow-hidden relative', themeBg[themeMode], themeText[themeMode])}>
      {/* Countdown overlay */}
      <AnimatePresence>
        <CountdownTimer seconds={countdownSeconds} isVisible={showCountdown && countdownSeconds > 0} />
      </AnimatePresence>

      {/* Header */}
      <div className={cn(
        'shrink-0 h-12 flex items-center justify-between px-4 border-b',
        themeMode === 'light' ? 'border-gray-200 bg-white/80' : 'border-zinc-800 bg-zinc-900/80',
        'backdrop-blur-sm'
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <ScrollText className="w-4 h-4" />
            <span className="text-sm font-medium">Teleprompter</span>
          </div>

          <div className="w-px h-5 bg-zinc-700" />

          {/* Scroll mode */}
          <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded-lg">
            {(['auto', 'manual', 'karaoke'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setScrollMode(mode)}
                className={cn(
                  'px-2 py-1 rounded text-xs capitalize transition-colors',
                  scrollMode === mode
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Font size controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFontSize(Math.max(16, fontSize - 4))}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-400 w-8 text-center">{fontSize}</span>
            <button
              onClick={() => setFontSize(Math.min(64, fontSize + 4))}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-5 bg-zinc-700" />

          {/* Alignment */}
          <button
            onClick={() => setTextAlign(textAlign === 'center' ? 'left' : 'center')}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded"
          >
            {textAlign === 'center' ? <AlignCenter className="w-4 h-4" /> : <AlignLeft className="w-4 h-4" />}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'contrast' : 'dark')}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded"
          >
            {themeMode === 'dark' ? <Moon className="w-4 h-4" /> : themeMode === 'light' ? <Sun className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showSettings ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
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
            className={cn(
              'shrink-0 overflow-hidden border-b',
              themeMode === 'light' ? 'border-gray-200 bg-white/50' : 'border-zinc-800 bg-zinc-900/50'
            )}
          >
            <div className="p-3 flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showCountdown}
                  onChange={(e) => setShowCountdown(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                <span>Show countdown</span>
              </label>

              {isMaster && (
                <button
                  onClick={() => setIsAddingLine(true)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Lyric Line
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics display */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'flex-1 overflow-y-auto py-8 scroll-smooth relative',
          scrollMode === 'manual' && 'cursor-grab active:cursor-grabbing'
        )}
      >
        {/* No Song Overlay */}
        {songs.length === 0 && !songsLoading && (
          <div className={cn(
            'absolute inset-0 z-10 backdrop-blur-[1px] flex flex-col items-center justify-center',
            themeMode === 'light' ? 'bg-gray-100/95' : 'bg-zinc-950/95'
          )}>
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                themeMode === 'light' ? 'bg-gray-200/50' : 'bg-white/5'
              )}>
                <ScrollText className={cn(
                  'w-6 h-6',
                  themeMode === 'light' ? 'text-gray-400' : 'text-zinc-600'
                )} />
              </div>
              <div className="text-center">
                <p className={cn(
                  'text-sm font-medium',
                  themeMode === 'light' ? 'text-gray-500' : 'text-zinc-400'
                )}>No songs yet</p>
                <p className={cn(
                  'text-xs mt-0.5',
                  themeMode === 'light' ? 'text-gray-400' : 'text-zinc-600'
                )}>Create a song to add lyrics</p>
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

        {lyrics.length > 0 ? (
          <div className="max-w-4xl mx-auto px-4">
            {/* Past lines */}
            {pastLines.map((line) => (
              <div key={line.id} data-line-id={line.id}>
                <LyricLineDisplay
                  line={line}
                  isActive={false}
                  isPast={true}
                  isUpcoming={false}
                  progress={0}
                  fontSize={fontSize}
                  textAlign={textAlign}
                  themeMode={themeMode}
                  isEditing={editingLineId === line.id}
                  onEdit={(text) => handleEditLine(line.id, text)}
                  onDelete={() => removeLyricLine(line.id)}
                  isEditable={isEditable}
                />
              </div>
            ))}

            {/* Current line */}
            {currentLine && (
              <div data-line-id={currentLine.id}>
                <LyricLineDisplay
                  line={currentLine}
                  isActive={true}
                  isPast={false}
                  isUpcoming={false}
                  progress={scrollMode === 'karaoke' ? currentProgress : 0}
                  fontSize={fontSize * 1.2}
                  textAlign={textAlign}
                  themeMode={themeMode}
                  isEditable={isEditable}
                />
              </div>
            )}

            {/* Upcoming lines */}
            {upcomingLines.map((line) => (
              <div key={line.id} data-line-id={line.id}>
                <LyricLineDisplay
                  line={line}
                  isActive={false}
                  isPast={false}
                  isUpcoming={true}
                  progress={0}
                  fontSize={fontSize}
                  textAlign={textAlign}
                  themeMode={themeMode}
                  isEditing={editingLineId === line.id}
                  onEdit={(text) => handleEditLine(line.id, text)}
                  onDelete={() => removeLyricLine(line.id)}
                  isEditable={isEditable}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ScrollText className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No Lyrics</p>
            <p className="text-sm opacity-60 mb-4">
              {isEditable ? 'Add lyrics to display them here' : 'Waiting for lyrics to be added'}
            </p>
            {isEditable && (
              <button
                onClick={() => setIsAddingLine(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Line
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add line modal */}
      <AnimatePresence>
        {isAddingLine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
            onClick={() => setIsAddingLine(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Add Lyric Line</h3>
                <button
                  onClick={() => setIsAddingLine(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={newLineText}
                onChange={(e) => setNewLineText(e.target.value)}
                placeholder="Enter lyric text..."
                className="w-full p-3 bg-white/5 border border-zinc-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                autoFocus
              />

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Start: {currentTime.toFixed(1)}s</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddingLine(false)}
                    className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddLine}
                    disabled={!newLineText.trim()}
                    className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Line
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      {lyrics.length > 0 && duration > 0 && (
        <div className={cn(
          'shrink-0 h-1',
          themeMode === 'light' ? 'bg-gray-200' : 'bg-zinc-800'
        )}>
          <motion.div
            className="h-full bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${(currentTime / duration) * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}
    </div>
  );
}
