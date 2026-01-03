import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUserFromRequest, getSupabase } from '@/lib/supabase/server';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'openstudio-tracks';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB for notation files

// Valid notation file types
const VALID_EXTENSIONS = [
  // MusicXML
  '.xml', '.musicxml', '.mxl',
  // Guitar Pro
  '.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.gp7',
  // Other tab formats
  '.ptb', '.tg',
];

const MIME_TYPES: Record<string, string> = {
  '.xml': 'application/xml',
  '.musicxml': 'application/vnd.recordare.musicxml+xml',
  '.mxl': 'application/vnd.recordare.musicxml',
  '.gp': 'application/x-guitar-pro',
  '.gp3': 'application/x-guitar-pro',
  '.gp4': 'application/x-guitar-pro',
  '.gp5': 'application/x-guitar-pro',
  '.gpx': 'application/x-guitar-pro',
  '.gp7': 'application/x-guitar-pro',
  '.ptb': 'application/x-powertab',
  '.tg': 'application/x-tuxguitar',
};

// POST - Get presigned URL for notation file upload
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const { fileName, fileSize, songId, roomId } = await request.json();

    if (!fileName || !songId || !roomId) {
      return NextResponse.json(
        { error: 'fileName, songId, and roomId are required' },
        { status: 400 }
      );
    }

    // Validate file extension
    const extension = '.' + (fileName.split('.').pop() || '').toLowerCase();
    if (!VALID_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: `Invalid file type. Supported: ${VALID_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be under 20MB' },
        { status: 400 }
      );
    }

    const fileId = uuidv4();
    const key = `notation/${roomId}/${songId}/${fileId}${extension}`;
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Return info for the client
    return NextResponse.json({
      fileId,
      uploadUrl,
      key,
      fileType: extension.replace('.', ''),
    });
  } catch (error) {
    console.error('Notation presign error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

// PATCH - Update song with parsed notation data
export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 }
    );
  }

  try {
    const { songId, roomId, notation, sourceFile } = await request.json();

    if (!songId || !roomId) {
      return NextResponse.json(
        { error: 'songId and roomId are required' },
        { status: 400 }
      );
    }

    // Update song with notation data
    const { data, error } = await supabase
      .from('songs')
      .update({
        notation: {
          ...notation,
          sourceFile,
          importedAt: new Date().toISOString(),
          importedBy: user.id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId)
      .eq('room_id', roomId)
      .select();

    if (error) {
      console.error('Error updating song notation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Song not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, song: data[0] });
  } catch (error) {
    console.error('Notation update error:', error);
    return NextResponse.json(
      { error: 'Failed to update notation' },
      { status: 500 }
    );
  }
}
