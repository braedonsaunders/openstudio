// Unified World View Types

import type { SceneType, SceneGroundConfig } from './scene-config';
import type { IdleAnimation } from '@/types/avatar';

// Re-export IdleAnimation for convenience
export type { IdleAnimation } from '@/types/avatar';

// Entity position state (shared between local and remote)
export interface EntityPosition {
  x: number;           // 0-100 percent
  y: number;           // 0-100 percent
  targetX: number;     // Target for walking
  targetY: number;
  facingRight: boolean;
  isWalking: boolean;
  timestamp: number;   // For sync ordering/staleness
}

// Walking entity state (extends position with timers)
export interface EntityState extends EntityPosition {
  isSettling: boolean;  // Brief pause between walking and idle
  walkTimer: number;
  idleTimer: number;
  settlingTimer: number;
}

// Synced position for broadcasting
export interface SyncedPosition {
  userId: string;
  x: number;
  y: number;
  facingRight: boolean;
  isWalking: boolean;
  targetX?: number;
  targetY?: number;
  timestamp: number;
}

// Walking configuration
export interface WalkingConfig {
  // Movement speeds
  walkSpeed: number;                    // Base movement speed (0.005 = slow, 0.05 = faster)

  // Timing (milliseconds)
  idleDuration: [number, number];       // [min, max] idle time
  walkDuration: [number, number];       // [min, max] walk time
  settlingDuration: number;             // Pause between walk/idle

  // Collision
  minEntityDistance: number;            // Minimum % distance between entities

  // Optional exclusion zones (e.g., content card on homepage)
  exclusionZones?: ExclusionZone[];

  // Musical behavior
  audioReactive?: boolean;              // Stop walking when audio > threshold
  audioThreshold?: number;              // Audio level that stops walking (0-1)

  // Beat sync
  beatSync?: boolean;                   // Sync footsteps to beat

  // Tempo influence
  tempoInfluence?: boolean;             // Walk speed varies with BPM
  baseTempo?: number;                   // Reference tempo (120 = normal speed)

  // Spawn behavior
  spawnBias?: 'bottom' | 'distributed'; // Where to spawn entities
  spawnMinY?: number;                   // For 'bottom' bias, minimum Y %
}

// Exclusion zone (area entities avoid)
export interface ExclusionZone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Idle animation configuration
export interface IdleAnimationConfig {
  animate: Record<string, number | number[]>;
  transition: {
    duration: number;
    repeat: number;
    ease: string;
  };
}

// Idle animations registry
export const IDLE_ANIMATIONS: Record<IdleAnimation, IdleAnimationConfig> = {
  bounce: {
    animate: { y: [0, -4, 0] },
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  sway: {
    animate: { rotate: [-2, 2, -2] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  still: {
    animate: {},
    transition: { duration: 0, repeat: 0, ease: 'linear' },
  },
  dance: {
    animate: { y: [0, -6, 0], rotate: [-3, 3, -3] },
    transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
  },
};

// Musical context for world view
export interface MusicalContext {
  tempo: number;
  beat: number;
  beatsPerBar: number;
  isPlaying: boolean;
  musicalKey: string | null;
  keyScale: 'major' | 'minor' | null;
}

// Audio levels map
export type AudioLevels = Map<string, number>;

// Room energy level (aggregated audio activity)
export type EnergyLevel = 'quiet' | 'medium' | 'high';

export function getEnergyLevel(audioLevels: AudioLevels): EnergyLevel {
  let totalLevel = 0;
  let activeCount = 0;

  audioLevels.forEach((level) => {
    totalLevel += level;
    if (level > 0.1) activeCount++;
  });

  const avgLevel = audioLevels.size > 0 ? totalLevel / audioLevels.size : 0;

  if (avgLevel > 0.4 || activeCount >= 3) return 'high';
  if (avgLevel > 0.15 || activeCount >= 1) return 'medium';
  return 'quiet';
}

// Select idle animation based on energy level
export function selectIdleAnimation(
  preferredAnimation: IdleAnimation,
  energyLevel: EnergyLevel
): IdleAnimation {
  // High energy: everyone dances
  if (energyLevel === 'high') return 'dance';

  // Medium energy: use preferred or bounce
  if (energyLevel === 'medium') {
    return preferredAnimation === 'still' ? 'bounce' : preferredAnimation;
  }

  // Quiet: use preferred animation
  return preferredAnimation;
}

// Default walking configurations
export const DEFAULT_WALKING_CONFIG: WalkingConfig = {
  walkSpeed: 0.005,
  idleDuration: [3000, 7000],
  walkDuration: [2000, 4000],
  settlingDuration: 300,
  minEntityDistance: 8,
  audioReactive: false,
  beatSync: false,
  tempoInfluence: false,
  baseTempo: 120,
  spawnBias: 'distributed',
};

export const DAW_WALKING_CONFIG: WalkingConfig = {
  walkSpeed: 0.03,              // Faster than homepage
  idleDuration: [2000, 5000],   // Shorter idles
  walkDuration: [2000, 5000],
  settlingDuration: 200,
  minEntityDistance: 10,
  audioReactive: true,          // Stop when making sound
  audioThreshold: 0.15,
  beatSync: true,               // Footsteps on beat
  tempoInfluence: true,         // Speed varies with tempo
  baseTempo: 120,
  spawnBias: 'distributed',
};

export const HOMEPAGE_WALKING_CONFIG: WalkingConfig = {
  walkSpeed: 0.005,             // Slow stroll
  idleDuration: [3000, 7000],   // Long hangs
  walkDuration: [2000, 4000],
  settlingDuration: 300,
  minEntityDistance: 8,
  audioReactive: false,
  beatSync: false,
  tempoInfluence: false,
  spawnBias: 'bottom',          // Stay in bottom 15%
  spawnMinY: 85,
  exclusionZones: [{            // Content card
    minX: 18,
    maxX: 82,
    minY: 15,
    maxY: 58,
  }],
};
