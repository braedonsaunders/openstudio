import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

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

// PUT - Update canvas data for a room
// Note: Room ownership is enforced via Supabase RLS policies
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

// DELETE - Clear canvas data for a room
// Note: Room ownership is enforced via Supabase RLS policies
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
