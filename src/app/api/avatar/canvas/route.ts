import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/server';
import { getUserAvatarCanvas, saveUserAvatarCanvas, getUserUnlockedComponents, getAvatarLibrary } from '@/lib/avatar/supabase';
import { uploadAvatarImage } from '@/lib/avatar/storage';
import { getUserProfile, getUserStats, getUserAchievements } from '@/lib/supabase/auth';
import { getUnlockedComponentIds, type UnlockContext } from '@/lib/avatar/unlocks';
import type { CanvasData } from '@/types/avatar';

// Helper to build unlock context and get unlocked component IDs
async function getEvaluatedUnlockedIds(userId: string): Promise<Set<string>> {
  const [manuallyUnlockedIds, library, profile, stats, achievements] = await Promise.all([
    getUserUnlockedComponents(userId),
    getAvatarLibrary(),
    getUserProfile(userId),
    getUserStats(userId),
    getUserAchievements(userId),
  ]);

  // Build unlock context for proper evaluation
  // Components are UNLOCKED BY DEFAULT if they have no rules
  const unlockContext: UnlockContext = {
    profile: profile || {
      id: userId,
      username: '',
      displayName: '',
      bio: '',
      accountType: 'free',
      isVerified: false,
      isBanned: false,
      totalXp: 0,
      level: 1,
      currentDailyStreak: 0,
      longestDailyStreak: 0,
      streakFreezes: 0,
      links: {},
      privacy: {
        profileVisibility: 'public',
        showStats: true,
        showActivity: true,
        allowFriendRequests: true,
        allowRoomInvites: true,
      },
      preferences: {
        defaultSampleRate: 48000,
        defaultBufferSize: 256,
        autoJitterBuffer: true,
        theme: 'dark',
        accentColor: '#6366f1',
        compactMode: false,
        showTutorialTips: true,
        emailNotifications: true,
        soundNotifications: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    stats: stats,
    achievements: achievements,
    manuallyUnlockedIds: manuallyUnlockedIds,
  };

  return getUnlockedComponentIds(
    library.components,
    library.componentUnlocks,
    library.unlockRules,
    unlockContext
  );
}

// GET /api/avatar/canvas - Get current user's canvas data
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [canvas, unlockedIds] = await Promise.all([
      getUserAvatarCanvas(user.id),
      getEvaluatedUnlockedIds(user.id),
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
    // Uses proper unlock evaluation (components unlocked by default unless they have rules)
    const unlockedIds = await getEvaluatedUnlockedIds(user.id);
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

        // Store R2 keys (not signed URLs) to avoid URL expiration
        fullBodyUrl = fullBodyResult.key;
        headshotUrl = headshotResult.key;

        // Upload thumbnails
        if (thumbnails) {
          const [xsResult, smResult, mdResult, lgResult] = await Promise.all([
            uploadAvatarImage(user.id, thumbnails.xs, 'thumb-xs'),
            uploadAvatarImage(user.id, thumbnails.sm, 'thumb-sm'),
            uploadAvatarImage(user.id, thumbnails.md, 'thumb-md'),
            uploadAvatarImage(user.id, thumbnails.lg, 'thumb-lg'),
          ]);

          // Store R2 keys (not signed URLs) to avoid URL expiration
          thumbnailUrls = {
            xs: xsResult.key,
            sm: smResult.key,
            md: mdResult.key,
            lg: lgResult.key,
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
