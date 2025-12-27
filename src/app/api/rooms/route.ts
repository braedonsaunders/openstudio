import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Lazy initialization of Supabase client to avoid build-time errors
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

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, name, createdBy } = body;

    // Use provided ID or generate a new one
    const roomId = id || uuidv4().slice(0, 8);

    // If Supabase is not configured, return a mock response
    if (!supabase) {
      return NextResponse.json({
        id: roomId,
        name: name || `Room ${roomId}`,
        createdBy: createdBy || 'anonymous',
        createdAt: new Date().toISOString(),
        popLocation: 'auto',
      });
    }

    // Use upsert to handle the case where room already exists
    const { data, error } = await supabase
      .from('rooms')
      .upsert({
        id: roomId,
        name: name || `Room ${roomId}`,
        created_by: createdBy || 'anonymous',
        pop_location: 'auto',
        max_users: 10,
        is_public: true,
        settings: {},
      }, { onConflict: 'id', ignoreDuplicates: true })
      .select()
      .single();

    if (error) {
      console.error('Error creating room:', error);
      // If table doesn't exist, return a mock room for now
      if (error.code === '42P01') {
        return NextResponse.json({
          id: roomId,
          name: name || `Room ${roomId}`,
          createdBy: createdBy || 'anonymous',
          createdAt: new Date().toISOString(),
          popLocation: 'auto',
        });
      }
      // If duplicate key, fetch and return the existing room
      if (error.code === '23505') {
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        if (existingRoom) {
          return NextResponse.json({
            id: existingRoom.id,
            name: existingRoom.name,
            createdBy: existingRoom.created_by,
            createdAt: existingRoom.created_at,
            popLocation: existingRoom.pop_location,
            maxUsers: existingRoom.max_users,
            isPublic: existingRoom.is_public,
            settings: existingRoom.settings,
          });
        }
      }
      return NextResponse.json(
        { error: 'Failed to create room' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      createdBy: data.created_by,
      createdAt: data.created_at,
      popLocation: data.pop_location,
      maxUsers: data.max_users,
      isPublic: data.is_public,
      settings: data.settings,
    });
  } catch (error) {
    console.error('Error in POST room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id');

  // If Supabase is not configured, return empty/not found
  if (!supabase) {
    if (roomId) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    return NextResponse.json([]);
  }

  try {
    if (roomId) {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !room) {
        return NextResponse.json(
          { error: 'Room not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: room.id,
        name: room.name,
        createdBy: room.created_by,
        createdAt: room.created_at,
        popLocation: room.pop_location,
        maxUsers: room.max_users,
        isPublic: room.is_public,
        settings: room.settings,
      });
    }

    // Return all public rooms
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading rooms:', error);
      return NextResponse.json([]);
    }

    const publicRooms = (rooms || []).map((room) => ({
      id: room.id,
      name: room.name,
      createdBy: room.created_by,
      createdAt: room.created_at,
      popLocation: room.pop_location,
      maxUsers: room.max_users,
      isPublic: room.is_public,
      settings: room.settings,
    }));

    return NextResponse.json(publicRooms);
  } catch (error) {
    console.error('Error in GET rooms:', error);
    return NextResponse.json(
      { error: 'Failed to load rooms' },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms?id=xxx - Delete a room and all its tracks
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id');

  if (!roomId) {
    return NextResponse.json(
      { error: 'Room ID is required' },
      { status: 400 }
    );
  }

  // If Supabase is not configured, return success (nothing to delete)
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  try {
    // Delete all tracks for this room first (in case CASCADE isn't set up)
    await supabase
      .from('room_tracks')
      .delete()
      .eq('room_id', roomId);

    // Delete the room
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      console.error('Error deleting room:', error);
      return NextResponse.json(
        { error: 'Failed to delete room' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    );
  }
}
