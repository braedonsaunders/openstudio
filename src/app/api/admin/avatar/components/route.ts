import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserProfile } from '@/lib/supabase/auth';
import {
  getAllComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  setComponentUnlockRules,
} from '@/lib/avatar/supabase';
import type { CreateComponentRequest, UpdateComponentRequest } from '@/types/avatar';

// Check if user is admin
async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const profile = await getUserProfile(user.id);
  return profile?.accountType === 'admin';
}

// GET /api/admin/avatar/components - List all components
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const components = await getAllComponents();
    return NextResponse.json(components);
  } catch (error) {
    console.error('Failed to get components:', error);
    return NextResponse.json(
      { error: 'Failed to get components' },
      { status: 500 }
    );
  }
}

// POST /api/admin/avatar/components - Create a new component
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
}

// PATCH /api/admin/avatar/components - Update a component
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Component ID required' }, { status: 400 });
    }

    const body = await req.json() as UpdateComponentRequest;
    const component = await updateComponent(id, body);

    return NextResponse.json(component);
  } catch (error) {
    console.error('Failed to update component:', error);
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/avatar/components - Delete a component
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
}
