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
import type { Song, SongTrackReference } from '@/types/songs';

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
    deleteSong,
    addTrackToSong,
    removeTrackFromSong,
    loadSongs,
  } = useSongsStore();

  const [showLoopBrowser, setShowLoopBrowser] = useState(false);
  const [showSongDropdown, setShowSongDropdown] = useState(false);
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [newSongName, setNewSongName] = useState('');

  // Get data
  const songs = getSongsByRoom(roomId);
  const currentSong = getCurrentSong();
  const loopTracks = getTracksByRoom(roomId);

  // Load songs on mount
  useEffect(() => {
    if (roomId) {
      loadSongs(roomId);
    }
  }, [roomId, loadSongs]);

  // Create default song if none exist
  useEffect(() => {
    if (songs.length === 0 && userId && !isCreatingSong) {
      const defaultSong = createSong(roomId, 'Song 1', userId, userName);
      // Persist to database
      fetch(`/api/rooms/${roomId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultSong),
      }).catch(console.error);
    }
  }, [songs.length, roomId, userId, userName, createSong, isCreatingSong]);

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

  // Handler for removing a track from current song
  const handleRemoveTrack = useCallback(
    async (trackRef: SongTrackReference) => {
      if (!currentSong) return;

      removeTrackFromSong(currentSong.id, trackRef.id);

      // If it's a loop, also remove from loop tracks store
      if (trackRef.type === 'loop') {
        removeLoopTrack(trackRef.trackId);
        try {
          await fetch(`/api/rooms/${roomId}/loop-tracks?trackId=${trackRef.trackId}`, {
            method: 'DELETE',
          });
        } catch (err) {
          console.error('Failed to delete loop track:', err);
        }
      } else {
        // It's an audio track
        onTrackRemove(trackRef.trackId);
      }
    },
    [currentSong, roomId, removeTrackFromSong, removeLoopTrack, onTrackRemove]
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

  // Get track icon based on type
  const getTrackIcon = (trackRef: SongTrackReference) => {
    if (trackRef.type === 'loop') {
      return <Repeat className="w-3 h-3" />;
    }
    const track = queue.tracks.find((t) => t.id === trackRef.trackId);
    if (track?.youtubeId) return <Youtube className="w-3 h-3" />;
    if (track?.aiGenerated) return <Sparkles className="w-3 h-3" />;
    return <Music className="w-3 h-3" />;
  };

  // Resolve track data
  const resolveTrack = (trackRef: SongTrackReference) => {
    if (trackRef.type === 'loop') {
      const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
      const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
      return {
        name: loopTrack?.name || loopDef?.name || 'Loop',
        duration: getLoopDuration(loopDef),
        color: loopTrack?.color || '#f59e0b',
        muted: loopTrack?.muted || false,
        loopTrack,
        loopDef,
      };
    } else {
      const audioTrack = queue.tracks.find((t) => t.id === trackRef.trackId);
      return {
        name: audioTrack?.name || 'Unknown Track',
        duration: audioTrack?.duration || 0,
        color: '#6366f1',
        muted: false,
        audioTrack,
      };
    }
  };

  // Build unified track list for current song
  const unifiedTracks = currentSong?.tracks.map((trackRef) => ({
    ...trackRef,
    ...resolveTrack(trackRef),
  })) || [];

  // Also include tracks not yet in a song (backwards compat)
  const orphanAudioTracks = queue.tracks.filter(
    (t) => !currentSong?.tracks.some((ref) => ref.type === 'audio' && ref.trackId === t.id)
  );
  const orphanLoopTracks = loopTracks.filter(
    (t) => !currentSong?.tracks.some((ref) => ref.type === 'loop' && ref.trackId === t.id)
  );

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

      {/* Track List */}
      <div className="flex-1 overflow-y-auto">
        {unifiedTracks.length === 0 && orphanAudioTracks.length === 0 && orphanLoopTracks.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Layers className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">No tracks in song</p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">Add audio or loops above</p>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {/* Song Tracks */}
            {unifiedTracks.map((track, index) => (
              <div
                key={track.id}
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                {/* Drag Handle */}
                <GripVertical className="w-3 h-3 text-gray-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 shrink-0" />

                {/* Track Icon */}
                <div
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${track.color}20`, color: track.color }}
                >
                  {getTrackIcon(track)}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                    {track.name}
                  </div>
                </div>

                {/* Duration */}
                <span className="text-[10px] text-gray-500 dark:text-zinc-500 tabular-nums shrink-0">
                  {formatTime(track.duration)}
                </span>

                {/* Mute Button (for loops) */}
                {track.type === 'loop' && track.loopTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackMuted(track.trackId, !track.muted);
                    }}
                    className={cn(
                      'p-0.5 rounded transition-colors',
                      track.muted ? 'text-red-400' : 'text-gray-400 dark:text-zinc-600'
                    )}
                    title={track.muted ? 'Unmute' : 'Mute'}
                  >
                    {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                )}

                {/* Remove Button */}
                {isMaster && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(track);
                    }}
                    className="p-0.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from song"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Orphan Audio Tracks (not in current song) */}
            {orphanAudioTracks.length > 0 && (
              <>
                <div className="px-3 py-1 mt-1 border-t border-gray-100 dark:border-white/5">
                  <span className="text-[9px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                    Unassigned Audio
                  </span>
                </div>
                {orphanAudioTracks.map((track) => (
                  <div
                    key={track.id}
                    className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer opacity-60"
                    onClick={() => onTrackSelect(track)}
                  >
                    <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Music className="w-3 h-3 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 dark:text-zinc-300 truncate">{track.name}</div>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500 tabular-nums">
                      {formatTime(track.duration)}
                    </span>
                    {isMaster && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add to current song
                          if (currentSong) {
                            addTrackToSong(currentSong.id, {
                              type: 'audio',
                              trackId: track.id,
                              startOffset: 0,
                            });
                          }
                        }}
                        className="p-0.5 text-indigo-500 opacity-0 group-hover:opacity-100"
                        title="Add to current song"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Orphan Loop Tracks (not in current song) */}
            {orphanLoopTracks.length > 0 && (
              <>
                <div className="px-3 py-1 mt-1 border-t border-gray-100 dark:border-white/5">
                  <span className="text-[9px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                    Unassigned Loops
                  </span>
                </div>
                {orphanLoopTracks.map((track) => {
                  const loopDef = getLoopById(track.loopId);
                  return (
                    <div
                      key={track.id}
                      className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer opacity-60"
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${track.color}20` }}
                      >
                        <Repeat className="w-3 h-3" style={{ color: track.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-700 dark:text-zinc-300 truncate">
                          {track.name || loopDef?.name || 'Loop'}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-zinc-500 tabular-nums">
                        {formatTime(getLoopDuration(loopDef))}
                      </span>
                      {isMaster && currentSong && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addTrackToSong(currentSong.id, {
                              type: 'loop',
                              trackId: track.id,
                              startOffset: 0,
                            });
                          }}
                          className="p-0.5 text-amber-500 opacity-0 group-hover:opacity-100"
                          title="Add to current song"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Song Summary */}
      {currentSong && (
        <div className="px-3 py-1.5 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 shrink-0">
          <span>{unifiedTracks.length} track{unifiedTracks.length !== 1 ? 's' : ''}</span>
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
