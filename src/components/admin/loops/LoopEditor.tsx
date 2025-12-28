'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteGridEditor } from '@/components/loops/note-grid-editor';
import type { LoopDefinition, LoopCategoryInfo, LoopCategory, MidiNote } from '@/types/loops';
import { getAllInstruments } from '@/lib/audio/instrument-registry';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { Play, Square, Save, X, Plus, Minus, Trash2 } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

interface LoopEditorProps {
  loop: LoopDefinition | null;
  categories: LoopCategoryInfo[];
  onSave: (loop: Partial<LoopDefinition>) => void;
  onClose: () => void;
}

export function LoopEditor({ loop, categories, onSave, onClose }: LoopEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [name, setName] = useState(loop?.name || '');
  const [category, setCategory] = useState(loop?.category || 'drums');
  const [subcategory, setSubcategory] = useState(loop?.subcategory || '');
  const [bpm, setBpm] = useState(loop?.bpm || 120);
  const [bars, setBars] = useState(loop?.bars || 1);
  const [timeSignature, setTimeSignature] = useState<[number, number]>(loop?.timeSignature || [4, 4]);
  const [key, setKey] = useState(loop?.key || '');
  const [soundPreset, setSoundPreset] = useState(loop?.soundPreset || 'drums/acoustic-kit');
  const [tags, setTags] = useState<string[]>(loop?.tags || []);
  const [intensity, setIntensity] = useState(loop?.intensity || 3);
  const [complexity, setComplexity] = useState(loop?.complexity || 2);
  const [midiData, setMidiData] = useState<MidiNote[]>(loop?.midiData || []);
  const [tagInput, setTagInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const loopStartTimeRef = useRef<number>(0);
  const triggeredNotesRef = useRef<Set<number>>(new Set());
  const lastPositionRef = useRef<number>(0);

  const instruments = getAllInstruments();
  const selectedCategory = categories.find(c => c.id === category);
  const subcategories = selectedCategory?.subcategories || [];

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPlayback();
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

  // Start playback
  const startPlayback = useCallback(async () => {
    if (midiData.length === 0) return;

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

    const update = () => {
      if (!audioContextRef.current) return;

      const now = audioContextRef.current.currentTime;
      const elapsed = now - loopStartTimeRef.current;
      const loopPosition = (elapsed % loopDuration) / loopDuration;

      // Check if we've looped back
      if (loopPosition < lastPositionRef.current - 0.5) {
        triggeredNotesRef.current.clear();
      }

      // Trigger notes
      for (let i = 0; i < midiData.length; i++) {
        const note = midiData[i];
        if (note.t >= lastPositionRef.current && note.t < loopPosition + 0.01) {
          if (!triggeredNotesRef.current.has(i)) {
            const noteDuration = Math.max(0.08, note.d * loopDuration);
            engine.playNote(soundPreset, note.n, note.v, undefined, noteDuration);
            triggeredNotesRef.current.add(i);
          }
        }
      }

      // Handle loop wrap
      if (lastPositionRef.current > 0.9 && loopPosition < 0.1) {
        for (let i = 0; i < midiData.length; i++) {
          const note = midiData[i];
          if (note.t < loopPosition + 0.01 && !triggeredNotesRef.current.has(i)) {
            const noteDuration = Math.max(0.08, note.d * loopDuration);
            engine.playNote(soundPreset, note.n, note.v, undefined, noteDuration);
            triggeredNotesRef.current.add(i);
          }
        }
      }

      lastPositionRef.current = loopPosition;
      setPlaybackPosition(loopPosition);
      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);
  }, [midiData, bars, timeSignature, bpm, soundPreset, initAudio]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    triggeredNotesRef.current.clear();
    lastPositionRef.current = 0;
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

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a loop name');
      return;
    }

    stopPlayback();
    onSave({
      name: name.trim(),
      category: category as LoopDefinition['category'],
      subcategory,
      bpm,
      bars,
      timeSignature,
      key: key || undefined,
      soundPreset,
      tags,
      intensity: intensity as LoopDefinition['intensity'],
      complexity: complexity as LoopDefinition['complexity'],
      midiData,
    });
  };

  const handleClose = () => {
    stopPlayback();
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleClearNotes = () => {
    stopPlayback();
    setMidiData([]);
  };

  // Compact select class
  const selectClass = cn(
    'h-7 px-2 rounded border text-xs font-medium',
    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200 text-gray-900'
  );

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      title={loop ? `Edit: ${loop.name}` : 'Create New Loop'}
      className="max-w-5xl"
    >
      <div className="flex flex-col gap-4">
        {/* Row 1: Name + Sound Preset + Category */}
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Loop name..."
            className="w-48 h-8 text-sm"
          />
          <select
            value={soundPreset}
            onChange={(e) => setSoundPreset(e.target.value)}
            className={cn(selectClass, 'w-44')}
          >
            {instruments.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.icon} {inst.name}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as LoopCategory);
              setSubcategory('');
            }}
            className={cn(selectClass, 'w-32')}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          {subcategories.length > 0 && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className={cn(selectClass, 'w-32')}
            >
              <option value="">Subcategory...</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Row 2: Musical settings (compact inline) */}
        <div className={cn(
          'flex items-center gap-4 px-3 py-2 rounded-lg flex-wrap',
          isDark ? 'bg-gray-800' : 'bg-slate-100'
        )}>
          {/* BPM */}
          <div className="flex items-center gap-1">
            <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>BPM</span>
            <button
              onClick={() => setBpm(Math.max(40, bpm - 5))}
              className={cn('w-5 h-5 flex items-center justify-center rounded', isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-200')}
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(40, Math.min(240, parseInt(e.target.value) || 120)))}
              className={cn('w-12 h-6 text-center rounded border text-xs font-medium', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200')}
            />
            <button
              onClick={() => setBpm(Math.min(240, bpm + 5))}
              className={cn('w-5 h-5 flex items-center justify-center rounded', isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-200')}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

          {/* Bars */}
          <div className="flex items-center gap-1">
            <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>Bars</span>
            <button
              onClick={() => setBars(Math.max(1, bars - 1))}
              className={cn('w-5 h-5 flex items-center justify-center rounded', isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-200')}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className={cn('w-6 h-6 flex items-center justify-center rounded border text-xs font-medium', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200')}>
              {bars}
            </span>
            <button
              onClick={() => setBars(Math.min(8, bars + 1))}
              className={cn('w-5 h-5 flex items-center justify-center rounded', isDark ? 'hover:bg-gray-700' : 'hover:bg-slate-200')}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

          {/* Time Signature */}
          <div className="flex items-center gap-1">
            <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>Time</span>
            <select
              value={`${timeSignature[0]}/${timeSignature[1]}`}
              onChange={(e) => {
                const [n, d] = e.target.value.split('/').map(Number);
                setTimeSignature([n, d]);
              }}
              className={cn('h-6 rounded border text-xs px-1 font-medium', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200')}
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
              <option value="5/4">5/4</option>
              <option value="7/8">7/8</option>
            </select>
          </div>

          <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

          {/* Key */}
          <div className="flex items-center gap-1">
            <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>Key</span>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={cn('h-6 rounded border text-xs px-1 font-medium', isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-200')}
            >
              <option value="">None</option>
              <option value="C">C</option>
              <option value="G">G</option>
              <option value="D">D</option>
              <option value="A">A</option>
              <option value="E">E</option>
              <option value="F">F</option>
              <option value="Bb">Bb</option>
              <option value="Am">Am</option>
              <option value="Em">Em</option>
              <option value="Dm">Dm</option>
            </select>
          </div>

          <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

          {/* Intensity */}
          <div className="flex items-center gap-1">
            <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>Int</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  onClick={() => setIntensity(i as LoopDefinition['intensity'])}
                  className={cn('text-sm', i <= intensity ? 'text-yellow-500' : isDark ? 'text-gray-600' : 'text-gray-300')}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className={cn('w-px h-4', isDark ? 'bg-gray-600' : 'bg-slate-300')} />

          {/* Complexity */}
          <div className="flex items-center gap-1">
            <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>Cmplx</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  onClick={() => setComplexity(i as LoopDefinition['complexity'])}
                  className={cn('text-sm', i <= complexity ? 'text-blue-500' : isDark ? 'text-gray-600' : 'text-gray-300')}
                >
                  ●
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Note Grid Editor */}
        <NoteGridEditor
          instrumentId={soundPreset}
          notes={midiData}
          bars={bars}
          timeSignature={timeSignature}
          bpm={bpm}
          onChange={setMidiData}
          isPlaying={isPlaying}
          playbackPosition={playbackPosition}
          isDark={isDark}
        />

        {/* Tags (compact) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-slate-500')}>Tags:</span>
          {tags.map(tag => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
              )}
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add tag..."
            className={cn(
              'w-24 h-6 px-2 rounded border text-xs',
              isDark ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-500' : 'bg-white border-slate-200 placeholder:text-slate-400'
            )}
          />
        </div>

        {/* Actions */}
        <div className={cn('flex items-center justify-between pt-3 border-t', isDark ? 'border-gray-700' : 'border-slate-200')}>
          <div className="flex items-center gap-2">
            <Button
              variant={isPlaying ? 'primary' : 'outline'}
              size="sm"
              onClick={togglePlayback}
              disabled={midiData.length === 0}
            >
              {isPlaying ? (
                <>
                  <Square className="w-3 h-3 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 mr-1" />
                  Preview
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearNotes}
              disabled={midiData.length === 0}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
            <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-slate-400')}>
              {midiData.length} notes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-3 h-3 mr-1" />
              {loop ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
