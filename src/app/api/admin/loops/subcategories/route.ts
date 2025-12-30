import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import {
  getAllLoopSubcategories,
  createLoopSubcategory,
  updateLoopSubcategory,
  deleteLoopSubcategory,
} from '@/lib/loops/supabase';

// GET /api/admin/loops/subcategories - List all subcategories
export const GET = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category') || undefined;

    const subcategories = await getAllLoopSubcategories(categoryId);
    return NextResponse.json(subcategories);
  } catch (error) {
    console.error('Failed to get loop subcategories:', error);
    return NextResponse.json(
      { error: 'Failed to get loop subcategories' },
      { status: 500 }
    );
  }
});

// POST /api/admin/loops/subcategories - Create a new subcategory
export const POST = withAdminAuth(async (req, user) => {
  try {
    const body = await req.json();

    if (!body.id || !body.category_id || !body.name) {
      return NextResponse.json(
        { error: 'Missing required fields: id, category_id, name' },
        { status: 400 }
      );
    }

    const subcategory = await createLoopSubcategory(body);
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error('Failed to create loop subcategory:', error);
    return NextResponse.json(
      { error: 'Failed to create loop subcategory' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/loops/subcategories?id=X - Update a subcategory
export const PATCH = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subcategory ID required' }, { status: 400 });
    }

    const body = await req.json();
    const subcategory = await updateLoopSubcategory(id, body);
    return NextResponse.json(subcategory);
  } catch (error) {
    console.error('Failed to update loop subcategory:', error);
    return NextResponse.json(
      { error: 'Failed to update loop subcategory' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/loops/subcategories?id=X - Delete a subcategory
export const DELETE = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subcategory ID required' }, { status: 400 });
    }

    await deleteLoopSubcategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete loop subcategory:', error);
    return NextResponse.json(
      { error: 'Failed to delete loop subcategory' },
      { status: 500 }
    );
  }
});
