import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { deleteTrackByUrl } from '@/lib/storage/r2';

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

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// GET /api/rooms/[roomId]/tracks - Load all tracks for a room
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;

    // If Supabase is not configured, return empty array
    if (!supabase) {
      return NextResponse.json([]);
    }

    const { data: tracks, error } = await supabase
      .from('room_tracks')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading tracks:', error);
      // Table might not exist yet, return empty array
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        { error: 'Failed to load tracks' },
        { status: 500 }
      );
    }

    // Transform database records to BackingTrack format
    const backingTracks = (tracks || []).map((track) => {
      // Convert old R2 URLs to use the proxy endpoint
      let url = track.url;
      if (url && url.includes('r2.cloudflarestorage.com')) {
        // Extract trackId from old URL format: tracks/{trackId}.{ext}
        const match = url.match(/tracks\/([^.]+)\./);
        if (match) {
          url = `/api/audio/${match[1]}`;
        }
      }

      return {
        id: track.id,
        name: track.name,
        artist: track.artist,
        duration: track.duration,
        url,
        uploadedBy: track.uploaded_by,
        uploadedAt: track.created_at,
        youtubeId: track.youtube_id,
        aiGenerated: track.ai_generated,
      };
    });

    return NextResponse.json(backingTracks);
  } catch (error) {
    console.error('Error in GET tracks:', error);
    return NextResponse.json(
      { error: 'Failed to load tracks' },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[roomId]/tracks - Add a track to a room
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const track = await request.json();

    // If Supabase is not configured, just return the track as-is
    if (!supabase) {
      return NextResponse.json(track);
    }

    // Ensure room exists before adding track (handles foreign key constraint)
    const { error: roomError } = await supabase
      .from('rooms')
      .upsert({
        id: roomId,
        name: `Room ${roomId}`,
        created_by: track.uploadedBy || 'user',
        pop_location: 'auto',
        max_users: 10,
        is_public: true,
        settings: {},
      }, { onConflict: 'id', ignoreDuplicates: true });

    if (roomError && roomError.code !== '42P01') {
      console.error('Error ensuring room exists:', roomError);
    }

    const { data, error } = await supabase
      .from('room_tracks')
      .insert({
        id: track.id,
        room_id: roomId,
        name: track.name,
        artist: track.artist || null,
        duration: Math.round(track.duration || 0),
        url: track.url || '',
        uploaded_by: track.uploadedBy || 'user',
        youtube_id: track.youtubeId || null,
        ai_generated: track.aiGenerated || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving track:', error);
      console.error('Track data:', JSON.stringify(track, null, 2));
      // If table doesn't exist, just return success
      if (error.code === '42P01') {
        return NextResponse.json(track);
      }
      // If duplicate key (track already exists), return success
      if (error.code === '23505') {
        return NextResponse.json(track);
      }
      return NextResponse.json(
        { error: 'Failed to save track', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      artist: data.artist,
      duration: data.duration,
      url: data.url,
      uploadedBy: data.uploaded_by,
      uploadedAt: data.created_at,
      youtubeId: data.youtube_id,
      aiGenerated: data.ai_generated,
    });
  } catch (error) {
    console.error('Error in POST track:', error);
    return NextResponse.json(
      { error: 'Failed to save track' },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[roomId]/tracks?trackId=xxx - Remove a track from a room
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId is required' },
        { status: 400 }
      );
    }

    // If Supabase is not configured, just return success
    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    // First, fetch the track to get its URL for R2 cleanup
    const { data: track, error: fetchError } = await supabase
      .from('room_tracks')
      .select('url')
      .eq('id', trackId)
      .eq('room_id', roomId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found - track might already be deleted
      console.error('Error fetching track for deletion:', fetchError);
    }

    // Delete from R2 if we have a URL
    if (track?.url) {
      try {
        const r2Result = await deleteTrackByUrl(track.url, trackId);
        if (r2Result.errors.length > 0) {
          console.warn('R2 deletion warnings:', r2Result.errors);
        }
        if (r2Result.deletedCount > 0) {
          console.log(`Deleted ${r2Result.deletedCount} files from R2 for track ${trackId}`);
        }
      } catch (r2Error) {
        // Log but don't fail the request - we still want to clean up the database
        console.error('Error deleting track from R2:', r2Error);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('room_tracks')
      .delete()
      .eq('id', trackId)
      .eq('room_id', roomId);

    if (error) {
      console.error('Error deleting track:', error);
      return NextResponse.json(
        { error: 'Failed to delete track' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE track:', error);
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
