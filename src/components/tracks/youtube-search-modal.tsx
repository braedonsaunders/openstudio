'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import {
  Search,
  Youtube,
  Play,
  Plus,
  Loader2,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react';

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
  publishedAt?: string;
}

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
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [suggestions, setSuggestions] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'suggestions'>('search');

  // Load suggestions when modal opens with a current track
  useEffect(() => {
    if (isOpen && currentTrackId) {
      loadSuggestions();
    }
  }, [isOpen, currentTrackId]);

  const loadSuggestions = useCallback(async () => {
    if (!currentTrackId) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/youtube/related?videoId=${currentTrackId}&maxResults=8`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch {
      // Silently fail for suggestions
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentTrackId]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=10`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);

      if (data.results?.length === 0) {
        setError('No results found. Try different keywords.');
      }
    } catch (err) {
      setError((err as Error).message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add from YouTube"
      description="Search for backing tracks on YouTube"
      className="max-w-2xl"
    >
      <div className={cn('space-y-4', className)}>
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
            {/* Search input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search for backing tracks..."
                  className="h-11"
                />
              </div>
              <Button
                onClick={handleSearch}
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

            {/* Results */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 mx-auto text-indigo-500 animate-spin mb-3" />
                  <p className="text-slate-500">Searching YouTube...</p>
                </div>
              ) : results.length > 0 ? (
                results.map((video) => renderVideoCard(video))
              ) : error ? (
                <div className="py-12 text-center">
                  <p className="text-slate-500">{error}</p>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Youtube className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">
                    Search for backing tracks, instrumentals, or karaoke versions
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Try &quot;Hotel California backing track&quot; or &quot;Blues in A minor jam track&quot;
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
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
        )}
      </div>
    </Modal>
  );
}
