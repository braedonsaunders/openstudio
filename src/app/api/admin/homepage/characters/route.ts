import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import {
  getAllCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  reorderCharacters,
} from '@/lib/homepage/characters';
import type { CreateHomepageCharacterRequest, UpdateHomepageCharacterRequest } from '@/types/avatar';

// GET /api/admin/homepage/characters - List all characters
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const characters = await getAllCharacters();
    return NextResponse.json(characters);
  } catch (error) {
    console.error('Failed to get characters:', error);
    return NextResponse.json(
      { error: 'Failed to get characters' },
      { status: 500 }
    );
  }
}

// POST /api/admin/homepage/characters - Create a new character
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as CreateHomepageCharacterRequest;

    if (!body.name || !body.canvasData) {
      return NextResponse.json(
        { error: 'Missing required fields: name, canvasData' },
        { status: 400 }
      );
    }

    const character = await createCharacter(body, user.id);
    return NextResponse.json(character, { status: 201 });
  } catch (error) {
    console.error('Failed to create character:', error);
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/homepage/characters - Update a character
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Character ID required' }, { status: 400 });
    }

    const body = await req.json() as UpdateHomepageCharacterRequest;
    const character = await updateCharacter(id, body);

    return NextResponse.json(character);
  } catch (error) {
    console.error('Failed to update character:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update character' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/homepage/characters - Delete a character
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Character ID required' }, { status: 400 });
    }

    await deleteCharacter(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete character:', error);
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/homepage/characters - Reorder characters
export async function PUT(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { orderedIds: string[] };

    if (!body.orderedIds || !Array.isArray(body.orderedIds)) {
      return NextResponse.json(
        { error: 'Missing required field: orderedIds' },
        { status: 400 }
      );
    }

    await reorderCharacters(body.orderedIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder characters:', error);
    return NextResponse.json(
      { error: 'Failed to reorder characters' },
      { status: 500 }
    );
  }
}
