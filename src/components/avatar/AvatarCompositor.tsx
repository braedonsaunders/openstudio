'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { UserAvatarConfig, AvatarCategory, AvatarComponent, ComponentSelection } from '@/types/avatar';

// Image cache to avoid re-fetching
const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

interface AvatarCompositorProps {
  config: UserAvatarConfig | null;
  categories: AvatarCategory[];
  components: AvatarComponent[];
  size?: number;
  className?: string;
  onRenderComplete?: () => void;
  showLoadingState?: boolean;
}

export function AvatarCompositor({
  config,
  categories,
  components,
  size = 128,
  className = '',
  onRenderComplete,
  showLoadingState = true,
}: AvatarCompositorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const renderAvatar = useCallback(async () => {
    if (!canvasRef.current) {
      setIsLoading(false);
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      setIsLoading(false);
      return;
    }

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    if (!config || !config.selections || Object.keys(config.selections).length === 0) {
      // No config - show placeholder
      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      setIsLoading(false);
      onRenderComplete?.();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Sort categories by layer order
      const sortedCategories = [...categories].sort((a, b) => a.layerOrder - b.layerOrder);

      // Collect layers to render
      const layers: Array<{ url: string; order: number }> = [];

      for (const category of sortedCategories) {
        const selection = config.selections[category.id];
        if (!selection?.componentId) continue;

        const component = components.find((c) => c.id === selection.componentId);
        if (!component || !component.isActive) continue;

        // Get the image URL, considering color variants
        let imageUrl = component.imageUrl;
        if (selection.colorVariant && component.colorVariants?.[selection.colorVariant]) {
          imageUrl = component.colorVariants[selection.colorVariant];
        }

        layers.push({ url: imageUrl, order: category.layerOrder });
      }

      if (layers.length === 0) {
        // No layers - show placeholder
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
        setIsLoading(false);
        onRenderComplete?.();
        return;
      }

      // Load all images
      const images = await Promise.all(layers.map(async (layer) => {
        const img = await loadImage(layer.url);
        return { img, order: layer.order };
      }));

      // Sort by order and draw
      images.sort((a, b) => a.order - b.order);
      for (const { img } of images) {
        ctx.drawImage(img, 0, 0, size, size);
      }

      setIsLoading(false);
      onRenderComplete?.();
    } catch (err) {
      console.error('Failed to render avatar:', err);
      setError(err instanceof Error ? err.message : 'Failed to render avatar');
      setIsLoading(false);
    }
  }, [config, categories, components, size, onRenderComplete]);

  useEffect(() => {
    renderAvatar();
  }, [renderAvatar]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className={`rounded-full ${isLoading && showLoadingState ? 'opacity-50' : ''}`}
      />
      {isLoading && showLoadingState && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80 rounded-full">
          <span className="text-xs text-red-400">Error</span>
        </div>
      )}
    </div>
  );
}

// Static avatar display (pre-rendered image URL)
interface StaticAvatarProps {
  imageUrl?: string | null;
  username?: string;
  size?: number;
  className?: string;
}

export function StaticAvatar({ imageUrl, username, size = 40, className = '' }: StaticAvatarProps) {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    // Fallback to initials
    const initials = username
      ? username.slice(0, 2).toUpperCase()
      : '?';

    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={username || 'Avatar'}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={() => setHasError(true)}
    />
  );
}

// Hook for using the avatar compositor
export function useAvatarCompositor() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAvatarDataUrl = useCallback(
    async (
      config: UserAvatarConfig,
      categories: AvatarCategory[],
      components: AvatarComponent[],
      size = 256
    ): Promise<string | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Sort categories by layer order
        const sortedCategories = [...categories].sort((a, b) => a.layerOrder - b.layerOrder);

        // Collect layers to render
        const layers: Array<{ url: string; order: number }> = [];

        for (const category of sortedCategories) {
          const selection = config.selections?.[category.id];
          if (!selection?.componentId) continue;

          const component = components.find((c) => c.id === selection.componentId);
          if (!component || !component.isActive) continue;

          let imageUrl = component.imageUrl;
          if (selection.colorVariant && component.colorVariants?.[selection.colorVariant]) {
            imageUrl = component.colorVariants[selection.colorVariant];
          }

          layers.push({ url: imageUrl, order: category.layerOrder });
        }

        if (layers.length === 0) {
          setIsLoading(false);
          return null;
        }

        // Load and draw images
        const images = await Promise.all(layers.map(async (layer) => {
          const img = await loadImage(layer.url);
          return { img, order: layer.order };
        }));

        images.sort((a, b) => a.order - b.order);
        for (const { img } of images) {
          ctx.drawImage(img, 0, 0, size, size);
        }

        const dataUrl = canvas.toDataURL('image/png');
        setIsLoading(false);
        return dataUrl;
      } catch (err) {
        console.error('Failed to generate avatar:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate avatar');
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  return { generateAvatarDataUrl, isLoading, error };
}
