import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

// This endpoint provides audio stream URL for a YouTube video
// Uses ytdl-core for reliable extraction

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

    // Get video info using ytdl-core
    const info = await ytdl.getInfo(videoUrl);

    // Find the best audio format
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

    if (audioFormats.length === 0) {
      return NextResponse.json(
        { error: 'No audio formats available for this video' },
        { status: 404 }
      );
    }

    // Sort by audio quality (bitrate) and pick the best one
    const bestAudio = audioFormats.sort((a, b) => {
      const bitrateA = a.audioBitrate || 0;
      const bitrateB = b.audioBitrate || 0;
      return bitrateB - bitrateA;
    })[0];

    if (!bestAudio.url) {
      return NextResponse.json(
        { error: 'Could not extract audio URL' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      audioUrl: bestAudio.url,
      videoId,
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      duration: parseInt(info.videoDetails.lengthSeconds, 10),
    });
  } catch (error) {
    console.error('YouTube audio extraction error:', error);

    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Video unavailable') || errorMessage.includes('private')) {
      return NextResponse.json(
        { error: 'This video is unavailable or private' },
        { status: 404 }
      );
    }

    if (errorMessage.includes('age-restricted')) {
      return NextResponse.json(
        { error: 'This video is age-restricted' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Could not extract audio. Try a different video.' },
      { status: 500 }
    );
  }
}
