import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

// Cobalt instance URL (self-hosted) - required
const COBALT_API_URL = process.env.COBALT_API_URL;
const COBALT_API_KEY = process.env.COBALT_API_KEY;

interface CobaltResponse {
  status: 'tunnel' | 'redirect' | 'picker' | 'stream' | 'error';
  url?: string;
  filename?: string;
  error?: { code: string };
}

interface ExtractResult {
  success: boolean;
  data?: CobaltResponse;
  error?: string;
}

async function tryExtractWithCobalt(videoUrl: string, instanceUrl: string, apiKey?: string): Promise<ExtractResult> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(instanceUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: videoUrl,
        audioFormat: 'mp3',
        downloadMode: 'audio',
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    console.log(`Cobalt response (${response.status}):`, responseText);

    if (!response.ok) {
      return {
        success: false,
        error: `Cobalt returned ${response.status}: ${responseText}`,
      };
    }

    let data: CobaltResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Invalid JSON response: ${responseText.slice(0, 200)}`,
      };
    }

    if (data.status === 'error') {
      return {
        success: false,
        error: `Cobalt error: ${data.error?.code || 'unknown'}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error(`Cobalt ${instanceUrl} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { videoId, title, artist } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    console.log(`Extracting audio from YouTube video: ${videoId}`);

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Check for Cobalt configuration
    if (!COBALT_API_URL) {
      return NextResponse.json(
        {
          error: 'Cobalt instance not configured.',
          hint: 'Set COBALT_API_URL environment variable to your Railway Cobalt instance.',
        },
        { status: 503 }
      );
    }

    // Extract audio using Cobalt
    console.log(`Using Cobalt instance: ${COBALT_API_URL}`);
    const cobaltResult = await tryExtractWithCobalt(videoUrl, COBALT_API_URL, COBALT_API_KEY);

    if (!cobaltResult.success || !cobaltResult.data?.url) {
      return NextResponse.json(
        {
          error: 'Failed to extract audio from Cobalt.',
          details: cobaltResult.error || 'No audio URL returned',
          hint: 'Check Cobalt logs in Railway for more details.',
        },
        { status: 503 }
      );
    }

    const audioUrl = cobaltResult.data.url;
    const filename = cobaltResult.data.filename;
    console.log(`Downloading audio from: ${audioUrl}`);

    // Download the audio
    const audioResponse = await fetch(audioUrl, {
      signal: AbortSignal.timeout(120000), // 2 min timeout for large files
    });

    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download audio: ${audioResponse.status}` },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log(`Downloaded ${audioBuffer.length} bytes of audio`);

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Failed to download audio - empty response' },
        { status: 400 }
      );
    }

    // Generate track ID and key
    const trackId = uuidv4();
    const extension = 'mp3';
    const key = `tracks/${trackId}.${extension}`;
    const contentType = 'audio/mpeg';

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: audioBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    console.log(`Uploaded audio to R2: ${key}`);

    // Build public URL
    const publicUrl = `/api/audio/${trackId}`;

    return NextResponse.json({
      success: true,
      track: {
        id: trackId,
        name: title || filename || `YouTube Video ${videoId}`,
        artist: artist || 'Unknown Artist',
        duration: 0, // Will be detected on playback
        url: publicUrl,
        key,
        youtubeId: videoId,
        extractedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('YouTube extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract audio from YouTube' },
      { status: 500 }
    );
  }
}
