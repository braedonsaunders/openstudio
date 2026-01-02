'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import {
  Loader2,
  Music,
  Calendar,
  ExternalLink,
  Trash2,
  BookmarkX,
  Sparkles,
  Crown,
} from 'lucide-react';

interface SavedRoom {
  id: string;
  roomId: string;
  notes: string | null;
  savedAt: string;
  room: {
    id: string;
    name: string;
    description: string | null;
    genre: string | null;
    color: string;
    icon: string;
    createdAt: string;
    lastActivity: string | null;
    trackCount: number;
  };
}

interface SavedRoomsResponse {
  rooms: SavedRoom[];
  count: number;
  limit: number;
  tier: string;
  isUnlimited: boolean;
}

// Room icon colors
const ROOM_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-500',
  lime: 'bg-lime-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-500',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function SavedRoomsTab() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<SavedRoomsResponse | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSavedRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/user/saved-rooms');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError('Failed to load saved rooms');
      }
    } catch (err) {
      console.error('Error loading saved rooms:', err);
      setError('Failed to load saved rooms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedRooms();
  }, [loadSavedRooms]);

  const handleRemove = async (roomId: string) => {
    setRemovingId(roomId);
    try {
      const response = await authFetch(`/api/user/saved-rooms?roomId=${roomId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the list
        await loadSavedRooms();
      } else {
        setError('Failed to remove room');
      }
    } catch (err) {
      console.error('Error removing room:', err);
      setError('Failed to remove room');
    } finally {
      setRemovingId(null);
    }
  };

  const handleOpen = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadSavedRooms}>Try Again</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Saved Rooms</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Rooms you&apos;ve saved for quick access
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            {data.tier === 'admin' || data.tier === 'Admin' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 rounded-full">
                <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Unlimited
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{data.count}</span>
                <span className="mx-1">/</span>
                <span>{data.isUnlimited ? '∞' : data.limit}</span>
                <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                  {data.tier}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {data?.rooms.length === 0 ? (
        <div className="text-center py-12">
          <BookmarkX className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No saved rooms yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            When you create a room, you can save it to quickly return later with all your tracks and settings intact.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.rooms.map((savedRoom) => (
            <div
              key={savedRoom.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Room Icon */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    ROOM_COLORS[savedRoom.room.color] || 'bg-indigo-500'
                  }`}
                >
                  <Music className="w-6 h-6 text-white" />
                </div>

                {/* Room Info */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {savedRoom.room.name}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Music className="w-3.5 h-3.5" />
                      {savedRoom.room.trackCount} {savedRoom.room.trackCount === 1 ? 'track' : 'tracks'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {savedRoom.room.lastActivity
                        ? formatRelativeTime(savedRoom.room.lastActivity)
                        : formatRelativeTime(savedRoom.room.createdAt)}
                    </span>
                    {savedRoom.room.genre && (
                      <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">
                        {savedRoom.room.genre}
                      </span>
                    )}
                  </div>
                  {savedRoom.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                      {savedRoom.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(savedRoom.roomId)}
                  disabled={removingId === savedRoom.roomId}
                  className="text-gray-400 hover:text-red-500"
                  title="Remove from saved"
                >
                  {removingId === savedRoom.roomId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpen(savedRoom.roomId)}
                  className="gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade prompt for non-unlimited users */}
      {data && !data.isUnlimited && data.count >= data.limit && (
        <div className="mt-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                Need more saved rooms?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upgrade to Pro for up to 10 saved rooms
              </p>
            </div>
            <Button variant="secondary" size="sm">
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Info section */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          About Saved Rooms
        </h3>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <p>• Saved rooms preserve all your tracks, settings, and configurations</p>
          <p>• Rooms you don&apos;t save will eventually be cleaned up to save resources</p>
          <p>• Only rooms you created can be saved</p>
          <p>• Opening a saved room reactivates it with all your previous setup</p>
        </div>
      </div>
    </Card>
  );
}
