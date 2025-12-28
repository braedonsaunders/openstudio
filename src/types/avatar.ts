// Avatar Component System Types

export type ComponentRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type UnlockType = 'level' | 'achievement' | 'statistic' | 'manual' | 'none';

export type StatisticOperator = '>=' | '<=' | '=' | '>';

// ============================================
// DATABASE TYPES
// ============================================

export interface AvatarColorPalette {
  id: string;
  displayName: string;
  colors: string[];
  createdAt: string;
}

export interface AvatarCategory {
  id: string;
  displayName: string;
  layerOrder: number;
  isRequired: boolean;
  maxSelections: number;
  supportsColorVariants: boolean;
  defaultColorPalette?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvatarComponent {
  id: string;
  categoryId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  r2Key: string;
  tags: string[];
  rarity: ComponentRarity;
  colorVariants?: Record<string, string>; // { "black": "url", "blonde": "url" }
  baseColor?: string;
  generationPrompt?: string;
  generationModel?: string;
  generationParams?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface AvatarUnlockRule {
  id: string;
  displayName: string;
  description?: string;
  unlockType: UnlockType;
  levelRequired?: number;
  achievementId?: string;
  statisticKey?: string;
  statisticOperator?: StatisticOperator;
  statisticValue?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvatarComponentUnlock {
  componentId: string;
  unlockRuleId: string;
}

export interface UserUnlockedComponent {
  userId: string;
  componentId: string;
  unlockedAt: string;
  unlockedReason?: string;
}

export interface ComponentSelection {
  componentId: string;
  colorVariant?: string;
}

export interface UserAvatarConfig {
  id: string;
  userId: string;
  selections: Record<string, ComponentSelection>; // categoryId -> selection
  createdAt: string;
  updatedAt: string;
}

export interface AvatarGenerationPreset {
  id: string;
  name: string;
  promptTemplate: string;
  negativePrompt?: string;
  styleSuffix?: string;
  model: string;
  params?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

// ============================================
// CLIENT-SIDE TYPES
// ============================================

export interface AvatarComponentLibrary {
  categories: AvatarCategory[];
  components: AvatarComponent[];
  colorPalettes: Record<string, string[]>;
  unlockRules: AvatarUnlockRule[];
  componentUnlocks: AvatarComponentUnlock[];
}

export interface UserAvatarContext {
  config: UserAvatarConfig | null;
  unlockedComponentIds: Set<string>;
  library: AvatarComponentLibrary;
}

// ============================================
// API TYPES
// ============================================

export interface CreateComponentRequest {
  id: string;
  categoryId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  r2Key: string;
  tags?: string[];
  rarity?: ComponentRarity;
  colorVariants?: Record<string, string>;
  baseColor?: string;
  generationPrompt?: string;
  generationModel?: string;
  generationParams?: Record<string, unknown>;
}

export interface UpdateComponentRequest {
  name?: string;
  tags?: string[];
  rarity?: ComponentRarity;
  colorVariants?: Record<string, string>;
  baseColor?: string;
  isActive?: boolean;
  unlockRuleIds?: string[];
}

export interface CreateCategoryRequest {
  id: string;
  displayName: string;
  layerOrder: number;
  isRequired?: boolean;
  maxSelections?: number;
  supportsColorVariants?: boolean;
  defaultColorPalette?: string;
}

export interface UpdateCategoryRequest {
  displayName?: string;
  layerOrder?: number;
  isRequired?: boolean;
  maxSelections?: number;
  supportsColorVariants?: boolean;
  defaultColorPalette?: string;
  isActive?: boolean;
}

export interface CreateUnlockRuleRequest {
  id: string;
  displayName: string;
  description?: string;
  unlockType: UnlockType;
  levelRequired?: number;
  achievementId?: string;
  statisticKey?: string;
  statisticOperator?: StatisticOperator;
  statisticValue?: number;
}

export interface UpdateUnlockRuleRequest {
  displayName?: string;
  description?: string;
  unlockType?: UnlockType;
  levelRequired?: number;
  achievementId?: string;
  statisticKey?: string;
  statisticOperator?: StatisticOperator;
  statisticValue?: number;
  isActive?: boolean;
  componentIds?: string[];
}

export interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  presetId?: string;
  model?: 'flux-schnell' | 'flux-dev' | 'sdxl';
  count?: number;
  seed?: number;
}

export interface GenerateImageResponse {
  images: string[];
  seed: number;
  model: string;
}

export interface UploadComponentImageRequest {
  imageData: string; // base64 or URL
  filename: string;
  categoryId: string;
}

export interface UploadComponentImageResponse {
  imageUrl: string;
  thumbnailUrl: string;
  r2Key: string;
}

// ============================================
// COMPOSITOR TYPES
// ============================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const AVATAR_SIZES: Record<AvatarSize, number> = {
  xs: 32,
  sm: 48,
  md: 64,
  lg: 128,
  xl: 256,
};

export interface CompositorOptions {
  size: AvatarSize;
  categories: AvatarCategory[];
  components: Map<string, AvatarComponent>;
}

// ============================================
// ADMIN TYPES
// ============================================

export interface AdminAvatarStats {
  totalComponents: number;
  componentsByCategory: Record<string, number>;
  componentsByRarity: Record<ComponentRarity, number>;
  totalUnlockRules: number;
  lockedComponents: number;
}
