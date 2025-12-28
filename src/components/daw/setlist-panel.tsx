'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useSongsStore } from '@/stores/songs-store';
import {
  Music2,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  GripVertical,
  Play,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { Song } from '@/types/songs';

interface SetlistPanelProps {
  roomId: string;
  userId: string;
  userName?: string;
  onPlaySong?: (songId: string) => void;
}

export function SetlistPanel({
  roomId,
  userId,
  userName,
  onPlaySong,
}: SetlistPanelProps) {
  const {
    getSongsByRoom,
    getCurrentSong,
    selectSong,
    createSong,
    updateSong,
    deleteSong,
    reorderSongs,
  } = useSongsStore();

  const songs = getSongsByRoom(roomId);
  const currentSong = getCurrentSong();

  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingBpmSongId, setEditingBpmSongId] = useState<string | null>(null);
  const [editingBpm, setEditingBpm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Calculate total setlist duration
  const totalDuration = songs.reduce((acc, song) => acc + (song.duration || 0), 0);

  // Start editing a song name
  const handleStartEdit = useCallback((song: Song) => {
    setEditingSongId(song.id);
    setEditingName(song.name);
  }, []);

  // Save edited song name
  const handleSaveEdit = useCallback(async () => {
    if (!editingSongId || !editingName.trim()) return;

    updateSong(editingSongId, { name: editingName.trim() });

    // Persist to database
    try {
      await fetch(`/api/rooms/${roomId}/songs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: editingSongId, name: editingName.trim() }),
      });
    } catch (err) {
      console.error('Failed to update song:', err);
    }

    setEditingSongId(null);
    setEditingName('');
  }, [editingSongId, editingName, roomId, updateSong]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingSongId(null);
    setEditingName('');
  }, []);

  // Start editing BPM
  const handleStartBpmEdit = useCallback((song: Song) => {
    setEditingBpmSongId(song.id);
    setEditingBpm(song.bpm.toString());
  }, []);

  // Save edited BPM
  const handleSaveBpm = useCallback(async () => {
    if (!editingBpmSongId) return;

    const bpmValue = parseInt(editingBpm, 10);
    if (isNaN(bpmValue) || bpmValue < 40 || bpmValue > 240) {
      // Invalid BPM, cancel edit
      setEditingBpmSongId(null);
      setEditingBpm('');
      return;
    }

    updateSong(editingBpmSongId, { bpm: bpmValue });

    // Persist to database
    try {
      await fetch(`/api/rooms/${roomId}/songs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: editingBpmSongId, bpm: bpmValue }),
      });
    } catch (err) {
      console.error('Failed to update song BPM:', err);
    }

    setEditingBpmSongId(null);
    setEditingBpm('');
  }, [editingBpmSongId, editingBpm, roomId, updateSong]);

  // Cancel BPM editing
  const handleCancelBpmEdit = useCallback(() => {
    setEditingBpmSongId(null);
    setEditingBpm('');
  }, []);

  // Create new song
  const handleCreateSong = useCallback(async () => {
    if (!newSongName.trim()) return;

    setIsCreating(true);
    const song = createSong(roomId, newSongName.trim(), userId, userName);

    try {
      await fetch(`/api/rooms/${roomId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song),
      });
    } catch (err) {
      console.error('Failed to create song:', err);
    }

    setNewSongName('');
    setIsCreating(false);
  }, [newSongName, roomId, userId, userName, createSong]);

  // Delete song
  const handleDeleteSong = useCallback(async (songId: string) => {
    if (!confirm('Delete this song? This cannot be undone.')) return;

    deleteSong(songId);

    try {
      await fetch(`/api/rooms/${roomId}/songs?songId=${songId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete song:', err);
    }
  }, [roomId, deleteSong]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, songId: string) => {
    setDraggedSongId(songId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedSongId) return;

    const draggedIndex = songs.findIndex(s => s.id === draggedSongId);
    if (draggedIndex === -1 || draggedIndex === targetIndex) {
      setDraggedSongId(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder songs
    const newOrder = [...songs];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    const songIds = newOrder.map(s => s.id);
    reorderSongs(roomId, songIds);

    // Persist new order
    try {
      await Promise.all(
        songIds.map((id, idx) =>
          fetch(`/api/rooms/${roomId}/songs`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId: id, position: idx }),
          })
        )
      );
    } catch (err) {
      console.error('Failed to reorder songs:', err);
    }

    setDraggedSongId(null);
    setDragOverIndex(null);
  }, [draggedSongId, songs, roomId, reorderSongs]);

  const handleDragEnd = useCallback(() => {
    setDraggedSongId(null);
    setDragOverIndex(null);
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Setlist</h3>
          </div>
          <span className="text-xs text-gray-500 dark:text-zinc-500">
            {songs.length} song{songs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto py-2">
        {songs.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Music2 className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-500">No songs yet</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
                Create your first song below
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {songs.map((song, index) => (
              <div
                key={song.id}
                draggable
                onDragStart={(e) => handleDragStart(e, song.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group relative mx-2 px-2 py-2 rounded-lg transition-all cursor-pointer',
                  currentSong?.id === song.id
                    ? 'bg-indigo-500/10 border border-indigo-500/30'
                    : 'hover:bg-gray-100 dark:hover:bg-white/5 border border-transparent',
                  draggedSongId === song.id && 'opacity-50',
                  dragOverIndex === index && 'border-t-2 border-t-indigo-500'
                )}
                onClick={() => selectSong(song.id)}
              >
                <div className="flex items-center gap-2">
                  {/* Drag Handle */}
                  <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-700 cursor-grab opacity-0 group-hover:opacity-100 shrink-0" />

                  {/* Song Color Indicator */}
                  <div
                    className="w-2 h-8 rounded-sm shrink-0"
                    style={{ backgroundColor: song.color }}
                  />

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    {editingSongId === song.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="flex-1 px-1.5 py-0.5 text-xs bg-white dark:bg-[#0d0d14] border border-gray-300 dark:border-white/20 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit();
                          }}
                          className="p-0.5 text-green-500 hover:text-green-400"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="p-0.5 text-red-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                            {song.name}
                          </span>
                          {currentSong?.id === song.id && (
                            <ChevronRight className="w-3 h-3 text-indigo-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500 dark:text-zinc-500">
                            {song.tracks.length} track{song.tracks.length !== 1 ? 's' : ''}
                          </span>
                          {editingBpmSongId === song.id ? (
                            <span
                              className="inline-flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                min={40}
                                max={240}
                                value={editingBpm}
                                onChange={(e) => setEditingBpm(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveBpm();
                                  if (e.key === 'Escape') handleCancelBpmEdit();
                                }}
                                className="w-10 px-1 py-0 text-[10px] bg-white dark:bg-[#0d0d14] border border-gray-300 dark:border-white/20 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                autoFocus
                              />
                              <span className="text-[10px] text-gray-400 dark:text-zinc-600">BPM</span>
                              <button
                                onClick={handleSaveBpm}
                                className="p-0.5 text-green-500 hover:text-green-400"
                              >
                                <Check className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={handleCancelBpmEdit}
                                className="p-0.5 text-red-500 hover:text-red-400"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartBpmEdit(song);
                              }}
                              className="text-[10px] text-gray-400 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                              title="Click to edit BPM"
                            >
                              {song.bpm} BPM
                            </button>
                          )}
                          {song.duration > 0 && (
                            <span className="text-[10px] text-gray-400 dark:text-zinc-600 tabular-nums">
                              {formatDuration(song.duration)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {editingSongId !== song.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onPlaySong && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectSong(song.id);
                            onPlaySong(song.id);
                          }}
                          className="p-1 text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded"
                          title="Play song"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(song);
                        }}
                        className="p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSong(song.id);
                        }}
                        className="p-1 text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create New Song */}
      <div className="px-3 py-3 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d0d14] shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSongName}
            onChange={(e) => setNewSongName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSong()}
            placeholder="New song name..."
            className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#12121a] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={isCreating}
          />
          <button
            onClick={handleCreateSong}
            disabled={!newSongName.trim() || isCreating}
            className="p-1.5 rounded-lg bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
            title="Create song"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[10px] text-gray-400 dark:text-zinc-600 shrink-0">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Total: {formatDuration(totalDuration)}</span>
        </div>
        <span>
          {songs.reduce((acc, s) => acc + s.tracks.length, 0)} total tracks
        </span>
      </div>
    </div>
  );
}
