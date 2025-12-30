'use client';

import { useState, useCallback, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useSongsStore } from '@/stores/songs-store';
import { useCustomLoopsStore } from '@/stores/custom-loops-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
import { LoopBrowserModal } from '../loops/loop-browser-modal';
import { LoopCreatorModal } from '../loops/loop-creator-modal';
import { getLoopById } from '@/lib/audio/loop-library';
import {
  Upload,
  Youtube,
  Sparkles,
  X,
  Music,
  Repeat,
  Plus,
  ChevronDown,
  Layers,
  GripVertical,
  Pencil,
  Copy,
  Trash2,
} from 'lucide-react';
import type { BackingTrack } from '@/types';
import type { LoopDefinition } from '@/types/loops';

interface TracksPanelProps {
  onTrackSelect: (track: BackingTrack) => void;
  onTrackRemove: (trackId: string) => void;
  onUpload: () => void;
  onAIGenerate: () => void;
  onYouTubeSearch: () => void;
  youtubePlayer?: React.ReactNode;
  roomId: string;
  userId: string;
  userName?: string;
}

export interface TracksPanelRef {
  focusNewSongInput: () => void;
}

export const TracksPanel = forwardRef<TracksPanelRef, TracksPanelProps>(function TracksPanel({
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onAIGenerate,
  onYouTubeSearch,
  youtubePlayer,
  roomId,
  userId,
  userName,
}, ref) {
  const { queue, isMaster } = useRoomStore();
  const { getTracksByRoom, addTrack: addLoopTrack, removeTrack: removeLoopTrack, updateTrack: updateLoopTrack } = useLoopTracksStore();
  const sessionTempo = useSessionTempoStore((s) => s.tempo);
  const {
    getSongsByRoom,
    getCurrentSong,
    selectSong,
    createSong,
    addTrackToSong,
    loadSongs,
    isLoading: songsLoading,
  } = useSongsStore();
  const { duplicateLoop, getLoop: getCustomLoop } = useCustomLoopsStore();

  const [showLoopBrowser, setShowLoopBrowser] = useState(false);
  const [showSongDropdown, setShowSongDropdown] = useState(false);
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [hasLoadedSongs, setHasLoadedSongs] = useState(false);

  // Ref for new song input
  const newSongInputRef = useRef<HTMLInputElement>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focusNewSongInput: () => {
      setShowSongDropdown(true);
      // Focus input after dropdown opens
      setTimeout(() => {
        newSongInputRef.current?.focus();
      }, 50);
    },
  }), []);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'audio' | 'loop';
    assetId: string;
    loopId?: string;
    name: string;
  } | null>(null);

  // Loop editor state
  const [loopEditorState, setLoopEditorState] = useState<{
    isOpen: boolean;
    loopId: string | null;
    loopTrackId: string | null;
  }>({
    isOpen: false,
    loopId: null,
    loopTrackId: null,
  });

  // Get data
  const songs = getSongsByRoom(roomId);
  const currentSong = getCurrentSong();
  const loopTracks = getTracksByRoom(roomId);

  // Check if the current song is a Lyria song (uses AI generative music)
  const isLyriaSong = useMemo(() => {
    return currentSong?.tracks.some(t => t.type === 'lyria') ?? false;
  }, [currentSong?.tracks]);

  // Load songs on mount
  useEffect(() => {
    if (roomId) {
      loadSongs(roomId).then(() => {
        setHasLoadedSongs(true);
      });
    }
  }, [roomId, loadSongs]);


  // Handler for creating a new song
  const handleCreateSong = useCallback(() => {
    if (!newSongName.trim()) return;
    // createSong already persists to server via createSongOnServer
    createSong(roomId, newSongName.trim(), userId, userName);
    setNewSongName('');
    setShowSongDropdown(false);
  }, [newSongName, roomId, userId, userName, createSong]);

  // Handler for adding a loop to current song
  const handleAddLoop = useCallback(
    async (loop: LoopDefinition) => {
      if (!userId || !roomId || !currentSong) return;

      // Create the loop track in the loop store
      const loopTrack = addLoopTrack(roomId, loop, userId, userName);

      // Persist loop track
      try {
        await fetch(`/api/rooms/${roomId}/loop-tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loopTrack),
        });
      } catch (err) {
        console.error('Failed to persist loop track:', err);
      }

      // Add reference to current song
      addTrackToSong(currentSong.id, {
        type: 'loop',
        trackId: loopTrack.id,
        startOffset: 0,
      });

      setShowLoopBrowser(false);
    },
    [userId, userName, roomId, currentSong, addLoopTrack, addTrackToSong]
  );

  // Context menu handlers
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    type: 'audio' | 'loop',
    assetId: string,
    name: string,
    loopId?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type,
      assetId,
      loopId,
      name,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Edit loop handler
  const handleEditLoop = useCallback(async () => {
    if (!contextMenu || contextMenu.type !== 'loop' || !contextMenu.loopId) return;

    // Check if it's a custom loop
    const existingCustomLoop = getCustomLoop(contextMenu.loopId);

    if (existingCustomLoop) {
      // It's already a custom loop - edit directly
      setLoopEditorState({
        isOpen: true,
        loopId: contextMenu.loopId,
        loopTrackId: contextMenu.assetId,
      });
    } else {
      // It's a built-in loop - duplicate it first to make it editable
      const newCustomLoop = await duplicateLoop(contextMenu.loopId);
      if (newCustomLoop) {
        // Update the loop track to use the new custom loop
        updateLoopTrack(contextMenu.assetId, {
          loopId: newCustomLoop.id,
        });
        // Open the editor with the new custom loop
        setLoopEditorState({
          isOpen: true,
          loopId: newCustomLoop.id,
          loopTrackId: contextMenu.assetId,
        });
      }
    }

    closeContextMenu();
  }, [contextMenu, getCustomLoop, duplicateLoop, updateLoopTrack, closeContextMenu]);

  // Duplicate loop handler
  const handleDuplicateLoop = useCallback(async () => {
    if (!contextMenu || contextMenu.type !== 'loop' || !contextMenu.loopId) return;

    const newCustomLoop = await duplicateLoop(contextMenu.loopId);
    if (newCustomLoop && currentSong) {
      // Create a new loop track with the duplicated loop
      const loopTrack = addLoopTrack(roomId, newCustomLoop, userId, userName);

      // Persist loop track
      try {
        await fetch(`/api/rooms/${roomId}/loop-tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loopTrack),
        });
      } catch (err) {
        console.error('Failed to persist loop track:', err);
      }

      // Add to current song
      addTrackToSong(currentSong.id, {
        type: 'loop',
        trackId: loopTrack.id,
        startOffset: 0,
      });
    }

    closeContextMenu();
  }, [contextMenu, duplicateLoop, currentSong, roomId, userId, userName, addLoopTrack, addTrackToSong, closeContextMenu]);

  // Delete asset handler - also removes all instances from timeline
  const handleDeleteAsset = useCallback(async () => {
    if (!contextMenu) return;

    const assetId = contextMenu.assetId;

    // Remove all instances from all songs in this room
    const { getSongsByRoom, removeTrackFromSong } = useSongsStore.getState();
    const roomSongs = getSongsByRoom(roomId);

    for (const song of roomSongs) {
      // Find all track references that use this asset
      const refsToRemove = song.tracks.filter((trackRef) => trackRef.trackId === assetId);
      for (const ref of refsToRemove) {
        removeTrackFromSong(song.id, ref.id);
      }
    }

    // Then remove the asset itself
    if (contextMenu.type === 'audio') {
      onTrackRemove(assetId);
    } else {
      // Remove from local store
      removeLoopTrack(assetId);
      // Persist deletion to server
      try {
        await fetch(`/api/rooms/${roomId}/loop-tracks?trackId=${assetId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete loop track:', err);
      }
    }

    closeContextMenu();
  }, [contextMenu, onTrackRemove, removeLoopTrack, closeContextMenu, roomId]);

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu?.isOpen) {
      const handleClick = () => closeContextMenu();
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu?.isOpen, closeContextMenu]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate loop duration using session tempo (loops auto-adjust unless tempo-locked)
  const getLoopDuration = (loopDef: LoopDefinition | undefined, tempoLocked = false): number => {
    if (!loopDef) return 0;
    const effectiveBpm = tempoLocked ? loopDef.bpm : sessionTempo;
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / effectiveBpm) * 60;
  };

  // Build asset list - unique source tracks (not timeline clips)
  // Audio assets from queue
  const audioAssets = queue.tracks.map((track) => ({
    type: 'audio' as const,
    id: track.id,
    name: track.name,
    duration: track.duration,
    color: '#6366f1',
    youtubeId: track.youtubeId,
    aiGenerated: track.aiGenerated,
    // Count how many times this asset appears in the current song
    clipCount: currentSong?.tracks.filter((ref) => ref.type === 'audio' && ref.trackId === track.id).length || 0,
  }));

  // Loop assets from loop tracks (duration adjusts to session tempo unless tempo-locked)
  const loopAssets = loopTracks.map((track) => {
    const loopDef = getLoopById(track.loopId);
    return {
      type: 'loop' as const,
      id: track.id,
      loopId: track.loopId,
      name: track.name || loopDef?.name || 'Loop',
      duration: getLoopDuration(loopDef, track.tempoLocked),
      color: track.color || '#f59e0b',
      muted: track.muted,
      // Count how many times this asset appears in the current song
      clipCount: currentSong?.tracks.filter((ref) => ref.type === 'loop' && ref.trackId === track.id).length || 0,
    };
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header with Song Selector */}
      <div className="h-8 px-3 flex items-center border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        {/* Song Dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowSongDropdown(!showSongDropdown)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-gray-200/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: currentSong?.color || '#6366f1' }}
              />
              <span className="text-[11px] font-medium text-gray-900 dark:text-white truncate">
                {currentSong?.name || 'No Song'}
              </span>
            </div>
            <ChevronDown className={cn(
              'w-3 h-3 text-gray-500 dark:text-zinc-400 transition-transform',
              showSongDropdown && 'rotate-180'
            )} />
          </button>

          {/* Dropdown Menu */}
          {showSongDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg z-50 overflow-hidden">
              {songs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => {
                    selectSong(song.id);
                    setShowSongDropdown(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
                    currentSong?.id === song.id && 'bg-indigo-500/10'
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: song.color }}
                  />
                  <span className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                    {song.name}
                  </span>
                  <span className="ml-auto text-[10px] text-gray-400 dark:text-zinc-600">
                    {song.tracks.length} tracks
                  </span>
                </button>
              ))}

              {/* New Song Input */}
              <div className="border-t border-gray-100 dark:border-white/5 p-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={newSongInputRef}
                    type="text"
                    value={newSongName}
                    onChange={(e) => setNewSongName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSong()}
                    placeholder="New song name..."
                    className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleCreateSong}
                    disabled={!newSongName.trim()}
                    className="p-1 rounded bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Add Track Buttons */}
      <div className={cn(
        "flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d0d14] shrink-0 transition-opacity",
        songs.length === 0 && "opacity-40 pointer-events-none"
      )}>
        <button
          onClick={onUpload}
          disabled={songs.length === 0}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-gray-200/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-zinc-400 text-[9px] font-medium transition-colors disabled:cursor-not-allowed"
          title="Upload audio"
        >
          <Upload className="w-2.5 h-2.5" />
          Upload
        </button>
        <button
          onClick={onYouTubeSearch}
          disabled={songs.length === 0}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-gray-200/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-zinc-400 text-[9px] font-medium transition-colors disabled:cursor-not-allowed"
          title="Add from YouTube"
        >
          <Youtube className="w-2.5 h-2.5" />
          YouTube
        </button>
        <button
          onClick={() => setShowLoopBrowser(true)}
          disabled={songs.length === 0}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-medium transition-colors disabled:cursor-not-allowed"
          title="Add loop"
        >
          <Repeat className="w-2.5 h-2.5" />
          Loop
        </button>
        <button
          onClick={onAIGenerate}
          disabled={songs.length === 0}
          className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors disabled:cursor-not-allowed"
          title="AI Generate"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      </div>

      {/* Asset Library */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Lyria Overlay - shown when current song uses Lyria AI music */}
        {isLyriaSong && (
          <div className="absolute inset-0 z-10 bg-gray-100/80 dark:bg-[#0a0a0f]/90 backdrop-blur-[1px] flex flex-col items-center justify-center">
            {/* Subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 dark:from-purple-500/3 via-transparent to-purple-500/5 dark:to-purple-500/3" />

            {/* Lyria indicator */}
            <div className="relative flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Lyria AI</p>
                <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">Generative music active</p>
              </div>
            </div>
          </div>
        )}

        {/* No Song Overlay - shown when no songs exist */}
        {songs.length === 0 && hasLoadedSongs && (
          <div className="absolute inset-0 z-10 bg-gray-100/90 dark:bg-[#0a0a0f]/95 backdrop-blur-[1px] flex flex-col items-center justify-center">
            <div className="relative flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200/50 dark:bg-white/5 flex items-center justify-center">
                <Music className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">No songs yet</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">Create a song to get started</p>
              </div>
              <button
                onClick={() => {
                  setShowSongDropdown(true);
                  setTimeout(() => {
                    newSongInputRef.current?.focus();
                  }, 50);
                }}
                className="mt-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Song
              </button>
            </div>
          </div>
        )}

        {audioAssets.length === 0 && loopAssets.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Layers className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">No assets</p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">Add audio or loops above</p>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {/* Audio Assets */}
            {audioAssets.length > 0 && (
              <>
                <div className="px-3 py-1 border-b border-gray-100 dark:border-white/5">
                  <span className="text-[9px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                    Audio
                  </span>
                </div>
                {audioAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-track', JSON.stringify({
                        type: 'audio',
                        trackId: asset.id,
                        name: asset.name,
                        duration: asset.duration,
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onContextMenu={(e) => handleContextMenu(e, 'audio', asset.id, asset.name)}
                  >
                    <GripVertical className="w-3 h-3 text-gray-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 shrink-0" />
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${asset.color}20`, color: asset.color }}
                    >
                      {asset.youtubeId ? <Youtube className="w-3 h-3" /> : asset.aiGenerated ? <Sparkles className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 dark:text-zinc-300 truncate">{asset.name}</div>
                    </div>
                    {asset.clipCount > 0 && (
                      <span className="text-[9px] text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        ×{asset.clipCount}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500 tabular-nums">
                      {formatTime(asset.duration)}
                    </span>
                    {isMaster && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove all song track references that use this asset first
                          const { getSongsByRoom, removeTrackFromSong } = useSongsStore.getState();
                          const roomSongs = getSongsByRoom(roomId);
                          for (const song of roomSongs) {
                            const refsToRemove = song.tracks.filter((trackRef) => trackRef.trackId === asset.id);
                            for (const ref of refsToRemove) {
                              removeTrackFromSong(song.id, ref.id);
                            }
                          }
                          // Then remove the asset
                          onTrackRemove(asset.id);
                        }}
                        className="p-0.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete asset"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Loop Assets */}
            {loopAssets.length > 0 && (
              <>
                <div className="px-3 py-1 mt-1 border-t border-b border-gray-100 dark:border-white/5">
                  <span className="text-[9px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                    Loops
                  </span>
                </div>
                {loopAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-track', JSON.stringify({
                        type: 'loop',
                        trackId: asset.id,
                        name: asset.name,
                        duration: asset.duration,
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onContextMenu={(e) => handleContextMenu(e, 'loop', asset.id, asset.name, asset.loopId)}
                  >
                    <GripVertical className="w-3 h-3 text-gray-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 shrink-0" />
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${asset.color}20` }}
                    >
                      <Repeat className="w-3 h-3" style={{ color: asset.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 dark:text-zinc-300 truncate">{asset.name}</div>
                    </div>
                    {asset.clipCount > 0 && (
                      <span className="text-[9px] text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        ×{asset.clipCount}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500 tabular-nums">
                      {formatTime(asset.duration)}
                    </span>
                    {isMaster && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          // Remove all song track references that use this asset first
                          const { getSongsByRoom, removeTrackFromSong } = useSongsStore.getState();
                          const roomSongs = getSongsByRoom(roomId);
                          for (const song of roomSongs) {
                            const refsToRemove = song.tracks.filter((trackRef) => trackRef.trackId === asset.id);
                            for (const ref of refsToRemove) {
                              removeTrackFromSong(song.id, ref.id);
                            }
                          }
                          // Remove from local store
                          removeLoopTrack(asset.id);
                          // Persist deletion to server
                          try {
                            await fetch(`/api/rooms/${roomId}/loop-tracks?trackId=${asset.id}`, {
                              method: 'DELETE',
                            });
                          } catch (err) {
                            console.error('Failed to delete loop track:', err);
                          }
                        }}
                        className="p-0.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete asset"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Song Summary */}
      {currentSong && (
        <div className="px-3 py-1.5 border-t border-gray-200 dark:border-white/5 text-[10px] text-gray-500 dark:text-zinc-500 shrink-0">
          <span>{audioAssets.length + loopAssets.length} asset{audioAssets.length + loopAssets.length !== 1 ? 's' : ''} • {currentSong.tracks.length} clip{currentSong.tracks.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* YouTube Player - Hidden but mounted */}
      {youtubePlayer && <div className="hidden">{youtubePlayer}</div>}

      {/* Loop Browser Modal */}
      <LoopBrowserModal
        isOpen={showLoopBrowser}
        onClose={() => setShowLoopBrowser(false)}
        roomId={roomId}
        userId={userId}
        userName={userName}
        onAddLoop={handleAddLoop}
      />

      {/* Context Menu */}
      {contextMenu?.isOpen && (
        <div
          className="fixed z-50 min-w-[140px] py-1 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800 truncate">
            {contextMenu.name}
          </div>

          {/* Edit Loop - only for loops */}
          {contextMenu.type === 'loop' && (
            <button
              onClick={handleEditLoop}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-amber-600 dark:text-amber-400"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Loop</span>
            </button>
          )}

          {/* Duplicate - only for loops */}
          {contextMenu.type === 'loop' && (
            <button
              onClick={handleDuplicateLoop}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Duplicate</span>
            </button>
          )}

          {isMaster && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
              <button
                onClick={handleDeleteAsset}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Loop Editor Modal */}
      <LoopCreatorModal
        isOpen={loopEditorState.isOpen}
        onClose={() => setLoopEditorState({ isOpen: false, loopId: null, loopTrackId: null })}
        editingLoopId={loopEditorState.loopId || undefined}
        onSave={(savedLoop) => {
          // Update the loop track to use the saved loop's ID
          if (loopEditorState.loopTrackId) {
            updateLoopTrack(loopEditorState.loopTrackId, {
              loopId: savedLoop.id,
            });
          }
          setLoopEditorState({ isOpen: false, loopId: null, loopTrackId: null });
        }}
      />
    </div>
  );
});
