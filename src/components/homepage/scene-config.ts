// Homepage Scene Configuration
// Re-exports from unified world scene config

// Re-export everything from shared config
export {
  SCENE_CONFIGS,
  KEY_COLORS,
  calculateAvatarScale,
  calculateAvatarZIndex,
  getRandomWalkablePosition,
  clampToWalkableArea,
  getBiasedSpawnPosition,
} from '@/components/world/scene-config';

export type {
  SceneType,
  SceneConfig,
  SceneElement,
  SceneGroundConfig,
} from '@/components/world/scene-config';
