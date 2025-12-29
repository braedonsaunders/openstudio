import { NextRequest, NextResponse } from 'next/server';
import { getActiveCharacters, getCharactersForScene } from '@/lib/homepage/characters';
import type { HomepageSceneType } from '@/types/avatar';

// GET /api/homepage/characters - Get active characters for homepage
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scene = searchParams.get('scene') as HomepageSceneType | null;

    let characters;
    if (scene) {
      characters = await getCharactersForScene(scene);
    } else {
      characters = await getActiveCharacters();
    }

    return NextResponse.json(characters, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Failed to get homepage characters:', error);
    return NextResponse.json(
      { error: 'Failed to get characters' },
      { status: 500 }
    );
  }
}
