import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import {
  getGenerationPresets,
  createGenerationPreset,
  updateGenerationPreset,
  deleteGenerationPreset,
} from '@/lib/avatar/supabase';
import type { AvatarGenerationPreset } from '@/types/avatar';

// GET /api/admin/avatar/presets - List all presets
export const GET = withAdminAuth(async (req, user) => {
  try {
    const presets = await getGenerationPresets();
    return NextResponse.json(presets);
  } catch (error) {
    console.error('Failed to get presets:', error);
    return NextResponse.json(
      { error: 'Failed to get presets' },
      { status: 500 }
    );
  }
});

// POST /api/admin/avatar/presets - Create a new preset
export const POST = withAdminAuth(async (req, user) => {
  try {
    const body = await req.json() as Omit<AvatarGenerationPreset, 'createdAt' | 'isActive'>;

    if (!body.id || !body.name || !body.promptTemplate) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, promptTemplate' },
        { status: 400 }
      );
    }

    const preset = await createGenerationPreset(body);
    return NextResponse.json(preset, { status: 201 });
  } catch (error) {
    console.error('Failed to create preset:', error);
    return NextResponse.json(
      { error: 'Failed to create preset' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/avatar/presets - Update a preset
export const PATCH = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
    }

    const body = await req.json() as Partial<AvatarGenerationPreset>;
    const preset = await updateGenerationPreset(id, body);

    return NextResponse.json(preset);
  } catch (error) {
    console.error('Failed to update preset:', error);
    return NextResponse.json(
      { error: 'Failed to update preset' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/avatar/presets - Delete a preset
export const DELETE = withAdminAuth(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
    }

    await deleteGenerationPreset(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete preset:', error);
    return NextResponse.json(
      { error: 'Failed to delete preset' },
      { status: 500 }
    );
  }
});
