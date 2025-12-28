// Client-side avatar compositor using HTML Canvas

import type {
  AvatarCategory,
  AvatarComponent,
  UserAvatarConfig,
  AvatarSize,
  AVATAR_SIZES,
} from '@/types/avatar';

const SIZES: Record<AvatarSize, number> = {
  xs: 32,
  sm: 48,
  md: 64,
  lg: 128,
  xl: 256,
};

// Image cache to avoid re-fetching
const imageCache = new Map<string, HTMLImageElement>();
const pendingLoads = new Map<string, Promise<HTMLImageElement>>();

/**
 * Load an image with caching
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  // Return cached image if available
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  // Return pending promise if already loading
  if (pendingLoads.has(url)) {
    return pendingLoads.get(url)!;
  }

  // Create new load promise
  const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      pendingLoads.delete(url);
      resolve(img);
    };
    img.onerror = () => {
      pendingLoads.delete(url);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });

  pendingLoads.set(url, loadPromise);
  return loadPromise;
}

/**
 * Preload images for faster compositing
 */
export async function preloadImages(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map(loadImage));
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
  pendingLoads.clear();
}

/**
 * Get the URL for a component, considering color variants
 */
function getComponentImageUrl(
  component: AvatarComponent,
  colorVariant?: string
): string {
  if (colorVariant && component.colorVariants?.[colorVariant]) {
    return component.colorVariants[colorVariant];
  }
  return component.imageUrl;
}

export interface CompositorOptions {
  size: AvatarSize;
  categories: AvatarCategory[];
  components: Map<string, AvatarComponent>;
}

/**
 * Composite avatar layers into a single image
 */
export async function compositeAvatar(
  config: UserAvatarConfig,
  options: CompositorOptions
): Promise<string> {
  const { size, categories, components } = options;
  const dimension = SIZES[size];

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext('2d')!;

  // Sort categories by layer order (lower = rendered first / behind)
  const sortedCategories = [...categories].sort(
    (a, b) => a.layerOrder - b.layerOrder
  );

  // Draw each layer
  for (const category of sortedCategories) {
    const selection = config.selections[category.id];
    if (!selection?.componentId) continue;

    const component = components.get(selection.componentId);
    if (!component || !component.isActive) continue;

    // Get the correct image URL (base or color variant)
    const imageUrl = getComponentImageUrl(component, selection.colorVariant);

    try {
      const img = await loadImage(imageUrl);
      ctx.drawImage(img, 0, 0, dimension, dimension);
    } catch (error) {
      console.warn(`Failed to load component: ${component.id}`, error);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Composite avatar with a loading callback for progress tracking
 */
export async function compositeAvatarWithProgress(
  config: UserAvatarConfig,
  options: CompositorOptions,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  const { size, categories, components } = options;
  const dimension = SIZES[size];

  // Get all components to render
  const layersToRender: Array<{
    category: AvatarCategory;
    component: AvatarComponent;
    colorVariant?: string;
  }> = [];

  const sortedCategories = [...categories].sort(
    (a, b) => a.layerOrder - b.layerOrder
  );

  for (const category of sortedCategories) {
    const selection = config.selections[category.id];
    if (!selection?.componentId) continue;

    const component = components.get(selection.componentId);
    if (!component || !component.isActive) continue;

    layersToRender.push({
      category,
      component,
      colorVariant: selection.colorVariant,
    });
  }

  // Preload all images with progress tracking
  let loaded = 0;
  const total = layersToRender.length;

  const images = await Promise.all(
    layersToRender.map(async ({ component, colorVariant }) => {
      const url = getComponentImageUrl(component, colorVariant);
      try {
        const img = await loadImage(url);
        loaded++;
        onProgress?.(loaded, total);
        return img;
      } catch {
        loaded++;
        onProgress?.(loaded, total);
        return null;
      }
    })
  );

  // Create canvas and draw
  const canvas = document.createElement('canvas');
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext('2d')!;

  for (const img of images) {
    if (img) {
      ctx.drawImage(img, 0, 0, dimension, dimension);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generate avatar at multiple sizes
 */
export async function compositeAvatarMultiSize(
  config: UserAvatarConfig,
  categories: AvatarCategory[],
  components: Map<string, AvatarComponent>,
  sizes: AvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
): Promise<Record<AvatarSize, string>> {
  const results: Partial<Record<AvatarSize, string>> = {};

  // Generate largest size first
  const sortedSizes = [...sizes].sort((a, b) => SIZES[b] - SIZES[a]);

  for (const size of sortedSizes) {
    results[size] = await compositeAvatar(config, {
      size,
      categories,
      components,
    });
  }

  return results as Record<AvatarSize, string>;
}

/**
 * Create a preview composite from a list of component IDs
 * Useful for showing what an avatar would look like before saving
 */
export async function createPreviewComposite(
  componentIds: string[],
  categories: AvatarCategory[],
  components: Map<string, AvatarComponent>,
  size: AvatarSize = 'lg'
): Promise<string> {
  const dimension = SIZES[size];
  const canvas = document.createElement('canvas');
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext('2d')!;

  // Sort by layer order
  const componentsToRender = componentIds
    .map((id) => components.get(id))
    .filter((c): c is AvatarComponent => !!c)
    .sort((a, b) => {
      const catA = categories.find((c) => c.id === a.categoryId);
      const catB = categories.find((c) => c.id === b.categoryId);
      return (catA?.layerOrder ?? 0) - (catB?.layerOrder ?? 0);
    });

  for (const component of componentsToRender) {
    try {
      const img = await loadImage(component.imageUrl);
      ctx.drawImage(img, 0, 0, dimension, dimension);
    } catch (error) {
      console.warn(`Failed to load component: ${component.id}`, error);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Check if all required categories have selections
 */
export function validateAvatarConfig(
  config: UserAvatarConfig,
  categories: AvatarCategory[]
): { valid: boolean; missingCategories: string[] } {
  const missingCategories: string[] = [];

  for (const category of categories) {
    if (category.isRequired && category.isActive) {
      const selection = config.selections[category.id];
      if (!selection?.componentId) {
        missingCategories.push(category.id);
      }
    }
  }

  return {
    valid: missingCategories.length === 0,
    missingCategories,
  };
}

/**
 * Create an empty avatar config for a user
 */
export function createEmptyAvatarConfig(userId: string): UserAvatarConfig {
  return {
    id: crypto.randomUUID(),
    userId,
    selections: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
