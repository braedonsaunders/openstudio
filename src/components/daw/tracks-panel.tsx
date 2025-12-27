'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
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
  Play,
  Plus,
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
  const { queue, currentTrack, isMaster } = useRoomStore();
  const { isPlaying, currentTime, duration } = useAudioStore();
  const {
    getTracksByRoom,
    addTrack: addLoopTrack,
    removeTrack: removeLoopTrack,
    setTrackMuted,
  } = useLoopTracksStore();

  const [showLoopBrowser, setShowLoopBrowser] = useState(false);

  // Get loop tracks for this room
  const loopTracks = getTracksByRoom(roomId);

  // Handler for adding a loop track from the browser
  const handleAddLoop = useCallback(
    async (loop: LoopDefinition) => {
      if (!userId || !roomId) return;

      const track = addLoopTrack(roomId, loop, userId, userName);

      // Persist to database
      try {
        await fetch(`/api/rooms/${roomId}/loop-tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(track),
        });
      } catch (err) {
        console.error('Failed to persist loop track:', err);
      }

      setShowLoopBrowser(false);
    },
    [userId, userName, roomId, addLoopTrack]
  );

  // Handler for removing a loop track
  const handleRemoveLoopTrack = useCallback(
    async (trackId: string) => {
      removeLoopTrack(trackId);
      try {
        await fetch(`/api/rooms/${roomId}/loop-tracks?id=${trackId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete loop track:', err);
      }
    },
    [roomId, removeLoopTrack]
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceIcon = (track: BackingTrack) => {
    if (track.youtubeId) return <Youtube className="w-3 h-3" />;
    if (track.aiGenerated) return <Sparkles className="w-3 h-3" />;
    return <Upload className="w-3 h-3" />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
          Tracks
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onUpload}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-zinc-400 transition-colors"
            title="Upload track"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onYouTubeSearch}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-zinc-400 transition-colors"
            title="Add from YouTube"
          >
            <Youtube className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onAIGenerate}
            className="p-1 rounded hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 transition-colors"
            title="AI Generate"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {isMaster && (
            <button
              onClick={() => setShowLoopBrowser(true)}
              className="p-1 rounded hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 transition-colors"
              title="Add Loop"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Now Playing - Compact */}
      {currentTrack && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-white/5 bg-indigo-500/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              {isPlaying ? (
                <Play className="w-3.5 h-3.5 text-white fill-white" />
              ) : (
                <Music className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {currentTrack.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-0.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-500 dark:text-zinc-500 tabular-nums shrink-0">
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="flex-1 overflow-y-auto">
        {queue.tracks.length === 0 && loopTracks.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Music className="w-5 h-5 text-gray-400 dark:text-zinc-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">No tracks yet</p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">Add backing tracks</p>
            </div>
          </div>
        ) : (
          <div className="py-1">
            {/* Backing Tracks */}
            {queue.tracks.map((track, index) => {
              const isCurrentTrack = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer',
                    isCurrentTrack && 'bg-indigo-500/10'
                  )}
                  onClick={() => onTrackSelect(track)}
                  title="Click to play"
                >
                  {/* Index */}
                  <span
                    className={cn(
                      'w-4 text-[10px] tabular-nums text-center shrink-0',
                      isCurrentTrack ? 'text-indigo-500 dark:text-indigo-400 font-medium' : 'text-gray-400 dark:text-zinc-600'
                    )}
                  >
                    {index + 1}
                  </span>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-xs truncate',
                        isCurrentTrack ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-zinc-300'
                      )}
                    >
                      {track.name}
                    </div>
                  </div>

                  {/* Duration & Source */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500 tabular-nums">
                      {formatTime(track.duration)}
                    </span>
                    <div
                      className={cn(
                        'p-0.5 rounded',
                        track.youtubeId && 'text-red-500 dark:text-red-400',
                        track.aiGenerated && 'text-purple-500 dark:text-purple-400',
                        !track.youtubeId && !track.aiGenerated && 'text-gray-400 dark:text-zinc-500'
                      )}
                    >
                      {getSourceIcon(track)}
                    </div>
                  </div>

                  {/* Remove Button */}
                  {isMaster && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrackRemove(track.id);
                      }}
                      className="p-0.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Loop Tracks */}
            {loopTracks.length > 0 && (
              <>
                <div className="px-3 py-1 mt-1 border-t border-gray-100 dark:border-white/5">
                  <span className="text-[9px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider">Loops</span>
                </div>
                {loopTracks.map((track) => {
                  const loopDef = getLoopById(track.loopId);
                  return (
                    <div
                      key={track.id}
                      className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
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
                      <button
                        onClick={() => setTrackMuted(track.id, !track.muted)}
                        className={cn(
                          'p-0.5 rounded transition-colors',
                          track.muted ? 'text-red-400' : 'text-gray-400 dark:text-zinc-600'
                        )}
                      >
                        {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </button>
                      {isMaster && (
                        <button
                          onClick={() => handleRemoveLoopTrack(track.id)}
                          className="p-0.5 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
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

      {/* Queue Summary */}
      {(queue.tracks.length > 0 || loopTracks.length > 0) && (
        <div className="px-3 py-1.5 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 shrink-0">
          <span>
            {queue.tracks.length} track{queue.tracks.length !== 1 ? 's' : ''}
            {loopTracks.length > 0 && ` + ${loopTracks.length} loop${loopTracks.length !== 1 ? 's' : ''}`}
          </span>
          <span>{formatTime(queue.tracks.reduce((acc, t) => acc + t.duration, 0))}</span>
        </div>
      )}

      {/* YouTube Player - Hidden but mounted */}
      {currentTrack?.youtubeId && youtubePlayer && (
        <div className="hidden">{youtubePlayer}</div>
      )}

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
