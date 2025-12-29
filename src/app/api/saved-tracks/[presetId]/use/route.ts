import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

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
