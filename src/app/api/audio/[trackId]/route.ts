import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

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

interface RouteContext {
  params: Promise<{ trackId: string }>;
}

// GET /api/audio/[trackId] - Stream audio file from R2
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { trackId } = await context.params;

    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId is required' },
        { status: 400 }
      );
    }

    // First, search for the file using prefix search since files are stored under user directories
    // Files are stored as tracks/{userId}/{trackId}.{ext}
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'tracks/',
      MaxKeys: 1000,
    });

    const listResponse = await s3Client.send(listCommand);
    const matchingKey = listResponse.Contents?.find(obj =>
      obj.Key?.includes(trackId)
    )?.Key;

    let audioStream = null;
    let contentType = 'audio/mpeg';

    if (matchingKey) {
      // Found the file, fetch it
      try {
        const command = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: matchingKey,
        });

        const response = await s3Client.send(command);
        if (response.Body) {
          audioStream = response;
          const ext = matchingKey.split('.').pop() || 'mp3';
          contentType = response.ContentType || `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
        }
      } catch (e) {
        console.error('Error fetching matched key:', matchingKey, e);
      }
    }

    // Fallback: try legacy paths without user ID (for backwards compatibility)
    if (!audioStream) {
      const extensions = ['mp3', 'wav', 'webm'];
      for (const ext of extensions) {
        const key = `tracks/${trackId}.${ext}`;
        try {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          });

          const response = await s3Client.send(command);
          if (response.Body) {
            audioStream = response;
            contentType = response.ContentType || `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
            break;
          }
        } catch {
          // Try next extension
          continue;
        }
      }
    }

    if (!audioStream || !audioStream.Body) {
      console.error('Audio file not found in R2:', trackId);
      return new NextResponse(
        JSON.stringify({ error: 'Audio file not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Convert the readable stream to a web stream
    const webStream = audioStream.Body.transformToWebStream();

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioStream.ContentLength?.toString() || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
      },
    });
  } catch (error) {
    console.error('Error streaming audio:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to stream audio' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
