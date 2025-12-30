'use client';

import { useState, useCallback, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { TracksPanel, type TracksPanelRef } from './tracks-panel';
import { LiveChannelsPanel } from './live-channels-panel';
import type { User, BackingTrack } from '@/types';

interface LeftPanelProps {
  // Tracks (Queue) props
  onTrackSelect: (track: BackingTrack) => void;
  onTrackRemove: (trackId: string) => void;
  onUpload: () => void;
  onYouTubeSearch: () => void;
  onAIGenerate: () => void;
  youtubePlayer?: React.ReactNode;
  roomId: string;
  userId: string;
  userName?: string;
  // Live Channels props
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  isMaster: boolean;
  onMuteUser: (userId: string, muted: boolean) => void;
  onVolumeChange: (userId: string, volume: number) => void;
  onMuteSelf: () => void;
  isGlobalMuted?: boolean;
  // Layout props
  width?: number;
  // Shared split position (synced with timeline)
  splitPosition?: number;
  onSplitPositionChange?: (position: number) => void;
}

export const LeftPanel = forwardRef<TracksPanelRef, LeftPanelProps>(function LeftPanel({
  // Tracks props
  onTrackSelect,
  onTrackRemove,
  onUpload,
  onYouTubeSearch,
  onAIGenerate,
  youtubePlayer,
  roomId,
  userId,
  userName,
  // Live Channels props
  users,
  currentUser,
  audioLevels,
  isMaster,
  onMuteUser,
  onVolumeChange,
  onMuteSelf,
  isGlobalMuted,
  // Layout props
  width,
  splitPosition: externalSplitPosition,
  onSplitPositionChange,
}, ref) {
  // Panel split ratio - use external if provided, otherwise local state
  const [localSplitPosition, setLocalSplitPosition] = useState(33);
  const splitPosition = externalSplitPosition ?? localSplitPosition;
  const setSplitPosition = onSplitPositionChange ?? setLocalSplitPosition;

  const [isDragging, setIsDragging] = useState(false);

  // Handle split resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('left-panel-container');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newPosition = ((e.clientY - rect.top) / rect.height) * 100;
      // Clamp between 20% and 60%
      setSplitPosition(Math.min(60, Math.max(20, newPosition)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setSplitPosition]);

  return (
    <div
      id="left-panel-container"
      className="bg-gray-50 dark:bg-[#0d0d14] border-r border-gray-200 dark:border-white/5 flex flex-col shrink-0 z-10"
      style={{ width: width ? `${width}px` : '340px' }}
    >
      {/* Upper Section: Tracks (formerly Queue) */}
      <div
        className="flex flex-col overflow-hidden border-b border-gray-200 dark:border-white/5"
        style={{ height: `${splitPosition}%` }}
      >
        <TracksPanel
          ref={ref}
          onTrackSelect={onTrackSelect}
          onTrackRemove={onTrackRemove}
          onUpload={onUpload}
          onYouTubeSearch={onYouTubeSearch}
          onAIGenerate={onAIGenerate}
          youtubePlayer={youtubePlayer}
          roomId={roomId}
          userId={userId}
          userName={userName}
        />
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          'h-1 cursor-row-resize flex items-center justify-center hover:bg-indigo-500/30 transition-colors shrink-0',
          isDragging && 'bg-indigo-500/50'
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="w-8 h-0.5 rounded-full bg-gray-300 dark:bg-zinc-700" />
      </div>

      {/* Lower Section: Live Channels (formerly Track Headers) */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(${100 - splitPosition}% - 4px)` }}
      >
        <LiveChannelsPanel
          users={users}
          currentUser={currentUser}
          audioLevels={audioLevels}
          isMaster={isMaster}
          onMuteUser={onMuteUser}
          onVolumeChange={onVolumeChange}
          onMuteSelf={onMuteSelf}
          isGlobalMuted={isGlobalMuted}
          roomId={roomId}
        />
      </div>
    </div>
  );
});
