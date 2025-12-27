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

// RapidAPI YouTube MP3 configuration
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'youtube-mp36.p.rapidapi.com';

interface RapidAPIResponse {
  status: string;
  title?: string;
  link?: string;
  msg?: string;
  progress?: number;
}

async function extractWithRapidAPI(videoId: string): Promise<{ success: boolean; data?: RapidAPIResponse; error?: string }> {
  if (!RAPIDAPI_KEY) {
    return { success: false, error: 'RapidAPI key not configured' };
  }

  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/dl?id=${videoId}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
        signal: AbortSignal.timeout(60000), // 60s timeout for conversion
      }
    );

    const data: RapidAPIResponse = await response.json();
    console.log('RapidAPI response:', JSON.stringify(data));

    if (data.status === 'ok' && data.link) {
      return { success: true, data };
    }

    // Handle processing state - poll until ready
    if (data.status === 'processing') {
      console.log('Video is processing, waiting...');
      // Wait 3 seconds and retry
      await new Promise(resolve => setTimeout(resolve, 3000));
      return extractWithRapidAPI(videoId);
    }

    return {
      success: false,
      error: data.msg || `RapidAPI returned status: ${data.status}`,
    };
  } catch (error) {
    console.error('RapidAPI error:', error);
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

    // Check for RapidAPI configuration
    if (!RAPIDAPI_KEY) {
      return NextResponse.json(
        {
          error: 'YouTube extraction not configured.',
          hint: 'Set RAPIDAPI_KEY environment variable.',
        },
        { status: 503 }
      );
    }

    // Extract audio using RapidAPI
    const result = await extractWithRapidAPI(videoId);

    if (!result.success || !result.data?.link) {
      return NextResponse.json(
        {
          error: 'Failed to extract audio.',
          details: result.error || 'No download link returned',
        },
        { status: 503 }
      );
    }

    const audioUrl = result.data.link;
    const videoTitle = result.data.title || title;
    console.log(`Downloading audio from: ${audioUrl}`);

    // Download the audio
    const audioResponse = await fetch(audioUrl, {
      signal: AbortSignal.timeout(120000), // 2 min timeout for large files
      redirect: 'follow',
    });

    console.log(`Audio response status: ${audioResponse.status}`);

    if (!audioResponse.ok) {
      const errorBody = await audioResponse.text();
      console.error(`Audio download failed: ${errorBody}`);
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
        name: videoTitle || `YouTube Video ${videoId}`,
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
