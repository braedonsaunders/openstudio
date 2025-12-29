import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import { uploadHomepageCharacterImage } from '@/lib/storage/r2';

// POST /api/admin/homepage/characters/upload - Upload character image
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as {
      characterId: string;
      imageDataUrl: string;
      imageType: 'full-body' | 'thumbnail';
    };

    if (!body.characterId || !body.imageDataUrl || !body.imageType) {
      return NextResponse.json(
        { error: 'Missing required fields: characterId, imageDataUrl, imageType' },
        { status: 400 }
      );
    }

    const result = await uploadHomepageCharacterImage(
      body.characterId,
      body.imageDataUrl,
      body.imageType
    );

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Failed to upload character image:', error);
    return NextResponse.json(
      { error: 'Failed to upload character image' },
      { status: 500 }
    );
  }
}
