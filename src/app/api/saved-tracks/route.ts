import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

// Transform SavedTrackPreset to database format
function transformPresetToDb(preset: Record<string, unknown>) {
  return {
    user_id: preset.userId,
    name: preset.name,
    description: preset.description,
    track_type: preset.type || 'audio',
    instrument_id: preset.instrumentId || 'other',
    color: preset.color,
    audio_settings: preset.audioSettings,
    midi_settings: preset.midiSettings,
    volume: preset.volume ?? 1,
    is_muted: preset.isMuted ?? false,
    is_solo: preset.isSolo ?? false,
    effects: preset.effects || {},
    active_effect_preset: preset.activeEffectPreset,
    is_default: preset.isDefault ?? false,
  };
}

// GET /api/saved-tracks - Load all saved track presets for a user
export async function GET(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!supabase) {
      // Return empty array if no database
      return NextResponse.json([]);
    }

    const { data: presets, error } = await supabase
      .from('saved_track_presets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading saved track presets:', error);
      // Handle table not existing
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: 'Failed to load saved tracks' }, { status: 500 });
    }

    const transformedPresets = (presets || []).map(transformDbToPreset);
    return NextResponse.json(transformedPresets);
  } catch (error) {
    console.error('Error in GET saved tracks:', error);
    return NextResponse.json({ error: 'Failed to load saved tracks' }, { status: 500 });
  }
}

// POST /api/saved-tracks - Create a new saved track preset
export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const preset = await request.json();

    if (!preset.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!preset.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    if (!supabase) {
      // Return mock response if no database
      return NextResponse.json({
        id,
        ...preset,
        useCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Build database record - let DB handle timestamps with defaults
    const dbRecord = {
      id,
      user_id: preset.userId,
      name: preset.name,
      description: preset.description || null,
      track_type: preset.type || 'audio',
      instrument_id: preset.instrumentId || 'other',
      color: preset.color || '#a78bfa',
      volume: preset.volume ?? 1,
      is_muted: preset.isMuted ?? false,
      is_solo: preset.isSolo ?? false,
      audio_settings: preset.audioSettings || null,
      midi_settings: preset.midiSettings || null,
      effects: preset.effects || {},
      active_effect_preset: preset.activeEffectPreset || null,
      is_default: preset.isDefault ?? false,
      use_count: 0,
    };

    console.log('Inserting saved track preset:', JSON.stringify(dbRecord, null, 2));

    const { data, error } = await supabase
      .from('saved_track_presets')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('Error saving track preset:', error.message, error.details, error.hint);
      // Handle table not existing - return mock response
      if (error.code === '42P01') {
        return NextResponse.json({
          id,
          ...preset,
          useCount: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      return NextResponse.json({ error: 'Failed to save track preset', details: error.message }, { status: 500 });
    }

    return NextResponse.json(transformDbToPreset(data));
  } catch (error) {
    console.error('Error in POST saved track:', error);
    return NextResponse.json({ error: 'Failed to save track preset' }, { status: 500 });
  }
}
