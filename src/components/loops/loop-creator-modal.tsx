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
  type InstrumentDefinition,
} from '@/lib/audio/instrument-registry';
import { SoundEngine } from '@/lib/audio/sound-engine';
import type { MidiNote, LoopCategory } from '@/types/loops';
import {
  Music,
  Play,
  Square,
  Save,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
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
  const [showSettings, setShowSettings] = useState(false);

  // Dark mode detection
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, [isOpen]);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Playback
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

    let loopStartTime = context.currentTime;

    const scheduleLoop = () => {
      const now = context.currentTime;

      for (const note of notes) {
        const noteTime = loopStartTime + note.t * loopDuration;
        if (noteTime >= now && noteTime < now + 0.1) {
          const noteDuration = note.d * loopDuration;
          engine.playNote(selectedInstrument, note.n, note.v, noteTime, noteDuration);
        }
      }

      if (now >= loopStartTime + loopDuration) {
        loopStartTime = now;
      }
    };

    playbackIntervalRef.current = setInterval(scheduleLoop, 25);
    scheduleLoop();
  }, [selectedInstrument, notes, bars, timeSignature, bpm, initAudio]);

  const stopPlayback = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    soundEngineRef.current?.allNotesOff();
    setIsPlaying(false);
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
        {/* Header with back button and loop name */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setStep('instrument')}
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
                'text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-indigo-500 outline-none px-1',
                isDark ? 'text-white' : 'text-slate-900'
              )}
              placeholder="Loop name..."
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                showSettings ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : ''
              )}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className={cn(
            'p-4 rounded-lg border space-y-4',
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'
          )}>
            <div className="grid grid-cols-3 gap-4">
              {/* BPM */}
              <div>
                <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-slate-600')}>
                  BPM
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={() => setBpm(Math.max(40, bpm - 5))}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
                    className={cn(
                      'w-16 h-8 text-center rounded border text-sm',
                      isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200'
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={() => setBpm(Math.min(240, bpm + 5))}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Bars */}
              <div>
                <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-slate-600')}>
                  Bars
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={() => setBars(Math.max(1, bars - 1))}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <input
                    type="number"
                    value={bars}
                    onChange={(e) => setBars(Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                    className={cn(
                      'w-12 h-8 text-center rounded border text-sm',
                      isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200'
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={() => setBars(Math.min(8, bars + 1))}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Time Signature */}
              <div>
                <label className={cn('block text-xs font-medium mb-1', isDark ? 'text-gray-400' : 'text-slate-600')}>
                  Time Sig
                </label>
                <select
                  value={`${timeSignature[0]}/${timeSignature[1]}`}
                  onChange={(e) => {
                    const [num, denom] = e.target.value.split('/').map(Number);
                    setTimeSignature([num, denom]);
                  }}
                  className={cn(
                    'w-full h-8 rounded border text-sm px-2',
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
        )}

        {/* Note Grid Editor */}
        <NoteGridEditor
          instrumentId={selectedInstrument || ''}
          notes={notes}
          bars={bars}
          timeSignature={timeSignature}
          bpm={bpm}
          onChange={setNotes}
          isDark={isDark}
        />

        {/* Action bar */}
        <div className={cn(
          'flex items-center justify-between pt-4 border-t',
          isDark ? 'border-gray-700' : 'border-slate-200'
        )}>
          <div className="flex items-center gap-2">
            <Button
              variant={isPlaying ? 'default' : 'outline'}
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
