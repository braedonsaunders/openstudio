// Server-side image processing for avatar components
// Handles background removal, resizing, and format conversion

import sharp from 'sharp';

// Standard avatar canvas size - all components use this
export const AVATAR_CANVAS_SIZE = 512;

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  hasTransparency: boolean;
}

/**
 * Process an avatar component image:
 * 1. Remove white/near-white background (make transparent)
 * 2. Resize to standard canvas size
 * 3. Convert to PNG with alpha channel
 */
export async function processAvatarComponent(
  input: Buffer,
  options: {
    removeBackground?: boolean;
    backgroundThreshold?: number; // 0-255, pixels lighter than this become transparent
  } = {}
): Promise<ProcessedImage> {
  const { removeBackground = true, backgroundThreshold = 250 } = options;

  let image = sharp(input);
  const metadata = await image.metadata();

  // Ensure we have an alpha channel
  image = image.ensureAlpha();

  if (removeBackground) {
    // Get raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Process pixels - make white/near-white transparent
    const pixels = new Uint8Array(data);
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Check if pixel is white/near-white
      if (r >= backgroundThreshold && g >= backgroundThreshold && b >= backgroundThreshold) {
        pixels[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    // Recreate image from processed pixels
    image = sharp(Buffer.from(pixels), {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    });
  }

  // Resize to standard canvas size, maintaining aspect ratio and centering
  const resized = await image
    .resize(AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return {
    buffer: resized,
    width: AVATAR_CANVAS_SIZE,
    height: AVATAR_CANVAS_SIZE,
    hasTransparency: true,
  };
}

/**
 * Create a thumbnail from a processed avatar component
 */
export async function createThumbnail(
  input: Buffer,
  size: number = 128
): Promise<Buffer> {
  return sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * Remove background using more advanced color detection
 * Removes pixels that are close to white or a specified color
 */
export async function removeBackgroundAdvanced(
  input: Buffer,
  options: {
    targetColor?: { r: number; g: number; b: number };
    tolerance?: number; // 0-255, how close to target color to remove
    edgeFeathering?: number; // Pixels to feather at edges
  } = {}
): Promise<Buffer> {
  const {
    targetColor = { r: 255, g: 255, b: 255 },
    tolerance = 30,
    edgeFeathering = 1,
  } = options;

  const image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Calculate color distance from target
    const distance = Math.sqrt(
      Math.pow(r - targetColor.r, 2) +
      Math.pow(g - targetColor.g, 2) +
      Math.pow(b - targetColor.b, 2)
    );

    if (distance <= tolerance) {
      // Feather the alpha based on distance
      const alpha = Math.min(255, Math.floor((distance / tolerance) * 255));
      pixels[i + 3] = alpha;
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Composite multiple layers into a single image
 * Server-side version for generating preview images
 */
export async function compositeLayersServer(
  layers: Array<{ buffer: Buffer; zIndex: number }>
): Promise<Buffer> {
  // Sort by z-index (lower = behind)
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  // Start with transparent canvas
  let composite = sharp({
    create: {
      width: AVATAR_CANVAS_SIZE,
      height: AVATAR_CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  // Build composite inputs
  const compositeInputs = sortedLayers.map((layer) => ({
    input: layer.buffer,
    top: 0,
    left: 0,
  }));

  if (compositeInputs.length > 0) {
    composite = composite.composite(compositeInputs);
  }

  return composite.png().toBuffer();
}

/**
 * Validate that an image is suitable for avatar use
 */
export async function validateAvatarImage(
  input: Buffer
): Promise<{ valid: boolean; error?: string; metadata?: sharp.Metadata }> {
  try {
    const metadata = await sharp(input).metadata();

    if (!metadata.width || !metadata.height) {
      return { valid: false, error: 'Could not read image dimensions' };
    }

    if (metadata.width < 64 || metadata.height < 64) {
      return { valid: false, error: 'Image too small (minimum 64x64)' };
    }

    if (metadata.width > 4096 || metadata.height > 4096) {
      return { valid: false, error: 'Image too large (maximum 4096x4096)' };
    }

    const supportedFormats = ['jpeg', 'png', 'webp', 'gif'];
    if (metadata.format && !supportedFormats.includes(metadata.format)) {
      return { valid: false, error: `Unsupported format: ${metadata.format}` };
    }

    return { valid: true, metadata };
  } catch (error) {
    return { valid: false, error: 'Failed to read image' };
  }
}
