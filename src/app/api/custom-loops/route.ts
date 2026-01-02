import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';

// GET - Fetch all custom loops for the authenticated user
// SECURITY: Requires authentication; only returns the user's own loops
export async function GET(request: NextRequest) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // SECURITY: Always use authenticated user's ID, never trust query params
    const { data, error } = await supabase
      .from('user_custom_loops')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching custom loops:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform snake_case to camelCase
    const loops = (data || []).map(transformFromDb);

    return NextResponse.json(loops);
  } catch (error) {
    console.error('Error in GET /custom-loops:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new custom loop
// SECURITY: Requires authentication; loop is created for the authenticated user
export async function POST(request: NextRequest) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json();
    // SECURITY: Override userId with authenticated user's ID
    body.userId = user.id;

    const dbRecord = transformToDb(body);

    const { data, error } = await supabase
      .from('user_custom_loops')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating custom loop:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in POST /custom-loops:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a custom loop
// SECURITY: Requires authentication; can only update own loops
export async function PATCH(request: NextRequest) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const dbUpdates = transformToDb(updates);
    delete dbUpdates.id;
    delete dbUpdates.user_id;
    delete dbUpdates.created_at;

    // SECURITY: Only allow updating own loops (filter by authenticated user ID)
    const { data, error } = await supabase
      .from('user_custom_loops')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating custom loop:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Loop not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in PATCH /custom-loops:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a custom loop
// SECURITY: Requires authentication; can only delete own loops
export async function DELETE(request: NextRequest) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // SECURITY: Only allow deleting own loops (filter by authenticated user ID)
    const { error } = await supabase
      .from('user_custom_loops')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting custom loop:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /custom-loops:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Transform database record to API response (snake_case -> camelCase)
function transformFromDb(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    userId: record.user_id,
    name: record.name,
    category: record.category,
    subcategory: record.subcategory,
    bpm: record.bpm,
    bars: record.bars,
    timeSignature: record.time_signature,
    key: record.key,
    midiData: record.midi_data,
    soundPreset: record.sound_preset,
    tags: record.tags,
    intensity: record.intensity,
    complexity: record.complexity,
    description: record.description,
    isFavorite: record.is_favorite,
    isCustom: true,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// Transform API request to database record (camelCase -> snake_case)
function transformToDb(data: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  if (data.id !== undefined) record.id = data.id;
  if (data.userId !== undefined) record.user_id = data.userId;
  if (data.name !== undefined) record.name = data.name;
  if (data.category !== undefined) record.category = data.category;
  if (data.subcategory !== undefined) record.subcategory = data.subcategory;
  if (data.bpm !== undefined) record.bpm = data.bpm;
  if (data.bars !== undefined) record.bars = data.bars;
  if (data.timeSignature !== undefined) record.time_signature = data.timeSignature;
  if (data.key !== undefined) record.key = data.key;
  if (data.midiData !== undefined) record.midi_data = data.midiData;
  if (data.soundPreset !== undefined) record.sound_preset = data.soundPreset;
  if (data.tags !== undefined) record.tags = data.tags;
  if (data.intensity !== undefined) record.intensity = data.intensity;
  if (data.complexity !== undefined) record.complexity = data.complexity;
  if (data.description !== undefined) record.description = data.description;
  if (data.isFavorite !== undefined) record.is_favorite = data.isFavorite;

  return record;
}
