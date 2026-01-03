import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/server';

// GET - Fetch canvas data for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { roomId } = await params;

    const { data, error } = await supabase
      .from('rooms')
      .select('canvas')
      .eq('id', roomId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching canvas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ canvas: data?.canvas || null });
  } catch (error) {
    console.error('Error in GET /canvas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update canvas data for a room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { roomId } = await params;
    const body = await request.json();
    const { canvas } = body;

    // First check if room exists
    const { data: roomExists } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();

    if (!roomExists) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('rooms')
      .update({ canvas })
      .eq('id', roomId)
      .select('canvas');

    if (error) {
      console.error('Error updating canvas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ canvas: data?.[0]?.canvas || null });
  } catch (error) {
    console.error('Error in PUT /canvas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Clear canvas data for a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { roomId } = await params;

    const { error } = await supabase
      .from('rooms')
      .update({ canvas: null })
      .eq('id', roomId);

    if (error) {
      console.error('Error clearing canvas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /canvas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
