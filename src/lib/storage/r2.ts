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
