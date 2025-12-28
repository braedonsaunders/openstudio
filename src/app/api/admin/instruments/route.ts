import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import {
  getAllSystemInstruments,
  getSystemInstrumentById,
  createSystemInstrument,
  updateSystemInstrument,
  deleteSystemInstrument,
  duplicateSystemInstrument,
} from '@/lib/loops/supabase';

// GET /api/admin/instruments - List all system instruments
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category') || undefined;
    const type = searchParams.get('type') as 'synth' | 'drums' | 'sampler' | undefined;
    const activeOnly = searchParams.get('active') !== 'false';

    const instruments = await getAllSystemInstruments({ categoryId, type, activeOnly });
    return NextResponse.json(instruments);
  } catch (error) {
    console.error('Failed to get instruments:', error);
    return NextResponse.json(
      { error: 'Failed to get instruments' },
      { status: 500 }
    );
  }
}

// POST /api/admin/instruments - Create a new instrument
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
      const instrument = await duplicateSystemInstrument(sourceId, newId);
      return NextResponse.json(instrument, { status: 201 });
    }

    // Regular create
    const body = await req.json();

    if (!body.id || !body.name || !body.category_id || !body.type || !body.layout) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, category_id, type, layout' },
        { status: 400 }
      );
    }

    const instrument = await createSystemInstrument({
      ...body,
      created_by: user.id,
    });
    return NextResponse.json(instrument, { status: 201 });
  } catch (error) {
    console.error('Failed to create instrument:', error);
    return NextResponse.json(
      { error: 'Failed to create instrument' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/instruments?id=X - Update an instrument
export async function PATCH(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Instrument ID required' }, { status: 400 });
    }

    const body = await req.json();
    const instrument = await updateSystemInstrument(id, body);
    return NextResponse.json(instrument);
  } catch (error) {
    console.error('Failed to update instrument:', error);
    return NextResponse.json(
      { error: 'Failed to update instrument' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/instruments?id=X - Delete an instrument
export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Instrument ID required' }, { status: 400 });
    }

    await deleteSystemInstrument(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete instrument:', error);
    return NextResponse.json(
      { error: 'Failed to delete instrument' },
      { status: 500 }
    );
  }
}
