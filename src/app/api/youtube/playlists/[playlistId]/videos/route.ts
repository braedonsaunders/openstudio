import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubePlaylistVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
  publishedAt: string;
  position: number;
}

export interface YouTubePlaylistVideosResponse {
  videos: YouTubePlaylistVideo[];
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults: number;
  playlistTitle?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const { playlistId } = await params;
  const { searchParams } = new URL(request.url);
  const maxResults = searchParams.get('maxResults') || '12';
  const pageToken = searchParams.get('pageToken');

  if (!playlistId) {
    return NextResponse.json(
      { error: 'Playlist ID is required' },
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
    // Get playlist items
    const itemsUrl = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
    itemsUrl.searchParams.set('part', 'snippet,contentDetails');
    itemsUrl.searchParams.set('playlistId', playlistId);
    itemsUrl.searchParams.set('maxResults', maxResults);
    itemsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    if (pageToken) {
      itemsUrl.searchParams.set('pageToken', pageToken);
    }

    const itemsResponse = await fetch(itemsUrl.toString());
    if (!itemsResponse.ok) {
      throw new Error('YouTube API playlist items fetch failed');
    }

    const itemsData = await itemsResponse.json();

    // Filter out deleted/private videos and get video IDs
    const validItems = itemsData.items.filter((item: {
      snippet: { title: string };
    }) => item.snippet.title !== 'Deleted video' && item.snippet.title !== 'Private video');

    const videoIds = validItems
      .map((item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId)
      .join(',');

    if (!videoIds) {
      return NextResponse.json({
        videos: [],
        totalResults: 0,
      });
    }

    // Get video details including duration
    const detailsUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
    detailsUrl.searchParams.set('part', 'contentDetails,snippet');
    detailsUrl.searchParams.set('id', videoIds);
    detailsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const detailsResponse = await fetch(detailsUrl.toString());
    if (!detailsResponse.ok) {
      throw new Error('YouTube API video details failed');
    }

    const detailsData = await detailsResponse.json();

    // Create a map for quick lookup
    const videoDetailsMap = new Map(
      detailsData.items.map((item: {
        id: string;
        contentDetails: { duration: string };
      }) => [item.id, item])
    );

    // Build video list with positions preserved
    const videos: YouTubePlaylistVideo[] = validItems.map((item: {
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { medium?: { url: string }; default?: { url: string } };
        publishedAt: string;
        position: number;
      };
      contentDetails: { videoId: string };
    }) => {
      const videoId = item.contentDetails.videoId;
      const details = videoDetailsMap.get(videoId) as {
        contentDetails: { duration: string };
      } | undefined;

      return {
        id: videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        duration: details ? parseDuration(details.contentDetails.duration) : undefined,
        publishedAt: item.snippet.publishedAt,
        position: item.snippet.position,
      };
    }).filter((video: YouTubePlaylistVideo) => video.id); // Filter out any undefined

    // Get playlist title
    let playlistTitle: string | undefined;
    try {
      const playlistUrl = new URL(`${YOUTUBE_API_BASE}/playlists`);
      playlistUrl.searchParams.set('part', 'snippet');
      playlistUrl.searchParams.set('id', playlistId);
      playlistUrl.searchParams.set('key', YOUTUBE_API_KEY);

      const playlistResponse = await fetch(playlistUrl.toString());
      if (playlistResponse.ok) {
        const playlistData = await playlistResponse.json();
        playlistTitle = playlistData.items?.[0]?.snippet?.title;
      }
    } catch {
      // Ignore errors getting playlist title
    }

    const response: YouTubePlaylistVideosResponse = {
      videos,
      nextPageToken: itemsData.nextPageToken,
      prevPageToken: itemsData.prevPageToken,
      totalResults: itemsData.pageInfo?.totalResults || videos.length,
      playlistTitle,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('YouTube playlist videos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlist videos' },
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
