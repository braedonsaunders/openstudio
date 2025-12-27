import { NextRequest, NextResponse } from 'next/server';

// This endpoint provides audio stream URL for a YouTube video
// In production, you would use a service like youtube-dl, yt-dlp, or a third-party API
// For now, we'll use a proxy approach with a public extraction service

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
    // Option 1: Use Invidious API (privacy-respecting YouTube frontend)
    // These are public instances - in production you'd host your own or use a paid service
    const invidiousInstances = [
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://yt.artemislena.eu',
    ];

    let audioUrl: string | null = null;
    let videoInfo: { title: string; author: string; lengthSeconds: number } | null = null;

    for (const instance of invidiousInstances) {
      try {
        const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();

          // Find the best audio format
          const audioFormats = data.adaptiveFormats?.filter(
            (f: { type: string }) => f.type?.startsWith('audio/')
          ) || [];

          // Prefer higher quality audio
          const bestAudio = audioFormats.sort(
            (a: { bitrate: number }, b: { bitrate: number }) => (b.bitrate || 0) - (a.bitrate || 0)
          )[0];

          if (bestAudio?.url) {
            audioUrl = bestAudio.url;
            videoInfo = {
              title: data.title,
              author: data.author,
              lengthSeconds: data.lengthSeconds,
            };
            break;
          }
        }
      } catch {
        // Try next instance
        continue;
      }
    }

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Could not extract audio. Try a different video.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      audioUrl,
      videoId,
      title: videoInfo?.title,
      author: videoInfo?.author,
      duration: videoInfo?.lengthSeconds,
    });
  } catch (error) {
    console.error('YouTube audio extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract audio' },
      { status: 500 }
    );
  }
}
