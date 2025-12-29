/**
 * Standalone canvas export utility for rendering CanvasData to images
 * Used by admin character creation to generate preview images
 */

import type { CanvasData, CanvasLayer, AvatarComponent } from '@/types/avatar';

const CANVAS_SIZE = 512;

/**
 * Export canvas data to a PNG data URL
 * Renders the canvas exactly as composed (WYSIWYG)
 */
export async function exportCanvasToDataUrl(
  canvasData: CanvasData,
  components: Map<string, AvatarComponent>
): Promise<string | null> {
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

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to export canvas:', error);
    return null;
  }
}

/**
 * Helper function to draw a layer image with transforms
 */
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
