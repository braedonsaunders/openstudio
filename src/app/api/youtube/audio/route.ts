import { NextRequest, NextResponse } from 'next/server';

// This endpoint provides audio stream URL for a YouTube video
// Uses Cobalt API for reliable extraction (handles bot detection)

interface CobaltResponse {
  status: 'tunnel' | 'redirect' | 'picker' | 'error';
  url?: string;
  audio?: string;
  picker?: Array<{ url: string; type: string }>;
  error?: { code: string };
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
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Use Cobalt API for extraction - it handles YouTube's bot detection
    // Cobalt is open source: https://github.com/imputnet/cobalt
    const cobaltInstances = [
      'https://api.cobalt.tools',
      'https://cobalt-api.kwiatekmiki.com',
      'https://cobalt.api.timelessnesses.me',
    ];

    let audioUrl: string | null = null;
    let lastError: string | null = null;

    for (const instance of cobaltInstances) {
      try {
        const response = await fetch(`${instance}/`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: videoUrl,
            downloadMode: 'audio',
            audioFormat: 'mp3',
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data: CobaltResponse = await response.json();

          if (data.status === 'tunnel' || data.status === 'redirect') {
            audioUrl = data.url || null;
            if (audioUrl) break;
          } else if (data.status === 'picker' && data.picker?.[0]?.url) {
            audioUrl = data.picker[0].url;
            break;
          } else if (data.status === 'error') {
            lastError = data.error?.code || 'Unknown error';
          }
        }
      } catch {
        // Try next instance
        continue;
      }
    }

    if (!audioUrl) {
      // Provide more specific error if available
      if (lastError === 'content.video.unavailable') {
        return NextResponse.json(
          { error: 'This video is unavailable or private' },
          { status: 404 }
        );
      }
      if (lastError === 'content.video.age') {
        return NextResponse.json(
          { error: 'This video is age-restricted' },
          { status: 403 }
        );
      }
      if (lastError === 'content.video.region') {
        return NextResponse.json(
          { error: 'This video is not available in your region' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Could not extract audio. Try a different video.' },
        { status: 404 }
      );
    }

    // Get video metadata from YouTube oEmbed API (doesn't require authentication)
    let title = 'Unknown Title';
    let author = 'Unknown Artist';

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || title;
        author = oembed.author_name || author;
      }
    } catch {
      // Metadata fetch failed, use defaults
    }

    return NextResponse.json({
      audioUrl,
      videoId,
      title,
      author,
    });
  } catch (error) {
    console.error('YouTube audio extraction error:', error);
    return NextResponse.json(
      { error: 'Could not extract audio. Try a different video.' },
      { status: 500 }
    );
  }
}
