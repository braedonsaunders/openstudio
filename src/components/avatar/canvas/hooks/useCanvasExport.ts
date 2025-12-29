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

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Calculate the bounding box of a layer considering rotation
function getLayerBounds(layer: CanvasLayer): BoundingBox {
  const { x, y, width, height, rotation } = layer.transform;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  // Rotated bounding box dimensions
  const rotatedWidth = width * cos + height * sin;
  const rotatedHeight = width * sin + height * cos;

  return {
    minX: centerX - rotatedWidth / 2,
    minY: centerY - rotatedHeight / 2,
    maxX: centerX + rotatedWidth / 2,
    maxY: centerY + rotatedHeight / 2,
  };
}

// Calculate combined bounding box of all layers
function getContentBounds(layers: CanvasLayer[]): BoundingBox | null {
  if (layers.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layer of layers) {
    const bounds = getLayerBounds(layer);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  return { minX, minY, maxX, maxY };
}

export function useCanvasExport() {
  const stageRef = useRef<Konva.Stage | null>(null);

  const setStageRef = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
  }, []);

  // Generate headshot by cropping upper portion of centered content
  const generateHeadshot = useCallback(async (fullBodyDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = HEADSHOT_SIZE;
        canvas.height = HEADSHOT_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Crop upper 60% of the full body (centered content)
        const cropHeight = CANVAS_SIZE * 0.6;
        ctx.drawImage(
          img,
          0, 0, CANVAS_SIZE, cropHeight,      // Source: top 60%
          0, 0, HEADSHOT_SIZE, HEADSHOT_SIZE  // Dest: fill headshot
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

  // Helper to resize image
  const resizeImage = useCallback((dataUrl: string, size: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

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

  // Internal export function with centering logic
  const exportFromCanvasDataInternal = async (
    canvasData: CanvasData,
    components: Map<string, AvatarComponent>
  ): Promise<ExportedAvatars | null> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Always clear to transparent (no background fill)
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Sort layers by zIndex
      const sortedLayers = [...canvasData.layers].sort((a, b) => a.zIndex - b.zIndex);

      if (sortedLayers.length === 0) {
        // Empty canvas
        const fullBodyDataUrl = canvas.toDataURL('image/png');
        const [headshotDataUrl, thumbnails] = await Promise.all([
          generateHeadshot(fullBodyDataUrl),
          generateThumbnails(fullBodyDataUrl),
        ]);
        return { fullBodyDataUrl, headshotDataUrl, thumbnails };
      }

      // Calculate content bounds for centering
      const bounds = getContentBounds(sortedLayers);
      if (!bounds) {
        throw new Error('Could not calculate content bounds');
      }

      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;
      const contentCenterX = bounds.minX + contentWidth / 2;
      const contentCenterY = bounds.minY + contentHeight / 2;

      // Calculate offset to center content in canvas
      const canvasCenterX = CANVAS_SIZE / 2;
      const canvasCenterY = CANVAS_SIZE / 2;
      const offsetX = canvasCenterX - contentCenterX;
      const offsetY = canvasCenterY - contentCenterY;

      // Draw each layer with centering offset
      for (const layer of sortedLayers) {
        const component = components.get(layer.componentId);
        if (!component) continue;

        // Get image URL (color variant or base)
        const imageUrl = layer.colorVariant && component.colorVariants?.[layer.colorVariant]
          ? component.colorVariants[layer.colorVariant]
          : component.imageUrl;

        // Apply offset to transform for centering
        const centeredTransform = {
          ...layer.transform,
          x: layer.transform.x + offsetX,
          y: layer.transform.y + offsetY,
        };

        // Load and draw image
        await drawLayerImage(ctx, imageUrl, centeredTransform);
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

      // Move to center of where we want to draw
      const centerX = transform.x + transform.width / 2;
      const centerY = transform.y + transform.height / 2;
      ctx.translate(centerX, centerY);

      // Apply rotation
      ctx.rotate((transform.rotation * Math.PI) / 180);

      // Apply flip
      ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);

      // Draw image centered
      ctx.drawImage(
        img,
        -transform.width / 2,
        -transform.height / 2,
        transform.width,
        transform.height
      );

      ctx.restore();
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

export type UseCanvasExportReturn = ReturnType<typeof useCanvasExport>;
