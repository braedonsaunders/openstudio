import { NextResponse } from 'next/server';
import { getAvatarLibrary } from '@/lib/avatar/supabase';

// Cache the library for 5 minutes
let cachedLibrary: Awaited<ReturnType<typeof getAvatarLibrary>> | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// GET /api/avatar/library - Get the full component library (public, cached)
export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (cachedLibrary && now - cacheTime < CACHE_DURATION) {
      return NextResponse.json(cachedLibrary, {
        headers: {
          'Cache-Control': 'public, max-age=300', // Browser cache for 5 min
        },
      });
    }

    // Fetch fresh data
    const library = await getAvatarLibrary();

    // Update cache
    cachedLibrary = library;
    cacheTime = now;

    return NextResponse.json(library, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Failed to get avatar library:', error);
    return NextResponse.json(
      { error: 'Failed to get avatar library' },
      { status: 500 }
    );
  }
}
