import { NextRequest, NextResponse } from 'next/server';
import { getFullLoopLibrary } from '@/lib/loops/supabase';
import { LOOP_LIBRARY, LOOP_CATEGORIES, INSTANT_BAND_PRESETS } from '@/lib/audio/loop-library';

// GET /api/loops/library - Get the full loop library for client use
// Returns categories, loops, and instant band presets
// Falls back to hardcoded data if database is unavailable
export async function GET(req: NextRequest) {
  try {
    // Try to fetch from database first
    const library = await getFullLoopLibrary();

    // If we have data from the database, use it
    if (library.loops.length > 0) {
      return NextResponse.json(library, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    // Fall back to hardcoded data if database is empty
    return NextResponse.json({
      categories: LOOP_CATEGORIES,
      loops: LOOP_LIBRARY,
      presets: INSTANT_BAND_PRESETS,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch loop library from database, using fallback:', error);

    // Return hardcoded data as fallback
    return NextResponse.json({
      categories: LOOP_CATEGORIES,
      loops: LOOP_LIBRARY,
      presets: INSTANT_BAND_PRESETS,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
      },
    });
  }
}
