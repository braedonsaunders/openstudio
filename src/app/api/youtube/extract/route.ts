import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import ytdl from '@distube/ytdl-core';

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

    // Get video info
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    let info;
    try {
      info = await ytdl.getInfo(videoUrl);
    } catch (error) {
      console.error('Failed to get video info:', error);
      return NextResponse.json(
        { error: 'Failed to get video info. Video may be unavailable or age-restricted.' },
        { status: 400 }
      );
    }

    // Get the best audio format
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    if (audioFormats.length === 0) {
      return NextResponse.json(
        { error: 'No audio formats available for this video' },
        { status: 400 }
      );
    }

    // Prefer high quality audio
    const audioFormat = audioFormats.reduce((best, format) => {
      const bestBitrate = best.audioBitrate || 0;
      const formatBitrate = format.audioBitrate || 0;
      return formatBitrate > bestBitrate ? format : best;
    }, audioFormats[0]);

    console.log(`Selected audio format: ${audioFormat.mimeType}, bitrate: ${audioFormat.audioBitrate}`);

    // Download the audio stream
    const audioStream = ytdl(videoUrl, { format: audioFormat });

    // Collect the audio data
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    console.log(`Downloaded ${audioBuffer.length} bytes of audio`);

    // Generate track ID and key
    const trackId = uuidv4();
    const extension = audioFormat.container || 'webm';
    const key = `tracks/${trackId}.${extension}`;

    // Determine content type
    let contentType = 'audio/webm';
    if (audioFormat.mimeType) {
      contentType = audioFormat.mimeType.split(';')[0];
    }

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
    const duration = parseInt(info.videoDetails.lengthSeconds, 10) || 0;

    return NextResponse.json({
      success: true,
      track: {
        id: trackId,
        name: title || info.videoDetails.title,
        artist: artist || info.videoDetails.author.name,
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
      { error: 'Failed to extract audio from YouTube' },
      { status: 500 }
    );
  }
}
