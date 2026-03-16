// Performance Sync Store
// Global state for world-class latency synchronization system

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  UserPerformanceInfo,
  JamCompatibility,
  QualityPresetName,
  OpusEncodingSettings,
  OptimizationState,
  AutoOptimization,
} from '@/types';

export interface PerformanceSyncState {
  // Local user performance
  localPerformance: UserPerformanceInfo | null;

  // All participants performance
  participantPerformance: Map<string, UserPerformanceInfo>;

  // Jam compatibility
  jamCompatibility: JamCompatibility;

  // Quality preset
  activePreset: QualityPresetName;
  customEncodingSettings: Partial<OpusEncodingSettings>;

  // Optimization state
  optimizationState: OptimizationState;

  // Master status
  isMaster: boolean;
  masterId: string | null;

  // Clock sync status
  clockOffset: number;
  clockSyncQuality: 'excellent' | 'good' | 'fair' | 'poor';
  lastClockSync: number;

  // UI display settings
  showPerformanceDetails: boolean;
  showLatencyBreakdown: boolean;

  // Actions
  setLocalPerformance: (info: UserPerformanceInfo) => void;
  updateParticipantPerformance: (userId: string, info: UserPerformanceInfo) => void;
  removeParticipant: (userId: string) => void;
  setJamCompatibility: (compatibility: JamCompatibility) => void;
  setActivePreset: (preset: QualityPresetName) => void;
  setCustomEncodingSettings: (settings: Partial<OpusEncodingSettings>) => void;
  setOptimizationState: (state: OptimizationState) => void;
  addPendingOptimization: (opt: AutoOptimization) => void;
  removePendingOptimization: (type: AutoOptimization['type']) => void;
  applyOptimization: (opt: AutoOptimization) => void;
  setIsMaster: (isMaster: boolean) => void;
  setMasterId: (masterId: string | null) => void;
  setClockSync: (offset: number, quality: 'excellent' | 'good' | 'fair' | 'poor') => void;
  setShowPerformanceDetails: (show: boolean) => void;
  setShowLatencyBreakdown: (show: boolean) => void;
  reset: () => void;
}

const initialJamCompatibility: JamCompatibility = {
  canJam: true,
  quality: 'tight',
  maxGroupLatency: 0,
  recommendation: 'Waiting for participants...',
  autoOptimizations: [],
};

const initialOptimizationState: OptimizationState = {
  isEnabled: true,
  lastOptimization: 0,
  recentIssues: [],
  appliedOptimizations: [],
  pendingOptimizations: [],
};

export const usePerformanceSyncStore = create<PerformanceSyncState>()(
  subscribeWithSelector((set) => ({
    // Initial state
    localPerformance: null,
    participantPerformance: new Map(),
    jamCompatibility: initialJamCompatibility,
    activePreset: 'balanced',
    customEncodingSettings: {},
    optimizationState: initialOptimizationState,
    isMaster: false,
    masterId: null,
    clockOffset: 0,
    clockSyncQuality: 'fair',
    lastClockSync: 0,
    showPerformanceDetails: false,
    showLatencyBreakdown: false,

    // Actions
    setLocalPerformance: (info) => set({ localPerformance: info }),

    updateParticipantPerformance: (userId, info) =>
      set((state) => {
        const newMap = new Map(state.participantPerformance);
        newMap.set(userId, info);
        return { participantPerformance: newMap };
      }),

    removeParticipant: (userId) =>
      set((state) => {
        const newMap = new Map(state.participantPerformance);
        newMap.delete(userId);
        return { participantPerformance: newMap };
      }),

    setJamCompatibility: (compatibility) => set({ jamCompatibility: compatibility }),

    setActivePreset: (preset) => set({ activePreset: preset }),

    setCustomEncodingSettings: (settings) =>
      set((state) => ({
        customEncodingSettings: {
          ...state.customEncodingSettings,
          ...settings,
        },
      })),

    setOptimizationState: (state) => set({ optimizationState: state }),

    addPendingOptimization: (opt) =>
      set((state) => ({
        optimizationState: {
          ...state.optimizationState,
          pendingOptimizations: [
            ...state.optimizationState.pendingOptimizations.filter(p => p.type !== opt.type),
            opt,
          ],
        },
      })),

    removePendingOptimization: (type) =>
      set((state) => ({
        optimizationState: {
          ...state.optimizationState,
          pendingOptimizations: state.optimizationState.pendingOptimizations.filter(
            p => p.type !== type
          ),
        },
      })),

    applyOptimization: (opt) =>
      set((state) => ({
        optimizationState: {
          ...state.optimizationState,
          appliedOptimizations: [...state.optimizationState.appliedOptimizations, opt],
          pendingOptimizations: state.optimizationState.pendingOptimizations.filter(
            p => p.type !== opt.type
          ),
          lastOptimization: Date.now(),
        },
      })),

    setIsMaster: (isMaster) => set({ isMaster }),

    setMasterId: (masterId) => set({ masterId }),

    setClockSync: (offset, quality) =>
      set({
        clockOffset: offset,
        clockSyncQuality: quality,
        lastClockSync: Date.now(),
      }),

    setShowPerformanceDetails: (show) => set({ showPerformanceDetails: show }),

    setShowLatencyBreakdown: (show) => set({ showLatencyBreakdown: show }),

    reset: () =>
      set({
        localPerformance: null,
        participantPerformance: new Map(),
        jamCompatibility: initialJamCompatibility,
        activePreset: 'balanced',
        customEncodingSettings: {},
        optimizationState: initialOptimizationState,
        isMaster: false,
        masterId: null,
        clockOffset: 0,
        clockSyncQuality: 'fair',
        lastClockSync: 0,
      }),
  }))
);

// Selectors for common use cases

/**
 * Get sorted list of participants by latency (lowest first)
 */
export function selectParticipantsByLatency(state: PerformanceSyncState): UserPerformanceInfo[] {
  return Array.from(state.participantPerformance.values()).sort(
    (a, b) => a.rttToMaster - b.rttToMaster
  );
}

/**
 * Get participant with highest latency
 */
export function selectHighestLatencyParticipant(
  state: PerformanceSyncState
): UserPerformanceInfo | null {
  const participants = Array.from(state.participantPerformance.values());
  if (participants.length === 0) return null;
  return participants.reduce((max, p) => (p.rttToMaster > max.rttToMaster ? p : max));
}

/**
 * Get average group latency
 */
export function selectAverageGroupLatency(state: PerformanceSyncState): number {
  const participants = Array.from(state.participantPerformance.values());
  if (participants.length === 0) return 0;
  const sum = participants.reduce((total, p) => total + p.rttToMaster, 0);
  return sum / participants.length;
}

/**
 * Check if any participant has connection issues
 */
export function selectHasConnectionIssues(state: PerformanceSyncState): boolean {
  return Array.from(state.participantPerformance.values()).some(
    p => p.connectionQuality === 'poor' || p.packetLoss > 5
  );
}

/**
 * Get jam quality color
 */
export function getJamQualityColor(quality: JamCompatibility['quality']): string {
  switch (quality) {
    case 'tight':
      return 'text-emerald-500';
    case 'good':
      return 'text-lime-500';
    case 'loose':
      return 'text-amber-500';
    case 'difficult':
      return 'text-orange-500';
    case 'impossible':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get jam quality background color
 */
export function getJamQualityBgColor(quality: JamCompatibility['quality']): string {
  switch (quality) {
    case 'tight':
      return 'bg-emerald-500/10';
    case 'good':
      return 'bg-lime-500/10';
    case 'loose':
      return 'bg-amber-500/10';
    case 'difficult':
      return 'bg-orange-500/10';
    case 'impossible':
      return 'bg-red-500/10';
    default:
      return 'bg-gray-500/10';
  }
}

/**
 * Get connection quality icon color
 */
export function getConnectionQualityColor(
  quality: 'excellent' | 'good' | 'fair' | 'poor'
): string {
  switch (quality) {
    case 'excellent':
      return 'text-emerald-500';
    case 'good':
      return 'text-lime-500';
    case 'fair':
      return 'text-amber-500';
    case 'poor':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}
