import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import { uploadAvatarComponentWithThumbnail, uploadAvatarColorVariant } from '@/lib/storage/r2';
import { processAvatarComponent, createThumbnail, validateAvatarImage } from '@/lib/avatar/image-processor';

interface UploadBody {
  imageUrl?: string;
  imageData?: string;
  categoryId: string;
  componentId: string;
  colorVariant?: string;
  removeBackground?: boolean;
  backgroundThreshold?: number;
}

/**
 * Process and upload an avatar component image
 * - Validates image
 * - Removes background (white/near-white becomes transparent)
 * - Resizes to standard 512x512 canvas
 * - Creates thumbnail
 * - Uploads to R2
 */
async function processAndUpload(
  buffer: Buffer,
  categoryId: string,
  componentId: string,
  options: { removeBackground?: boolean; backgroundThreshold?: number } = {}
) {
  // Validate image
  const validation = await validateAvatarImage(buffer);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image');
  }

  // Process image (remove background, resize to 512x512)
  const processed = await processAvatarComponent(buffer, {
    removeBackground: options.removeBackground ?? true,
    backgroundThreshold: options.backgroundThreshold ?? 250,
  });

  // Create thumbnail
  const thumbnail = await createThumbnail(processed.buffer, 128);

  // Upload both
  const result = await uploadAvatarComponentWithThumbnail(
    processed.buffer,
    thumbnail,
    categoryId,
    componentId
  );

  return {
    ...result,
    processed: {
      width: processed.width,
      height: processed.height,
      hasTransparency: processed.hasTransparency,
    },
  };
}

// POST /api/admin/avatar/upload - Upload avatar component image
export const POST = withAdminAuth(async (req, user) => {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Handle JSON body (URL or base64)
    if (contentType.includes('application/json')) {
      const body = await req.json() as UploadBody;
      const { imageUrl, imageData, categoryId, componentId, colorVariant, removeBackground, backgroundThreshold } = body;

      if (!categoryId || !componentId) {
        return NextResponse.json(
          { error: 'categoryId and componentId are required' },
          { status: 400 }
        );
      }

      let buffer: Buffer;

      // Get buffer from URL
      if (imageUrl) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        buffer = Buffer.from(await response.arrayBuffer());
      }
      // Get buffer from base64
      else if (imageData) {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        return NextResponse.json(
          { error: 'Either imageUrl or imageData is required' },
          { status: 400 }
        );
      }

      // Handle color variant upload (still process but store separately)
      if (colorVariant) {
        const processed = await processAvatarComponent(buffer, {
          removeBackground: removeBackground ?? true,
          backgroundThreshold: backgroundThreshold ?? 250,
        });
        const result = await uploadAvatarColorVariant(processed.buffer, categoryId, componentId, colorVariant);
        return NextResponse.json(result);
      }

      // Process and upload main component
      const result = await processAndUpload(buffer, categoryId, componentId, {
        removeBackground,
        backgroundThreshold,
      });
      return NextResponse.json(result);
    }

    // Handle multipart form data
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const categoryId = formData.get('categoryId') as string | null;
      const componentId = formData.get('componentId') as string | null;
      const colorVariant = formData.get('colorVariant') as string | null;
      const removeBackground = formData.get('removeBackground') !== 'false';

      if (!file || !categoryId || !componentId) {
        return NextResponse.json(
          { error: 'file, categoryId, and componentId are required' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (colorVariant) {
        const processed = await processAvatarComponent(buffer, { removeBackground });
        const result = await uploadAvatarColorVariant(processed.buffer, categoryId, componentId, colorVariant);
        return NextResponse.json(result);
      }

      const result = await processAndUpload(buffer, categoryId, componentId, { removeBackground });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to upload image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    );
  }
});
