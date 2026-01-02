import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';

// Default tier limits (fallback if DB not available)
const DEFAULT_TIER_LIMITS: Record<string, number> = {
  free: 3,
  pro: 10,
  enterprise: 25,
  admin: -1,
};

interface RoomData {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
  last_activity: string | null;
  created_by: string;
}

// Helper to extract room from Supabase join result (can be object or array)
function extractRoom(rooms: RoomData | RoomData[] | null): RoomData | null {
  if (!rooms) return null;
  if (Array.isArray(rooms)) return rooms[0] || null;
  return rooms;
}

// GET /api/user/saved-rooms - Get user's saved rooms with limits info
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    // Get user's account type for tier
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    const accountType = profile?.account_type || 'free';

    // Get tier limit
    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('max_saved_rooms, name')
      .eq('id', accountType)
      .single();

    const limit = tier?.max_saved_rooms ?? DEFAULT_TIER_LIMITS[accountType] ?? 3;
    const tierName = tier?.name || accountType;

    // Get saved rooms with room details
    const { data: savedRooms, error } = await supabase
      .from('user_saved_rooms')
      .select(`
        id,
        user_id,
        room_id,
        notes,
        saved_at,
        rooms (
          id,
          name,
          description,
          genre,
          color,
          icon,
          created_at,
          last_activity,
          created_by
        )
      `)
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved rooms:', error);
      return NextResponse.json(
        { error: 'Failed to fetch saved rooms' },
        { status: 500 }
      );
    }

    // Get track counts for each room
    const roomIds = (savedRooms || []).map((sr: { room_id: string }) => sr.room_id);
    let trackCounts: Record<string, number> = {};

    if (roomIds.length > 0) {
      const { data: tracks } = await supabase
        .from('room_tracks')
        .select('room_id')
        .in('room_id', roomIds);

      if (tracks) {
        trackCounts = tracks.reduce((acc: Record<string, number>, t: { room_id: string }) => {
          acc[t.room_id] = (acc[t.room_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Transform the response
    const rooms = (savedRooms || []).map((sr: {
      id: string;
      room_id: string;
      notes: string | null;
      saved_at: string;
      rooms: RoomData | RoomData[] | null;
    }) => {
      const room = extractRoom(sr.rooms);
      return {
        id: sr.id,
        roomId: sr.room_id,
        notes: sr.notes,
        savedAt: sr.saved_at,
        room: room ? {
          id: room.id,
          name: room.name,
          description: room.description,
          genre: room.genre,
          color: room.color || 'indigo',
          icon: room.icon || 'music',
          createdAt: room.created_at,
          lastActivity: room.last_activity,
          trackCount: trackCounts[sr.room_id] || 0,
        } : null,
      };
    }).filter((r: { room: unknown }) => r.room !== null);

    return NextResponse.json({
      rooms,
      count: rooms.length,
      limit,
      tier: tierName,
      isUnlimited: limit === -1,
    });
  } catch (error) {
    console.error('Error in GET saved-rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved rooms' },
      { status: 500 }
    );
  }
}

// POST /api/user/saved-rooms - Save a room
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { roomId, notes } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, created_by, name')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    if (room.created_by !== user.id) {
      return NextResponse.json(
        { error: 'You can only save rooms you created' },
        { status: 403 }
      );
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from('user_saved_rooms')
      .select('id')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Room is already saved' },
        { status: 409 }
      );
    }

    // Get user's account type and check limit
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', user.id)
      .single();

    const accountType = profile?.account_type || 'free';

    // Get tier limit
    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('max_saved_rooms')
      .eq('id', accountType)
      .single();

    const limit = tier?.max_saved_rooms ?? DEFAULT_TIER_LIMITS[accountType] ?? 3;

    // Check current count (skip for unlimited)
    if (limit !== -1) {
      const { count } = await supabase
        .from('user_saved_rooms')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((count || 0) >= limit) {
        return NextResponse.json(
          {
            error: 'limit_reached',
            message: `You have reached your limit of ${limit} saved rooms`,
            limit,
            tier: accountType,
          },
          { status: 403 }
        );
      }
    }

    // Save the room
    const { data: savedRoom, error: saveError } = await supabase
      .from('user_saved_rooms')
      .insert({
        user_id: user.id,
        room_id: roomId,
        notes: notes || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving room:', saveError);
      return NextResponse.json(
        { error: 'Failed to save room' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedRoom: {
        id: savedRoom.id,
        roomId: savedRoom.room_id,
        roomName: room.name,
        notes: savedRoom.notes,
        savedAt: savedRoom.saved_at,
      },
    });
  } catch (error) {
    console.error('Error in POST saved-rooms:', error);
    return NextResponse.json(
      { error: 'Failed to save room' },
      { status: 500 }
    );
  }
}

// DELETE /api/user/saved-rooms?roomId=xxx - Remove a saved room
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
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
    const { error } = await supabase
      .from('user_saved_rooms')
      .delete()
      .eq('user_id', user.id)
      .eq('room_id', roomId);

    if (error) {
      console.error('Error removing saved room:', error);
      return NextResponse.json(
        { error: 'Failed to remove saved room' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE saved-rooms:', error);
    return NextResponse.json(
      { error: 'Failed to remove saved room' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/saved-rooms - Update notes for a saved room
export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { roomId, notes } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('user_saved_rooms')
      .update({ notes })
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .select()
      .single();

    if (error) {
      console.error('Error updating saved room:', error);
      return NextResponse.json(
        { error: 'Failed to update saved room' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedRoom: data,
    });
  } catch (error) {
    console.error('Error in PATCH saved-rooms:', error);
    return NextResponse.json(
      { error: 'Failed to update saved room' },
      { status: 500 }
    );
  }
}
