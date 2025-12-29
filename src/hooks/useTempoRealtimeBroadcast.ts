'use client';

import { useEffect, useRef } from 'react';
import { useSessionTempoStore, type TempoSource } from '@/stores/session-tempo-store';

/**
 * Callback types for broadcasting tempo changes to other clients
 */
export type BroadcastTempoUpdate = (tempo: number, source: string) => void;
export type BroadcastTempoSource = (source: string) => void;
export type BroadcastTimeSignature = (beatsPerBar: number, beatUnit: number) => void;

/**
 * Hook that broadcasts session tempo changes to other clients via realtime.
 * This ensures BPM, source mode, and time signature are synced across all room members.
 *
 * @param onBroadcastTempo - Callback to broadcast tempo changes
 * @param onBroadcastSource - Callback to broadcast tempo source changes
 * @param onBroadcastTimeSignature - Callback to broadcast time signature changes
 */
export function useTempoRealtimeBroadcast(
  onBroadcastTempo?: BroadcastTempoUpdate,
  onBroadcastSource?: BroadcastTempoSource,
  onBroadcastTimeSignature?: BroadcastTimeSignature
): void {
  // Track last broadcast values to avoid duplicate broadcasts
  const lastBroadcastTempo = useRef<number | null>(null);
  const lastBroadcastSource = useRef<string | null>(null);
  const lastBroadcastTimeSig = useRef<string | null>(null);

  // Subscribe to manual tempo changes and broadcast them
  useEffect(() => {
    if (!onBroadcastTempo) return;

    const unsubscribe = useSessionTempoStore.subscribe(
      (state) => ({ tempo: state.manualTempo, source: state.source }),
      ({ tempo, source }) => {
        // Only broadcast manual tempo changes
        if (source === 'manual' || source === 'tap') {
          // Avoid duplicate broadcasts
          if (lastBroadcastTempo.current !== tempo) {
            lastBroadcastTempo.current = tempo;
            onBroadcastTempo(tempo, source);
          }
        }
      }
    );

    return unsubscribe;
  }, [onBroadcastTempo]);

  // Subscribe to tempo source changes and broadcast them
  useEffect(() => {
    if (!onBroadcastSource) return;

    const unsubscribe = useSessionTempoStore.subscribe(
      (state) => state.source,
      (source: TempoSource) => {
        // Avoid duplicate broadcasts
        if (lastBroadcastSource.current !== source) {
          lastBroadcastSource.current = source;
          onBroadcastSource(source);
        }
      }
    );

    return unsubscribe;
  }, [onBroadcastSource]);

  // Subscribe to time signature changes and broadcast them
  useEffect(() => {
    if (!onBroadcastTimeSignature) return;

    const unsubscribe = useSessionTempoStore.subscribe(
      (state) => ({ beatsPerBar: state.beatsPerBar, beatUnit: state.beatUnit }),
      ({ beatsPerBar, beatUnit }) => {
        const timeSigKey = `${beatsPerBar}/${beatUnit}`;
        // Avoid duplicate broadcasts
        if (lastBroadcastTimeSig.current !== timeSigKey) {
          lastBroadcastTimeSig.current = timeSigKey;
          onBroadcastTimeSignature(beatsPerBar, beatUnit);
        }
      }
    );

    return unsubscribe;
  }, [onBroadcastTimeSignature]);
}
