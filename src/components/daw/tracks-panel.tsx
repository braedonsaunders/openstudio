'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useSongsStore } from '@/stores/songs-store';
import { LoopBrowserModal } from '../loops/loop-browser-modal';
import { getLoopById } from '@/lib/audio/loop-library';
import {
  Upload,
  Youtube,
  Sparkles,
  X,
  Music,
  Repeat,
  Volume2,
  VolumeX,
  Plus,
  ChevronDown,
  Layers,
  GripVertical,
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

export function TracksPanel({
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onAIGenerate,
  onYouTubeSearch,
  youtubePlayer,
  roomId,
  userId,
  userName,
}: TracksPanelProps) {
  const { queue, isMaster } = useRoomStore();
  const { getTracksByRoom, addTrack: addLoopTrack, removeTrack: removeLoopTrack, setTrackMuted } = useLoopTracksStore();
  const {
    getSongsByRoom,
    getCurrentSong,
    selectSong,
    createSong,
    addTrackToSong,
    loadSongs,
    isLoading: songsLoading,
  } = useSongsStore();

  const [showLoopBrowser, setShowLoopBrowser] = useState(false);
  const [showSongDropdown, setShowSongDropdown] = useState(false);
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [hasLoadedSongs, setHasLoadedSongs] = useState(false);

  // Get data
  const songs = getSongsByRoom(roomId);
  const currentSong = getCurrentSong();
  const loopTracks = getTracksByRoom(roomId);

  // Load songs on mount
  useEffect(() => {
    if (roomId) {
      loadSongs(roomId).then(() => {
        setHasLoadedSongs(true);
      });
    }
  }, [roomId, loadSongs]);

  // Create default song if none exist AFTER loading from database
  useEffect(() => {
    // Only create default song after we've loaded from DB and confirmed none exist
    if (hasLoadedSongs && !songsLoading && songs.length === 0 && userId && !isCreatingSong) {
      setIsCreatingSong(true);
      const defaultSong = createSong(roomId, 'Song 1', userId, userName);
      // Persist to database
      fetch(`/api/rooms/${roomId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultSong),
      })
        .catch(console.error)
        .finally(() => setIsCreatingSong(false));
    }
  }, [hasLoadedSongs, songsLoading, songs.length, roomId, userId, userName, createSong, isCreatingSong]);

  // Handler for creating a new song
  const handleCreateSong = useCallback(async () => {
    if (!newSongName.trim()) return;
    setIsCreatingSong(true);
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
    setShowSongDropdown(false);
    setIsCreatingSong(false);
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate loop duration from BPM and bars
  const getLoopDuration = (loopDef: LoopDefinition | undefined): number => {
    if (!loopDef) return 0;
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / loopDef.bpm) * 60;
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

  // Loop assets from loop tracks
  const loopAssets = loopTracks.map((track) => {
    const loopDef = getLoopById(track.loopId);
    return {
      type: 'loop' as const,
      id: track.id,
      loopId: track.loopId,
      name: track.name || loopDef?.name || 'Loop',
      duration: getLoopDuration(loopDef),
      color: track.color || '#f59e0b',
      muted: track.muted,
      // Count how many times this asset appears in the current song
      clipCount: currentSong?.tracks.filter((ref) => ref.type === 'loop' && ref.trackId === track.id).length || 0,
    };
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header with Song Selector */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        {/* Song Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSongDropdown(!showSongDropdown)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-gray-200/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: currentSong?.color || '#6366f1' }}
              />
              <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {currentSong?.name || 'No Song'}
              </span>
            </div>
            <ChevronDown className={cn(
              'w-3.5 h-3.5 text-gray-500 dark:text-zinc-400 transition-transform',
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

        {/* Add Track Buttons */}
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={onUpload}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-gray-200/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-zinc-400 text-[10px] font-medium transition-colors"
            title="Upload audio"
          >
            <Upload className="w-3 h-3" />
            Upload
          </button>
          <button
            onClick={onYouTubeSearch}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-gray-200/50 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-zinc-400 text-[10px] font-medium transition-colors"
            title="Add from YouTube"
          >
            <Youtube className="w-3 h-3" />
            YouTube
          </button>
          <button
            onClick={() => setShowLoopBrowser(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-medium transition-colors"
            title="Add loop"
          >
            <Repeat className="w-3 h-3" />
            Loop
          </button>
          <button
            onClick={onAIGenerate}
            className="p-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors"
            title="AI Generate"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Asset Library */}
      <div className="flex-1 overflow-y-auto">
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackMuted(asset.id, !asset.muted);
                      }}
                      className={cn(
                        'p-0.5 rounded transition-colors',
                        asset.muted ? 'text-red-400' : 'text-gray-400 dark:text-zinc-600 opacity-0 group-hover:opacity-100'
                      )}
                      title={asset.muted ? 'Unmute' : 'Mute'}
                    >
                      {asset.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                    {isMaster && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLoopTrack(asset.id);
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
        <div className="px-3 py-1.5 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 shrink-0">
          <span>{audioAssets.length + loopAssets.length} asset{audioAssets.length + loopAssets.length !== 1 ? 's' : ''} • {currentSong.tracks.length} clip{currentSong.tracks.length !== 1 ? 's' : ''}</span>
          <span>{currentSong.bpm} BPM</span>
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
    </div>
  );
}
