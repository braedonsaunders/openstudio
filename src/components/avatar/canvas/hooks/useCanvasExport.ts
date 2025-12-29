'use client';

import { useCallback, useRef } from 'react';
import type Konva from 'konva';
import type { CanvasData, CanvasLayer, AvatarComponent } from '@/types/avatar';

const CANVAS_SIZE = 512;
const HEADSHOT_SIZE = 256;

interface ThumbnailUrls {
  xs: string; // 32px
  sm: string; // 48px
  md: string; // 64px
  lg: string; // 128px
}

interface ExportedAvatars {
  fullBodyDataUrl: string;
  headshotDataUrl: string;
  thumbnails: ThumbnailUrls;
}

export function useCanvasExport() {
  const stageRef = useRef<Konva.Stage | null>(null);

  const setStageRef = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
  }, []);

  // Generate headshot by cropping a square from upper portion of centered content
  const generateHeadshot = useCallback(async (fullBodyDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = HEADSHOT_SIZE;
        canvas.height = HEADSHOT_SIZE;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Clear to transparent
        ctx.clearRect(0, 0, HEADSHOT_SIZE, HEADSHOT_SIZE);

        // Crop a square from upper portion (top 65% centered)
        // Source: 512x512, take upper square portion
        const cropSize = CANVAS_SIZE; // Keep full width
        const cropY = 0; // Start from top

        // Draw maintaining aspect ratio - just scale down the full image
        // This preserves the centered content
        ctx.drawImage(
          img,
          0, cropY, CANVAS_SIZE, CANVAS_SIZE,  // Source: full square from top
          0, 0, HEADSHOT_SIZE, HEADSHOT_SIZE   // Dest: fill headshot maintaining ratio
        );

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image for headshot'));
      img.src = fullBodyDataUrl;
    });
  }, []);

  // Generate thumbnails at various sizes
  const generateThumbnails = useCallback(async (fullBodyDataUrl: string): Promise<ThumbnailUrls> => {
    const sizes = { xs: 32, sm: 48, md: 64, lg: 128 };
    const thumbnails: Partial<ThumbnailUrls> = {};

    await Promise.all(
      Object.entries(sizes).map(async ([key, size]) => {
        const dataUrl = await resizeImage(fullBodyDataUrl, size);
        thumbnails[key as keyof ThumbnailUrls] = dataUrl;
      })
    );

    return thumbnails as ThumbnailUrls;
  }, []);

  // Helper to resize image with transparency support
  const resizeImage = useCallback((dataUrl: string, size: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Clear to transparent before drawing
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image for resize'));
      img.src = dataUrl;
    });
  }, []);

  // Export all avatar images from the Konva stage (with centering)
  const exportFromStage = useCallback(async (
    canvasData?: CanvasData,
    components?: Map<string, AvatarComponent>
  ): Promise<ExportedAvatars | null> => {
    // If we have canvas data and components, use the canvas data export for proper centering
    if (canvasData && components) {
      return exportFromCanvasDataInternal(canvasData, components);
    }

    const stage = stageRef.current;
    if (!stage) {
      console.error('Stage ref not set');
      return null;
    }

    try {
      // Generate full body at 512x512 (transparent background)
      // Note: This path doesn't center - use exportFromCanvasData for proper centering
      const fullBodyDataUrl = stage.toDataURL({
        pixelRatio: 1,
        mimeType: 'image/png',
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
      });

      // Generate headshot and thumbnails
      const [headshotDataUrl, thumbnails] = await Promise.all([
        generateHeadshot(fullBodyDataUrl),
        generateThumbnails(fullBodyDataUrl),
      ]);

      return {
        fullBodyDataUrl,
        headshotDataUrl,
        thumbnails,
      };
    } catch (error) {
      console.error('Failed to export avatar:', error);
      return null;
    }
  }, [generateHeadshot, generateThumbnails]);

  // Internal export function - renders exactly as positioned (WYSIWYG)
  const exportFromCanvasDataInternal = async (
    canvasData: CanvasData,
    components: Map<string, AvatarComponent>
  ): Promise<ExportedAvatars | null> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('Could not get canvas context');

      // Always clear to transparent (no background fill)
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Sort layers by zIndex
      const sortedLayers = [...canvasData.layers].sort((a, b) => a.zIndex - b.zIndex);

      // Draw each layer exactly as positioned (no centering - WYSIWYG)
      for (const layer of sortedLayers) {
        const component = components.get(layer.componentId);
        if (!component) continue;

        // Get image URL (color variant or base)
        const imageUrl = layer.colorVariant && component.colorVariants?.[layer.colorVariant]
          ? component.colorVariants[layer.colorVariant]
          : component.imageUrl;

        // Draw layer with its exact transform
        await drawLayerImage(ctx, imageUrl, layer.transform);
      }

      const fullBodyDataUrl = canvas.toDataURL('image/png');

      const [headshotDataUrl, thumbnails] = await Promise.all([
        generateHeadshot(fullBodyDataUrl),
        generateThumbnails(fullBodyDataUrl),
      ]);

      return {
        fullBodyDataUrl,
        headshotDataUrl,
        thumbnails,
      };
    } catch (error) {
      console.error('Failed to export from canvas data:', error);
      return null;
    }
  };

  // Export using canvas data (without Konva stage) - with auto-centering
  const exportFromCanvasData = useCallback(
    async (
      canvasData: CanvasData,
      components: Map<string, AvatarComponent>
    ): Promise<ExportedAvatars | null> => {
      return exportFromCanvasDataInternal(canvasData, components);
    },
    [generateHeadshot, generateThumbnails]
  );

  return {
    stageRef,
    setStageRef,
    exportFromStage,
    exportFromCanvasData,
  };
}

// Helper function to draw a layer image with transforms
async function drawLayerImage(
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    opacity: number;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();

      // Set opacity
      ctx.globalAlpha = transform.opacity;

      // Match Konva's transform order exactly:
      // 1. Translate to position (x, y)
      ctx.translate(transform.x, transform.y);

      // 2. Apply rotation (around the origin point, which is now at x,y)
      ctx.rotate((transform.rotation * Math.PI) / 180);

      // 3. Apply scale for flip
      ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);

      // 4. Apply offset (Konva uses offsetX/offsetY to shift the drawing point)
      // When flipped, Konva sets offset to width/height to flip around the correct edge
      const offsetX = transform.flipX ? transform.width : 0;
      const offsetY = transform.flipY ? transform.height : 0;
      ctx.translate(-offsetX, -offsetY);

      // 5. Draw image at origin (0, 0)
      ctx.drawImage(img, 0, 0, transform.width, transform.height);

      ctx.restore();
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

export type UseCanvasExportReturn = ReturnType<typeof useCanvasExport>;
