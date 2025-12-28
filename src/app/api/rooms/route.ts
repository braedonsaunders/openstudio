import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { deleteRoomFiles } from '@/lib/storage/r2';

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

// Get admin client with service role key (required for operations that bypass RLS)
function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return createClient(url, key);
  }
  return null;
}

// Transform database row to API response
function transformRoom(room: Record<string, unknown>) {
  return {
    id: room.id,
    name: room.name,
    createdBy: room.created_by,
    createdAt: room.created_at,
    popLocation: room.pop_location,
    maxUsers: room.max_users,
    isPublic: room.is_public,
    settings: room.settings || {},
    description: room.description,
    genre: room.genre,
    tags: room.tags,
    rules: room.rules,
    creatorName: room.creator_name,
    creatorUsername: room.creator_username,
    lastActivity: room.last_activity,
    color: room.color || 'indigo',
    icon: room.icon || 'music',
  };
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const {
      id,
      name,
      createdBy,
      description,
      isPublic = true,
      maxUsers = 10,
      genre,
      tags,
      rules,
      settings,
      color = 'indigo',
      icon = 'music',
    } = body;

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
        maxUsers,
        isPublic,
        description,
        genre,
        tags,
        rules,
        settings: settings || {},
        color,
        icon,
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
        max_users: maxUsers,
        is_public: isPublic,
        description: description || null,
        genre: genre || null,
        tags: tags || null,
        rules: rules || null,
        settings: settings || {},
        last_activity: new Date().toISOString(),
        color: color || 'indigo',
        icon: icon || 'music',
      }, { onConflict: 'id', ignoreDuplicates: true })
      .select()
      .single();

    if (error) {
      console.error('Error creating room:', error);
      // If table doesn't exist or column doesn't exist, return a mock room for now
      if (error.code === '42P01' || error.code === '42703') {
        return NextResponse.json({
          id: roomId,
          name: name || `Room ${roomId}`,
          createdBy: createdBy || 'anonymous',
          createdAt: new Date().toISOString(),
          popLocation: 'auto',
          maxUsers,
          isPublic,
          description,
          genre,
          tags,
          rules,
          settings: settings || {},
          color,
          icon,
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
          return NextResponse.json(transformRoom(existingRoom));
        }
      }
      return NextResponse.json(
        { error: 'Failed to create room' },
        { status: 500 }
      );
    }

    return NextResponse.json(transformRoom(data));
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
  const createdBy = searchParams.get('createdBy');
  const genre = searchParams.get('genre');
  const search = searchParams.get('search');
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');

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
    // Get a single room by ID
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

      return NextResponse.json(transformRoom(room));
    }

    // Clean up stale rooms first (rooms without description created more than 2 hours ago)
    // These are likely abandoned quick-create rooms
    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    try {
      await supabase
        .from('rooms')
        .delete()
        .is('description', null)
        .lt('created_at', staleThreshold);
    } catch {
      // Ignore cleanup errors - might fail if column doesn't exist
    }

    // Build query for listing rooms
    let query = supabase.from('rooms').select('*');

    // Filter by creator
    if (createdBy) {
      query = query.eq('created_by', createdBy);
    } else {
      // Only return public rooms when not filtering by creator
      query = query.eq('is_public', true);
    }

    // Filter by genre
    if (genre) {
      query = query.eq('genre', genre);
    }

    // Search by name, description, or tags
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    // Pagination
    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }
    if (offset) {
      query = query.range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit || '20', 10) - 1);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error('Error loading rooms:', error);
      // If columns don't exist, return empty array
      if (error.code === '42703') {
        return NextResponse.json([]);
      }
      return NextResponse.json([]);
    }

    const transformedRooms = (rooms || []).map(transformRoom);

    return NextResponse.json(transformedRooms);
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
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id');

  if (!roomId) {
    return NextResponse.json(
      { error: 'Room ID is required' },
      { status: 400 }
    );
  }

  // Use admin client to bypass RLS - required for admin operations
  const adminSupabase = getAdminSupabase();

  if (!adminSupabase) {
    // Fall back to regular client for checking, but warn about RLS
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Admin operations require SUPABASE_SERVICE_ROLE_KEY to be configured. Room deletion is blocked by database security policies.' },
      { status: 500 }
    );
  }

  try {
    // First, verify the room exists
    const { data: existingRoom, error: fetchError } = await adminSupabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (fetchError || !existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Delete all R2 files for this room (audio tracks and stems)
    try {
      const r2Result = await deleteRoomFiles(roomId);
      if (r2Result.errors.length > 0) {
        console.warn('R2 deletion warnings for room:', roomId, r2Result.errors);
      }
      if (r2Result.deletedCount > 0) {
        console.log(`Deleted ${r2Result.deletedCount} files from R2 for room ${roomId}`);
      }
    } catch (r2Error) {
      // Log but don't fail the request - we still want to clean up the database
      console.error('Error deleting room files from R2:', r2Error);
    }

    // Delete user_tracks for this room first
    const { error: userTracksError } = await adminSupabase
      .from('user_tracks')
      .delete()
      .eq('room_id', roomId);

    if (userTracksError) {
      console.error('Error deleting user tracks:', userTracksError);
      // Continue anyway - table might not exist or might be empty
    }

    // Delete room_tracks for this room (in case CASCADE isn't set up)
    const { error: roomTracksError } = await adminSupabase
      .from('room_tracks')
      .delete()
      .eq('room_id', roomId);

    if (roomTracksError) {
      console.error('Error deleting room tracks:', roomTracksError);
      // Continue anyway - table might not exist or might be empty
    }

    // Delete the room itself
    const { error: deleteError } = await adminSupabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (deleteError) {
      console.error('Error deleting room:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete room: ' + deleteError.message },
        { status: 500 }
      );
    }

    // Verify the room was actually deleted
    const { data: checkRoom } = await adminSupabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (checkRoom) {
      console.error('Room still exists after deletion attempt:', roomId);
      return NextResponse.json(
        { error: 'Room deletion failed - room still exists. This may be due to database permissions.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: roomId });
  } catch (error) {
    console.error('Error in DELETE room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms - Update a room
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Transform camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
    if (updates.maxUsers !== undefined) dbUpdates.max_users = updates.maxUsers;
    if (updates.genre !== undefined) dbUpdates.genre = updates.genre;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.rules !== undefined) dbUpdates.rules = updates.rules;
    if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    dbUpdates.last_activity = new Date().toISOString();

    const { data, error } = await supabase
      .from('rooms')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating room:', error);
      return NextResponse.json(
        { error: 'Failed to update room' },
        { status: 500 }
      );
    }

    return NextResponse.json(transformRoom(data));
  } catch (error) {
    console.error('Error in PATCH room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
}
