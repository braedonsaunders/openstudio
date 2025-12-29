import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

// GET - Fetch all loop tracks for a room
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
      .from('room_loop_tracks')
      .select('*')
      .eq('room_id', roomId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching loop tracks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform snake_case to camelCase
    const tracks = (data || []).map(transformFromDb);

    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Error in GET /loop-tracks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new loop track
export async function POST(
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

    const dbRecord = transformToDb(body, roomId);

    const { data, error } = await supabase
      .from('room_loop_tracks')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating loop track:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in POST /loop-tracks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a loop track
export async function PATCH(
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
    const { trackId, ...updates } = body;

    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const dbUpdates = transformToDb(updates, roomId);
    delete dbUpdates.id;
    delete dbUpdates.room_id;
    delete dbUpdates.created_at;

    const { data, error } = await supabase
      .from('room_loop_tracks')
      .update(dbUpdates)
      .eq('id', trackId)
      .eq('room_id', roomId)
      .select()
      .single();

    if (error) {
      console.error('Error updating loop track:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transformFromDb(data));
  } catch (error) {
    console.error('Error in PATCH /loop-tracks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a loop track
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
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('room_loop_tracks')
      .delete()
      .eq('id', trackId)
      .eq('room_id', roomId);

    if (error) {
      console.error('Error deleting loop track:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /loop-tracks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Transform database record to API response (snake_case -> camelCase)
function transformFromDb(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    roomId: record.room_id,
    createdBy: record.created_by,
    createdByName: record.created_by_name,
    loopId: record.loop_id,
    customMidiData: record.custom_midi_data,
    isPlaying: record.is_playing,
    startTime: record.start_time,
    loopStartBeat: record.loop_start_beat,
    soundPreset: record.sound_preset,
    soundSettings: record.sound_settings,
    tempoLocked: record.tempo_locked,
    targetBpm: record.target_bpm,
    keyLocked: record.key_locked,
    targetKey: record.target_key,
    transposeAmount: record.transpose_amount,
    volume: record.volume,
    pan: record.pan,
    muted: record.muted,
    solo: record.solo,
    effects: record.effects,
    humanizeEnabled: record.humanize_enabled,
    humanizeTiming: record.humanize_timing,
    humanizeVelocity: record.humanize_velocity,
    color: record.color,
    name: record.name,
    position: record.position,
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
  if (data.createdBy !== undefined) record.created_by = data.createdBy;
  if (data.createdByName !== undefined) record.created_by_name = data.createdByName;
  if (data.loopId !== undefined) record.loop_id = data.loopId;
  if (data.customMidiData !== undefined) record.custom_midi_data = data.customMidiData;
  if (data.isPlaying !== undefined) record.is_playing = data.isPlaying;
  if (data.startTime !== undefined) record.start_time = data.startTime;
  if (data.loopStartBeat !== undefined) record.loop_start_beat = data.loopStartBeat;
  if (data.soundPreset !== undefined) record.sound_preset = data.soundPreset;
  if (data.soundSettings !== undefined) record.sound_settings = data.soundSettings;
  if (data.tempoLocked !== undefined) record.tempo_locked = data.tempoLocked;
  if (data.targetBpm !== undefined) record.target_bpm = data.targetBpm;
  if (data.keyLocked !== undefined) record.key_locked = data.keyLocked;
  if (data.targetKey !== undefined) record.target_key = data.targetKey;
  if (data.transposeAmount !== undefined) record.transpose_amount = data.transposeAmount;
  if (data.volume !== undefined) record.volume = data.volume;
  if (data.pan !== undefined) record.pan = data.pan;
  if (data.muted !== undefined) record.muted = data.muted;
  if (data.solo !== undefined) record.solo = data.solo;
  if (data.effects !== undefined) record.effects = data.effects;
  if (data.humanizeEnabled !== undefined) record.humanize_enabled = data.humanizeEnabled;
  if (data.humanizeTiming !== undefined) record.humanize_timing = data.humanizeTiming;
  if (data.humanizeVelocity !== undefined) record.humanize_velocity = data.humanizeVelocity;
  if (data.color !== undefined) record.color = data.color;
  if (data.name !== undefined) record.name = data.name;
  if (data.position !== undefined) record.position = data.position;

  return record;
}
