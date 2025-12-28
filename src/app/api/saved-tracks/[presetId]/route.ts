import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
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
  params: Promise<{ presetId: string }>;
}

// Transform database record to SavedTrackPreset format
function transformDbToPreset(record: Record<string, unknown>) {
  return {
    id: record.id,
    userId: record.user_id,
    name: record.name,
    description: record.description,
    type: record.track_type || 'audio',
    instrumentId: record.instrument_id || 'other',
    color: record.color,
    audioSettings: record.audio_settings,
    midiSettings: record.midi_settings,
    volume: record.volume ?? 1,
    isMuted: record.is_muted ?? false,
    isSolo: record.is_solo ?? false,
    effects: record.effects || {},
    activeEffectPreset: record.active_effect_preset,
    isDefault: record.is_default ?? false,
    useCount: record.use_count ?? 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// GET /api/saved-tracks/[presetId] - Get a specific preset
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { presetId } = await context.params;

    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('saved_track_presets')
      .select('*')
      .eq('id', presetId)
      .single();

    if (error) {
      console.error('Error loading preset:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to load preset' }, { status: 500 });
    }

    return NextResponse.json(transformDbToPreset(data));
  } catch (error) {
    console.error('Error in GET preset:', error);
    return NextResponse.json({ error: 'Failed to load preset' }, { status: 500 });
  }
}

// PATCH /api/saved-tracks/[presetId] - Update a preset
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { presetId } = await context.params;
    const updates = await request.json();

    if (!supabase) {
      return NextResponse.json({ success: true, ...updates });
    }

    // Map camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type !== undefined) dbUpdates.track_type = updates.type;
    if (updates.instrumentId !== undefined) dbUpdates.instrument_id = updates.instrumentId;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.audioSettings !== undefined) dbUpdates.audio_settings = updates.audioSettings;
    if (updates.midiSettings !== undefined) dbUpdates.midi_settings = updates.midiSettings;
    if (updates.volume !== undefined) dbUpdates.volume = updates.volume;
    if (updates.isMuted !== undefined) dbUpdates.is_muted = updates.isMuted;
    if (updates.isSolo !== undefined) dbUpdates.is_solo = updates.isSolo;
    if (updates.effects !== undefined) dbUpdates.effects = updates.effects;
    if (updates.activeEffectPreset !== undefined) dbUpdates.active_effect_preset = updates.activeEffectPreset;
    if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;

    const { data, error } = await supabase
      .from('saved_track_presets')
      .update(dbUpdates)
      .eq('id', presetId)
      .select()
      .single();

    if (error) {
      console.error('Error updating preset:', error);
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, ...updates });
      }
      return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 });
    }

    return NextResponse.json(transformDbToPreset(data));
  } catch (error) {
    console.error('Error in PATCH preset:', error);
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 });
  }
}

// DELETE /api/saved-tracks/[presetId] - Delete a preset
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { presetId } = await context.params;

    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('saved_track_presets')
      .delete()
      .eq('id', presetId);

    if (error) {
      console.error('Error deleting preset:', error);
      if (error.code === '42P01') {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE preset:', error);
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
  }
}
