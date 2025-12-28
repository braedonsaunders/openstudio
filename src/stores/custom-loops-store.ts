// Custom Loops Store - Zustand store for user-created loops with localStorage persistence

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LoopDefinition, MidiNote, LoopCategory } from '@/types/loops';

// =============================================================================
// Custom Loop Types
// =============================================================================

export interface CustomLoopDefinition extends LoopDefinition {
  // Custom loop specific fields
  isCustom: true;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;

  // Optional metadata
  description?: string;
  isFavorite?: boolean;
}

// =============================================================================
// Store State
// =============================================================================

interface CustomLoopsState {
  // All custom loops indexed by ID
  loops: Record<string, CustomLoopDefinition>;

  // Currently editing loop (in editor)
  editingLoopId: string | null;

  // Draft loop being created (before save)
  draftLoop: Partial<CustomLoopDefinition> | null;

  // Actions
  createLoop: (loop: Omit<CustomLoopDefinition, 'id' | 'isCustom' | 'createdAt' | 'updatedAt'>) => CustomLoopDefinition;
  updateLoop: (id: string, updates: Partial<CustomLoopDefinition>) => void;
  deleteLoop: (id: string) => void;
  duplicateLoop: (id: string) => CustomLoopDefinition | undefined;

  // Note editing
  addNote: (loopId: string, note: MidiNote) => void;
  removeNote: (loopId: string, noteIndex: number) => void;
  updateNote: (loopId: string, noteIndex: number, updates: Partial<MidiNote>) => void;
  clearNotes: (loopId: string) => void;

  // Draft management
  startDraft: (instrumentId: string) => void;
  updateDraft: (updates: Partial<CustomLoopDefinition>) => void;
  saveDraft: () => CustomLoopDefinition | undefined;
  discardDraft: () => void;

  // Editing state
  setEditingLoop: (loopId: string | null) => void;

  // Favorites
  toggleFavorite: (loopId: string) => void;

  // Query helpers
  getLoop: (id: string) => CustomLoopDefinition | undefined;
  getAllLoops: () => CustomLoopDefinition[];
  getLoopsByCategory: (category: LoopCategory) => CustomLoopDefinition[];
  getFavorites: () => CustomLoopDefinition[];
  searchLoops: (query: string) => CustomLoopDefinition[];

  // Import/Export
  exportLoop: (id: string) => string | undefined;
  importLoop: (jsonData: string) => CustomLoopDefinition | undefined;
  exportAllLoops: () => string;
  importLoops: (jsonData: string) => number;
}

// =============================================================================
// Default Loop Template
// =============================================================================

const createDefaultLoop = (instrumentId: string): Partial<CustomLoopDefinition> => {
  const category = instrumentId.split('/')[0] as LoopCategory;

  return {
    name: 'New Loop',
    category,
    subcategory: 'custom',
    bpm: 120,
    bars: 2,
    timeSignature: [4, 4] as [number, number],
    midiData: [],
    soundPreset: instrumentId,
    tags: ['custom'],
    intensity: 3 as const,
    complexity: 2 as const,
  };
};

// =============================================================================
// Store Implementation
// =============================================================================

export const useCustomLoopsStore = create<CustomLoopsState>()(
  persist(
    (set, get) => ({
      loops: {},
      editingLoopId: null,
      draftLoop: null,

      createLoop: (loopData) => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const loop: CustomLoopDefinition = {
          ...loopData,
          id,
          isCustom: true,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          loops: { ...state.loops, [id]: loop },
        }));

        return loop;
      },

      updateLoop: (id, updates) => {
        set((state) => {
          const loop = state.loops[id];
          if (!loop) return state;

          return {
            loops: {
              ...state.loops,
              [id]: {
                ...loop,
                ...updates,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      deleteLoop: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.loops;
          return {
            loops: rest,
            editingLoopId: state.editingLoopId === id ? null : state.editingLoopId,
          };
        });
      },

      duplicateLoop: (id) => {
        const original = get().loops[id];
        if (!original) return undefined;

        const newLoop = get().createLoop({
          ...original,
          name: `${original.name} (Copy)`,
        });

        return newLoop;
      },

      // Note editing
      addNote: (loopId, note) => {
        const loop = get().loops[loopId];
        if (!loop) return;

        get().updateLoop(loopId, {
          midiData: [...loop.midiData, note],
        });
      },

      removeNote: (loopId, noteIndex) => {
        const loop = get().loops[loopId];
        if (!loop) return;

        get().updateLoop(loopId, {
          midiData: loop.midiData.filter((_, i) => i !== noteIndex),
        });
      },

      updateNote: (loopId, noteIndex, updates) => {
        const loop = get().loops[loopId];
        if (!loop) return;

        const newMidiData = [...loop.midiData];
        newMidiData[noteIndex] = { ...newMidiData[noteIndex], ...updates };

        get().updateLoop(loopId, { midiData: newMidiData });
      },

      clearNotes: (loopId) => {
        get().updateLoop(loopId, { midiData: [] });
      },

      // Draft management
      startDraft: (instrumentId) => {
        set({ draftLoop: createDefaultLoop(instrumentId) });
      },

      updateDraft: (updates) => {
        set((state) => ({
          draftLoop: state.draftLoop ? { ...state.draftLoop, ...updates } : null,
        }));
      },

      saveDraft: () => {
        const draft = get().draftLoop;
        if (!draft || !draft.name || !draft.soundPreset) return undefined;

        const loop = get().createLoop(draft as Omit<CustomLoopDefinition, 'id' | 'isCustom' | 'createdAt' | 'updatedAt'>);
        set({ draftLoop: null });
        return loop;
      },

      discardDraft: () => {
        set({ draftLoop: null });
      },

      // Editing state
      setEditingLoop: (loopId) => {
        set({ editingLoopId: loopId });
      },

      // Favorites
      toggleFavorite: (loopId) => {
        const loop = get().loops[loopId];
        if (!loop) return;

        get().updateLoop(loopId, { isFavorite: !loop.isFavorite });
      },

      // Query helpers
      getLoop: (id) => get().loops[id],

      getAllLoops: () => Object.values(get().loops).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),

      getLoopsByCategory: (category) =>
        Object.values(get().loops)
          .filter((l) => l.category === category)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),

      getFavorites: () =>
        Object.values(get().loops)
          .filter((l) => l.isFavorite)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),

      searchLoops: (query) => {
        const lowerQuery = query.toLowerCase();
        return Object.values(get().loops).filter(
          (l) =>
            l.name.toLowerCase().includes(lowerQuery) ||
            l.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
            l.description?.toLowerCase().includes(lowerQuery)
        );
      },

      // Import/Export
      exportLoop: (id) => {
        const loop = get().loops[id];
        if (!loop) return undefined;

        return JSON.stringify(loop, null, 2);
      },

      importLoop: (jsonData) => {
        try {
          const parsed = JSON.parse(jsonData) as CustomLoopDefinition;

          // Validate required fields
          if (!parsed.name || !parsed.midiData || !parsed.soundPreset) {
            console.error('Invalid loop data: missing required fields');
            return undefined;
          }

          // Create with a new ID
          return get().createLoop({
            ...parsed,
            name: `${parsed.name} (Imported)`,
          });
        } catch (e) {
          console.error('Failed to import loop:', e);
          return undefined;
        }
      },

      exportAllLoops: () => {
        return JSON.stringify(Object.values(get().loops), null, 2);
      },

      importLoops: (jsonData) => {
        try {
          const parsed = JSON.parse(jsonData) as CustomLoopDefinition[];

          if (!Array.isArray(parsed)) {
            console.error('Invalid import data: expected array');
            return 0;
          }

          let count = 0;
          for (const loop of parsed) {
            if (loop.name && loop.midiData && loop.soundPreset) {
              get().createLoop(loop);
              count++;
            }
          }

          return count;
        } catch (e) {
          console.error('Failed to import loops:', e);
          return 0;
        }
      },
    }),
    {
      name: 'openstudio-custom-loops',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        loops: state.loops,
      }),
    }
  )
);

// =============================================================================
// Combined Loop Library Helper
// =============================================================================

import { LOOP_LIBRARY } from '@/lib/audio/loop-library';

/**
 * Get all loops (both built-in and custom)
 */
export function getAllLoopsWithCustom(): LoopDefinition[] {
  const customLoops = useCustomLoopsStore.getState().getAllLoops();
  return [...LOOP_LIBRARY, ...customLoops];
}

/**
 * Get a loop by ID (checks both libraries)
 */
export function getLoopById(id: string): LoopDefinition | undefined {
  // Check custom loops first
  const customLoop = useCustomLoopsStore.getState().getLoop(id);
  if (customLoop) return customLoop;

  // Check built-in library
  return LOOP_LIBRARY.find((l) => l.id === id);
}
