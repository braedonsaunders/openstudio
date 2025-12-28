import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserProfile } from '@/lib/supabase/auth';
import { uploadAvatarComponent, uploadAvatarFromUrl, uploadAvatarColorVariant } from '@/lib/storage/r2';

// Check if user is admin
async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const profile = await getUserProfile(user.id);
  return profile?.accountType === 'admin';
}

// POST /api/admin/avatar/upload - Upload avatar component image
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    // Handle JSON body (URL or base64)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { imageUrl, imageData, categoryId, componentId, colorVariant } = body;

      if (!categoryId || !componentId) {
        return NextResponse.json(
          { error: 'categoryId and componentId are required' },
          { status: 400 }
        );
      }

      // Upload from URL
      if (imageUrl) {
        // Handle color variant upload
        if (colorVariant) {
          // Fetch the image first
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const result = await uploadAvatarColorVariant(buffer, categoryId, componentId, colorVariant);
          return NextResponse.json(result);
        }

        const result = await uploadAvatarFromUrl(imageUrl, categoryId, componentId);
        return NextResponse.json(result);
      }

      // Upload from base64
      if (imageData) {
        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        if (colorVariant) {
          const result = await uploadAvatarColorVariant(buffer, categoryId, componentId, colorVariant);
          return NextResponse.json(result);
        }

        const result = await uploadAvatarComponent(buffer, categoryId, componentId);
        return NextResponse.json(result);
      }

      return NextResponse.json(
        { error: 'Either imageUrl or imageData is required' },
        { status: 400 }
      );
    }

    // Handle multipart form data
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const categoryId = formData.get('categoryId') as string | null;
      const componentId = formData.get('componentId') as string | null;
      const colorVariant = formData.get('colorVariant') as string | null;

      if (!file || !categoryId || !componentId) {
        return NextResponse.json(
          { error: 'file, categoryId, and componentId are required' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (colorVariant) {
        const result = await uploadAvatarColorVariant(buffer, categoryId, componentId, colorVariant);
        return NextResponse.json(result);
      }

      const result = await uploadAvatarComponent(buffer, categoryId, componentId);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to upload image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    );
  }
}
