import { NextRequest, NextResponse } from 'next/server';
import { getPublicAvatarUrls } from '@/lib/avatar/supabase';

// GET /api/avatar/public/[userId] - Get public avatar URLs for a user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const urls = await getPublicAvatarUrls(userId);

    if (!urls) {
      return NextResponse.json({
        fullBodyUrl: null,
        headshotUrl: null,
        thumbnailUrls: null,
      });
    }

    return NextResponse.json(urls);
  } catch (error) {
    console.error('Failed to get public avatar URLs:', error);
    return NextResponse.json(
      { error: 'Failed to get avatar' },
      { status: 500 }
    );
  }
}
