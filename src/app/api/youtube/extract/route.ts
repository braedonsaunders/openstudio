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

// Cobalt API for YouTube extraction (open-source, reliable)
const COBALT_API = 'https://api.cobalt.tools';

interface CobaltResponse {
  status: 'stream' | 'redirect' | 'picker' | 'error';
  url?: string;
  audio?: string;
  picker?: Array<{ type: string; url: string }>;
  text?: string;
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

    // Use Cobalt API to get audio URL
    let cobaltResponse: CobaltResponse;
    try {
      const response = await fetch(COBALT_API, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoUrl,
          audioFormat: 'mp3',
          isAudioOnly: true,
          aFormat: 'mp3',
          filenameStyle: 'basic',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cobalt API error:', response.status, errorText);
        throw new Error(`Cobalt API returned ${response.status}`);
      }

      cobaltResponse = await response.json();
      console.log('Cobalt response:', cobaltResponse);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to call Cobalt API:', errorMessage);
      return NextResponse.json(
        { error: `Failed to extract audio: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Handle different response types
    let audioUrl: string | null = null;

    if (cobaltResponse.status === 'error') {
      return NextResponse.json(
        { error: cobaltResponse.text || 'Cobalt API error' },
        { status: 400 }
      );
    }

    if (cobaltResponse.status === 'stream' || cobaltResponse.status === 'redirect') {
      audioUrl = cobaltResponse.url || cobaltResponse.audio || null;
    } else if (cobaltResponse.status === 'picker' && cobaltResponse.picker) {
      // Find audio in picker results
      const audioItem = cobaltResponse.picker.find(item => item.type === 'audio');
      audioUrl = audioItem?.url || cobaltResponse.picker[0]?.url || null;
    }

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'No audio URL returned from Cobalt' },
        { status: 400 }
      );
    }

    console.log(`Downloading audio from: ${audioUrl}`);

    // Download the audio
    const audioResponse = await fetch(audioUrl);
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
        name: title || `YouTube Video ${videoId}`,
        artist: artist || 'Unknown Artist',
        duration: 0, // Cobalt doesn't provide duration, will be detected on playback
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
