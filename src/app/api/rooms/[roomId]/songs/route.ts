import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when env vars are missing
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Supabase configuration missing');
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

// GET - Fetch all songs for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    const { data, error } = await getSupabase()
      .from('songs')
      .select('*')
      .eq('room_id', roomId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching songs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform snake_case to camelCase
    const songs = (data || []).map(transformFromDb);

    // Get current song from room settings or default to first
    const currentSongId = songs[0]?.id || null;

    return NextResponse.json({ songs, currentSongId });
  } catch (error) {
    console.error('Error in GET /songs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new song
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();

    const dbRecord = transformToDb(body, roomId);

    const { data, error } = await getSupabase()
      .from('songs')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating song:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in POST /songs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a song
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { songId, ...updates } = body;

    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 });
    }

    const dbUpdates = transformToDb(updates, roomId);
    delete dbUpdates.id;
    delete dbUpdates.room_id;
    delete dbUpdates.created_at;
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from('songs')
      .update(dbUpdates)
      .eq('id', songId)
      .eq('room_id', roomId)
      .select()
      .single();

    if (error) {
      console.error('Error updating song:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in PATCH /songs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a song
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get('songId');

    if (!songId) {
      return NextResponse.json({ error: 'songId is required' }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from('songs')
      .delete()
      .eq('id', songId)
      .eq('room_id', roomId);

    if (error) {
      console.error('Error deleting song:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /songs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Transform database record to API response (snake_case -> camelCase)
function transformFromDb(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    roomId: record.room_id,
    name: record.name,
    tracks: record.tracks || [],
    bpm: record.bpm,
    key: record.key,
    timeSignature: record.time_signature,
    duration: record.duration,
    color: record.color,
    position: record.position,
    createdBy: record.created_by,
    createdByName: record.created_by_name,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// Transform API request to database record (camelCase -> snake_case)
function transformToDb(data: Record<string, unknown>, roomId: string): Record<string, unknown> {
  const record: Record<string, unknown> = {
    room_id: roomId,
  };

  if (data.id !== undefined) record.id = data.id;
  if (data.name !== undefined) record.name = data.name;
  if (data.tracks !== undefined) record.tracks = data.tracks;
  if (data.bpm !== undefined) record.bpm = data.bpm;
  if (data.key !== undefined) record.key = data.key;
  if (data.timeSignature !== undefined) record.time_signature = data.timeSignature;
  if (data.duration !== undefined) record.duration = data.duration;
  if (data.color !== undefined) record.color = data.color;
  if (data.position !== undefined) record.position = data.position;
  if (data.createdBy !== undefined) record.created_by = data.createdBy;
  if (data.createdByName !== undefined) record.created_by_name = data.createdByName;

  return record;
}
