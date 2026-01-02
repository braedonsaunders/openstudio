import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';

// GET /api/user/saved-rooms/check?roomId=xxx - Check if a room is saved
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ isSaved: false, canSave: false });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ isSaved: false, canSave: false });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  if (!roomId) {
    return NextResponse.json(
      { error: 'Room ID is required' },
      { status: 400 }
    );
  }

  try {
    // Check if user owns this room
    const { data: room } = await supabase
      .from('rooms')
      .select('created_by')
      .eq('id', roomId)
      .single();

    const isOwner = room?.created_by === user.id;

    // Check if already saved
    const { data: saved } = await supabase
      .from('user_saved_rooms')
      .select('id')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .single();

    const isSaved = !!saved;

    // If not owner, can't save
    if (!isOwner) {
      return NextResponse.json({
        isSaved: false,
        canSave: false,
        isOwner: false,
      });
    }

    // If already saved, return that
    if (isSaved) {
      return NextResponse.json({
        isSaved: true,
        canSave: true,
        isOwner: true,
      });
    }

    // Check if user can save more rooms
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    const accountType = profile?.account_type || 'free';

    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('max_saved_rooms')
      .eq('id', accountType)
      .single();

    const limit = tier?.max_saved_rooms ?? 3;

    // Unlimited
    if (limit === -1) {
      return NextResponse.json({
        isSaved: false,
        canSave: true,
        isOwner: true,
      });
    }

    // Check count
    const { count } = await supabase
      .from('user_saved_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({
      isSaved: false,
      canSave: (count || 0) < limit,
      isOwner: true,
      currentCount: count || 0,
      limit,
    });
  } catch (error) {
    console.error('Error checking saved room:', error);
    return NextResponse.json({ isSaved: false, canSave: false });
  }
}
