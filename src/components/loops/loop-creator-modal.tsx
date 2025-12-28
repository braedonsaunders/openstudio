'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { NoteGridEditor } from './note-grid-editor';
import { useCustomLoopsStore, type CustomLoopDefinition } from '@/stores/custom-loops-store';
import {
  getAllInstruments,
  getAllCategories,
  getInstrument,
} from '@/lib/audio/instrument-registry';
import { SoundEngine } from '@/lib/audio/sound-engine';
import type { MidiNote, LoopCategory } from '@/types/loops';
import {
  Play,
  Square,
  Save,
  Trash2,
  ChevronLeft,
  Plus,
  Minus,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface LoopCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLoopId?: string; // If provided, edit existing loop
  onSave?: (loop: CustomLoopDefinition) => void;
}

type EditorStep = 'instrument' | 'editor';

// =============================================================================
// Component
// =============================================================================

export function LoopCreatorModal({
  isOpen,
  onClose,
  editingLoopId,
  onSave,
}: LoopCreatorModalProps) {
  // Store
  const { getLoop, createLoop, updateLoop } = useCustomLoopsStore();

  // State
  const [step, setStep] = useState<EditorStep>('instrument');
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);
  const [loopName, setLoopName] = useState('New Loop');
  const [bars, setBars] = useState(2);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4]);
  const [notes, setNotes] = useState<MidiNote[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // Dark mode detection
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, [isOpen]);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const loopStartTimeRef = useRef<number>(0);

  // Initialize if editing
  useEffect(() => {
    if (isOpen && editingLoopId) {
      const loop = getLoop(editingLoopId);
      if (loop) {
        setSelectedInstrument(loop.soundPreset);
        setLoopName(loop.name);
        setBars(loop.bars);
        setBpm(loop.bpm);
        setTimeSignature(loop.timeSignature);
        setNotes([...loop.midiData]);
        setStep('editor');
      }
    } else if (isOpen) {
      // Reset for new loop
      setStep('instrument');
      setSelectedInstrument(null);
      setLoopName('New Loop');
      setBars(2);
      setBpm(120);
      setTimeSignature([4, 4]);
      setNotes([]);
      setPlaybackPosition(0);
    }
  }, [isOpen, editingLoopId, getLoop]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopPlayback();
    }
    return () => stopPlayback();
  }, [isOpen]);

  // Get instruments by category
  const instrumentsByCategory = useMemo(() => {
    const categories = getAllCategories();
    const instruments = getAllInstruments();

    return categories.map((cat) => ({
      ...cat,
      instruments: instruments.filter((i) => i.category === cat.id),
    }));
  }, []);

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

  // Track which notes have been triggered in current loop
  const triggeredNotesRef = useRef<Set<number>>(new Set());
  const lastPositionRef = useRef<number>(0);

  // Playback with playhead - simplified approach
  const startPlayback = useCallback(async () => {
    if (!selectedInstrument || notes.length === 0) return;

    await initAudio();
    setIsPlaying(true);

    const context = audioContextRef.current!;
    const engine = soundEngineRef.current!;

    const beatsPerBar = timeSignature[0];
    const totalBeats = bars * beatsPerBar;
    const beatDuration = 60 / bpm;
    const loopDuration = totalBeats * beatDuration;

    loopStartTimeRef.current = context.currentTime;
    triggeredNotesRef.current.clear();
    lastPositionRef.current = 0;

    // Combined update function for both playhead and note triggering
    const update = () => {
      if (!audioContextRef.current) return;

      const now = audioContextRef.current.currentTime;
      const elapsed = now - loopStartTimeRef.current;
      const loopPosition = (elapsed % loopDuration) / loopDuration;

      // Check if we've looped back to the start
      if (loopPosition < lastPositionRef.current - 0.5) {
        // We've wrapped around, clear triggered notes
        triggeredNotesRef.current.clear();
      }

      // Trigger notes that the playhead has passed over
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        // Check if playhead just crossed this note's start position
        if (note.t >= lastPositionRef.current && note.t < loopPosition + 0.01) {
          if (!triggeredNotesRef.current.has(i)) {
            // Play this note NOW (undefined time = immediate)
            const noteDuration = Math.max(0.08, note.d * loopDuration);
            engine.playNote(selectedInstrument, note.n, note.v, undefined, noteDuration);
            triggeredNotesRef.current.add(i);
          }
        }
      }

      // Also check notes at the very beginning when we loop
      if (lastPositionRef.current > 0.9 && loopPosition < 0.1) {
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (note.t < loopPosition + 0.01 && !triggeredNotesRef.current.has(i)) {
            const noteDuration = Math.max(0.08, note.d * loopDuration);
            engine.playNote(selectedInstrument, note.n, note.v, undefined, noteDuration);
            triggeredNotesRef.current.add(i);
          }
        }
      }

      lastPositionRef.current = loopPosition;
      setPlaybackPosition(loopPosition);

      animationFrameRef.current = requestAnimationFrame(update);
    };

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(update);
  }, [selectedInstrument, notes, bars, timeSignature, bpm, initAudio]);

  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // Clear triggered notes
    triggeredNotesRef.current.clear();
    lastPositionRef.current = 0;
    // Use killAll for immediate stop
    soundEngineRef.current?.killAll();
    setIsPlaying(false);
    setPlaybackPosition(0);
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);

  // Handle instrument selection
  const handleSelectInstrument = (instrumentId: string) => {
    setSelectedInstrument(instrumentId);
    const instrument = getInstrument(instrumentId);
    if (instrument) {
      // Set reasonable defaults based on instrument type
      if (instrument.layout === 'drums') {
        setBars(2);
        setBpm(120);
      } else if (instrument.category === 'bass') {
        setBars(2);
        setBpm(120);
      } else {
        setBars(4);
        setBpm(100);
      }
    }
    setStep('editor');
  };

  // Handle bar changes - scale existing notes
  const handleBarsChange = (newBars: number) => {
    if (newBars === bars) return;

    // When reducing bars, remove notes that would be outside
    if (newBars < bars) {
      const maxT = newBars / bars;
      setNotes(notes.filter(n => n.t < maxT).map(n => ({
        ...n,
        t: n.t * (bars / newBars), // Scale time to new range
        d: n.d * (bars / newBars), // Scale duration
      })));
    } else {
      // When adding bars, scale notes to occupy same relative positions
      setNotes(notes.map(n => ({
        ...n,
        t: n.t * (bars / newBars),
        d: n.d * (bars / newBars),
      })));
    }

    setBars(newBars);
  };

  // Handle save
  const handleSave = async () => {
    if (!selectedInstrument) return;

    const instrument = getInstrument(selectedInstrument);
    const category = (instrument?.category || 'synth') as LoopCategory;

    if (editingLoopId) {
      await updateLoop(editingLoopId, {
        name: loopName,
        bars,
        bpm,
        timeSignature,
        midiData: notes,
        soundPreset: selectedInstrument,
      });
      const loop = getLoop(editingLoopId);
      if (loop) onSave?.(loop);
    } else {
      const loop = await createLoop({
        name: loopName,
        category,
        subcategory: 'custom',
        bars,
        bpm,
        timeSignature,
        midiData: notes,
        soundPreset: selectedInstrument,
        tags: ['custom', category],
        intensity: 3,
        complexity: Math.min(5, Math.max(1, Math.ceil(notes.length / 10))) as 1 | 2 | 3 | 4 | 5,
      });
      onSave?.(loop);
    }

    onClose();
  };

  // Handle clear notes
  const handleClearNotes = () => {
    stopPlayback();
    setNotes([]);
  };

  // Render instrument picker
  const renderInstrumentPicker = () => (
    <div className="space-y-6">
      <div className={cn('text-center mb-6', isDark ? 'text-gray-300' : 'text-slate-700')}>
        <h3 className="text-lg font-semibold mb-1">Choose an Instrument</h3>
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-slate-500')}>
          Select the sound you want to create a loop with
        </p>
      </div>

      {instrumentsByCategory.map((category) => (
        <div key={category.id}>
          <div className={cn(
            'flex items-center gap-2 mb-2 text-sm font-medium',
            isDark ? 'text-gray-400' : 'text-slate-500'
          )}>
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {category.instruments.map((instrument) => (
              <button
                key={instrument.id}
                onClick={() => handleSelectInstrument(instrument.id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all hover:scale-[1.02]',
                  isDark
                    ? 'bg-gray-800 border-gray-700 hover:border-indigo-500 hover:bg-gray-700'
                    : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{instrument.icon}</span>
                  <span className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-slate-900')}>
                    {instrument.name}
                  </span>
                </div>
                {instrument.description && (
                  <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-slate-400')}>
                    {instrument.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // Render loop editor
  const renderEditor = () => {
    const instrument = getInstrument(selectedInstrument || '');

    return (
      <div className="space-y-4">
        {/* Header with back button, loop name, and inline settings */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stopPlayback();
              setStep('instrument');
            }}
            className={isDark ? 'text-gray-400 hover:text-white' : ''}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xl">{instrument?.icon || '🎵'}</span>
            <input
              type="text"
              value={loopName}
              onChange={(e) => setLoopName(e.target.value)}
              className={cn(
                'text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-indigo-500 outline-none px-1 w-40',
                isDark ? 'text-white' : 'text-slate-900'
              )}
              placeholder="Loop name..."
            />
          </div>

          {/* Inline settings - no cogwheel! */}
          <div className={cn(
            'flex items-center gap-3 ml-auto px-3 py-1.5 rounded-lg',
            isDark ? 'bg-gray-800' : 'bg-slate-100'
          )}>
            {/* BPM */}
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>
                BPM
              </span>
              <button
                onClick={() => setBpm(Math.max(40, bpm - 5))}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded text-xs',
                  isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-slate-200 text-slate-600'
                )}
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                className={cn(
                  'w-12 h-6 text-center rounded border text-xs font-medium',
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200'
                )}
              />
              <button
                onClick={() => setBpm(Math.min(240, bpm + 5))}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded text-xs',
                  isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-slate-200 text-slate-600'
                )}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

            {/* Bars */}
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>
                Bars
              </span>
              <button
                onClick={() => handleBarsChange(Math.max(1, bars - 1))}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded text-xs',
                  isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-slate-200 text-slate-600'
                )}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className={cn(
                'w-6 h-6 flex items-center justify-center rounded border text-xs font-medium',
                isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200'
              )}>
                {bars}
              </span>
              <button
                onClick={() => handleBarsChange(Math.min(8, bars + 1))}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded text-xs',
                  isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-slate-200 text-slate-600'
                )}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

            {/* Time Signature */}
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>
                Time
              </span>
              <select
                value={`${timeSignature[0]}/${timeSignature[1]}`}
                onChange={(e) => {
                  const [num, denom] = e.target.value.split('/').map(Number);
                  setTimeSignature([num, denom]);
                }}
                className={cn(
                  'h-6 rounded border text-xs px-1 font-medium',
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200'
                )}
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
                <option value="2/4">2/4</option>
              </select>
            </div>
          </div>
        </div>

        {/* Note Grid Editor with playhead */}
        <NoteGridEditor
          instrumentId={selectedInstrument || ''}
          notes={notes}
          bars={bars}
          timeSignature={timeSignature}
          bpm={bpm}
          onChange={setNotes}
          isPlaying={isPlaying}
          playbackPosition={playbackPosition}
          isDark={isDark}
        />

        {/* Action bar */}
        <div className={cn(
          'flex items-center justify-between pt-4 border-t',
          isDark ? 'border-gray-700' : 'border-slate-200'
        )}>
          <div className="flex items-center gap-2">
            <Button
              variant={isPlaying ? 'primary' : 'outline'}
              onClick={togglePlayback}
              disabled={notes.length === 0}
            >
              {isPlaying ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Preview
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleClearNotes}
              disabled={notes.length === 0}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn('text-sm', isDark ? 'text-gray-500' : 'text-slate-400')}>
              {notes.length} notes
            </span>
            <Button
              onClick={handleSave}
              disabled={notes.length === 0 || !loopName.trim()}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Loop
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopPlayback();
        onClose();
      }}
      title={editingLoopId ? 'Edit Loop' : 'Create Loop'}
      description={step === 'instrument' ? 'Design your own custom loop pattern' : undefined}
      className="max-w-4xl"
    >
      <div className="-mx-6 -mb-6 px-6 pb-6">
        {step === 'instrument' ? renderInstrumentPicker() : renderEditor()}
      </div>
    </Modal>
  );
}
