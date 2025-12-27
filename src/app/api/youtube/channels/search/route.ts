import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: string;
  videoCount?: string;
  customUrl?: string;
}

export interface YouTubeChannelSearchResponse {
  channels: YouTubeChannel[];
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const maxResults = searchParams.get('maxResults') || '10';
  const pageToken = searchParams.get('pageToken');

  if (!query) {
    return NextResponse.json(
      { error: 'Search query is required' },
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
    // Search for channels
    const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('type', 'channel');
    searchUrl.searchParams.set('maxResults', maxResults);
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);

    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchResponse = await fetch(searchUrl.toString());
    if (!searchResponse.ok) {
      throw new Error('YouTube API channel search failed');
    }

    const searchData = await searchResponse.json();
    const channelIds = searchData.items
      .map((item: { id: { channelId: string } }) => item.id.channelId)
      .join(',');

    if (!channelIds) {
      return NextResponse.json({
        channels: [],
        totalResults: 0,
      });
    }

    // Get channel details including statistics
    const detailsUrl = new URL(`${YOUTUBE_API_BASE}/channels`);
    detailsUrl.searchParams.set('part', 'snippet,statistics');
    detailsUrl.searchParams.set('id', channelIds);
    detailsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    if (!detailsResponse.ok) {
      throw new Error('YouTube API channel details failed');
    }

    const detailsData = await detailsResponse.json();

    const channels: YouTubeChannel[] = detailsData.items.map((item: {
      id: string;
      snippet: {
        title: string;
        description: string;
        customUrl?: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
      };
      statistics: {
        subscriberCount?: string;
        videoCount?: string;
      };
    }) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      subscriberCount: formatCount(item.statistics.subscriberCount),
      videoCount: formatCount(item.statistics.videoCount),
      customUrl: item.snippet.customUrl,
    }));

    const response: YouTubeChannelSearchResponse = {
      channels,
      nextPageToken: searchData.nextPageToken,
      prevPageToken: searchData.prevPageToken,
      totalResults: searchData.pageInfo?.totalResults || channels.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('YouTube channel search error:', error);
    return NextResponse.json(
      { error: 'Failed to search YouTube channels' },
      { status: 500 }
    );
  }
}

function formatCount(count?: string): string | undefined {
  if (!count) return undefined;
  const num = parseInt(count);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return count;
}
