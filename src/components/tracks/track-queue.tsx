'use client';

import { useState, useCallback } from 'react';
import { cn, formatTime } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  Music,
  Play,
  Trash2,
  GripVertical,
  Upload,
  Sparkles,
  Youtube,
} from 'lucide-react';
import type { BackingTrack } from '@/types';

interface TrackQueueProps {
  onTrackSelect: (track: BackingTrack) => void;
  onTrackRemove: (trackId: string) => void;
  onUpload: () => void;
  onAIGenerate: () => void;
  onYouTubeSearch: () => void;
  className?: string;
}

export function TrackQueue({
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onAIGenerate,
  onYouTubeSearch,
  className,
}: TrackQueueProps) {
  const { queue, currentTrack, isMaster } = useRoomStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    if (!isMaster) return;
    setDraggedIndex(index);
  }, [isMaster]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-900">Track Queue</h4>
        <span className="text-sm text-slate-500">
          {queue.tracks.length} track{queue.tracks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add track buttons */}
      {isMaster && (
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUpload}
            className="flex-col h-auto py-3 gap-1"
          >
            <Upload className="w-4 h-4" />
            <span className="text-xs">Upload</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onYouTubeSearch}
            className="flex-col h-auto py-3 gap-1"
          >
            <Youtube className="w-4 h-4 text-red-500" />
            <span className="text-xs">YouTube</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAIGenerate}
            className="flex-col h-auto py-3 gap-1"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-xs">AI Gen</span>
          </Button>
        </div>
      )}

      {/* Track list */}
      {queue.tracks.length === 0 ? (
        <Card variant="bordered" className="py-8 text-center">
          <Music className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500">No tracks in queue</p>
          <p className="text-sm text-slate-400 mt-1">
            Upload, search YouTube, or generate with AI
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {queue.tracks.map((track, index) => {
            const isActive = currentTrack?.id === track.id;
            const isDragging = draggedIndex === index;

            return (
              <div
                key={track.id}
                draggable={isMaster}
                onDragStart={() => handleDragStart(index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl transition-all',
                  'bg-slate-50 border border-transparent',
                  isActive && 'border-indigo-300 bg-indigo-50',
                  isDragging && 'opacity-50',
                  isMaster && 'cursor-move'
                )}
              >
                {/* Drag handle */}
                {isMaster && (
                  <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                )}

                {/* Track number / playing indicator */}
                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                  {isActive ? (
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-slate-400 text-sm">{index + 1}</span>
                  )}
                </div>

                {/* Track info */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onDoubleClick={() => isMaster && onTrackSelect(track)}
                  title={isMaster ? 'Double-click to play' : undefined}
                >
                  <h5 className="font-medium text-slate-900 truncate text-sm">
                    {track.name}
                  </h5>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {track.artist && (
                      <>
                        <span className="truncate">{track.artist}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{formatTime(track.duration)}</span>
                    {track.aiGenerated && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-purple-500">
                          <Sparkles className="w-3 h-3" />
                          AI
                        </span>
                      </>
                    )}
                    {track.youtubeId && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-red-500">
                          <Youtube className="w-3 h-3" />
                          YT
                        </span>
                      </>
                    )}
                    {track.stems && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-500">Stems</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!isActive && isMaster && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onTrackSelect(track)}
                      className="w-8 h-8"
                      title="Play this track"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  {isMaster && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onTrackRemove(track.id)}
                      className="w-8 h-8 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
