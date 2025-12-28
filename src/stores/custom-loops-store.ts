// Custom Loops Store - Zustand store for user-created loops with server + localStorage persistence

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
  userId?: string;

  // Optional metadata
  description?: string;
  isFavorite?: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchLoopsFromServer(userId: string): Promise<CustomLoopDefinition[]> {
  try {
    const response = await fetch(`/api/custom-loops?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch loops');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching loops from server:', error);
    return [];
  }
}

async function createLoopOnServer(loop: CustomLoopDefinition): Promise<CustomLoopDefinition | null> {
  try {
    const response = await fetch('/api/custom-loops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loop),
    });
    if (!response.ok) {
      throw new Error('Failed to create loop');
    }
    return response.json();
  } catch (error) {
    console.error('Error creating loop on server:', error);
    return null;
  }
}

async function updateLoopOnServer(loop: Partial<CustomLoopDefinition> & { id: string; userId: string }): Promise<CustomLoopDefinition | null> {
  try {
    const response = await fetch('/api/custom-loops', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loop),
    });
    if (!response.ok) {
      throw new Error('Failed to update loop');
    }
    return response.json();
  } catch (error) {
    console.error('Error updating loop on server:', error);
    return null;
  }
}

async function deleteLoopOnServer(id: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/custom-loops?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting loop on server:', error);
    return false;
  }
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

  // Current user ID for server sync
  userId: string | null;

  // Sync status
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // Actions
  setUserId: (userId: string | null) => void;
  syncFromServer: () => Promise<void>;
  createLoop: (loop: Omit<CustomLoopDefinition, 'id' | 'isCustom' | 'createdAt' | 'updatedAt'>) => Promise<CustomLoopDefinition>;
  updateLoop: (id: string, updates: Partial<CustomLoopDefinition>) => Promise<void>;
  deleteLoop: (id: string) => Promise<void>;
  duplicateLoop: (id: string) => Promise<CustomLoopDefinition | undefined>;

  // Note editing
  addNote: (loopId: string, note: MidiNote) => void;
  removeNote: (loopId: string, noteIndex: number) => void;
  updateNote: (loopId: string, noteIndex: number, updates: Partial<MidiNote>) => void;
  clearNotes: (loopId: string) => void;

  // Draft management
  startDraft: (instrumentId: string) => void;
  updateDraft: (updates: Partial<CustomLoopDefinition>) => void;
  saveDraft: () => Promise<CustomLoopDefinition | undefined>;
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
  importLoop: (jsonData: string) => Promise<CustomLoopDefinition | undefined>;
  exportAllLoops: () => string;
  importLoops: (jsonData: string) => Promise<number>;
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
      userId: null,
      isSyncing: false,
      lastSyncedAt: null,

      setUserId: (userId) => {
        set({ userId });
        // Automatically sync when user ID is set
        if (userId) {
          get().syncFromServer();
        }
      },

      syncFromServer: async () => {
        const { userId } = get();
        if (!userId) return;

        set({ isSyncing: true });
        try {
          const serverLoops = await fetchLoopsFromServer(userId);
          const loopsRecord: Record<string, CustomLoopDefinition> = {};

          for (const loop of serverLoops) {
            loopsRecord[loop.id] = loop;
          }

          set({
            loops: loopsRecord,
            lastSyncedAt: new Date().toISOString(),
          });
        } finally {
          set({ isSyncing: false });
        }
      },

      createLoop: async (loopData) => {
        const { userId } = get();
        const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const loop: CustomLoopDefinition = {
          ...loopData,
          id,
          isCustom: true,
          createdAt: now,
          updatedAt: now,
          userId: userId || undefined,
        };

        // Update local state immediately
        set((state) => ({
          loops: { ...state.loops, [id]: loop },
        }));

        // Sync to server if user is logged in
        if (userId) {
          const serverLoop = await createLoopOnServer(loop);
          if (serverLoop) {
            // Update with server-assigned data
            set((state) => ({
              loops: { ...state.loops, [serverLoop.id]: serverLoop },
            }));
            return serverLoop;
          }
        }

        return loop;
      },

      updateLoop: async (id, updates) => {
        const { userId, loops } = get();
        const loop = loops[id];
        if (!loop) return;

        const updatedLoop = {
          ...loop,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        // Update local state immediately
        set((state) => ({
          loops: {
            ...state.loops,
            [id]: updatedLoop,
          },
        }));

        // Sync to server if user is logged in
        if (userId) {
          await updateLoopOnServer({ ...updates, id, userId });
        }
      },

      deleteLoop: async (id) => {
        const { userId } = get();

        // Update local state immediately
        set((state) => {
          const { [id]: _, ...rest } = state.loops;
          return {
            loops: rest,
            editingLoopId: state.editingLoopId === id ? null : state.editingLoopId,
          };
        });

        // Sync to server if user is logged in
        if (userId) {
          await deleteLoopOnServer(id, userId);
        }
      },

      duplicateLoop: async (id) => {
        // Check custom loops first
        let original: LoopDefinition | undefined = get().loops[id];

        // If not found in custom loops, check built-in library
        if (!original) {
          const { LOOP_LIBRARY } = await import('@/lib/audio/loop-library');
          original = LOOP_LIBRARY.find((l) => l.id === id);
        }

        if (!original) return undefined;

        const newLoop = await get().createLoop({
          name: original.name,
          category: original.category,
          subcategory: original.subcategory,
          bpm: original.bpm,
          bars: original.bars,
          timeSignature: original.timeSignature,
          midiData: [...original.midiData],
          soundPreset: original.soundPreset,
          tags: [...(original.tags || [])],
          intensity: original.intensity,
          complexity: original.complexity,
          key: original.key,
          description: `Copy of ${original.name}`,
        });

        return newLoop;
      },

      // Note editing (local only, then sync entire loop)
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

      saveDraft: async () => {
        const draft = get().draftLoop;
        if (!draft || !draft.name || !draft.soundPreset) return undefined;

        const loop = await get().createLoop(draft as Omit<CustomLoopDefinition, 'id' | 'isCustom' | 'createdAt' | 'updatedAt'>);
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

      importLoop: async (jsonData) => {
        try {
          const parsed = JSON.parse(jsonData) as CustomLoopDefinition;

          // Validate required fields
          if (!parsed.name || !parsed.midiData || !parsed.soundPreset) {
            console.error('Invalid loop data: missing required fields');
            return undefined;
          }

          // Create with a new ID
          return await get().createLoop({
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

      importLoops: async (jsonData) => {
        try {
          const parsed = JSON.parse(jsonData) as CustomLoopDefinition[];

          if (!Array.isArray(parsed)) {
            console.error('Invalid import data: expected array');
            return 0;
          }

          let count = 0;
          for (const loop of parsed) {
            if (loop.name && loop.midiData && loop.soundPreset) {
              await get().createLoop(loop);
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
        userId: state.userId,
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
