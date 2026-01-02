'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { MusicalContext, AudioLevels, EnergyLevel } from '../types';
import { getEnergyLevel } from '../types';

/**
 * Hook to get the current beat phase (0-1) within a beat.
 * Useful for syncing animations to the rhythm.
 */
export function useBeatPhase(tempo: number, isPlaying: boolean, isVisible: boolean): number {
  const [phase, setPhase] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible || !isPlaying || tempo <= 0) {
      setPhase(0);
      startTimeRef.current = null;
      return;
    }

    const msPerBeat = 60000 / tempo;
    let animationId: number;

    const update = () => {
      const now = performance.now();
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }

      const elapsed = now - startTimeRef.current;
      const beatPhase = (elapsed % msPerBeat) / msPerBeat;
      setPhase(beatPhase);

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [tempo, isPlaying, isVisible]);

  return phase;
}

/**
 * Hook to detect beat "hits" for triggering one-shot animations.
 * Calls onBeat callback on each beat, with beat number and isDownbeat flag.
 */
export function useBeatTrigger(
  beat: number,
  beatsPerBar: number,
  isPlaying: boolean,
  isVisible: boolean,
  onBeat: (beat: number, isDownbeat: boolean) => void
) {
  const lastBeatRef = useRef(beat);
  const callbackRef = useRef(onBeat);

  useEffect(() => {
    callbackRef.current = onBeat;
  }, [onBeat]);

  useEffect(() => {
    if (!isVisible || !isPlaying) return;

    if (beat !== lastBeatRef.current) {
      lastBeatRef.current = beat;
      callbackRef.current(beat, beat === 1);
    }
  }, [beat, isPlaying, isVisible]);
}

/**
 * Hook to calculate walk speed multiplier based on tempo.
 * Returns a multiplier (1.0 = normal, <1 = slower, >1 = faster)
 */
export function useTempoSpeedMultiplier(
  tempo: number,
  baseTempo: number = 120,
  enabled: boolean = true
): number {
  return useMemo(() => {
    if (!enabled || tempo <= 0) return 1;

    // Clamp the multiplier to reasonable range (0.5x to 1.5x)
    const multiplier = tempo / baseTempo;
    return Math.max(0.5, Math.min(1.5, multiplier));
  }, [tempo, baseTempo, enabled]);
}

/**
 * Hook to get a throttled aggregate audio level.
 * Updates at most every throttleMs milliseconds.
 */
export function useThrottledAudioLevel(
  audioLevels: AudioLevels,
  throttleMs: number = 100,
  isVisible: boolean = true
): number {
  const [level, setLevel] = useState(0);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!isVisible) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) return;
    lastUpdateRef.current = now;

    let total = 0;
    audioLevels.forEach((l) => { total += l; });
    const avg = audioLevels.size > 0 ? total / audioLevels.size : 0;
    setLevel(Math.min(avg, 1));
  }, [audioLevels, throttleMs, isVisible]);

  return level;
}

/**
 * Hook to get the room's energy level based on audio activity.
 */
export function useRoomEnergy(
  audioLevels: AudioLevels,
  isVisible: boolean = true
): EnergyLevel {
  const [energy, setEnergy] = useState<EnergyLevel>('quiet');
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!isVisible) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < 200) return; // Throttle to 5Hz
    lastUpdateRef.current = now;

    setEnergy(getEnergyLevel(audioLevels));
  }, [audioLevels, isVisible]);

  return energy;
}

/**
 * Hook to detect audio "transients" (sudden loud moments).
 * Useful for triggering visual reactions to musical hits.
 */
export function useAudioTransients(
  audioLevels: AudioLevels,
  threshold: number = 0.3,
  isVisible: boolean = true,
  onTransient: (userId: string, level: number) => void
) {
  const prevLevelsRef = useRef<Map<string, number>>(new Map());
  const callbackRef = useRef(onTransient);

  useEffect(() => {
    callbackRef.current = onTransient;
  }, [onTransient]);

  useEffect(() => {
    if (!isVisible) return;

    audioLevels.forEach((level, userId) => {
      const prevLevel = prevLevelsRef.current.get(userId) || 0;
      const delta = level - prevLevel;

      // Detect sudden increase above threshold
      if (delta > threshold && level > 0.2) {
        callbackRef.current(userId, level);
      }

      prevLevelsRef.current.set(userId, level);
    });
  }, [audioLevels, threshold, isVisible]);
}

/**
 * Hook to calculate bobbing/bouncing offset synced to beat.
 * Returns a value that oscillates with the beat.
 */
export function useBeatBob(
  beatPhase: number,
  intensity: number = 2,
  isPlaying: boolean = true
): number {
  if (!isPlaying) return 0;

  // Use cosine for smooth bob (1 at beat hit, -1 at half beat)
  // Inverted so we go up (negative Y) on the beat
  return -Math.cos(beatPhase * Math.PI * 2) * intensity;
}

/**
 * Hook to calculate head nod rotation synced to downbeat.
 * Returns rotation in degrees.
 */
export function useHeadNod(
  beat: number,
  isPlaying: boolean,
  intensity: number = 2
): number {
  const [rotation, setRotation] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Trigger nod on beat 1 (downbeat)
    if (!isPlaying || beat !== 1) return;

    startTimeRef.current = performance.now();

    const animate = () => {
      if (startTimeRef.current === null) return;

      const elapsed = performance.now() - startTimeRef.current;
      const duration = 200; // 200ms nod

      if (elapsed >= duration) {
        setRotation(0);
        startTimeRef.current = null;
        return;
      }

      // Quick nod down and back up
      const progress = elapsed / duration;
      const nodCurve = Math.sin(progress * Math.PI) * intensity;
      setRotation(-nodCurve); // Negative = nod forward

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [beat, isPlaying, intensity]);

  return rotation;
}

/**
 * Hook to smoothly interpolate audio glow intensity.
 * Provides smooth rise and fall for audio-reactive glow effects.
 */
export function useAudioGlow(
  audioLevel: number,
  riseSpeed: number = 0.15,
  fallSpeed: number = 0.05,
  isVisible: boolean = true
): number {
  const [glow, setGlow] = useState(0);
  const targetRef = useRef(0);

  useEffect(() => {
    targetRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    if (!isVisible) return;

    let animationId: number;

    const animate = () => {
      setGlow((current) => {
        const target = targetRef.current;
        if (Math.abs(current - target) < 0.01) return target;

        const speed = target > current ? riseSpeed : fallSpeed;
        return current + (target - current) * speed;
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [riseSpeed, fallSpeed, isVisible]);

  return glow;
}

/**
 * Combined hook for all musical context.
 * Provides everything needed for musical world behavior.
 */
export function useMusicalWorld(
  musicalContext: MusicalContext,
  audioLevels: AudioLevels,
  isVisible: boolean
) {
  const { tempo, beat, beatsPerBar, isPlaying, musicalKey, keyScale } = musicalContext;

  const beatPhase = useBeatPhase(tempo, isPlaying, isVisible);
  const roomEnergy = useRoomEnergy(audioLevels, isVisible);
  const totalAudioLevel = useThrottledAudioLevel(audioLevels, 100, isVisible);
  const tempoMultiplier = useTempoSpeedMultiplier(tempo, 120, isPlaying);
  const beatBob = useBeatBob(beatPhase, 2, isPlaying);
  const headNod = useHeadNod(beat, isPlaying, 2);

  return {
    beatPhase,
    roomEnergy,
    totalAudioLevel,
    tempoMultiplier,
    beatBob,
    headNod,
    beat,
    beatsPerBar,
    tempo,
    isPlaying,
    musicalKey,
    keyScale,
  };
}
