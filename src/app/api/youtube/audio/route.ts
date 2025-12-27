import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

interface YtDlpInfo {
  url?: string;
  title?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
}

// Get audio URL using yt-dlp (no download, just extract URL)
async function getAudioUrlWithYtDlp(videoId: string): Promise<YtDlpInfo | null> {
  return new Promise((resolve) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const args = [
      '-f', 'bestaudio',
      '-g', // Get URL only
      '--no-playlist',
      '--no-warnings',
      '-j', // Output JSON info
      videoUrl,
    ];

    const proc = spawn('yt-dlp', args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      console.error(`yt-dlp spawn error: ${error.message}`);
      resolve(null);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`yt-dlp failed with code ${code}: ${stderr}`);
        resolve(null);
        return;
      }

      try {
        // yt-dlp with -g and -j outputs URL first, then JSON on separate lines
        const lines = stdout.trim().split('\n');
        let audioUrl = '';
        let info: YtDlpInfo = {};

        for (const line of lines) {
          if (line.startsWith('http')) {
            audioUrl = line;
          } else if (line.startsWith('{')) {
            try {
              info = JSON.parse(line);
            } catch {
              // Not JSON, skip
            }
          }
        }

        if (!audioUrl && info.url) {
          audioUrl = info.url;
        }

        if (audioUrl) {
          resolve({
            url: audioUrl,
            title: info.title,
            uploader: info.uploader,
            duration: info.duration,
            thumbnail: info.thumbnail,
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });
  });
}

// Alternative: just get info without URL (for metadata only)
async function getVideoInfo(videoId: string): Promise<YtDlpInfo | null> {
  return new Promise((resolve) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const args = [
      '--no-download',
      '--no-playlist',
      '--no-warnings',
      '-j',
      videoUrl,
    ];

    const proc = spawn('yt-dlp', args);

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('error', () => {
      resolve(null);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      try {
        const info = JSON.parse(stdout.trim());
        resolve({
          title: info.title,
          uploader: info.uploader || info.channel,
          duration: info.duration,
          thumbnail: info.thumbnail,
        });
      } catch {
        resolve(null);
      }
    });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId is required' },
      { status: 400 }
    );
  }

  try {
    // Try to get audio URL from yt-dlp
    const streamData = await getAudioUrlWithYtDlp(videoId);

    if (streamData && streamData.url) {
      return NextResponse.json({
        videoId,
        title: streamData.title || 'Unknown Title',
        author: streamData.uploader || 'Unknown Artist',
        duration: streamData.duration || 0,
        thumbnailUrl: streamData.thumbnail || '',
        audioUrl: streamData.url,
        useAudioElement: true,
      });
    }

    // Fallback: Get metadata only
    const info = await getVideoInfo(videoId);

    if (info) {
      return NextResponse.json({
        videoId,
        title: info.title || 'Unknown Title',
        author: info.uploader || 'Unknown Artist',
        duration: info.duration || 0,
        thumbnailUrl: info.thumbnail || '',
        useAudioElement: false,
        error: 'Could not extract audio stream URL',
      });
    }

    return NextResponse.json(
      { error: 'Could not fetch video data. Make sure yt-dlp is installed.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('YouTube audio fetch error:', error);
    return NextResponse.json(
      { error: 'Could not fetch video data' },
      { status: 500 }
    );
  }
}
