import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getUserFromRequest, getRoomMembership } from '@/lib/supabase/server';

// GET - Fetch canvas data for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { roomId } = await params;

    const { data, error } = await supabase
      .from('rooms')
      .select('canvas')
      .eq('id', roomId)
      .single();

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

// PUT - Update canvas data for a room (room owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { roomId } = await params;

    // Check if user is room owner
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const membership = await getRoomMembership(roomId, user.id);
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only room owner can update canvas' }, { status: 403 });
    }

    const body = await request.json();
    const { canvas } = body;

    const { data, error } = await supabase
      .from('rooms')
      .update({ canvas })
      .eq('id', roomId)
      .select('canvas')
      .single();

    if (error) {
      console.error('Error updating canvas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ canvas: data?.canvas || null });
  } catch (error) {
    console.error('Error in PUT /canvas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Clear canvas data for a room (room owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { roomId } = await params;

    // Check if user is room owner
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const membership = await getRoomMembership(roomId, user.id);
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only room owner can clear canvas' }, { status: 403 });
    }

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
