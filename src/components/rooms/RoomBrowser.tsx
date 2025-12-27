'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Radio,
  Grid3X3,
  List,
  RefreshCw,
  Globe,
  Users,
  Music,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoomCard } from './RoomCard';
import { getPublicRooms, ROOM_GENRES } from '@/lib/rooms/service';
import type { RoomListItem } from '@/types';

interface RoomBrowserProps {
  onJoinRoom?: (roomId: string) => void;
}

export function RoomBrowser({ onJoinRoom }: RoomBrowserProps) {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'active' | 'name'>('recent');

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const publicRooms = await getPublicRooms();
      setRooms(publicRooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    // Refresh every 30 seconds to get latest activity
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredRooms = useMemo(() => {
    let result = [...rooms];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (room) =>
          room.name.toLowerCase().includes(query) ||
          room.description?.toLowerCase().includes(query) ||
          room.genre?.toLowerCase().includes(query) ||
          room.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Filter by genre
    if (selectedGenre) {
      result = result.filter((room) => room.genre === selectedGenre);
    }

    // Sort
    switch (sortBy) {
      case 'active':
        result.sort((a, b) => (b.activeUsers || 0) - (a.activeUsers || 0));
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [rooms, searchQuery, selectedGenre, sortBy]);

  const liveRooms = filteredRooms.filter((room) => room.activeUsers && room.activeUsers > 0);
  const emptyRooms = filteredRooms.filter((room) => !room.activeUsers || room.activeUsers === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Browse Rooms</h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Find a session to join or start your own
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchRooms}
            disabled={isLoading}
            className="shrink-0"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="flex items-center rounded-lg bg-slate-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms, genres, or tags..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'active' | 'name')}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="recent">Most Recent</option>
            <option value="active">Most Active</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                <Music className="inline-block w-4 h-4 mr-1" />
                Genre
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGenre('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    !selectedGenre
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-600'
                  }`}
                >
                  All Genres
                </button>
                {ROOM_GENRES.map((genre) => (
                  <button
                    key={genre.value}
                    onClick={() => setSelectedGenre(genre.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedGenre === genre.value
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white dark:bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {genre.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
          <Globe className="w-4 h-4" />
          <span>{filteredRooms.length} rooms found</span>
        </div>
        {liveRooms.length > 0 && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>{liveRooms.length} live now</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-600 dark:text-gray-400">
          <Users className="w-4 h-4" />
          <span>{filteredRooms.reduce((sum, r) => sum + (r.activeUsers || 0), 0)} musicians online</span>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && rooms.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-slate-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredRooms.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No rooms found
          </h3>
          <p className="text-slate-500 dark:text-gray-400 max-w-md mx-auto">
            {searchQuery || selectedGenre
              ? "Try adjusting your search or filters to find more rooms."
              : "Be the first to create a room and start jamming!"}
          </p>
        </div>
      )}

      {/* Live rooms section */}
      {liveRooms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-green-500 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Live Sessions</h3>
            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
              {liveRooms.length}
            </span>
          </div>
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          }>
            {liveRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                variant={viewMode === 'list' ? 'compact' : 'default'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other rooms */}
      {emptyRooms.length > 0 && (
        <div className="space-y-4">
          {liveRooms.length > 0 && (
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Available Rooms
            </h3>
          )}
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
          }>
            {emptyRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                variant={viewMode === 'list' ? 'compact' : 'default'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
