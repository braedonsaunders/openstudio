import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { getUserAvatarConfig, saveUserAvatarConfig, getUserUnlockedComponents } from '@/lib/avatar/supabase';

// GET /api/avatar/config - Get current user's avatar config
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [config, unlockedIds] = await Promise.all([
      getUserAvatarConfig(user.id),
      getUserUnlockedComponents(user.id),
    ]);

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
    const user = await getUser();
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
