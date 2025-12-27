import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import play from 'play-dl';

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

    // Get video info using play-dl
    let info;
    try {
      info = await play.video_info(videoUrl);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to get video info:', errorMessage);

      // YouTube is blocking automated access - provide helpful error
      return NextResponse.json(
        {
          error: 'YouTube is blocking automated access. This is a known issue affecting all YouTube download tools. Please upload an audio file directly instead.',
          details: errorMessage
        },
        { status: 400 }
      );
    }

    // Get audio stream
    let audioStream;
    try {
      audioStream = await play.stream(videoUrl, { quality: 2 }); // quality 2 = highest audio
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to get audio stream:', errorMessage);
      return NextResponse.json(
        {
          error: 'Failed to get audio stream from YouTube. Please upload an audio file directly.',
          details: errorMessage
        },
        { status: 400 }
      );
    }

    console.log(`Audio stream type: ${audioStream.type}`);

    // Collect the audio data
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log(`Downloaded ${audioBuffer.length} bytes of audio`);

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Failed to download audio - empty response. Please upload an audio file directly.' },
        { status: 400 }
      );
    }

    // Generate track ID and key
    const trackId = uuidv4();
    // play-dl streams as opus in webm container
    const extension = 'webm';
    const key = `tracks/${trackId}.${extension}`;
    const contentType = 'audio/webm';

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

    // Get duration from video info
    const duration = info.video_details.durationInSec || 0;

    return NextResponse.json({
      success: true,
      track: {
        id: trackId,
        name: title || info.video_details.title,
        artist: artist || info.video_details.channel?.name || 'Unknown Artist',
        duration,
        url: publicUrl,
        key,
        youtubeId: videoId,
        extractedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('YouTube extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract audio from YouTube. Please upload an audio file directly.' },
      { status: 500 }
    );
  }
}
