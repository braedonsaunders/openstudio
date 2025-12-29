import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminSupabase } from '@/lib/supabase/server';
import { getComponentById } from '@/lib/avatar/supabase';
import { processAvatarComponent, createThumbnail, applyEraserMask } from '@/lib/avatar/image-processor';
import { downloadAvatarComponent, uploadAvatarComponentWithThumbnail, getAvatarUrl } from '@/lib/storage/r2';

interface ReprocessBody {
  componentId: string;
  removeBackground?: boolean;
  backgroundThreshold?: number;
  specSizeThreshold?: number;
  cleanupSpecs?: boolean;
  feathering?: number;
  eraserMask?: string; // Base64 PNG mask
  bgColor?: { r: number; g: number; b: number };
  colorTolerance?: number;
  useFloodFill?: boolean;
  previewOnly?: boolean;
}

/**
 * Reprocess an avatar component's image with new background removal settings
 * - If previewOnly, returns a base64 preview
 * - Otherwise, saves the reprocessed image to R2 and updates the component
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ReprocessBody;
    const {
      componentId,
      removeBackground = true,
      backgroundThreshold = 220,
      specSizeThreshold = 100,
      cleanupSpecs = true,
      feathering = 0,
      eraserMask,
      bgColor = { r: 255, g: 255, b: 255 },
      colorTolerance = 30,
      useFloodFill = true,
      previewOnly = false,
    } = body;

    if (!componentId) {
      return NextResponse.json(
        { error: 'componentId is required' },
        { status: 400 }
      );
    }

    // Get the component
    const component = await getComponentById(componentId);
    if (!component) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }

    if (!component.r2Key) {
      return NextResponse.json(
        { error: 'Component has no R2 key' },
        { status: 400 }
      );
    }

    // Download the original image from R2
    let originalBuffer: Buffer;
    try {
      originalBuffer = await downloadAvatarComponent(component.r2Key);
    } catch (err) {
      console.error('Failed to download from R2:', err);
      // Try fetching from imageUrl as fallback
      if (component.imageUrl) {
        const response = await fetch(component.imageUrl);
        if (!response.ok) {
          return NextResponse.json(
            { error: 'Failed to download original image' },
            { status: 500 }
          );
        }
        originalBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        return NextResponse.json(
          { error: 'Failed to download original image' },
          { status: 500 }
        );
      }
    }

    // Reprocess with new settings
    let processed = await processAvatarComponent(originalBuffer, {
      removeBackground,
      backgroundThreshold,
      cleanupSpecs,
      specSizeThreshold,
      feathering,
      targetColor: bgColor,
      colorTolerance,
      useFloodFill,
    });

    // Apply eraser mask if provided
    if (eraserMask) {
      const maskedBuffer = await applyEraserMask(processed.buffer, eraserMask);
      processed = {
        ...processed,
        buffer: maskedBuffer,
      };
    }

    if (previewOnly) {
      // Return base64 preview
      const base64 = processed.buffer.toString('base64');
      return NextResponse.json({
        previewUrl: `data:image/png;base64,${base64}`,
      });
    }

    // Save to R2
    const thumbnail = await createThumbnail(processed.buffer, 128);
    const uploadResult = await uploadAvatarComponentWithThumbnail(
      processed.buffer,
      thumbnail,
      component.categoryId,
      component.id
    );

    // Update component in database with R2 keys (not presigned URLs)
    // The keys will be converted to fresh signed URLs when fetched
    const adminClient = getAdminSupabase();
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Admin client not configured' },
        { status: 500 }
      );
    }

    await adminClient
      .from('avatar_components')
      .update({
        image_url: uploadResult.key,
        thumbnail_url: uploadResult.thumbnailKey,
        r2_key: uploadResult.key,
        updated_at: new Date().toISOString(),
      })
      .eq('id', component.id);

    // Return fresh signed URLs for immediate display
    const displayImageUrl = await getAvatarUrl(uploadResult.key);
    const displayThumbnailUrl = uploadResult.thumbnailKey
      ? await getAvatarUrl(uploadResult.thumbnailKey)
      : undefined;

    return NextResponse.json({
      success: true,
      imageUrl: displayImageUrl,
      thumbnailUrl: displayThumbnailUrl,
    });
  } catch (error) {
    console.error('Failed to reprocess image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reprocess image' },
      { status: 500 }
    );
  }
}
