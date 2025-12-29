import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

// GET - Fetch all custom loops for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('user_custom_loops')
      .select('*')
      .eq('user_id', userId)
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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const dbRecord = transformToDb(body);

    const { data, error } = await getSupabase()
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
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const dbUpdates = transformToDb(updates);
    delete dbUpdates.id;
    delete dbUpdates.user_id;
    delete dbUpdates.created_at;

    const { data, error } = await getSupabase()
      .from('user_custom_loops')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating custom loop:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in PATCH /custom-loops:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a custom loop
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { error } = await getSupabase()
      .from('user_custom_loops')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

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
