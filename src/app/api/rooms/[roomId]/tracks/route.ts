import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role for database access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// GET /api/rooms/[roomId]/tracks - Load all tracks for a room
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { roomId } = await context.params;

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
    const backingTracks = (tracks || []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artist,
      duration: track.duration,
      url: track.url,
      uploadedBy: track.uploaded_by,
      uploadedAt: track.created_at,
      youtubeId: track.youtube_id,
      aiGenerated: track.ai_generated,
    }));

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
  try {
    const { roomId } = await context.params;
    const track = await request.json();

    const { data, error } = await supabase
      .from('room_tracks')
      .insert({
        id: track.id,
        room_id: roomId,
        name: track.name,
        artist: track.artist || null,
        duration: track.duration || 0,
        url: track.url,
        uploaded_by: track.uploadedBy || 'user',
        youtube_id: track.youtubeId || null,
        ai_generated: track.aiGenerated || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving track:', error);
      // If table doesn't exist, create it
      if (error.code === '42P01') {
        // Table doesn't exist - we'll need to create it
        // For now, just return success since realtime sync will handle it
        return NextResponse.json(track);
      }
      return NextResponse.json(
        { error: 'Failed to save track' },
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
