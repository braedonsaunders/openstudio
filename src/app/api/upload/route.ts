// SECURITY: This endpoint requires authentication and proper file validation
// For direct uploads, use the /api/upload/presign endpoint instead

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserFromRequest } from '@/lib/supabase/server';
import { uploadTrack } from '@/lib/storage/r2';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

// Maximum file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Allowed MIME types for audio files
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
]);

// Magic bytes for audio file validation
const AUDIO_MAGIC_BYTES: Record<string, number[]> = {
  mp3: [0xFF, 0xFB], // MP3 frame sync
  mp3_id3: [0x49, 0x44, 0x33], // ID3 tag
  wav: [0x52, 0x49, 0x46, 0x46], // RIFF
  ogg: [0x4F, 0x67, 0x67, 0x53], // OggS
  webm: [0x1A, 0x45, 0xDF, 0xA3], // EBML
};

function validateMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12));

  // Check each known magic byte pattern
  for (const pattern of Object.values(AUDIO_MAGIC_BYTES)) {
    let matches = true;
    for (let i = 0; i < pattern.length; i++) {
      if (bytes[i] !== pattern[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required to upload files' },
      { status: 401 }
    );
  }

  // Rate limiting
  const rateLimit = checkRateLimit(`upload:${user.id}`, rateLimiters.upload);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const roomId = formData.get('roomId') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Track name is required' },
        { status: 400 }
      );
    }

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be under 100MB' },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported formats: MP3, WAV, WebM, OGG' },
        { status: 400 }
      );
    }

    // Validate file content (magic bytes)
    const buffer = await file.arrayBuffer();
    if (!validateMagicBytes(buffer)) {
      return NextResponse.json(
        { error: 'File content does not match a supported audio format' },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedName = name.trim().slice(0, 255).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const safeExtension = ['mp3', 'wav', 'webm', 'ogg'].includes(extension) ? extension : 'mp3';
    const filename = `${sanitizedName}.${safeExtension}`;

    // Upload to R2
    const result = await uploadTrack(
      new Uint8Array(buffer),
      filename,
      file.type,
      roomId
    );

    // Return track metadata
    return NextResponse.json({
      id: uuidv4(),
      name: sanitizedName,
      url: result.url,
      key: result.key,
      size: result.size,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload track' },
      { status: 500 }
    );
  }
}

// GET endpoint removed - use proper track listing APIs instead
export async function GET() {
  return NextResponse.json(
    { error: 'Use /api/rooms/[roomId]/tracks to list tracks' },
    { status: 400 }
  );
}
