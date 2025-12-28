'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { useContextMenu } from '../ui/context-menu';
import {
  useLoopLibrary,
  getLoopsByCategory,
  getLoopsBySubcategory,
  getLoopById,
} from '@/hooks/use-loop-library';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useCustomLoopsStore } from '@/stores/custom-loops-store';
import { LoopCreatorModal } from './loop-creator-modal';
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
  PenTool,
  Heart,
  Trash2,
  Edit3,
  Copy,
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
  const { getAllLoops: getAllCustomLoops, deleteLoop: deleteCustomLoop, createLoop: createCustomLoop, setUserId, syncFromServer } = useCustomLoopsStore();
  const { showContextMenu, ContextMenuComponent } = useContextMenu();

  // Fetch loop library from API (with fallback to hardcoded data)
  const { categories: LOOP_CATEGORIES, loops: LOOP_LIBRARY, presets: INSTANT_BAND_PRESETS, isLoading: libraryLoading } = useLoopLibrary();

  // Dark mode detection
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, [isOpen]);

  // Sync user ID and fetch loops from server when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      setUserId(userId);
    }
  }, [isOpen, userId, setUserId]);

  // State
  const [selectedCategory, setSelectedCategory] = useState<LoopCategory | 'my-loops' | null>('drums');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bpmRange, setBpmRange] = useState<[number, number]>([60, 180]);
  const [intensityFilter, setIntensityFilter] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(0.7);

  // Creator modal state
  const [showCreator, setShowCreator] = useState(false);
  const [editingLoopId, setEditingLoopId] = useState<string | undefined>(undefined);

  // Get custom loops
  const customLoops = getAllCustomLoops();

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
    let loops: LoopDefinition[] = [];

    // Handle "my-loops" category
    if (selectedCategory === 'my-loops') {
      loops = customLoops;
    } else if (selectedCategory) {
      loops = getLoopsByCategory(LOOP_LIBRARY, selectedCategory);
    } else {
      loops = LOOP_LIBRARY;
    }

    // Apply subcategory filter (skip for custom loops)
    if (selectedSubcategory && selectedCategory !== 'my-loops') {
      loops = getLoopsBySubcategory(LOOP_LIBRARY, selectedSubcategory);
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
  }, [selectedCategory, selectedSubcategory, searchQuery, bpmRange, intensityFilter, customLoops, LOOP_LIBRARY]);

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
    // Use killAll for immediate stop without release envelope
    soundEngineRef.current?.killAll();
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

  // Duplicate a loop as a custom loop for editing
  const handleDuplicateAsCustom = useCallback(
    async (loop: LoopDefinition) => {
      const newLoop = await createCustomLoop({
        name: `${loop.name} (Copy)`,
        category: loop.category,
        subcategory: 'custom',
        bars: loop.bars,
        bpm: loop.bpm,
        timeSignature: loop.timeSignature,
        midiData: [...loop.midiData],
        soundPreset: loop.soundPreset,
        tags: ['custom', ...loop.tags],
        intensity: loop.intensity,
        complexity: loop.complexity,
        key: loop.key,
      });
      // Open editor for the new custom loop
      setEditingLoopId(newLoop.id);
      setShowCreator(true);
    },
    [createCustomLoop]
  );

  // Handle right-click on a loop
  const handleLoopContextMenu = useCallback(
    (e: React.MouseEvent, loop: LoopDefinition, isCustom: boolean) => {
      const items = [];

      if (isCustom) {
        items.push({
          label: 'Edit Loop',
          icon: <Edit3 className="w-4 h-4" />,
          onClick: () => {
            setEditingLoopId(loop.id);
            setShowCreator(true);
          },
        });
        items.push({
          label: 'Duplicate',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => handleDuplicateAsCustom(loop),
        });
        items.push({ divider: true, label: '', onClick: () => {} });
        items.push({
          label: 'Delete Loop',
          icon: <Trash2 className="w-4 h-4" />,
          danger: true,
          onClick: () => {
            if (confirm('Delete this loop? This cannot be undone.')) {
              deleteCustomLoop(loop.id);
            }
          },
        });
      } else {
        items.push({
          label: 'Duplicate & Edit',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => handleDuplicateAsCustom(loop),
        });
      }

      items.push({ divider: true, label: '', onClick: () => {} });
      items.push({
        label: 'Add to Session',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => handleAddLoop(loop),
      });

      showContextMenu(e, items);
    },
    [showContextMenu, handleDuplicateAsCustom, handleAddLoop, deleteCustomLoop]
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
      className="max-w-5xl"
    >
      <div className="flex h-[600px] -mx-6 -mb-6">
        {/* Sidebar - Categories */}
        <div className={cn(
          "w-56 border-r flex flex-col",
          isDark ? "border-gray-700 bg-gray-800" : "border-slate-200 bg-slate-50"
        )}>
          <div className={cn("p-4 border-b", isDark ? "border-gray-700" : "border-slate-200")}>
            <div className={cn(
              "text-xs font-semibold uppercase tracking-wider mb-2",
              isDark ? "text-gray-400" : "text-slate-500"
            )}>
              Categories
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {/* Create Loop Button */}
            <button
              onClick={() => {
                setEditingLoopId(undefined);
                setShowCreator(true);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-lg text-left transition-colors',
                'bg-indigo-500 hover:bg-indigo-600 text-white'
              )}
            >
              <PenTool className="w-4 h-4" />
              <span className="font-medium text-sm">Create Loop</span>
            </button>

            {/* My Loops Section */}
            {customLoops.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={() => {
                    setSelectedCategory('my-loops');
                    setSelectedSubcategory(null);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                    selectedCategory === 'my-loops'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : isDark
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-slate-100 text-slate-700'
                  )}
                >
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span className="font-medium text-sm">My Loops</span>
                  <span className={cn('ml-auto text-xs', isDark ? 'text-gray-500' : 'text-slate-400')}>
                    {customLoops.length}
                  </span>
                </button>
              </div>
            )}

            {/* Divider */}
            <div className={cn('mb-3 border-b', isDark ? 'border-gray-700' : 'border-slate-200')} />

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
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : isDark
                        ? 'hover:bg-gray-700 text-gray-300'
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
                            ? isDark ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                            : isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-slate-100 text-slate-600'
                        )}
                      >
                        <ChevronRight className="w-3 h-3" />
                        <span>{sub.name}</span>
                        <span className={cn("ml-auto text-xs", isDark ? "text-gray-500" : "text-slate-400")}>{sub.loopCount}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Instant Band Section */}
            <div className={cn("mt-4 pt-4 border-t", isDark ? "border-gray-700" : "border-slate-200")}>
              <div className={cn("flex items-center gap-2 px-3 py-2", isDark ? "text-gray-300" : "text-slate-700")}>
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">Instant Band</span>
              </div>
              {INSTANT_BAND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    // Add all loops from preset
                    for (const loopId of preset.loops) {
                      const loop = getLoopById(LOOP_LIBRARY, loopId);
                      if (loop) {
                        handleAddLoop(loop);
                      }
                    }
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm",
                    isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-slate-100 text-slate-600"
                  )}
                >
                  <Music className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{preset.name}</div>
                    <div className={cn("text-xs truncate", isDark ? "text-gray-500" : "text-slate-400")}>{preset.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search and Filters */}
          <div className={cn("p-4 border-b space-y-3", isDark ? "border-gray-700" : "border-slate-200")}>
            {/* Search */}
            <div className="relative">
              <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-gray-500" : "text-slate-400")} />
              <input
                type="text"
                placeholder="Search loops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full h-10 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400"
                )}
              />
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-4">
              {/* BPM Range */}
              <div className="flex items-center gap-2">
                <Gauge className={cn("w-4 h-4", isDark ? "text-gray-500" : "text-slate-400")} />
                <span className={cn("text-sm", isDark ? "text-gray-400" : "text-slate-600")}>BPM:</span>
                <input
                  type="number"
                  value={bpmRange[0]}
                  onChange={(e) => setBpmRange([parseInt(e.target.value) || 40, bpmRange[1]])}
                  className={cn(
                    "w-14 h-7 px-2 text-sm text-center rounded-md",
                    isDark ? "bg-gray-700 border-gray-600 text-white" : "border border-slate-200"
                  )}
                  min={40}
                  max={200}
                />
                <span className={isDark ? "text-gray-500" : "text-slate-400"}>-</span>
                <input
                  type="number"
                  value={bpmRange[1]}
                  onChange={(e) => setBpmRange([bpmRange[0], parseInt(e.target.value) || 200])}
                  className={cn(
                    "w-14 h-7 px-2 text-sm text-center rounded-md",
                    isDark ? "bg-gray-700 border-gray-600 text-white" : "border border-slate-200"
                  )}
                  min={40}
                  max={200}
                />
              </div>

              {/* Intensity Filter */}
              <div className="flex items-center gap-2">
                <Layers className={cn("w-4 h-4", isDark ? "text-gray-500" : "text-slate-400")} />
                <span className={cn("text-sm", isDark ? "text-gray-400" : "text-slate-600")}>Energy:</span>
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
                          : isDark
                            ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
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
                <Volume2 className={cn("w-4 h-4", isDark ? "text-gray-500" : "text-slate-400")} />
                <div className="w-20">
                  <Slider
                    value={previewVolume}
                    min={0}
                    max={1}
                    step={0.1}
                    onChange={(e) => {
                      const vol = parseFloat(e.target.value);
                      setPreviewVolume(vol);
                      if (soundEngineRef.current) {
                        soundEngineRef.current.setMasterVolume(vol);
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
              <div className={cn("flex flex-col items-center justify-center h-full", isDark ? "text-gray-500" : "text-slate-400")}>
                <Music className="w-12 h-12 mb-2" />
                <p>No loops found matching your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLoops.map((loop) => {
                  const isCustom = 'isCustom' in loop && loop.isCustom === true;
                  return (
                    <LoopCard
                      key={loop.id}
                      loop={loop}
                      isPlaying={previewingLoopId === loop.id}
                      isDark={isDark}
                      isCustom={isCustom}
                      categories={LOOP_CATEGORIES}
                      onPlay={() => {
                        if (previewingLoopId === loop.id) {
                          stopPreview();
                        } else {
                          playPreview(loop);
                        }
                      }}
                      onAdd={() => handleAddLoop(loop)}
                      onEdit={isCustom ? () => {
                        setEditingLoopId(loop.id);
                        setShowCreator(true);
                      } : undefined}
                      onDelete={isCustom ? () => {
                        if (confirm('Delete this loop? This cannot be undone.')) {
                          deleteCustomLoop(loop.id);
                        }
                      } : undefined}
                      onContextMenu={(e) => handleLoopContextMenu(e, loop, isCustom)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={cn("p-4 border-t", isDark ? "border-gray-700 bg-gray-800" : "border-slate-200 bg-slate-50")}>
            <div className="flex items-center justify-between">
              <div className={cn("text-sm", isDark ? "text-gray-400" : "text-slate-500")}>
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

      {/* Loop Creator Modal */}
      <LoopCreatorModal
        isOpen={showCreator}
        onClose={() => {
          setShowCreator(false);
          setEditingLoopId(undefined);
        }}
        editingLoopId={editingLoopId}
        onSave={(loop) => {
          // Optionally add the newly created loop to the session
          // handleAddLoop(loop);
        }}
      />

      {/* Context Menu */}
      {ContextMenuComponent}
    </Modal>
  );
}

// Loop Card Component
interface LoopCardProps {
  loop: LoopDefinition;
  isPlaying: boolean;
  isDark: boolean;
  isCustom?: boolean;
  categories: { id: string; icon: string }[];
  onPlay: () => void;
  onAdd: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function LoopCard({ loop, isPlaying, isDark, isCustom, categories, onPlay, onAdd, onEdit, onDelete, onContextMenu }: LoopCardProps) {
  const categoryIcon =
    categories.find((c) => c.id === loop.category)?.icon || '🎵';

  return (
    <div
      className={cn(
        'relative p-3 border rounded-xl transition-all group',
        isDark ? 'bg-gray-800' : 'bg-white',
        isPlaying
          ? isDark ? 'border-indigo-500 ring-2 ring-indigo-900/50' : 'border-indigo-400 ring-2 ring-indigo-100'
          : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-slate-200 hover:border-slate-300'
      )}
      onContextMenu={onContextMenu}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{isCustom ? '✏️' : categoryIcon}</span>
        <div className="flex-1 min-w-0">
          <div className={cn("font-medium truncate", isDark ? "text-white" : "text-slate-900")}>{loop.name}</div>
          <div className={cn("text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
            {loop.bpm} BPM • {loop.bars} {loop.bars === 1 ? 'bar' : 'bars'}
            {loop.key && ` • ${loop.key}`}
          </div>
        </div>
        {/* Edit/Delete buttons for custom loops */}
        {isCustom && (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              className={cn(
                'p-1 rounded hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors',
                isDark ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
              )}
              title="Edit loop"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
              className={cn(
                'p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors',
                'text-red-400 hover:text-red-600'
              )}
              title="Delete loop"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {loop.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className={cn(
              "px-1.5 py-0.5 rounded text-xs",
              isDark ? "bg-gray-700 text-gray-300" : "bg-slate-100 text-slate-600"
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Intensity/Complexity Bars */}
      <div className={cn("flex items-center gap-4 mb-3 text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
        <div className="flex items-center gap-1">
          <span>Energy</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'w-2 h-2 rounded-full',
                  level <= loop.intensity ? 'bg-orange-400' : isDark ? 'bg-gray-600' : 'bg-slate-200'
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
                  level <= loop.complexity ? 'bg-blue-400' : isDark ? 'bg-gray-600' : 'bg-slate-200'
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
              : isDark
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
