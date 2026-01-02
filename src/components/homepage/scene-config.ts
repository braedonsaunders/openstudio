// Homepage Scene Configuration
// Re-exports shared world configuration with homepage-specific extensions

import type { HomepageSceneType } from '@/types/avatar';

// Re-export shared types and utilities
export {
  calculateAvatarScale,
  calculateAvatarZIndex,
  getRandomWalkablePosition,
  clampToWalkableArea,
  KEY_COLORS,
} from '@/components/world/scene-config';

export type {
  SceneGroundConfig,
} from '@/components/world/scene-config';

// Homepage-specific scene element type
export interface SceneElement {
  id: string;
  type: 'decoration' | 'interactive';
  component: string; // Component name to render
  position: { x: number; y: number }; // Percentages
  scale?: number;
  zIndex?: number;
}

// Extended scene config with homepage-specific elements
export interface SceneConfig {
  id: HomepageSceneType;
  name: string;
  description: string;
  emoji?: string;
  ground: import('@/components/world/scene-config').SceneGroundConfig;
  elements?: SceneElement[];
}

// Default scene configurations with perspective ground
export const SCENE_CONFIGS: Record<HomepageSceneType, SceneConfig> = {
  campfire: {
    id: 'campfire',
    name: 'Campfire',
    description: 'Cozy night jam session',
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
    description: 'City vibes at dusk',
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
    description: 'Pro recording vibe',
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
        pattern: 'grid', // Studio floor grid
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
    description: 'Magical meadow',
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
