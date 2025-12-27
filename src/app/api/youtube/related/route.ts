import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeRelatedResult {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
}

export interface YouTubeRelatedResponse {
  suggestions: YouTubeRelatedResult[];
  nextPageToken?: string;
  totalResults: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const maxResults = searchParams.get('maxResults') || '5';
  const pageToken = searchParams.get('pageToken');

  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId is required' },
      { status: 400 }
    );
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: 'YouTube API not configured' },
      { status: 503 }
    );
  }

  try {
    // First get the current video details to understand the content
    const videoUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    videoUrl.searchParams.set('part', 'snippet');
    videoUrl.searchParams.set('id', videoId);
    videoUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const videoResponse = await fetch(videoUrl.toString());
    const videoData = await videoResponse.json();

    if (!videoData.items?.[0]) {
      return NextResponse.json({ suggestions: [] });
    }

    const currentVideo = videoData.items[0];
    const title = currentVideo.snippet.title;

    // Extract key terms for search (remove common words)
    const searchTerms = title
      .replace(/\(.*?\)/g, '') // Remove parentheses content
      .replace(/\[.*?\]/g, '') // Remove brackets content
      .replace(/official|video|audio|lyric|lyrics|hd|4k|backing track|instrumental|karaoke/gi, '')
      .trim();

    // Search for related backing tracks
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', `${searchTerms} backing track instrumental`);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('videoCategoryId', '10'); // Music category
    searchUrl.searchParams.set('maxResults', String(parseInt(maxResults) + 1)); // Get one extra to filter out current
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

    // Add page token for pagination if provided
    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      throw new Error('YouTube API search failed');
    }

    const searchData = await searchResponse.json();

    // Filter out the current video
    const filteredItems = searchData.items.filter(
      (item: { id: { videoId: string } }) => item.id.videoId !== videoId
    ).slice(0, parseInt(maxResults));

    const videoIds = filteredItems.map((item: { id: { videoId: string } }) => item.id.videoId).join(',');

    if (!videoIds) {
      return NextResponse.json({ suggestions: [] });
    }

    // Get video details including duration
    const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    detailsUrl.searchParams.set('part', 'contentDetails,snippet');
    detailsUrl.searchParams.set('id', videoIds);
    detailsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    const suggestions: YouTubeRelatedResult[] = detailsData.items.map((item: {
      id: string;
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
      contentDetails: { duration: string };
    }) => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      duration: parseDuration(item.contentDetails.duration),
    }));

    const response: YouTubeRelatedResponse = {
      suggestions,
      nextPageToken: searchData.nextPageToken,
      totalResults: searchData.pageInfo?.totalResults || suggestions.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('YouTube related error:', error);
    return NextResponse.json(
      { error: 'Failed to get related videos' },
      { status: 500 }
    );
  }
}

function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
