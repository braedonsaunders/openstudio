// Unified World Scene Configuration
// Single source of truth for all scene configs - homepage and DAW

import type { HomepageSceneType } from '@/types/avatar';

// Re-export scene type for convenience
export type SceneType = HomepageSceneType;

export interface SceneGroundConfig {
  // Horizon line position (percentage from top, e.g., 30 means horizon at 30% from top)
  horizonY: number;
  // Walkable area bounds (percentages)
  walkableArea: {
    minX: number;
    maxX: number;
    minY: number; // Near horizon (far from camera)
    maxY: number; // Near bottom (close to camera)
  };
  // Avatar scale range based on Y position
  scaleRange: {
    min: number; // Scale at horizon (far)
    max: number; // Scale at bottom (near)
  };
  // Ground gradient/texture
  groundStyle: {
    type: 'gradient' | 'texture' | 'color';
    colors?: string[];
    pattern?: string;
  };
  // Backdrop/sky style
  backdropStyle: {
    type: 'gradient' | 'image';
    colors?: string[];
    imageUrl?: string;
  };
}

// Scene element (decorations, interactives)
export interface SceneElement {
  id: string;
  type: 'decoration' | 'interactive';
  component: string; // Component name to render
  position: { x: number; y: number }; // Percentages
  scale?: number;
  zIndex?: number;
}

export interface SceneConfig {
  id: SceneType;
  name: string;
  description: string;
  emoji: string;
  ground: SceneGroundConfig;
  elements?: SceneElement[]; // Optional scene decorations
}

// Complete scene configurations with decorations
export const SCENE_CONFIGS: Record<SceneType, SceneConfig> = {
  campfire: {
    id: 'campfire',
    name: 'Campfire',
    description: 'Cozy night jam',
    emoji: '🔥',
    ground: {
      horizonY: 28,
      walkableArea: {
        minX: 10,
        maxX: 90,
        minY: 32,
        maxY: 78,
      },
      scaleRange: {
        min: 0.4,
        max: 1.3,
      },
      groundStyle: {
        type: 'gradient',
        colors: ['#1a1a2e', '#16213e', '#0f3460'],
      },
      backdropStyle: {
        type: 'gradient',
        colors: ['#0f0c29', '#302b63', '#24243e'],
      },
    },
    elements: [
      { id: 'fire', type: 'decoration', component: 'Campfire', position: { x: 50, y: 65 }, zIndex: 10 },
      { id: 'logs', type: 'decoration', component: 'Logs', position: { x: 48, y: 70 }, zIndex: 5 },
    ],
  },
  rooftop: {
    id: 'rooftop',
    name: 'Rooftop',
    description: 'City vibes',
    emoji: '🏙️',
    ground: {
      horizonY: 25,
      walkableArea: {
        minX: 8,
        maxX: 92,
        minY: 30,
        maxY: 80,
      },
      scaleRange: {
        min: 0.45,
        max: 1.25,
      },
      groundStyle: {
        type: 'gradient',
        colors: ['#2d2d2d', '#3d3d3d', '#4a4a4a'],
      },
      backdropStyle: {
        type: 'gradient',
        colors: ['#1a1a2e', '#4a3f6b', '#6b5b95'],
      },
    },
    elements: [
      { id: 'skyline', type: 'decoration', component: 'CitySkyline', position: { x: 50, y: 25 }, zIndex: 1 },
    ],
  },
  beach: {
    id: 'beach',
    name: 'Beach',
    description: 'Sunset session',
    emoji: '🏖️',
    ground: {
      horizonY: 30,
      walkableArea: {
        minX: 5,
        maxX: 95,
        minY: 35,
        maxY: 82,
      },
      scaleRange: {
        min: 0.4,
        max: 1.35,
      },
      groundStyle: {
        type: 'gradient',
        colors: ['#c4a35a', '#d4b366', '#e8c875'],
      },
      backdropStyle: {
        type: 'gradient',
        colors: ['#ff6b6b', '#feca57', '#48dbfb'],
      },
    },
    elements: [
      { id: 'palm1', type: 'decoration', component: 'PalmTree', position: { x: 10, y: 40 }, scale: 1.2, zIndex: 2 },
      { id: 'palm2', type: 'decoration', component: 'PalmTree', position: { x: 88, y: 38 }, scale: 1.0, zIndex: 2 },
      { id: 'waves', type: 'decoration', component: 'Waves', position: { x: 50, y: 32 }, zIndex: 1 },
    ],
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    description: 'Pro recording',
    emoji: '🎙️',
    ground: {
      horizonY: 20,
      walkableArea: {
        minX: 12,
        maxX: 88,
        minY: 28,
        maxY: 75,
      },
      scaleRange: {
        min: 0.5,
        max: 1.2,
      },
      groundStyle: {
        type: 'gradient',
        colors: ['#1a1a1a', '#2a2a2a', '#3a3a3a'],
        pattern: 'grid',
      },
      backdropStyle: {
        type: 'gradient',
        colors: ['#121212', '#1e1e1e', '#252525'],
      },
    },
    elements: [
      { id: 'console', type: 'decoration', component: 'MixingConsole', position: { x: 50, y: 22 }, zIndex: 1 },
      { id: 'leds', type: 'decoration', component: 'LEDStrip', position: { x: 50, y: 15 }, zIndex: 0 },
    ],
  },
  space: {
    id: 'space',
    name: 'Space',
    description: 'Cosmic journey',
    emoji: '🚀',
    ground: {
      horizonY: 35,
      walkableArea: {
        minX: 15,
        maxX: 85,
        minY: 40,
        maxY: 80,
      },
      scaleRange: {
        min: 0.45,
        max: 1.3,
      },
      groundStyle: {
        type: 'gradient',
        colors: ['#0a0a20', '#151530', '#202045'],
      },
      backdropStyle: {
        type: 'gradient',
        colors: ['#000000', '#0a0a20', '#15152d'],
      },
    },
    elements: [
      { id: 'stars', type: 'decoration', component: 'StarField', position: { x: 50, y: 20 }, zIndex: 0 },
      { id: 'planet', type: 'decoration', component: 'Planet', position: { x: 75, y: 15 }, zIndex: 1 },
      { id: 'platform', type: 'decoration', component: 'SpacePlatform', position: { x: 50, y: 60 }, zIndex: 5 },
    ],
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Magical glade',
    emoji: '🌲',
    ground: {
      horizonY: 25,
      walkableArea: {
        minX: 8,
        maxX: 92,
        minY: 30,
        maxY: 80,
      },
      scaleRange: {
        min: 0.4,
        max: 1.3,
      },
      groundStyle: {
        type: 'gradient',
        colors: ['#2d5a27', '#3d7a37', '#4d9a47'],
      },
      backdropStyle: {
        type: 'gradient',
        colors: ['#87ceeb', '#98d8c8', '#b5e7a0'],
      },
    },
    elements: [
      { id: 'tree1', type: 'decoration', component: 'Tree', position: { x: 8, y: 30 }, scale: 1.5, zIndex: 2 },
      { id: 'tree2', type: 'decoration', component: 'Tree', position: { x: 92, y: 28 }, scale: 1.3, zIndex: 2 },
      { id: 'flowers', type: 'decoration', component: 'Flowers', position: { x: 50, y: 85 }, zIndex: 3 },
    ],
  },
};

// Musical key colors for scene theming
export const KEY_COLORS: Record<string, string> = {
  'C': '#ef4444', 'C#': '#f97316', 'Db': '#f97316',
  'D': '#eab308', 'D#': '#84cc16', 'Eb': '#84cc16',
  'E': '#22c55e', 'F': '#14b8a6', 'F#': '#06b6d4', 'Gb': '#06b6d4',
  'G': '#3b82f6', 'G#': '#6366f1', 'Ab': '#6366f1',
  'A': '#8b5cf6', 'A#': '#a855f7', 'Bb': '#a855f7', 'B': '#ec4899',
};

// Calculate avatar scale based on Y position within walkable area
export function calculateAvatarScale(
  yPercent: number,
  config: SceneGroundConfig
): number {
  const { walkableArea, scaleRange } = config;

  // Normalize Y position within walkable area (0 = horizon, 1 = front)
  const normalizedY = (yPercent - walkableArea.minY) / (walkableArea.maxY - walkableArea.minY);
  const clampedY = Math.max(0, Math.min(1, normalizedY));

  // Linear interpolation between min and max scale
  return scaleRange.min + (scaleRange.max - scaleRange.min) * clampedY;
}

// Calculate Z-index for proper layering (higher Y = closer = higher z-index)
export function calculateAvatarZIndex(
  yPercent: number,
  config: SceneGroundConfig,
  baseZIndex: number = 100
): number {
  const { walkableArea } = config;

  // Map Y position to z-index (higher Y = higher z-index)
  const normalizedY = (yPercent - walkableArea.minY) / (walkableArea.maxY - walkableArea.minY);
  const clampedY = Math.max(0, Math.min(1, normalizedY));

  return baseZIndex + Math.floor(clampedY * 100);
}

// Get random position within walkable area
export function getRandomWalkablePosition(
  config: SceneGroundConfig
): { x: number; y: number } {
  const { walkableArea } = config;

  return {
    x: walkableArea.minX + Math.random() * (walkableArea.maxX - walkableArea.minX),
    y: walkableArea.minY + Math.random() * (walkableArea.maxY - walkableArea.minY),
  };
}

// Clamp position to walkable area
export function clampToWalkableArea(
  x: number,
  y: number,
  config: SceneGroundConfig
): { x: number; y: number } {
  const { walkableArea } = config;
  return {
    x: Math.max(walkableArea.minX, Math.min(walkableArea.maxX, x)),
    y: Math.max(walkableArea.minY, Math.min(walkableArea.maxY, y)),
  };
}

// Get biased spawn position (for homepage - bottom of screen only)
export function getBiasedSpawnPosition(
  config: SceneGroundConfig,
  spawnMinY: number = 85
): { x: number; y: number } {
  const { walkableArea } = config;
  const x = walkableArea.minX + 5 + Math.random() * (walkableArea.maxX - walkableArea.minX - 10);
  const y = spawnMinY + Math.random() * (walkableArea.maxY - spawnMinY - 3);
  return { x, y };
}
