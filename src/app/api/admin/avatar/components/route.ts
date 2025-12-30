import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import {
  getAllComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  changeComponentId,
} from '@/lib/avatar/supabase';
import type { CreateComponentRequest, UpdateComponentRequest } from '@/types/avatar';

// GET /api/admin/avatar/components - List all components
export const GET = withAdminAuth(async (req, user) => {
  try {
    const components = await getAllComponents();
    return NextResponse.json(components);
  } catch (error) {
    console.error('Failed to get components:', error);
    return NextResponse.json(
      { error: 'Failed to get components' },
      { status: 500 }
    );
  }
});

// POST /api/admin/avatar/components - Create a new component
export const POST = withAdminAuth(async (req, user) => {
  try {
    const body = await req.json() as CreateComponentRequest;

    if (!body.id || !body.categoryId || !body.name || !body.imageUrl || !body.r2Key) {
      return NextResponse.json(
        { error: 'Missing required fields: id, categoryId, name, imageUrl, r2Key' },
        { status: 400 }
      );
    }

    const component = await createComponent(body, user.id);
    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error('Failed to create component:', error);
    return NextResponse.json(
      { error: 'Failed to create component' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/avatar/components - Update a component
export const PATCH = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Component ID required' }, { status: 400 });
    }

    const body = await req.json() as UpdateComponentRequest & { newId?: string };

    // Handle ID change separately
    let currentId = id;
    if (body.newId && body.newId !== id) {
      await changeComponentId(id, body.newId);
      currentId = body.newId;
    }

    // Update other fields if any
    const { newId: _, ...updateFields } = body;
    const component = await updateComponent(currentId, updateFields);

    return NextResponse.json(component);
  } catch (error) {
    console.error('Failed to update component:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update component' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/avatar/components - Delete a component
export const DELETE = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Component ID required' }, { status: 400 });
    }

    await deleteComponent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete component:', error);
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    );
  }
});
