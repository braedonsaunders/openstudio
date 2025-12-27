import { NextRequest, NextResponse } from 'next/server';

// This endpoint provides audio stream URL for a YouTube video
// Uses Piped API (privacy-friendly YouTube frontend) for extraction

interface PipedStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  bitrate: number;
  audioTrackId?: string;
  audioTrackName?: string;
  audioTrackType?: string;
  audioTrackLocale?: string;
  videoOnly?: boolean;
}

interface PipedResponse {
  title: string;
  uploader: string;
  duration: number;
  audioStreams?: PipedStream[];
  error?: string;
  message?: string;
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
    // Piped instances - these provide YouTube data without authentication
    // List from: https://github.com/TeamPiped/Piped/wiki/Instances
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.adminforge.de',
      'https://api.piped.yt',
      'https://pipedapi.darkness.services',
      'https://pipedapi.drgns.space',
    ];

    let audioUrl: string | null = null;
    let videoInfo: { title: string; author: string; duration: number } | null = null;
    let lastError: string | null = null;

    for (const instance of pipedInstances) {
      try {
        const response = await fetch(`${instance}/streams/${videoId}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'OpenStudio/1.0',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const data: PipedResponse = await response.json();

          if (data.error || data.message) {
            lastError = data.error || data.message || 'Unknown error';
            continue;
          }

          // Find the best audio stream
          const audioStreams = data.audioStreams || [];

          if (audioStreams.length === 0) {
            lastError = 'No audio streams available';
            continue;
          }

          // Sort by bitrate (highest first) and prefer opus/mp4a codecs
          const sortedStreams = audioStreams.sort((a, b) => {
            // Prefer higher bitrate
            return (b.bitrate || 0) - (a.bitrate || 0);
          });

          const bestAudio = sortedStreams[0];

          if (bestAudio?.url) {
            audioUrl = bestAudio.url;
            videoInfo = {
              title: data.title,
              author: data.uploader,
              duration: data.duration,
            };
            break;
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData.message || `HTTP ${response.status}`;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Request failed';
        continue;
      }
    }

    if (!audioUrl) {
      // Provide user-friendly error messages
      if (lastError?.includes('Video unavailable') || lastError?.includes('private')) {
        return NextResponse.json(
          { error: 'This video is unavailable or private' },
          { status: 404 }
        );
      }
      if (lastError?.includes('age') || lastError?.includes('Sign in')) {
        return NextResponse.json(
          { error: 'This video is age-restricted' },
          { status: 403 }
        );
      }
      if (lastError?.includes('region') || lastError?.includes('country')) {
        return NextResponse.json(
          { error: 'This video is not available in your region' },
          { status: 403 }
        );
      }

      console.error('YouTube audio extraction failed:', lastError);
      return NextResponse.json(
        { error: 'Could not extract audio. Try a different video.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      audioUrl,
      videoId,
      title: videoInfo?.title || 'Unknown Title',
      author: videoInfo?.author || 'Unknown Artist',
      duration: videoInfo?.duration,
    });
  } catch (error) {
    console.error('YouTube audio extraction error:', error);
    return NextResponse.json(
      { error: 'Could not extract audio. Try a different video.' },
      { status: 500 }
    );
  }
}
