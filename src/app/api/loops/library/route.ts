import { NextRequest, NextResponse } from 'next/server';
import { getFullLoopLibrary } from '@/lib/loops/supabase';

// GET /api/loops/library - Get the full loop library for client use
// Returns categories, loops, and instant band presets
export async function GET(req: NextRequest) {
  try {
    const library = await getFullLoopLibrary();

    return NextResponse.json(library, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Failed to fetch loop library from database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loop library' },
      { status: 500 }
    );
  }
}
