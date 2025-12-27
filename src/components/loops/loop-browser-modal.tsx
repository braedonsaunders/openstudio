'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import {
  LOOP_LIBRARY,
  LOOP_CATEGORIES,
  getLoopsByCategory,
  getLoopsBySubcategory,
  filterLoops,
  INSTANT_BAND_PRESETS,
} from '@/lib/audio/loop-library';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import type { LoopDefinition, LoopCategory } from '@/types/loops';
import {
  Search,
  Play,
  Square,
  Plus,
  Sparkles,
  Music,
  Volume2,
  ChevronRight,
  Gauge,
  Layers,
} from 'lucide-react';

interface LoopBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  userName?: string;
  onAddLoop: (loop: LoopDefinition) => void;
}

export function LoopBrowserModal({
  isOpen,
  onClose,
  roomId,
  userId,
  userName,
  onAddLoop,
}: LoopBrowserModalProps) {
  const { previewingLoopId, setPreviewingLoop, masterTempo } = useLoopTracksStore();

  // State
  const [selectedCategory, setSelectedCategory] = useState<LoopCategory | null>('drums');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bpmRange, setBpmRange] = useState<[number, number]>([60, 180]);
  const [intensityFilter, setIntensityFilter] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(0.7);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const previewIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio on first play
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

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopPreview();
    }
    return () => {
      stopPreview();
    };
  }, [isOpen]);

  // Get filtered loops
  const filteredLoops = useMemo(() => {
    let loops = LOOP_LIBRARY;

    // Apply category filter
    if (selectedCategory) {
      loops = getLoopsByCategory(selectedCategory);
    }

    // Apply subcategory filter
    if (selectedSubcategory) {
      loops = getLoopsBySubcategory(selectedSubcategory);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      loops = loops.filter(
        (loop) =>
          loop.name.toLowerCase().includes(query) ||
          loop.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply BPM filter
    loops = loops.filter((loop) => loop.bpm >= bpmRange[0] && loop.bpm <= bpmRange[1]);

    // Apply intensity filter
    if (intensityFilter !== null) {
      loops = loops.filter((loop) => loop.intensity === intensityFilter);
    }

    return loops;
  }, [selectedCategory, selectedSubcategory, searchQuery, bpmRange, intensityFilter]);

  // Preview a loop
  const playPreview = useCallback(
    async (loop: LoopDefinition) => {
      await initAudio();
      stopPreview();

      setPreviewingLoop(loop.id);
      setIsPlaying(true);

      const context = audioContextRef.current!;
      const engine = soundEngineRef.current!;
      engine.setMasterVolume(previewVolume);

      // Calculate loop timing
      const beatsPerBar = loop.timeSignature[0];
      const totalBeats = loop.bars * beatsPerBar;
      const beatDuration = 60 / masterTempo;
      const loopDuration = totalBeats * beatDuration;

      let loopStartTime = context.currentTime;

      const scheduleLoop = () => {
        const now = context.currentTime;

        // Schedule notes for current loop iteration
        for (const note of loop.midiData) {
          const noteTime = loopStartTime + note.t * loopDuration;
          if (noteTime >= now && noteTime < now + 0.1) {
            const noteDuration = note.d * loopDuration;
            engine.playNote(loop.soundPreset, note.n, note.v, noteTime, noteDuration);
          }
        }

        // Check if loop should restart
        if (now >= loopStartTime + loopDuration) {
          loopStartTime = now;
        }
      };

      // Schedule at 25ms intervals
      previewIntervalRef.current = setInterval(scheduleLoop, 25);
      scheduleLoop();
    },
    [initAudio, masterTempo, previewVolume, setPreviewingLoop]
  );

  const stopPreview = useCallback(() => {
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    soundEngineRef.current?.allNotesOff();
    setPreviewingLoop(null);
    setIsPlaying(false);
  }, [setPreviewingLoop]);

  const handleAddLoop = useCallback(
    (loop: LoopDefinition) => {
      stopPreview();
      onAddLoop(loop);
    },
    [onAddLoop, stopPreview]
  );

  // Get current category info
  const currentCategory = LOOP_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopPreview();
        onClose();
      }}
      title="Loop Library"
      description="Add drum beats, bass lines, and melodic loops to your session"
      className="max-w-4xl"
    >
      <div className="flex h-[600px] -mx-6 -mb-6">
        {/* Sidebar - Categories */}
        <div className="w-56 border-r border-slate-200 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Categories
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {LOOP_CATEGORIES.map((category) => (
              <div key={category.id} className="mb-1">
                <button
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSelectedSubcategory(null);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                    selectedCategory === category.id
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'hover:bg-slate-100 text-slate-700'
                  )}
                >
                  <span className="text-lg">{category.icon}</span>
                  <span className="font-medium text-sm">{category.name}</span>
                </button>

                {/* Subcategories */}
                {selectedCategory === category.id && (
                  <div className="ml-8 mt-1 space-y-0.5">
                    {category.subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubcategory(sub.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                          selectedSubcategory === sub.id
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'hover:bg-slate-100 text-slate-600'
                        )}
                      >
                        <ChevronRight className="w-3 h-3" />
                        <span>{sub.name}</span>
                        <span className="ml-auto text-xs text-slate-400">{sub.loopCount}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Instant Band Section */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 px-3 py-2 text-slate-700">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">Instant Band</span>
              </div>
              {INSTANT_BAND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    // Add all loops from preset
                    for (const loopId of preset.loops) {
                      const loop = LOOP_LIBRARY.find((l) => l.id === loopId);
                      if (loop) {
                        handleAddLoop(loop);
                      }
                    }
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-slate-100 text-slate-600 text-sm"
                >
                  <Music className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{preset.name}</div>
                    <div className="text-xs text-slate-400 truncate">{preset.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search and Filters */}
          <div className="p-4 border-b border-slate-200 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search loops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-4">
              {/* BPM Range */}
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">BPM:</span>
                <span className="text-sm font-medium text-slate-800 w-16">
                  {bpmRange[0]}-{bpmRange[1]}
                </span>
                <div className="w-32">
                  <Slider
                    value={bpmRange}
                    min={40}
                    max={200}
                    step={5}
                    onValueChange={(value) => setBpmRange(value as [number, number])}
                  />
                </div>
              </div>

              {/* Intensity Filter */}
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Energy:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() =>
                        setIntensityFilter(intensityFilter === level ? null : level)
                      }
                      className={cn(
                        'w-6 h-6 rounded-full text-xs font-medium transition-colors',
                        intensityFilter === level
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Volume */}
              <div className="flex items-center gap-2 ml-auto">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <div className="w-20">
                  <Slider
                    value={[previewVolume]}
                    min={0}
                    max={1}
                    step={0.1}
                    onValueChange={(value) => {
                      setPreviewVolume(value[0]);
                      if (soundEngineRef.current) {
                        soundEngineRef.current.setMasterVolume(value[0]);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loop Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredLoops.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Music className="w-12 h-12 mb-2" />
                <p>No loops found matching your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLoops.map((loop) => (
                  <LoopCard
                    key={loop.id}
                    loop={loop}
                    isPlaying={previewingLoopId === loop.id}
                    onPlay={() => {
                      if (previewingLoopId === loop.id) {
                        stopPreview();
                      } else {
                        playPreview(loop);
                      }
                    }}
                    onAdd={() => handleAddLoop(loop)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {filteredLoops.length} loops available
                {currentCategory && ` in ${currentCategory.name}`}
              </div>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Loop Card Component
interface LoopCardProps {
  loop: LoopDefinition;
  isPlaying: boolean;
  onPlay: () => void;
  onAdd: () => void;
}

function LoopCard({ loop, isPlaying, onPlay, onAdd }: LoopCardProps) {
  const categoryIcon =
    LOOP_CATEGORIES.find((c) => c.id === loop.category)?.icon || '🎵';

  return (
    <div
      className={cn(
        'relative p-3 bg-white border rounded-xl transition-all group',
        isPlaying ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{categoryIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 truncate">{loop.name}</div>
          <div className="text-xs text-slate-500">
            {loop.bpm} BPM • {loop.bars} {loop.bars === 1 ? 'bar' : 'bars'}
            {loop.key && ` • ${loop.key}`}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {loop.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Intensity/Complexity Bars */}
      <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span>Energy</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'w-2 h-2 rounded-full',
                  level <= loop.intensity ? 'bg-orange-400' : 'bg-slate-200'
                )}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span>Complex</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'w-2 h-2 rounded-full',
                  level <= loop.complexity ? 'bg-blue-400' : 'bg-slate-200'
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onPlay}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-sm font-medium transition-colors',
            isPlaying
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          )}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Preview
            </>
          )}
        </button>
        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-1.5 h-8 px-3 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Playing indicator */}
      {isPlaying && (
        <div className="absolute top-2 right-2">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 bg-indigo-500 rounded-full animate-pulse"
                style={{
                  height: `${8 + Math.random() * 8}px`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
