'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import {
  Search,
  Youtube,
  Plus,
  Loader2,
  User,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  Video,
  ListVideo,
  Users,
  Play,
} from 'lucide-react';

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
  publishedAt?: string;
  viewCount?: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: string;
  videoCount?: string;
}

interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
  channelTitle: string;
}

type SearchType = 'videos' | 'channels';
type ViewMode = 'search' | 'channel' | 'playlist';
type ChannelTab = 'videos' | 'playlists';

interface YouTubeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (video: YouTubeVideo) => Promise<void>;
  currentTrackId?: string;
  className?: string;
}

export function YouTubeSearchModal({
  isOpen,
  onClose,
  onSelectTrack,
  currentTrackId,
  className,
}: YouTubeSearchModalProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('videos');
  const [videoResults, setVideoResults] = useState<YouTubeVideo[]>([]);
  const [channelResults, setChannelResults] = useState<YouTubeChannel[]>([]);
  const [suggestions, setSuggestions] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingMoreSuggestions, setIsLoadingMoreSuggestions] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'suggestions'>('search');

  // View state for browsing
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylist | null>(null);
  const [channelTab, setChannelTab] = useState<ChannelTab>('videos');
  const [channelVideos, setChannelVideos] = useState<YouTubeVideo[]>([]);
  const [channelPlaylists, setChannelPlaylists] = useState<YouTubePlaylist[]>([]);
  const [playlistVideos, setPlaylistVideos] = useState<YouTubeVideo[]>([]);
  const [isLoadingChannel, setIsLoadingChannel] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

  // Pagination state
  const [searchNextPageToken, setSearchNextPageToken] = useState<string | null>(null);
  const [searchTotalResults, setSearchTotalResults] = useState(0);
  const [suggestionsNextPageToken, setSuggestionsNextPageToken] = useState<string | null>(null);
  const [suggestionsTotalResults, setSuggestionsTotalResults] = useState(0);
  const [channelVideosNextPageToken, setChannelVideosNextPageToken] = useState<string | null>(null);
  const [channelPlaylistsNextPageToken, setChannelPlaylistsNextPageToken] = useState<string | null>(null);
  const [playlistVideosNextPageToken, setPlaylistVideosNextPageToken] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Reset view when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewMode('search');
      setSelectedChannel(null);
      setSelectedPlaylist(null);
    }
  }, [isOpen]);

  // Load suggestions when modal opens with a current track
  useEffect(() => {
    if (isOpen && currentTrackId) {
      loadSuggestions();
    }
  }, [isOpen, currentTrackId]);

  const loadSuggestions = useCallback(async (pageToken?: string) => {
    if (!currentTrackId) return;

    if (pageToken) {
      setIsLoadingMoreSuggestions(true);
    } else {
      setIsLoadingSuggestions(true);
      setSuggestions([]);
    }

    try {
      const url = new URL('/api/youtube/related', window.location.origin);
      url.searchParams.set('videoId', currentTrackId);
      url.searchParams.set('maxResults', '8');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        if (pageToken) {
          setSuggestions(prev => [...prev, ...(data.suggestions || [])]);
        } else {
          setSuggestions(data.suggestions || []);
        }
        setSuggestionsNextPageToken(data.nextPageToken || null);
        setSuggestionsTotalResults(data.totalResults || 0);
      }
    } catch {
      // Silently fail for suggestions
    } finally {
      setIsLoadingSuggestions(false);
      setIsLoadingMoreSuggestions(false);
    }
  }, [currentTrackId]);

  const handleSearch = useCallback(async (pageToken?: string) => {
    if (!query.trim()) return;

    if (pageToken) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setVideoResults([]);
      setChannelResults([]);
      setLastSearchQuery(query);
    }
    setError(null);

    try {
      const endpoint = searchType === 'channels'
        ? '/api/youtube/channels/search'
        : '/api/youtube/search';

      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', '10');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();

      if (searchType === 'channels') {
        if (pageToken) {
          setChannelResults(prev => [...prev, ...(data.channels || [])]);
        } else {
          setChannelResults(data.channels || []);
        }
      } else {
        if (pageToken) {
          setVideoResults(prev => [...prev, ...(data.results || [])]);
        } else {
          setVideoResults(data.results || []);
        }
      }

      setSearchNextPageToken(data.nextPageToken || null);
      setSearchTotalResults(data.totalResults || 0);

      const results = searchType === 'channels' ? data.channels : data.results;
      if (!pageToken && results?.length === 0) {
        setError('No results found. Try different keywords.');
      }
    } catch (err) {
      setError((err as Error).message);
      if (!pageToken) {
        setVideoResults([]);
        setChannelResults([]);
      }
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, [query, searchType]);

  const handleLoadMoreResults = useCallback(() => {
    if (searchNextPageToken && !isLoadingMore) {
      handleSearch(searchNextPageToken);
    }
  }, [searchNextPageToken, isLoadingMore, handleSearch]);

  const handleLoadMoreSuggestions = useCallback(() => {
    if (suggestionsNextPageToken && !isLoadingMoreSuggestions) {
      loadSuggestions(suggestionsNextPageToken);
    }
  }, [suggestionsNextPageToken, isLoadingMoreSuggestions, loadSuggestions]);

  const loadChannelContent = useCallback(async (channelId: string, type: 'videos' | 'playlists', pageToken?: string) => {
    if (!pageToken) {
      setIsLoadingChannel(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const endpoint = type === 'playlists'
        ? `/api/youtube/channels/${channelId}/playlists`
        : `/api/youtube/channels/${channelId}/videos`;

      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('maxResults', '12');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to load channel content');
      }

      const data = await response.json();

      if (type === 'playlists') {
        if (pageToken) {
          setChannelPlaylists(prev => [...prev, ...(data.playlists || [])]);
        } else {
          setChannelPlaylists(data.playlists || []);
        }
        setChannelPlaylistsNextPageToken(data.nextPageToken || null);
      } else {
        if (pageToken) {
          setChannelVideos(prev => [...prev, ...(data.videos || [])]);
        } else {
          setChannelVideos(data.videos || []);
        }
        setChannelVideosNextPageToken(data.nextPageToken || null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoadingChannel(false);
      setIsLoadingMore(false);
    }
  }, []);

  const loadPlaylistVideos = useCallback(async (playlistId: string, pageToken?: string) => {
    if (!pageToken) {
      setIsLoadingPlaylist(true);
      setPlaylistVideos([]);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const url = new URL(`/api/youtube/playlists/${playlistId}/videos`, window.location.origin);
      url.searchParams.set('maxResults', '12');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to load playlist videos');
      }

      const data = await response.json();

      if (pageToken) {
        setPlaylistVideos(prev => [...prev, ...(data.videos || [])]);
      } else {
        setPlaylistVideos(data.videos || []);
      }
      setPlaylistVideosNextPageToken(data.nextPageToken || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoadingPlaylist(false);
      setIsLoadingMore(false);
    }
  }, []);

  const handleChannelClick = useCallback((channel: YouTubeChannel) => {
    setSelectedChannel(channel);
    setViewMode('channel');
    setChannelTab('videos');
    setChannelVideos([]);
    setChannelPlaylists([]);
    loadChannelContent(channel.id, 'videos');
  }, [loadChannelContent]);

  const handlePlaylistClick = useCallback((playlist: YouTubePlaylist) => {
    setSelectedPlaylist(playlist);
    setViewMode('playlist');
    loadPlaylistVideos(playlist.id);
  }, [loadPlaylistVideos]);

  const handleBack = useCallback(() => {
    if (viewMode === 'playlist' && selectedChannel) {
      // Go back to channel view
      setViewMode('channel');
      setSelectedPlaylist(null);
    } else {
      // Go back to search
      setViewMode('search');
      setSelectedChannel(null);
      setSelectedPlaylist(null);
    }
  }, [viewMode, selectedChannel]);

  const handleChannelTabChange = useCallback((tab: ChannelTab) => {
    if (!selectedChannel) return;
    setChannelTab(tab);
    if (tab === 'playlists' && channelPlaylists.length === 0) {
      loadChannelContent(selectedChannel.id, 'playlists');
    } else if (tab === 'videos' && channelVideos.length === 0) {
      loadChannelContent(selectedChannel.id, 'videos');
    }
  }, [selectedChannel, channelPlaylists.length, channelVideos.length, loadChannelContent]);

  const handleAddTrack = useCallback(async (video: YouTubeVideo) => {
    setAddingId(video.id);
    try {
      await onSelectTrack(video);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingId(null);
    }
  }, [onSelectTrack]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const renderVideoCard = (video: YouTubeVideo, showAddButton = true) => (
    <div
      key={video.id}
      className="flex gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-28 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-200">
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        )}
        {video.duration && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-xs text-white font-medium">
            {video.duration}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-900 text-sm line-clamp-2 leading-snug">
          {video.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
          <User className="w-3 h-3" />
          <span className="truncate">{video.channelTitle}</span>
        </div>
        {video.viewCount && (
          <div className="text-xs text-slate-400 mt-0.5">
            {video.viewCount}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5 shrink-0">
        {showAddButton && (
          <Button
            size="sm"
            onClick={() => handleAddTrack(video)}
            disabled={addingId === video.id}
            className="h-8"
          >
            {addingId === video.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add
              </>
            )}
          </Button>
        )}
        <a
          href={`https://youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );

  const renderChannelCard = (channel: YouTubeChannel) => (
    <div
      key={channel.id}
      onClick={() => handleChannelClick(channel)}
      className="flex gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
    >
      {/* Avatar */}
      <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-slate-200">
        {channel.thumbnail && (
          <img
            src={channel.thumbnail}
            alt={channel.title}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-900 text-sm line-clamp-1">
          {channel.title}
        </h4>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          {channel.subscriberCount && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {channel.subscriberCount}
            </span>
          )}
          {channel.videoCount && (
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3" />
              {channel.videoCount} videos
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
          {channel.description}
        </p>
      </div>

      {/* Arrow */}
      <div className="flex items-center text-slate-400">
        <ChevronDown className="w-4 h-4 -rotate-90" />
      </div>
    </div>
  );

  const renderPlaylistCard = (playlist: YouTubePlaylist) => (
    <div
      key={playlist.id}
      onClick={() => handlePlaylistClick(playlist)}
      className="flex gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative w-28 h-20 shrink-0 rounded-lg overflow-hidden bg-slate-200">
        {playlist.thumbnail && (
          <img
            src={playlist.thumbnail}
            alt={playlist.title}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="text-white text-center">
            <ListVideo className="w-5 h-5 mx-auto" />
            <span className="text-xs font-medium">{playlist.itemCount}</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-900 text-sm line-clamp-2 leading-snug">
          {playlist.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
          <Play className="w-3 h-3" />
          <span>{playlist.itemCount} videos</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center text-slate-400">
        <ChevronDown className="w-4 h-4 -rotate-90" />
      </div>
    </div>
  );

  const renderSearchView = () => (
    <>
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('search')}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'search'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Search
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={cn(
            'flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'suggestions'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          <Youtube className="w-4 h-4 inline mr-2" />
          Suggested
          {suggestions.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs">
              {suggestions.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <>
          {/* Search Type Toggle */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => {
                setSearchType('videos');
                setVideoResults([]);
                setChannelResults([]);
              }}
              className={cn(
                'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
                searchType === 'videos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Video className="w-4 h-4" />
              Videos
            </button>
            <button
              onClick={() => {
                setSearchType('channels');
                setVideoResults([]);
                setChannelResults([]);
              }}
              className={cn(
                'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
                searchType === 'channels'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Users className="w-4 h-4" />
              Channels
            </button>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchType === 'channels' ? 'Search for channels...' : 'Search for backing tracks...'}
                className="h-11"
              />
            </div>
            <Button
              onClick={() => handleSearch()}
              disabled={!query.trim() || isSearching}
              className="h-11 px-5"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Results header with count */}
          {((searchType === 'videos' && videoResults.length > 0) ||
            (searchType === 'channels' && channelResults.length > 0)) && !isSearching && (
            <div className="flex items-center justify-between text-sm text-slate-500 px-1">
              <span>
                Showing {searchType === 'videos' ? videoResults.length : channelResults.length} of {searchTotalResults.toLocaleString()} results
                {lastSearchQuery && <span className="text-slate-400"> for &quot;{lastSearchQuery}&quot;</span>}
              </span>
            </div>
          )}

          {/* Results */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
                <p className="text-slate-500">Searching YouTube...</p>
              </div>
            ) : searchType === 'videos' && videoResults.length > 0 ? (
              <>
                {videoResults.map((video) => renderVideoCard(video))}
                {searchNextPageToken && (
                  <div className="pt-3 pb-1">
                    <Button
                      variant="outline"
                      onClick={handleLoadMoreResults}
                      disabled={isLoadingMore}
                      className="w-full"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading more...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Load more results
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {!searchNextPageToken && videoResults.length > 0 && (
                  <p className="text-center text-sm text-slate-400 py-3">
                    End of results
                  </p>
                )}
              </>
            ) : searchType === 'channels' && channelResults.length > 0 ? (
              <>
                {channelResults.map((channel) => renderChannelCard(channel))}
                {searchNextPageToken && (
                  <div className="pt-3 pb-1">
                    <Button
                      variant="outline"
                      onClick={handleLoadMoreResults}
                      disabled={isLoadingMore}
                      className="w-full"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading more...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Load more results
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {!searchNextPageToken && channelResults.length > 0 && (
                  <p className="text-center text-sm text-slate-400 py-3">
                    End of results
                  </p>
                )}
              </>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="text-slate-500">{error}</p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Youtube className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">
                  {searchType === 'channels'
                    ? 'Search for YouTube channels to browse their content'
                    : 'Search for backing tracks, instrumentals, or karaoke versions'
                  }
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {searchType === 'channels'
                    ? 'Try searching for music channels like "Drumless Backing Tracks"'
                    : 'Try "Hotel California backing track" or "Blues in A minor jam track"'
                  }
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <>
          {/* Suggestions header with count */}
          {suggestions.length > 0 && !isLoadingSuggestions && (
            <div className="flex items-center justify-between text-sm text-slate-500 px-1">
              <span>
                Showing {suggestions.length} of {suggestionsTotalResults.toLocaleString()} suggestions
              </span>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isLoadingSuggestions ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
                <p className="text-slate-500">Loading suggestions...</p>
              </div>
            ) : suggestions.length > 0 ? (
              <>
                <p className="text-sm text-slate-500 mb-3">
                  Based on your current track, you might also like:
                </p>
                {suggestions.map((video) => renderVideoCard(video))}

                {/* Load More Button */}
                {suggestionsNextPageToken && (
                  <div className="pt-3 pb-1">
                    <Button
                      variant="outline"
                      onClick={handleLoadMoreSuggestions}
                      disabled={isLoadingMoreSuggestions}
                      className="w-full"
                    >
                      {isLoadingMoreSuggestions ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading more...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Load more suggestions
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* End of suggestions indicator */}
                {!suggestionsNextPageToken && suggestions.length > 0 && (
                  <p className="text-center text-sm text-slate-400 py-3">
                    End of suggestions
                  </p>
                )}
              </>
            ) : (
              <div className="py-12 text-center">
                <Youtube className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">
                  {currentTrackId
                    ? 'No suggestions available for this track'
                    : 'Play a track to get suggestions'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );

  const renderChannelView = () => (
    <>
      {/* Header with back button */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        {selectedChannel && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
              {selectedChannel.thumbnail && (
                <img
                  src={selectedChannel.thumbnail}
                  alt={selectedChannel.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 truncate">{selectedChannel.title}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {selectedChannel.subscriberCount && (
                  <span>{selectedChannel.subscriberCount} subscribers</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Channel Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => handleChannelTabChange('videos')}
          className={cn(
            'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
            channelTab === 'videos'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Video className="w-4 h-4" />
          Videos
        </button>
        <button
          onClick={() => handleChannelTabChange('playlists')}
          className={cn(
            'flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
            channelTab === 'playlists'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <ListVideo className="w-4 h-4" />
          Playlists
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {isLoadingChannel ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
            <p className="text-slate-500">Loading {channelTab}...</p>
          </div>
        ) : channelTab === 'videos' ? (
          channelVideos.length > 0 ? (
            <>
              {channelVideos.map((video) => renderVideoCard(video))}
              {channelVideosNextPageToken && (
                <div className="pt-3 pb-1">
                  <Button
                    variant="outline"
                    onClick={() => selectedChannel && loadChannelContent(selectedChannel.id, 'videos', channelVideosNextPageToken)}
                    disabled={isLoadingMore}
                    className="w-full"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Load more videos
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <Video className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No videos found</p>
            </div>
          )
        ) : (
          channelPlaylists.length > 0 ? (
            <>
              {channelPlaylists.map((playlist) => renderPlaylistCard(playlist))}
              {channelPlaylistsNextPageToken && (
                <div className="pt-3 pb-1">
                  <Button
                    variant="outline"
                    onClick={() => selectedChannel && loadChannelContent(selectedChannel.id, 'playlists', channelPlaylistsNextPageToken)}
                    disabled={isLoadingMore}
                    className="w-full"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Load more playlists
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <ListVideo className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No playlists found</p>
            </div>
          )
        )}
      </div>
    </>
  );

  const renderPlaylistView = () => (
    <>
      {/* Header with back button */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        {selectedPlaylist && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-200 shrink-0">
              {selectedPlaylist.thumbnail && (
                <img
                  src={selectedPlaylist.thumbnail}
                  alt={selectedPlaylist.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 truncate">{selectedPlaylist.title}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{selectedPlaylist.itemCount} videos</span>
                <span>•</span>
                <span>{selectedPlaylist.channelTitle}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Playlist Videos */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {isLoadingPlaylist ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
            <p className="text-slate-500">Loading playlist videos...</p>
          </div>
        ) : playlistVideos.length > 0 ? (
          <>
            {playlistVideos.map((video) => renderVideoCard(video))}
            {playlistVideosNextPageToken && (
              <div className="pt-3 pb-1">
                <Button
                  variant="outline"
                  onClick={() => selectedPlaylist && loadPlaylistVideos(selectedPlaylist.id, playlistVideosNextPageToken)}
                  disabled={isLoadingMore}
                  className="w-full"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading more...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Load more videos
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center">
            <Video className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No videos in this playlist</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add from YouTube"
      description={
        viewMode === 'search'
          ? 'Search for videos or browse channels'
          : viewMode === 'channel'
          ? 'Browse channel content'
          : 'Browse playlist videos'
      }
      className="max-w-2xl"
    >
      <div className={cn('space-y-4', className)}>
        {viewMode === 'search' && renderSearchView()}
        {viewMode === 'channel' && renderChannelView()}
        {viewMode === 'playlist' && renderPlaylistView()}
      </div>
    </Modal>
  );
}
