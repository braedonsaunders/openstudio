// R2 Storage integration for backing tracks and avatar components
// Uses S3-compatible API with Cloudflare R2

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'openstudio-tracks';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || ''; // Optional: Custom domain for public access

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export async function uploadTrack(
  file: Buffer | Uint8Array,
  filename: string,
  contentType: string,
  roomId: string
): Promise<UploadResult> {
  const key = `rooms/${roomId}/tracks/${Date.now()}-${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  const url = await getTrackUrl(key);

  return {
    key,
    url,
    size: file.length,
  };
}

export async function uploadStem(
  file: Buffer | Uint8Array,
  originalKey: string,
  stemType: string,
  contentType: string
): Promise<UploadResult> {
  const basePath = originalKey.replace(/\.[^/.]+$/, '');
  const key = `${basePath}/stems/${stemType}.wav`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  const url = await getTrackUrl(key);

  return {
    key,
    url,
    size: file.length,
  };
}

export async function getTrackUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteTrack(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

export async function listRoomTracks(roomId: string): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `rooms/${roomId}/tracks/`,
    })
  );

  return (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);
}

/**
 * Delete all files for a room (tracks and stems)
 * This should be called before deleting a room from the database
 */
export async function deleteRoomFiles(roomId: string): Promise<{ deletedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let deletedCount = 0;

  try {
    // List all files in the room's tracks directory (includes stems in subdirectories)
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: `rooms/${roomId}/`,
      })
    );

    const keys = (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);

    // Delete all files
    const deletePromises = keys.map(async (key) => {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
          })
        );
        deletedCount++;
      } catch (error) {
        errors.push(`Failed to delete ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    await Promise.all(deletePromises);
  } catch (error) {
    errors.push(`Failed to list room files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { deletedCount, errors };
}

/**
 * Delete a track and its associated stem files from R2
 * Handles both old-style keys (tracks/{id}.ext) and new-style keys (rooms/{roomId}/tracks/{timestamp}-{filename})
 */
export async function deleteTrackWithStems(key: string): Promise<{ deletedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let deletedCount = 0;

  try {
    // Delete the main track file
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    deletedCount++;

    // Delete associated stem files
    // Stems are stored at: {basePath}/stems/{stemType}.wav
    const basePath = key.replace(/\.[^/.]+$/, ''); // Remove file extension
    const stemsPrefix = `${basePath}/stems/`;

    const stemsResponse = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: stemsPrefix,
      })
    );

    const stemKeys = (stemsResponse.Contents || []).map((obj) => obj.Key!).filter(Boolean);

    for (const stemKey of stemKeys) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: stemKey,
          })
        );
        deletedCount++;
      } catch (error) {
        errors.push(`Failed to delete stem ${stemKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to delete track ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { deletedCount, errors };
}

/**
 * Extract R2 key from a track URL
 * Handles various URL formats:
 * - Direct R2 URL: https://{account}.r2.cloudflarestorage.com/{bucket}/rooms/{roomId}/tracks/...
 * - Proxy URL: /api/audio/{trackId} -> tracks/{trackId}.{ext}
 * - Full key: rooms/{roomId}/tracks/...
 */
export function extractR2KeyFromUrl(url: string, trackId?: string): string | null {
  if (!url) return null;

  // If it's already a key (starts with rooms/ or tracks/)
  if (url.startsWith('rooms/') || url.startsWith('tracks/')) {
    return url;
  }

  // Handle proxy URLs: /api/audio/{trackId}
  if (url.startsWith('/api/audio/')) {
    const id = url.replace('/api/audio/', '');
    // Old format used tracks/{id}.ext - we'll return the base pattern
    return `tracks/${id}`;
  }

  // Handle full R2 URLs
  if (url.includes('r2.cloudflarestorage.com')) {
    // Extract the key from the URL (everything after the bucket name)
    const match = url.match(/r2\.cloudflarestorage\.com\/[^/]+\/(.+)/);
    if (match) {
      return match[1];
    }
    // Alternative pattern without bucket in URL
    const altMatch = url.match(/r2\.cloudflarestorage\.com\/(.+)/);
    if (altMatch) {
      return altMatch[1];
    }
  }

  // If we have a trackId, use the old format
  if (trackId) {
    return `tracks/${trackId}`;
  }

  return null;
}

/**
 * Delete a track from R2 by its URL
 * Tries multiple extensions for old-style URLs
 */
export async function deleteTrackByUrl(url: string, trackId?: string): Promise<{ deletedCount: number; errors: string[] }> {
  const key = extractR2KeyFromUrl(url, trackId);

  if (!key) {
    return { deletedCount: 0, errors: ['Could not extract R2 key from URL'] };
  }

  // If key doesn't have an extension (old proxy format), try multiple extensions
  if (key.startsWith('tracks/') && !key.match(/\.(mp3|wav|webm)$/)) {
    const extensions = ['mp3', 'wav', 'webm'];
    let totalDeleted = 0;
    const allErrors: string[] = [];

    for (const ext of extensions) {
      const fullKey = `${key}.${ext}`;
      const result = await deleteTrackWithStems(fullKey);
      totalDeleted += result.deletedCount;
      // Don't treat "not found" as an error since we're trying multiple extensions
    }

    return { deletedCount: totalDeleted, errors: allErrors };
  }

  return deleteTrackWithStems(key);
}

export async function getUploadUrl(
  filename: string,
  contentType: string,
  roomId: string
): Promise<{ uploadUrl: string; key: string }> {
  const key = `rooms/${roomId}/tracks/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { uploadUrl, key };
}

// ============================================
// AVATAR COMPONENT STORAGE
// ============================================

export interface AvatarUploadResult {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
}

/**
 * Download an avatar component image from R2
 */
export async function downloadAvatarComponent(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error('No body in response');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const reader = response.Body.transformToWebStream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/**
 * Upload an avatar component image
 */
export async function uploadAvatarComponent(
  file: Buffer | Uint8Array,
  categoryId: string,
  componentId: string,
  contentType: string = 'image/png'
): Promise<AvatarUploadResult> {
  const key = `avatars/components/${categoryId}/${componentId}.png`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    })
  );

  const url = await getAvatarUrl(key);

  return { key, url };
}

/**
 * Upload an avatar component with thumbnail
 */
export async function uploadAvatarComponentWithThumbnail(
  file: Buffer | Uint8Array,
  thumbnail: Buffer | Uint8Array,
  categoryId: string,
  componentId: string
): Promise<AvatarUploadResult> {
  const key = `avatars/components/${categoryId}/${componentId}.png`;
  const thumbnailKey = `avatars/components/${categoryId}/${componentId}_thumb.png`;

  await Promise.all([
    s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000',
      })
    ),
    s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000',
      })
    ),
  ]);

  const [url, thumbnailUrl] = await Promise.all([
    getAvatarUrl(key),
    getAvatarUrl(thumbnailKey),
  ]);

  return { key, url, thumbnailKey, thumbnailUrl };
}

/**
 * Upload a color variant of an avatar component
 */
export async function uploadAvatarColorVariant(
  file: Buffer | Uint8Array,
  categoryId: string,
  componentId: string,
  colorName: string
): Promise<{ key: string; url: string }> {
  const key = `avatars/components/${categoryId}/${componentId}_${colorName}.png`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    })
  );

  const url = await getAvatarUrl(key);

  return { key, url };
}

/**
 * Get a signed URL for an avatar component (or public URL if configured)
 */
export async function getAvatarUrl(key: string, expiresIn: number = 86400): Promise<string> {
  // If we have a public URL configured, use it directly
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }

  // Otherwise use signed URL
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete an avatar component and all its variants
 */
export async function deleteAvatarComponent(categoryId: string, componentId: string): Promise<void> {
  // List all files for this component (including color variants)
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `avatars/components/${categoryId}/${componentId}`,
    })
  );

  // Delete all matching files
  const deletePromises = (response.Contents || []).map((obj) =>
    s3Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: obj.Key!,
      })
    )
  );

  await Promise.all(deletePromises);
}

/**
 * List all avatar components in a category
 */
export async function listAvatarComponents(categoryId: string): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `avatars/components/${categoryId}/`,
    })
  );

  return (response.Contents || [])
    .map((obj) => obj.Key!)
    .filter((key) => key && !key.includes('_thumb') && !key.includes('_'));
}

/**
 * Upload avatar image from URL (fetch and re-upload)
 */
export async function uploadAvatarFromUrl(
  imageUrl: string,
  categoryId: string,
  componentId: string
): Promise<AvatarUploadResult> {
  // Fetch the image
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadAvatarComponent(buffer, categoryId, componentId);
}

// ============================================
// USER AVATAR IMAGE STORAGE
// ============================================

/**
 * Upload a user's generated avatar image (full-body, headshot, or thumbnail)
 * Takes a base64 data URL and uploads to R2
 */
export async function uploadUserAvatarImage(
  userId: string,
  dataUrl: string,
  imageType: 'full-body' | 'headshot' | 'thumb-xs' | 'thumb-sm' | 'thumb-md' | 'thumb-lg'
): Promise<{ key: string; url: string }> {
  // Extract base64 data from data URL
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }

  const [, , base64Data] = matches;
  const buffer = Buffer.from(base64Data, 'base64');

  const timestamp = Date.now();
  const key = `avatars/users/${userId}/${imageType}-${timestamp}.png`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=86400', // Cache for 1 day
    })
  );

  const url = await getAvatarUrl(key);

  return { key, url };
}
