import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  updateCategoryOrder,
  deleteCategory,
} from '@/lib/avatar/supabase';
import type { CreateCategoryRequest, UpdateCategoryRequest } from '@/types/avatar';

// GET /api/admin/avatar/categories - List all categories
export const GET = withAdminAuth(async (req, user) => {
  try {
    const categories = await getAllCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to get categories:', error);
    return NextResponse.json(
      { error: 'Failed to get categories' },
      { status: 500 }
    );
  }
});

// POST /api/admin/avatar/categories - Create a new category
export const POST = withAdminAuth(async (req, user) => {
  try {
    const body = await req.json() as CreateCategoryRequest;

    if (!body.id || !body.displayName || body.layerOrder === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: id, displayName, layerOrder' },
        { status: 400 }
      );
    }

    const category = await createCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/avatar/categories - Update a category or reorder
export const PATCH = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    const body = await req.json();

    // Handle reordering
    if (action === 'reorder' && Array.isArray(body.orderedIds)) {
      await updateCategoryOrder(body.orderedIds);
      return NextResponse.json({ success: true });
    }

    // Handle single category update
    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const category = await updateCategory(id, body as UpdateCategoryRequest);
    return NextResponse.json(category);
  } catch (error) {
    console.error('Failed to update category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/avatar/categories - Delete a category
export const DELETE = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    await deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
});
