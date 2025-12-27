import { NextRequest, NextResponse } from 'next/server';

// This endpoint is deprecated - YouTube playback now uses the IFrame API directly
// Keeping this for backwards compatibility and metadata lookup

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
    // Get video metadata from YouTube oEmbed API (doesn't require authentication)
    let title = 'Unknown Title';
    let author = 'Unknown Artist';

    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      title = oembed.title || title;
      author = oembed.author_name || author;
    }

    // Return info indicating this should use the IFrame player
    return NextResponse.json({
      videoId,
      title,
      author,
      useIframePlayer: true,
      message: 'YouTube playback uses IFrame API. This endpoint provides metadata only.',
    });
  } catch (error) {
    console.error('YouTube metadata fetch error:', error);
    return NextResponse.json(
      { error: 'Could not fetch video metadata' },
      { status: 500 }
    );
  }
}
