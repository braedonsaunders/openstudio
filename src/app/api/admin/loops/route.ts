import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import {
  getAllSystemLoops,
  getSystemLoopById,
  createSystemLoop,
  updateSystemLoop,
  deleteSystemLoop,
  duplicateSystemLoop,
  promoteUserLoopToSystem,
} from '@/lib/loops/supabase';

// GET /api/admin/loops - List all system loops
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category') || undefined;
    const subcategoryId = searchParams.get('subcategory') || undefined;
    const activeOnly = searchParams.get('active') !== 'false';

    const loops = await getAllSystemLoops({ categoryId, subcategoryId, activeOnly });
    return NextResponse.json(loops);
  } catch (error) {
    console.error('Failed to get loops:', error);
    return NextResponse.json(
      { error: 'Failed to get loops' },
      { status: 500 }
    );
  }
}

// POST /api/admin/loops - Create a new loop
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Handle duplicate action
    if (action === 'duplicate') {
      const sourceId = searchParams.get('id');
      const newId = searchParams.get('newId');
      if (!sourceId || !newId) {
        return NextResponse.json(
          { error: 'Missing id or newId for duplicate' },
          { status: 400 }
        );
      }
      const loop = await duplicateSystemLoop(sourceId, newId);
      return NextResponse.json(loop, { status: 201 });
    }

    // Handle promote action (user loop to system)
    if (action === 'promote') {
      const body = await req.json();
      const { userLoopId, overrides } = body;
      if (!userLoopId) {
        return NextResponse.json(
          { error: 'Missing userLoopId' },
          { status: 400 }
        );
      }
      const loop = await promoteUserLoopToSystem(userLoopId, user.id, overrides);
      return NextResponse.json(loop, { status: 201 });
    }

    // Regular create
    const body = await req.json();

    if (!body.id || !body.name || !body.category_id || !body.sound_preset) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, category_id, sound_preset' },
        { status: 400 }
      );
    }

    const loop = await createSystemLoop({
      ...body,
      created_by: user.id,
    });
    return NextResponse.json(loop, { status: 201 });
  } catch (error) {
    console.error('Failed to create loop:', error);
    return NextResponse.json(
      { error: 'Failed to create loop' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/loops?id=X - Update a loop
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Loop ID required' }, { status: 400 });
    }

    const body = await req.json();
    const loop = await updateSystemLoop(id, body);
    return NextResponse.json(loop);
  } catch (error) {
    console.error('Failed to update loop:', error);
    return NextResponse.json(
      { error: 'Failed to update loop' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/loops?id=X - Delete a loop
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Loop ID required' }, { status: 400 });
    }

    await deleteSystemLoop(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete loop:', error);
    return NextResponse.json(
      { error: 'Failed to delete loop' },
      { status: 500 }
    );
  }
}
