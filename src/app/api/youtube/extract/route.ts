import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

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

// Download audio using yt-dlp
async function downloadWithYtDlp(videoUrl: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-x', // Extract audio
      '--audio-format', 'mp3',
      '--audio-quality', '0', // Best quality
      '-o', outputPath,
      '--no-playlist',
      '--no-warnings',
      videoUrl,
    ];

    console.log(`Running yt-dlp with args:`, args.join(' '));

    const proc = spawn('yt-dlp', args);

    let stderr = '';

    proc.stdout.on('data', (data) => {
      console.log(`yt-dlp stdout: ${data}`);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`yt-dlp stderr: ${data}`);
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to start yt-dlp: ${error.message}. Make sure yt-dlp is installed.`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

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

    // Create temp directory for download
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-audio-'));
    const tempFilePath = path.join(tempDir, `${videoId}.mp3`);

    // Download with yt-dlp
    try {
      await downloadWithYtDlp(videoUrl, tempFilePath);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('yt-dlp failed:', errorMessage);
      return NextResponse.json(
        { error: `Failed to extract audio: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Read the downloaded file
    let audioBuffer: Buffer;
    try {
      audioBuffer = await fs.readFile(tempFilePath);
      console.log(`Downloaded ${audioBuffer.length} bytes of audio`);
    } catch {
      return NextResponse.json(
        { error: 'Failed to read downloaded audio file' },
        { status: 400 }
      );
    }

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Failed to download audio - empty file' },
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
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
