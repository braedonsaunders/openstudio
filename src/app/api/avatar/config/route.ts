import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/server';
import { getUserAvatarConfig, saveUserAvatarConfig, getUserUnlockedComponents, getAvatarLibrary } from '@/lib/avatar/supabase';
import { getUserProfile, getUserStats, getUserAchievements } from '@/lib/supabase/auth';
import { getUnlockedComponentIds, type UnlockContext } from '@/lib/avatar/unlocks';

// GET /api/avatar/config - Get current user's avatar config
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all required data in parallel
    const [config, manuallyUnlockedIds, library, profile, stats, achievements] = await Promise.all([
      getUserAvatarConfig(user.id),
      getUserUnlockedComponents(user.id),
      getAvatarLibrary(),
      getUserProfile(user.id),
      getUserStats(user.id),
      getUserAchievements(user.id),
    ]);

    // Build unlock context for proper evaluation
    // Components are UNLOCKED BY DEFAULT if they have no rules
    const unlockContext: UnlockContext = {
      profile: profile || {
        id: user.id,
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

    // Evaluate which components are unlocked using proper logic:
    // - Components with NO rules are unlocked by default
    // - Components with rules need at least one rule satisfied
    // - Manually unlocked components are always unlocked
    console.log('[avatar/config] Library data:', {
      components: library.components.length,
      componentUnlocks: library.componentUnlocks.length,
      unlockRules: library.unlockRules.length,
    });

    const unlockedIds = getUnlockedComponentIds(
      library.components,
      library.componentUnlocks,
      library.unlockRules,
      unlockContext
    );

    console.log('[avatar/config] Evaluated unlocked:', unlockedIds.size);

    return NextResponse.json({
      config,
      unlockedComponentIds: Array.from(unlockedIds),
    });
  } catch (error) {
    console.error('Failed to get avatar config:', error);
    return NextResponse.json(
      { error: 'Failed to get avatar config' },
      { status: 500 }
    );
  }
}

// PUT /api/avatar/config - Update current user's avatar config
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.selections || typeof body.selections !== 'object') {
      return NextResponse.json(
        { error: 'selections object is required' },
        { status: 400 }
      );
    }

    const config = await saveUserAvatarConfig(user.id, body.selections);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to save avatar config:', error);
    return NextResponse.json(
      { error: 'Failed to save avatar config' },
      { status: 500 }
    );
  }
}
