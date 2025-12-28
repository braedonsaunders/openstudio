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
 * Check if a pixel is white/near-white
 */
function isWhitePixel(r: number, g: number, b: number, threshold: number): boolean {
  return r >= threshold && g >= threshold && b >= threshold;
}

/**
 * Flood fill from edges to mark background pixels
 * This ensures we only remove white that connects to the image edges
 */
function floodFillFromEdges(
  pixels: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Set<number> {
  const background = new Set<number>();
  const queue: number[] = [];

  // Helper to get pixel index
  const getIdx = (x: number, y: number) => (y * width + x) * 4;

  // Check if position is valid and pixel is white
  const canVisit = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = getIdx(x, y);
    if (background.has(idx)) return false;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    return isWhitePixel(r, g, b, threshold);
  };

  // Seed from all edges
  for (let x = 0; x < width; x++) {
    // Top edge
    if (canVisit(x, 0)) {
      const idx = getIdx(x, 0);
      background.add(idx);
      queue.push(x, 0);
    }
    // Bottom edge
    if (canVisit(x, height - 1)) {
      const idx = getIdx(x, height - 1);
      background.add(idx);
      queue.push(x, height - 1);
    }
  }
  for (let y = 0; y < height; y++) {
    // Left edge
    if (canVisit(0, y)) {
      const idx = getIdx(0, y);
      background.add(idx);
      queue.push(0, y);
    }
    // Right edge
    if (canVisit(width - 1, y)) {
      const idx = getIdx(width - 1, y);
      background.add(idx);
      queue.push(width - 1, y);
    }
  }

  // Flood fill
  while (queue.length > 0) {
    const y = queue.pop()!;
    const x = queue.pop()!;

    // Check 4-connected neighbors
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (canVisit(nx, ny)) {
        const idx = getIdx(nx, ny);
        background.add(idx);
        queue.push(nx, ny);
      }
    }
  }

  return background;
}

/**
 * Process an avatar component image:
 * 1. Remove white/near-white background using flood fill from edges
 * 2. Clean up small isolated white specs
 * 3. Apply edge feathering for smoother transitions
 * 4. Resize to standard canvas size
 * 5. Convert to PNG with alpha channel
 */
export async function processAvatarComponent(
  input: Buffer,
  options: {
    removeBackground?: boolean;
    backgroundThreshold?: number; // 0-255, pixels lighter than this become transparent
    cleanupSpecs?: boolean; // Remove small isolated white regions
    specSizeThreshold?: number; // Max size of specs to remove
    feathering?: number; // Edge feathering amount in pixels
  } = {}
): Promise<ProcessedImage> {
  const {
    removeBackground = true,
    backgroundThreshold = 240, // Lower threshold for more aggressive removal
    cleanupSpecs = true,
    specSizeThreshold = 50, // Remove white specs smaller than this many pixels
    feathering = 0, // No feathering by default
  } = options;

  let image = sharp(input);

  // Ensure we have an alpha channel
  image = image.ensureAlpha();

  if (removeBackground) {
    // Get raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const width = info.width;
    const height = info.height;

    // Step 1: Flood fill from edges to find connected background
    const backgroundPixels = floodFillFromEdges(pixels, width, height, backgroundThreshold);

    // Step 2: Make background pixels transparent
    for (const idx of backgroundPixels) {
      pixels[idx + 3] = 0; // Set alpha to 0
    }

    // Step 3: Clean up small isolated white specs
    if (cleanupSpecs) {
      // Find remaining white pixels that aren't transparent
      const whitePixels = new Set<number>();
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i + 3] > 0 && // Not already transparent
          isWhitePixel(pixels[i], pixels[i + 1], pixels[i + 2], backgroundThreshold)
        ) {
          whitePixels.add(i);
        }
      }

      // Find connected components of white pixels
      const visited = new Set<number>();
      const getIdx = (x: number, y: number) => (y * width + x) * 4;
      const getCoords = (idx: number) => {
        const pixelNum = idx / 4;
        return [pixelNum % width, Math.floor(pixelNum / width)];
      };

      for (const startIdx of whitePixels) {
        if (visited.has(startIdx)) continue;

        // BFS to find connected component
        const component: number[] = [];
        const queue = [startIdx];
        visited.add(startIdx);

        while (queue.length > 0) {
          const idx = queue.shift()!;
          component.push(idx);
          const [x, y] = getCoords(idx);

          // Check 8-connected neighbors
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nidx = getIdx(nx, ny);
              if (!visited.has(nidx) && whitePixels.has(nidx)) {
                visited.add(nidx);
                queue.push(nidx);
              }
            }
          }
        }

        // If component is small enough, make it transparent (it's a spec)
        if (component.length <= specSizeThreshold) {
          for (const idx of component) {
            pixels[idx + 3] = 0;
          }
        }
      }
    }

    // Step 4: Apply edge feathering if enabled
    if (feathering > 0) {
      // Create a copy to read from while modifying
      const original = new Uint8Array(pixels);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const alpha = original[idx + 3];

          // Only process edge pixels (semi-transparent or next to transparent)
          if (alpha > 0 && alpha < 255) continue;
          if (alpha === 0) continue;

          // Check if this is an edge pixel (has transparent neighbor)
          let isEdge = false;
          for (let dy = -1; dy <= 1 && !isEdge; dy++) {
            for (let dx = -1; dx <= 1 && !isEdge; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nidx = (ny * width + nx) * 4;
              if (original[nidx + 3] === 0) isEdge = true;
            }
          }

          if (isEdge) {
            // Reduce alpha for edge pixels based on feathering distance
            // More feathering = more transparency at edges
            const newAlpha = Math.max(0, 255 - (feathering * 25));
            pixels[idx + 3] = newAlpha;
          }
        }
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
 * Apply an eraser mask to make specified pixels transparent
 * The mask is a PNG where white pixels indicate areas to erase
 */
export async function applyEraserMask(
  input: Buffer,
  maskBase64: string
): Promise<Buffer> {
  // Decode mask from base64
  const maskData = maskBase64.replace(/^data:image\/\w+;base64,/, '');
  const maskBuffer = Buffer.from(maskData, 'base64');

  // Get input image data
  const inputImage = sharp(input).ensureAlpha();
  const { data: inputData, info } = await inputImage.raw().toBuffer({ resolveWithObject: true });

  // Get mask data and resize to match input
  const maskImage = sharp(maskBuffer).ensureAlpha();
  const { data: maskDataRaw } = await maskImage
    .resize(info.width, info.height, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(inputData);
  const mask = new Uint8Array(maskDataRaw);

  // Apply mask: where mask is white (R > 128), make input transparent
  for (let i = 0; i < pixels.length; i += 4) {
    const maskR = mask[i];
    if (maskR > 128) {
      pixels[i + 3] = 0; // Make transparent
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
