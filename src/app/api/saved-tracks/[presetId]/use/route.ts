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

// POST /api/saved-tracks/[presetId]/use - Increment use count
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { presetId } = await context.params;

    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    // Increment use_count using RPC or direct update
    const { error } = await supabase.rpc('increment_preset_use_count', {
      preset_id: presetId,
    });

    // If RPC doesn't exist, fall back to manual increment
    if (error) {
      // Get current count
      const { data: preset } = await supabase
        .from('saved_track_presets')
        .select('use_count')
        .eq('id', presetId)
        .single();

      if (preset) {
        await supabase
          .from('saved_track_presets')
          .update({
            use_count: (preset.use_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', presetId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error incrementing use count:', error);
    return NextResponse.json({ success: true }); // Don't fail the request for analytics
  }
}
