import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/server';
import { getUserAvatarCanvas, saveUserAvatarCanvas, getUserUnlockedComponents } from '@/lib/avatar/supabase';
import { uploadAvatarImage } from '@/lib/avatar/storage';
import type { CanvasData } from '@/types/avatar';

// GET /api/avatar/canvas - Get current user's canvas data
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [canvas, unlockedIds] = await Promise.all([
      getUserAvatarCanvas(user.id),
      getUserUnlockedComponents(user.id),
    ]);

    return NextResponse.json({
      canvasData: canvas?.canvasData || null,
      fullBodyUrl: canvas?.fullBodyUrl || null,
      headshotUrl: canvas?.headshotUrl || null,
      thumbnailUrls: canvas?.thumbnailUrls || null,
      unlockedComponentIds: Array.from(unlockedIds),
    });
  } catch (error) {
    console.error('Failed to get avatar canvas:', error);
    return NextResponse.json(
      { error: 'Failed to get avatar canvas' },
      { status: 500 }
    );
  }
}

// PUT /api/avatar/canvas - Save current user's canvas with generated images
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { canvasData, fullBodyImage, headshotImage, thumbnails } = body as {
      canvasData: CanvasData;
      fullBodyImage: string;
      headshotImage: string;
      thumbnails: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
      };
    };

    if (!canvasData) {
      return NextResponse.json(
        { error: 'canvasData is required' },
        { status: 400 }
      );
    }

    // Validate canvas data structure
    if (typeof canvasData.version !== 'number' || !Array.isArray(canvasData.layers)) {
      return NextResponse.json(
        { error: 'Invalid canvas data structure' },
        { status: 400 }
      );
    }

    // Validate that user owns/has unlocked the components they're using
    const unlockedIds = await getUserUnlockedComponents(user.id);
    for (const layer of canvasData.layers) {
      if (!unlockedIds.has(layer.componentId)) {
        return NextResponse.json(
          { error: `Component ${layer.componentId} is not unlocked` },
          { status: 403 }
        );
      }
    }

    let fullBodyUrl: string | undefined;
    let headshotUrl: string | undefined;
    let thumbnailUrls: { xs: string; sm: string; md: string; lg: string } | undefined;

    // Upload images if provided
    if (fullBodyImage && headshotImage) {
      try {
        const [fullBodyResult, headshotResult] = await Promise.all([
          uploadAvatarImage(user.id, fullBodyImage, 'full-body'),
          uploadAvatarImage(user.id, headshotImage, 'headshot'),
        ]);

        fullBodyUrl = fullBodyResult.url;
        headshotUrl = headshotResult.url;

        // Upload thumbnails
        if (thumbnails) {
          const [xsResult, smResult, mdResult, lgResult] = await Promise.all([
            uploadAvatarImage(user.id, thumbnails.xs, 'thumb-xs'),
            uploadAvatarImage(user.id, thumbnails.sm, 'thumb-sm'),
            uploadAvatarImage(user.id, thumbnails.md, 'thumb-md'),
            uploadAvatarImage(user.id, thumbnails.lg, 'thumb-lg'),
          ]);

          thumbnailUrls = {
            xs: xsResult.url,
            sm: smResult.url,
            md: mdResult.url,
            lg: lgResult.url,
          };
        }
      } catch (uploadError) {
        console.error('Failed to upload avatar images:', uploadError);
        // Continue without images - just save canvas data
      }
    }

    // Save to database
    const canvas = await saveUserAvatarCanvas(
      user.id,
      canvasData,
      fullBodyUrl,
      headshotUrl,
      thumbnailUrls
    );

    return NextResponse.json({
      success: true,
      canvasData: canvas.canvasData,
      fullBodyUrl: canvas.fullBodyUrl,
      headshotUrl: canvas.headshotUrl,
      thumbnailUrls: canvas.thumbnailUrls,
    });
  } catch (error) {
    console.error('Failed to save avatar canvas:', error);
    return NextResponse.json(
      { error: 'Failed to save avatar canvas' },
      { status: 500 }
    );
  }
}
