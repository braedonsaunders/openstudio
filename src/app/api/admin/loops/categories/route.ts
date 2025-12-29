import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import {
  getAllLoopCategories,
  createLoopCategory,
  updateLoopCategory,
  deleteLoopCategory,
} from '@/lib/loops/supabase';

// GET /api/admin/loops/categories - List all loop categories
export const GET = withAdminAuth(async (req, user) => {
  try {
    const categories = await getAllLoopCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to get loop categories:', error);
    return NextResponse.json(
      { error: 'Failed to get loop categories' },
      { status: 500 }
    );
  }
});

// POST /api/admin/loops/categories - Create a new category
export const POST = withAdminAuth(async (req, user) => {
  try {
    const body = await req.json();

    if (!body.id || !body.name || !body.icon) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, icon' },
        { status: 400 }
      );
    }

    const category = await createLoopCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Failed to create loop category:', error);
    return NextResponse.json(
      { error: 'Failed to create loop category' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/loops/categories?id=X - Update a category
export const PATCH = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const body = await req.json();
    const category = await updateLoopCategory(id, body);
    return NextResponse.json(category);
  } catch (error) {
    console.error('Failed to update loop category:', error);
    return NextResponse.json(
      { error: 'Failed to update loop category' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/loops/categories?id=X - Delete a category
export const DELETE = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    await deleteLoopCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete loop category:', error);
    return NextResponse.json(
      { error: 'Failed to delete loop category' },
      { status: 500 }
    );
  }
});
