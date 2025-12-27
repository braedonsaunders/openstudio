import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
  channelTitle: string;
  publishedAt: string;
}

export interface YouTubeChannelPlaylistsResponse {
  playlists: YouTubePlaylist[];
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults: number;
  channelTitle?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const { searchParams } = new URL(request.url);
  const maxResults = searchParams.get('maxResults') || '12';
  const pageToken = searchParams.get('pageToken');

  if (!channelId) {
    return NextResponse.json(
      { error: 'Channel ID is required' },
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
    // Get playlists from the channel
    const playlistsUrl = new URL(`${YOUTUBE_API_BASE}/playlists`);
    playlistsUrl.searchParams.set('part', 'snippet,contentDetails');
    playlistsUrl.searchParams.set('channelId', channelId);
    playlistsUrl.searchParams.set('maxResults', maxResults);
    playlistsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    if (pageToken) {
      playlistsUrl.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(playlistsUrl.toString());
    if (!response.ok) {
      throw new Error('YouTube API playlists fetch failed');
    }

    const data = await response.json();

    const playlists: YouTubePlaylist[] = data.items.map((item: {
      id: string;
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        thumbnails: { medium?: { url: string }; default?: { url: string }; high?: { url: string } };
        publishedAt: string;
      };
      contentDetails: { itemCount: number };
    }) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      itemCount: item.contentDetails.itemCount,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

    const result: YouTubeChannelPlaylistsResponse = {
      playlists,
      nextPageToken: data.nextPageToken,
      prevPageToken: data.prevPageToken,
      totalResults: data.pageInfo?.totalResults || playlists.length,
      channelTitle: playlists[0]?.channelTitle,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('YouTube channel playlists error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel playlists' },
      { status: 500 }
    );
  }
}
