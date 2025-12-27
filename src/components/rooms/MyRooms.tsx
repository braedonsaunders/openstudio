'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  History,
  FolderOpen,
  RefreshCw,
  Music,
  Calendar,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoomCard } from './RoomCard';
import { useAuthStore } from '@/stores/auth-store';
import { getUserRooms, deleteRoom } from '@/lib/rooms/service';
import type { RoomListItem } from '@/types';

interface MyRoomsProps {
  onCreateRoom: () => void;
}

export function MyRooms({ onCreateRoom }: MyRoomsProps) {
  const { user, profile } = useAuthStore();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [recentRooms, setRecentRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-rooms' | 'recent'>('my-rooms');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchRooms = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const userRooms = await getUserRooms(user.id);
      setRooms(userRooms);

      // Get recent rooms from localStorage
      const storedRecent = localStorage.getItem('openstudio-recent-rooms');
      if (storedRecent) {
        try {
          setRecentRooms(JSON.parse(storedRecent));
        } catch {
          // Invalid data, clear it
          localStorage.removeItem('openstudio-recent-rooms');
        }
      }
    } catch (error) {
      console.error('Failed to fetch user rooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [user]);

  const handleDeleteRoom = async (roomId: string) => {
    if (deleteConfirmId !== roomId) {
      setDeleteConfirmId(roomId);
      return;
    }

    try {
      await deleteRoom(roomId);
      setRooms(rooms.filter((r) => r.id !== roomId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  };

  const clearRecentRooms = () => {
    localStorage.removeItem('openstudio-recent-rooms');
    setRecentRooms([]);
  };

  const currentRooms = activeTab === 'my-rooms' ? rooms : recentRooms;

  if (!user) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <Music className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          Sign in to see your rooms
        </h3>
        <p className="text-slate-500 dark:text-gray-400 max-w-md mx-auto">
          Create an account or sign in to access your rooms and session history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {profile ? `${profile.displayName}'s Rooms` : 'My Rooms'}
          </h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            Manage your jam sessions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchRooms}
            disabled={isLoading}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={onCreateRoom}>
            <Plus className="w-4 h-4" />
            Create Room
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('my-rooms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'my-rooms'
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
              : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          My Rooms
          {rooms.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-xs">
              {rooms.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === 'recent'
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
              : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <History className="w-4 h-4" />
          Recent
          {recentRooms.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-400 dark:bg-gray-600 text-white text-xs">
              {recentRooms.length}
            </span>
          )}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-slate-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && currentRooms.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            {activeTab === 'my-rooms' ? (
              <FolderOpen className="w-8 h-8 text-slate-400" />
            ) : (
              <Calendar className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {activeTab === 'my-rooms' ? 'No rooms yet' : 'No recent sessions'}
          </h3>
          <p className="text-slate-500 dark:text-gray-400 max-w-md mx-auto mb-6">
            {activeTab === 'my-rooms'
              ? 'Create your first room to start jamming with others.'
              : 'Rooms you visit will appear here for quick access.'}
          </p>
          {activeTab === 'my-rooms' && (
            <Button onClick={onCreateRoom}>
              <Plus className="w-4 h-4" />
              Create Your First Room
            </Button>
          )}
        </motion.div>
      )}

      {/* Rooms grid */}
      <AnimatePresence mode="wait">
        {!isLoading && currentRooms.length > 0 && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Clear recent button */}
            {activeTab === 'recent' && recentRooms.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentRooms}
                  className="text-slate-500 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear History
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isOwner={activeTab === 'my-rooms'}
                  onDelete={activeTab === 'my-rooms' ? handleDeleteRoom : undefined}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation toast */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg"
          >
            <span className="text-sm font-medium">Delete this room?</span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDeleteRoom(deleteConfirmId)}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteConfirmId(null)}
              className="text-white dark:text-slate-900 hover:bg-white/20 dark:hover:bg-slate-900/20"
            >
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
