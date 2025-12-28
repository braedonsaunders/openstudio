'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { compositeAvatar, preloadImages, type CompositorLayer } from '@/lib/avatar/compositor';
import type { UserAvatarConfig, AvatarCategory, AvatarComponent } from '@/types/avatar';

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
    if (!canvasRef.current || !config) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build layers from config
      const layers: CompositorLayer[] = [];
      const selectedComponents = config.selectedComponents || {};
      const selectedColors = config.selectedColors || {};

      // Sort categories by layer order
      const sortedCategories = [...categories].sort((a, b) => a.layerOrder - b.layerOrder);

      for (const category of sortedCategories) {
        const componentIds = selectedComponents[category.id];
        if (!componentIds || componentIds.length === 0) continue;

        for (const componentId of componentIds) {
          const component = components.find((c) => c.id === componentId);
          if (!component || !component.isActive) continue;

          // Check for color variant
          const colorVariant = selectedColors[category.id];
          let imageUrl = component.imageUrl;

          if (colorVariant && component.colorVariants) {
            const variantUrl = component.colorVariants[colorVariant];
            if (variantUrl) {
              imageUrl = variantUrl;
            }
          }

          layers.push({
            imageUrl,
            zIndex: category.layerOrder,
          });
        }
      }

      if (layers.length === 0) {
        // No layers to render - show placeholder
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, size, size);
          ctx.fillStyle = '#374151';
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        setIsLoading(false);
        onRenderComplete?.();
        return;
      }

      // Preload images
      await preloadImages(layers.map((l) => l.imageUrl));

      // Composite the avatar
      const dataUrl = await compositeAvatar(layers, size, size);

      // Draw to canvas
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          setIsLoading(false);
          onRenderComplete?.();
        };
        img.onerror = () => {
          setError('Failed to render avatar');
          setIsLoading(false);
        };
        img.src = dataUrl;
      }
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
        const layers: CompositorLayer[] = [];
        const selectedComponents = config.selectedComponents || {};
        const selectedColors = config.selectedColors || {};

        const sortedCategories = [...categories].sort((a, b) => a.layerOrder - b.layerOrder);

        for (const category of sortedCategories) {
          const componentIds = selectedComponents[category.id];
          if (!componentIds || componentIds.length === 0) continue;

          for (const componentId of componentIds) {
            const component = components.find((c) => c.id === componentId);
            if (!component || !component.isActive) continue;

            const colorVariant = selectedColors[category.id];
            let imageUrl = component.imageUrl;

            if (colorVariant && component.colorVariants) {
              const variantUrl = component.colorVariants[colorVariant];
              if (variantUrl) {
                imageUrl = variantUrl;
              }
            }

            layers.push({
              imageUrl,
              zIndex: category.layerOrder,
            });
          }
        }

        if (layers.length === 0) {
          setIsLoading(false);
          return null;
        }

        await preloadImages(layers.map((l) => l.imageUrl));
        const dataUrl = await compositeAvatar(layers, size, size);

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
