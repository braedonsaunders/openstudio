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
  MoreVertical,
} from 'lucide-react';
import type { BackingTrack } from '@/types';

interface TrackQueueProps {
  onTrackSelect: (track: BackingTrack) => void;
  onTrackRemove: (trackId: string) => void;
  onUpload: () => void;
  onAIGenerate: () => void;
  className?: string;
}

export function TrackQueue({
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onAIGenerate,
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
        <h4 className="font-medium text-white">Track Queue</h4>
        <span className="text-sm text-gray-500">
          {queue.tracks.length} track{queue.tracks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add track buttons */}
      {isMaster && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUpload}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAIGenerate}
            className="flex-1"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Generate
          </Button>
        </div>
      )}

      {/* Track list */}
      {queue.tracks.length === 0 ? (
        <Card variant="bordered" className="py-8 text-center">
          <Music className="w-8 h-8 mx-auto text-gray-600 mb-2" />
          <p className="text-gray-500">No tracks in queue</p>
          <p className="text-sm text-gray-600 mt-1">
            Upload a track or generate one with AI
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
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  'bg-gray-800/50 border border-transparent',
                  isActive && 'border-indigo-500 bg-indigo-500/10',
                  isDragging && 'opacity-50',
                  isMaster && 'cursor-move'
                )}
              >
                {/* Drag handle */}
                {isMaster && (
                  <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                )}

                {/* Track number / playing indicator */}
                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                  {isActive ? (
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-gray-500">{index + 1}</span>
                  )}
                </div>

                {/* Track info */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onTrackSelect(track)}
                >
                  <h5 className="font-medium text-white truncate">
                    {track.name}
                  </h5>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
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
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          AI
                        </span>
                      </>
                    )}
                    {track.stems && (
                      <>
                        <span>•</span>
                        <span className="text-green-500">Stems</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onTrackSelect(track)}
                      className="w-8 h-8"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                  {isMaster && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onTrackRemove(track.id)}
                      className="w-8 h-8 text-gray-500 hover:text-red-500"
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
