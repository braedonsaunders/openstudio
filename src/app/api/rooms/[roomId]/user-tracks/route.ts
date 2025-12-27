import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      supabaseClient = createClient(url, key);
    }
  }
  return supabaseClient;
}

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// GET /api/rooms/[roomId]/user-tracks - Load all user tracks for a room
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!supabase) {
      return NextResponse.json([]);
    }

    let query = supabase
      .from('user_tracks')
      .select('*')
      .eq('room_id', roomId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: tracks, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading user tracks:', error);
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: 'Failed to load user tracks' }, { status: 500 });
    }

    // Transform database records to UserTrack format
    const userTracks = (tracks || []).map((track) => ({
      id: track.id,
      userId: track.user_id,
      name: track.name,
      color: track.color,
      audioSettings: track.audio_settings,
      isMuted: track.is_muted,
      isSolo: track.is_solo,
      volume: track.volume,
      isArmed: track.is_armed,
      isRecording: track.is_recording,
      createdAt: new Date(track.created_at).getTime(),
      ownerUserId: track.owner_user_id || track.user_id,
      ownerUserName: track.owner_user_name,
      isActive: track.is_active ?? true,
    }));

    return NextResponse.json(userTracks);
  } catch (error) {
    console.error('Error in GET user tracks:', error);
    return NextResponse.json({ error: 'Failed to load user tracks' }, { status: 500 });
  }
}

// POST /api/rooms/[roomId]/user-tracks - Create or update a user track
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const track = await request.json();

    if (!supabase) {
      return NextResponse.json(track);
    }

    // Ensure room exists
    const { error: roomError } = await supabase
      .from('rooms')
      .upsert({
        id: roomId,
        name: `Room ${roomId}`,
        created_by: track.userId || 'user',
        pop_location: 'auto',
        max_users: 10,
        is_public: true,
        settings: {},
      }, { onConflict: 'id', ignoreDuplicates: true });

    if (roomError && roomError.code !== '42P01') {
      console.error('Error ensuring room exists:', roomError);
    }

    const { data, error } = await supabase
      .from('user_tracks')
      .upsert({
        id: track.id,
        room_id: roomId,
        user_id: track.userId,
        name: track.name,
        color: track.color,
        audio_settings: track.audioSettings,
        is_muted: track.isMuted ?? false,
        is_solo: track.isSolo ?? false,
        volume: track.volume ?? 1,
        is_armed: track.isArmed ?? true,
        is_recording: track.isRecording ?? false,
        owner_user_id: track.ownerUserId || track.userId,
        owner_user_name: track.ownerUserName,
        is_active: track.isActive ?? true,
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving user track:', error);
      if (error.code === '42P01') {
        return NextResponse.json(track);
      }
      return NextResponse.json(
        { error: 'Failed to save user track', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      color: data.color,
      audioSettings: data.audio_settings,
      isMuted: data.is_muted,
      isSolo: data.is_solo,
      volume: data.volume,
      isArmed: data.is_armed,
      isRecording: data.is_recording,
      createdAt: new Date(data.created_at).getTime(),
      ownerUserId: data.owner_user_id || data.user_id,
      ownerUserName: data.owner_user_name,
      isActive: data.is_active ?? true,
    });
  } catch (error) {
    console.error('Error in POST user track:', error);
    return NextResponse.json({ error: 'Failed to save user track' }, { status: 500 });
  }
}

// PATCH /api/rooms/[roomId]/user-tracks - Update track settings
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const { trackId, ...updates } = await request.json();

    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    // Map camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.audioSettings !== undefined) dbUpdates.audio_settings = updates.audioSettings;
    if (updates.isMuted !== undefined) dbUpdates.is_muted = updates.isMuted;
    if (updates.isSolo !== undefined) dbUpdates.is_solo = updates.isSolo;
    if (updates.volume !== undefined) dbUpdates.volume = updates.volume;
    if (updates.isArmed !== undefined) dbUpdates.is_armed = updates.isArmed;
    if (updates.isRecording !== undefined) dbUpdates.is_recording = updates.isRecording;
    if (updates.userId !== undefined) dbUpdates.user_id = updates.userId;
    if (updates.ownerUserId !== undefined) dbUpdates.owner_user_id = updates.ownerUserId;
    if (updates.ownerUserName !== undefined) dbUpdates.owner_user_name = updates.ownerUserName;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { error } = await supabase
      .from('user_tracks')
      .update(dbUpdates)
      .eq('id', trackId)
      .eq('room_id', roomId);

    if (error) {
      console.error('Error updating user track:', error);
      if (error.code === '42P01') {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Failed to update user track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH user track:', error);
    return NextResponse.json({ error: 'Failed to update user track' }, { status: 500 });
  }
}

// DELETE /api/rooms/[roomId]/user-tracks?trackId=xxx - Remove a user track
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const userId = searchParams.get('userId');

    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    let query = supabase
      .from('user_tracks')
      .delete()
      .eq('room_id', roomId);

    if (trackId) {
      query = query.eq('id', trackId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else {
      return NextResponse.json({ error: 'trackId or userId is required' }, { status: 400 });
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting user track:', error);
      return NextResponse.json({ error: 'Failed to delete user track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE user track:', error);
    return NextResponse.json({ error: 'Failed to delete user track' }, { status: 500 });
  }
}
