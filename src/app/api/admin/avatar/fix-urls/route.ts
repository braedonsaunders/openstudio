import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, getAdminSupabase } from '@/lib/supabase/server';
import { extractAvatarR2Key, isPresignedUrl } from '@/lib/storage/r2';

/**
 * Fix avatar component URLs in the database
 * Converts expired presigned URLs to R2 keys
 * The keys will be converted to fresh signed URLs when components are fetched
 */
export const POST = withAdminAuth(async (req, user) => {
  try {
    const adminClient = getAdminSupabase();
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Admin client not configured' },
        { status: 500 }
      );
    }

    // Fetch all components
    const { data: components, error: fetchError } = await adminClient
      .from('avatar_components')
      .select('id, image_url, thumbnail_url, r2_key');

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch components: ${fetchError.message}` },
        { status: 500 }
      );
    }

    let fixedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const component of components || []) {
      try {
        const updates: Record<string, string> = {};
        let needsUpdate = false;

        // Check if image_url needs fixing
        if (component.image_url && isPresignedUrl(component.image_url)) {
          const key = extractAvatarR2Key(component.image_url);
          if (key && key !== component.image_url) {
            updates.image_url = key;
            // Also update r2_key if it's not set or different
            if (!component.r2_key || component.r2_key !== key) {
              updates.r2_key = key;
            }
            needsUpdate = true;
          }
        }

        // Check if thumbnail_url needs fixing
        if (component.thumbnail_url && isPresignedUrl(component.thumbnail_url)) {
          const key = extractAvatarR2Key(component.thumbnail_url);
          if (key && key !== component.thumbnail_url) {
            updates.thumbnail_url = key;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          updates.updated_at = new Date().toISOString();
          const { error: updateError } = await adminClient
            .from('avatar_components')
            .update(updates)
            .eq('id', component.id);

          if (updateError) {
            errors.push(`Failed to update ${component.id}: ${updateError.message}`);
          } else {
            fixedCount++;
          }
        } else {
          skippedCount++;
        }
      } catch (err) {
        errors.push(`Error processing ${component.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      totalComponents: components?.length || 0,
      fixedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Failed to fix URLs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix URLs' },
      { status: 500 }
    );
  }
});

/**
 * GET - Check how many components have presigned URLs that need fixing
 */
export const GET = withAdminAuth(async (req, user) => {
  try {
    const adminClient = getAdminSupabase();
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Admin client not configured' },
        { status: 500 }
      );
    }

    // Fetch all components
    const { data: components, error: fetchError } = await adminClient
      .from('avatar_components')
      .select('id, image_url, thumbnail_url, r2_key');

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch components: ${fetchError.message}` },
        { status: 500 }
      );
    }

    let needsFixing = 0;
    let alreadyFixed = 0;
    const samples: { id: string; imageUrl: string; needsFix: boolean }[] = [];

    for (const component of components || []) {
      const imageNeedsFix = component.image_url && isPresignedUrl(component.image_url);
      const thumbnailNeedsFix = component.thumbnail_url && isPresignedUrl(component.thumbnail_url);

      if (imageNeedsFix || thumbnailNeedsFix) {
        needsFixing++;
        if (samples.length < 5) {
          samples.push({
            id: component.id,
            imageUrl: component.image_url?.substring(0, 100) + '...',
            needsFix: true,
          });
        }
      } else {
        alreadyFixed++;
      }
    }

    return NextResponse.json({
      totalComponents: components?.length || 0,
      needsFixing,
      alreadyFixed,
      samples,
    });
  } catch (error) {
    console.error('Failed to check URLs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check URLs' },
      { status: 500 }
    );
  }
});
