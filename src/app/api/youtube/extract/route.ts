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

// Custom Cobalt instance URL (self-hosted) - set this env var for your own instance
const CUSTOM_COBALT_URL = process.env.COBALT_API_URL;
const COBALT_API_KEY = process.env.COBALT_API_KEY;

// Fallback public instances (may require auth or be unavailable)
const COBALT_INSTANCES = [
  'https://downloadapi.stuff.solutions',  // eu-gb instance
  'https://cobalt-backend.canine.tools',
];

interface CobaltResponse {
  status: 'tunnel' | 'redirect' | 'picker' | 'stream' | 'error';
  url?: string;
  filename?: string;
  error?: { code: string };
}

async function tryExtractWithCobalt(videoUrl: string, instanceUrl: string, apiKey?: string): Promise<CobaltResponse | null> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Api-Key ${apiKey}`;
    }

    const response = await fetch(instanceUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: videoUrl,
        downloadMode: 'audio',
        audioFormat: 'mp3',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cobalt ${instanceUrl} error:`, response.status, errorText);

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        console.warn(`Cobalt ${instanceUrl} requires authentication`);
        return null;
      }

      return null;
    }

    const data: CobaltResponse = await response.json();

    if (data.status === 'error') {
      console.error(`Cobalt ${instanceUrl} returned error:`, data.error?.code);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Cobalt ${instanceUrl} failed:`, error);
    return null;
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

    // Try to extract audio using Cobalt
    let cobaltResponse: CobaltResponse | null = null;

    // First try custom instance if configured
    if (CUSTOM_COBALT_URL) {
      console.log(`Trying custom Cobalt instance: ${CUSTOM_COBALT_URL}`);
      cobaltResponse = await tryExtractWithCobalt(videoUrl, CUSTOM_COBALT_URL, COBALT_API_KEY);
    }

    // Try fallback instances
    if (!cobaltResponse) {
      for (const instance of COBALT_INSTANCES) {
        console.log(`Trying Cobalt instance: ${instance}`);
        cobaltResponse = await tryExtractWithCobalt(videoUrl, instance);
        if (cobaltResponse) break;
      }
    }

    if (!cobaltResponse || !cobaltResponse.url) {
      return NextResponse.json(
        {
          error: 'Failed to extract audio. All Cobalt instances unavailable or require authentication.',
          hint: 'Set COBALT_API_URL and COBALT_API_KEY environment variables for a self-hosted instance.',
        },
        { status: 503 }
      );
    }

    console.log(`Downloading audio from: ${cobaltResponse.url}`);

    // Download the audio
    const audioResponse = await fetch(cobaltResponse.url, {
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
        name: title || cobaltResponse.filename || `YouTube Video ${videoId}`,
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
