'use client';

import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import {
  Plus,
  Upload,
  Youtube,
  Sparkles,
  Play,
  Pause,
  X,
  GripVertical,
  Music,
} from 'lucide-react';
import type { BackingTrack } from '@/types';

interface QueuePanelProps {
  onTrackSelect: (track: BackingTrack) => void;
  onTrackRemove: (trackId: string) => void;
  onUpload: () => void;
  onAIGenerate: () => void;
  onYouTubeSearch: () => void;
  youtubePlayer?: React.ReactNode;
}

export function QueuePanel({
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onAIGenerate,
  onYouTubeSearch,
  youtubePlayer,
}: QueuePanelProps) {
  const { queue, currentTrack, isMaster } = useRoomStore();
  const { isPlaying, currentTime, duration } = useAudioStore();

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

  const getSourceLabel = (track: BackingTrack) => {
    if (track.youtubeId) return 'YouTube';
    if (track.aiGenerated) return 'AI';
    return 'Upload';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Add Buttons */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={onUpload}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-white text-xs font-medium transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <button
            onClick={onYouTubeSearch}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-white text-xs font-medium transition-all"
          >
            <Youtube className="w-3.5 h-3.5" />
            YouTube
          </button>
          <button
            onClick={onAIGenerate}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </button>
        </div>
      </div>

      {/* Now Playing */}
      {currentTrack && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-2">Now Playing</div>

          {/* Track info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentTrack.name}</div>
              {currentTrack.artist && (
                <div className="text-xs text-gray-500 dark:text-zinc-500 truncate">{currentTrack.artist}</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 dark:text-zinc-500 shrink-0">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          {/* YouTube player - rendered inline below track info */}
          {currentTrack.youtubeId && youtubePlayer && (
            <div className="mt-3">
              {youtubePlayer}
            </div>
          )}
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto">
        {queue.tracks.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Music className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mb-1">Queue is empty</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600">Add tracks to get started</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {queue.tracks.map((track, index) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const isUpNext = index === queue.currentIndex + 1;

              return (
                <div
                  key={track.id}
                  className={cn(
                    'group flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer',
                    isCurrentTrack && 'bg-indigo-500/10'
                  )}
                  onClick={() => onTrackSelect(track)}
                  title="Click to play"
                >
                  {/* Drag Handle / Index */}
                  <div className="w-6 flex items-center justify-center shrink-0">
                    <GripVertical className="w-4 h-4 text-gray-400 dark:text-zinc-600 hidden group-hover:block" />
                    <span className={cn(
                      'text-xs tabular-nums group-hover:hidden',
                      isCurrentTrack ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-zinc-600'
                    )}>
                      {index + 1}
                    </span>
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm truncate',
                        isCurrentTrack ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-zinc-300'
                      )}>
                        {track.name}
                      </span>
                      {isUpNext && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          Up Next
                        </span>
                      )}
                    </div>
                    {track.artist && (
                      <div className="text-xs text-gray-500 dark:text-zinc-500 truncate">{track.artist}</div>
                    )}
                  </div>

                  {/* Duration & Source */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums">
                      {formatTime(track.duration)}
                    </span>
                    <div className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                      track.youtubeId && 'bg-red-500/10 text-red-500 dark:text-red-400',
                      track.aiGenerated && 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
                      !track.youtubeId && !track.aiGenerated && 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-500'
                    )}>
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
                      className="p-1 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Queue Summary */}
      {queue.tracks.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-white/5 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500">
          <span>{queue.tracks.length} track{queue.tracks.length !== 1 ? 's' : ''}</span>
          <span>
            {formatTime(queue.tracks.reduce((acc, t) => acc + t.duration, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
