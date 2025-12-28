import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import {
  getAllInstantBandPresets,
  createInstantBandPreset,
  updateInstantBandPreset,
  deleteInstantBandPreset,
} from '@/lib/loops/supabase';

// GET /api/admin/loops/presets - List all instant band presets
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const presets = await getAllInstantBandPresets(activeOnly);
    return NextResponse.json(presets);
  } catch (error) {
    console.error('Failed to get instant band presets:', error);
    return NextResponse.json(
      { error: 'Failed to get instant band presets' },
      { status: 500 }
    );
  }
}

// POST /api/admin/loops/presets - Create a new preset
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.id || !body.name || !body.loop_ids || !body.genre) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, loop_ids, genre' },
        { status: 400 }
      );
    }

    const preset = await createInstantBandPreset(body);
    return NextResponse.json(preset, { status: 201 });
  } catch (error) {
    console.error('Failed to create instant band preset:', error);
    return NextResponse.json(
      { error: 'Failed to create instant band preset' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/loops/presets?id=X - Update a preset
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
    }

    const body = await req.json();
    const preset = await updateInstantBandPreset(id, body);
    return NextResponse.json(preset);
  } catch (error) {
    console.error('Failed to update instant band preset:', error);
    return NextResponse.json(
      { error: 'Failed to update instant band preset' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/loops/presets?id=X - Delete a preset
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
    }

    await deleteInstantBandPreset(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete instant band preset:', error);
    return NextResponse.json(
      { error: 'Failed to delete instant band preset' },
      { status: 500 }
    );
  }
}
