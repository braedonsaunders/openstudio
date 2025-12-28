import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import {
  getAllInstrumentCategories,
  createInstrumentCategory,
  updateInstrumentCategory,
  deleteInstrumentCategory,
} from '@/lib/loops/supabase';
import { getAllCategories } from '@/lib/audio/instrument-registry';

// GET /api/admin/instruments/categories - List all instrument categories
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await getAllInstrumentCategories();

    // Fall back to hardcoded data if database is empty
    if (categories.length === 0) {
      return NextResponse.json(getAllCategories());
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Failed to get instrument categories:', error);
    // Return hardcoded data as fallback on error
    return NextResponse.json(getAllCategories());
  }
}

// POST /api/admin/instruments/categories - Create a new category
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.id || !body.name || !body.icon) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, icon' },
        { status: 400 }
      );
    }

    const category = await createInstrumentCategory(body);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Failed to create instrument category:', error);
    return NextResponse.json(
      { error: 'Failed to create instrument category' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/instruments/categories?id=X - Update a category
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const body = await req.json();
    const category = await updateInstrumentCategory(id, body);
    return NextResponse.json(category);
  } catch (error) {
    console.error('Failed to update instrument category:', error);
    return NextResponse.json(
      { error: 'Failed to update instrument category' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/instruments/categories?id=X - Delete a category
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    await deleteInstrumentCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete instrument category:', error);
    return NextResponse.json(
      { error: 'Failed to delete instrument category' },
      { status: 500 }
    );
  }
}
