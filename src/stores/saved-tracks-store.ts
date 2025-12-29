import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SavedTrackPreset } from '@/types/user';
import type { UserTrack, ExtendedEffectsChain } from '@/types';
import { DEFAULT_FULL_EFFECTS } from '@/lib/audio/effects/extended-effects-processor';

interface SavedTracksState {
  // All saved track presets
  presets: SavedTrackPreset[];

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Selected presets for joining room
  selectedPresets: Set<string>;

  // Actions
  loadPresets: (userId: string) => Promise<void>;
  savePreset: (preset: Omit<SavedTrackPreset, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>) => Promise<SavedTrackPreset>;
  updatePreset: (presetId: string, updates: Partial<SavedTrackPreset>) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  duplicatePreset: (presetId: string, newName: string) => Promise<SavedTrackPreset | null>;

  // Save from existing track
  saveFromTrack: (userId: string, track: UserTrack, name: string, description?: string, instrumentId?: string) => Promise<SavedTrackPreset>;

  // Set default preset for an instrument
  setDefaultPreset: (presetId: string) => Promise<void>;

  // Room join selection
  togglePresetSelection: (presetId: string) => void;
  selectAllPresets: () => void;
  clearSelection: () => void;
  getSelectedPresets: () => SavedTrackPreset[];

  // Increment use count
  incrementUseCount: (presetId: string) => Promise<void>;

  // Query helpers
  getPresetsByInstrument: (instrumentId: string) => SavedTrackPreset[];
  getPresetsByType: (type: 'audio' | 'midi') => SavedTrackPreset[];
  getDefaultPresets: () => SavedTrackPreset[];

  // Reset
  reset: () => void;
}

const initialState = {
  presets: [] as SavedTrackPreset[],
  isLoading: false,
  isInitialized: false,
  error: null,
  selectedPresets: new Set<string>(),
};

export const useSavedTracksStore = create<SavedTracksState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    loadPresets: async (userId: string) => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });

      try {
        const response = await fetch(`/api/saved-tracks?userId=${userId}`);
        if (!response.ok) {
          throw new Error('Failed to load saved track presets');
        }

        const presets: SavedTrackPreset[] = await response.json();
        set({
          presets,
          isLoading: false,
          isInitialized: true,
        });
      } catch (error) {
        console.error('Failed to load saved tracks:', error);
        set({
          isLoading: false,
          isInitialized: true,
          error: error instanceof Error ? error.message : 'Failed to load presets',
        });
      }
    },

    savePreset: async (preset) => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch('/api/saved-tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preset),
        });

        if (!response.ok) {
          throw new Error('Failed to save track preset');
        }

        const savedPreset: SavedTrackPreset = await response.json();

        set((state) => ({
          presets: [...state.presets, savedPreset],
          isLoading: false,
        }));

        return savedPreset;
      } catch (error) {
        console.error('Failed to save preset:', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to save preset',
        });
        throw error;
      }
    },

    updatePreset: async (presetId, updates) => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch(`/api/saved-tracks/${presetId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update track preset');
        }

        const updatedPreset: SavedTrackPreset = await response.json();

        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId ? updatedPreset : p
          ),
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to update preset:', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to update preset',
        });
        throw error;
      }
    },

    deletePreset: async (presetId) => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch(`/api/saved-tracks/${presetId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete track preset');
        }

        set((state) => ({
          presets: state.presets.filter((p) => p.id !== presetId),
          selectedPresets: new Set(
            Array.from(state.selectedPresets).filter((id) => id !== presetId)
          ),
          isLoading: false,
        }));
      } catch (error) {
        console.error('Failed to delete preset:', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to delete preset',
        });
        throw error;
      }
    },

    duplicatePreset: async (presetId, newName) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (!preset) return null;

      const duplicated = {
        ...preset,
        name: newName,
        isDefault: false,
      };

      // Remove fields that should be regenerated
      const { id, createdAt, updatedAt, useCount, ...presetData } = duplicated;

      return get().savePreset(presetData);
    },

    saveFromTrack: async (userId, track, name, description, instrumentId) => {
      const preset: Omit<SavedTrackPreset, 'id' | 'createdAt' | 'updatedAt' | 'useCount'> = {
        userId,
        name,
        description,
        type: track.type,
        instrumentId: instrumentId || 'other',
        color: track.color,
        volume: track.volume,
        isMuted: track.isMuted,
        isSolo: track.isSolo,
        effects: track.audioSettings.effects as unknown as Record<string, unknown>,
        activeEffectPreset: track.audioSettings.activePreset,
        isDefault: false,
      };

      // Add audio settings if it's an audio track
      if (track.type === 'audio') {
        preset.audioSettings = {
          inputMode: track.audioSettings.inputMode,
          inputDeviceId: track.audioSettings.inputDeviceId,
          sampleRate: track.audioSettings.sampleRate,
          bufferSize: track.audioSettings.bufferSize,
          noiseSuppression: track.audioSettings.noiseSuppression,
          echoCancellation: track.audioSettings.echoCancellation,
          autoGainControl: track.audioSettings.autoGainControl,
          channelConfig: track.audioSettings.channelConfig,
          inputGain: track.audioSettings.inputGain,
          directMonitoring: track.audioSettings.directMonitoring,
          monitoringVolume: track.audioSettings.monitoringVolume,
        };
      }

      // Add MIDI settings if it's a MIDI track
      if (track.type === 'midi' && track.midiSettings) {
        preset.midiSettings = {
          deviceId: track.midiSettings.deviceId || undefined,
          channel: track.midiSettings.channel,
          soundBank: track.midiSettings.soundBank,
          soundPreset: track.midiSettings.soundPreset,
          velocityCurve: track.midiSettings.velocityCurve,
          arpeggiator: track.midiSettings.arpeggiator,
        };
      }

      return get().savePreset(preset);
    },

    setDefaultPreset: async (presetId) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (!preset) return;

      // First, unset any existing default for this instrument
      const existingDefault = get().presets.find(
        (p) => p.instrumentId === preset.instrumentId && p.isDefault && p.id !== presetId
      );

      if (existingDefault) {
        await get().updatePreset(existingDefault.id, { isDefault: false });
      }

      // Set the new default
      await get().updatePreset(presetId, { isDefault: true });
    },

    togglePresetSelection: (presetId) => {
      set((state) => {
        const newSelection = new Set(state.selectedPresets);
        if (newSelection.has(presetId)) {
          newSelection.delete(presetId);
        } else {
          newSelection.add(presetId);
        }
        return { selectedPresets: newSelection };
      });
    },

    selectAllPresets: () => {
      set((state) => ({
        selectedPresets: new Set(state.presets.map((p) => p.id)),
      }));
    },

    clearSelection: () => {
      set({ selectedPresets: new Set() });
    },

    getSelectedPresets: () => {
      const state = get();
      return state.presets.filter((p) => state.selectedPresets.has(p.id));
    },

    incrementUseCount: async (presetId) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (!preset) return;

      // Update locally first for responsiveness
      set((state) => ({
        presets: state.presets.map((p) =>
          p.id === presetId ? { ...p, useCount: p.useCount + 1 } : p
        ),
      }));

      // Then update on server (fire and forget)
      try {
        await fetch(`/api/saved-tracks/${presetId}/use`, { method: 'POST' });
      } catch (error) {
        console.error('Failed to increment use count:', error);
      }
    },

    getPresetsByInstrument: (instrumentId) => {
      return get().presets.filter((p) => p.instrumentId === instrumentId);
    },

    getPresetsByType: (type) => {
      return get().presets.filter((p) => p.type === type);
    },

    getDefaultPresets: () => {
      return get().presets.filter((p) => p.isDefault);
    },

    reset: () => {
      set(initialState);
    },
  }))
);

// Helper function to convert a SavedTrackPreset to track creation settings
export function presetToTrackSettings(preset: SavedTrackPreset) {
  const baseSettings = {
    name: preset.name,
    color: preset.color,
    volume: preset.volume,
    isMuted: preset.isMuted,
    isSolo: preset.isSolo,
  };

  if (preset.type === 'audio' && preset.audioSettings) {
    return {
      ...baseSettings,
      type: 'audio' as const,
      audioSettings: {
        inputMode: preset.audioSettings.inputMode,
        inputDeviceId: preset.audioSettings.inputDeviceId || 'default',
        sampleRate: preset.audioSettings.sampleRate,
        bufferSize: preset.audioSettings.bufferSize,
        noiseSuppression: preset.audioSettings.noiseSuppression,
        echoCancellation: preset.audioSettings.echoCancellation,
        autoGainControl: preset.audioSettings.autoGainControl,
        channelConfig: preset.audioSettings.channelConfig,
        inputGain: preset.audioSettings.inputGain,
        effects: { ...DEFAULT_FULL_EFFECTS, ...(preset.effects as unknown as Partial<ExtendedEffectsChain>) },
        activePreset: preset.activeEffectPreset,
        directMonitoring: preset.audioSettings.directMonitoring,
        monitoringVolume: preset.audioSettings.monitoringVolume,
      },
    };
  }

  if (preset.type === 'midi' && preset.midiSettings) {
    return {
      ...baseSettings,
      type: 'midi' as const,
      midiSettings: {
        deviceId: preset.midiSettings.deviceId || null,
        channel: preset.midiSettings.channel,
        soundBank: preset.midiSettings.soundBank,
        soundPreset: preset.midiSettings.soundPreset,
        velocityCurve: preset.midiSettings.velocityCurve,
        arpeggiator: preset.midiSettings.arpeggiator,
      },
    };
  }

  return baseSettings;
}
