import { NextRequest, NextResponse } from 'next/server';
import { getFullInstrumentLibrary } from '@/lib/loops/supabase';
import { getAllInstruments, getAllCategories } from '@/lib/audio/instrument-registry';

// GET /api/instruments/library - Get the full instrument library for client use
// Returns categories and instruments
// Falls back to hardcoded data if database is unavailable
export async function GET(req: NextRequest) {
  try {
    // Try to fetch from database first
    const library = await getFullInstrumentLibrary();

    // If we have data from the database, use it
    if (library.instruments.length > 0) {
      return NextResponse.json(library, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    // Fall back to hardcoded data if database is empty
    return NextResponse.json({
      categories: getAllCategories(),
      instruments: getAllInstruments(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch instrument library from database, using fallback:', error);

    // Return hardcoded data as fallback
    return NextResponse.json({
      categories: getAllCategories(),
      instruments: getAllInstruments(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
      },
    });
  }
}
