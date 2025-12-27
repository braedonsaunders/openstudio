import { NextRequest, NextResponse } from 'next/server';

// List of Piped API instances to try (fallback if one is down)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.r4fo.com',
];

interface PipedStream {
  url: string;
  format: string;
  quality: string;
  mimeType: string;
  codec: string;
  bitrate: number;
  contentLength: number;
}

interface PipedResponse {
  title: string;
  uploader: string;
  uploaderUrl: string;
  duration: number;
  audioStreams: PipedStream[];
  thumbnailUrl: string;
}

// Get audio stream URL from Piped API
async function getAudioStreamFromPiped(videoId: string): Promise<{
  audioUrl: string;
  title: string;
  author: string;
  duration: number;
  thumbnailUrl: string;
} | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) continue;

      const data: PipedResponse = await response.json();

      if (!data.audioStreams || data.audioStreams.length === 0) {
        continue;
      }

      // Find the best audio stream (prefer opus/webm, then m4a)
      const sortedStreams = data.audioStreams.sort((a, b) => {
        // Prefer opus codec
        if (a.codec?.includes('opus') && !b.codec?.includes('opus')) return -1;
        if (!a.codec?.includes('opus') && b.codec?.includes('opus')) return 1;
        // Then by bitrate
        return (b.bitrate || 0) - (a.bitrate || 0);
      });

      const bestStream = sortedStreams[0];

      return {
        audioUrl: bestStream.url,
        title: data.title || 'Unknown Title',
        author: data.uploader || 'Unknown Artist',
        duration: data.duration || 0,
        thumbnailUrl: data.thumbnailUrl || '',
      };
    } catch (error) {
      console.warn(`Piped instance ${instance} failed:`, error);
      continue;
    }
  }

  return null;
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
    // Try to get audio stream from Piped API
    const streamData = await getAudioStreamFromPiped(videoId);

    if (streamData) {
      return NextResponse.json({
        videoId,
        title: streamData.title,
        author: streamData.author,
        duration: streamData.duration,
        thumbnailUrl: streamData.thumbnailUrl,
        audioUrl: streamData.audioUrl,
        useAudioElement: true,
      });
    }

    // Fallback: Get metadata only from oEmbed
    let title = 'Unknown Title';
    let author = 'Unknown Artist';

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || title;
        author = oembed.author_name || author;
      }
    } catch {
      // Ignore oEmbed errors
    }

    // Return error - no audio stream available
    return NextResponse.json({
      videoId,
      title,
      author,
      useAudioElement: false,
      error: 'Could not extract audio stream. Try using the download feature instead.',
    });
  } catch (error) {
    console.error('YouTube audio fetch error:', error);
    return NextResponse.json(
      { error: 'Could not fetch video data' },
      { status: 500 }
    );
  }
}
