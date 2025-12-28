'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MultiTrackTimeline } from './multi-track-timeline';
import { LiveArrangementView } from './live-arrangement-view';
import type { User } from '@/types';

interface CenterSplitViewProps {
  roomId: string;
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  isMaster: boolean;
  onSeek: (time: number) => void;
  onPlay?: () => void;
  onStop?: () => void;
  sessionStartTime?: number;
  // Shared split position (synced with left panel)
  splitPosition?: number;
  onSplitPositionChange?: (position: number) => void;
}

export function CenterSplitView({
  roomId,
  users,
  currentUser,
  audioLevels,
  isMaster,
  onSeek,
  onPlay,
  onStop,
  sessionStartTime,
  splitPosition: externalSplitPosition,
  onSplitPositionChange,
}: CenterSplitViewProps) {
  // Split position - use external if provided, otherwise local state
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
      const container = document.getElementById('center-split-container');
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
      id="center-split-container"
      className="flex-1 flex flex-col min-w-0 h-full"
    >
      {/* Upper Section: Multi-Track Timeline (1/3) */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `${splitPosition}%` }}
      >
        <MultiTrackTimeline
          roomId={roomId}
          onSeek={onSeek}
          onPlay={onPlay}
          onStop={onStop}
        />
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          'h-1 cursor-row-resize flex items-center justify-center hover:bg-indigo-500/30 transition-colors shrink-0 bg-gray-200 dark:bg-white/5',
          isDragging && 'bg-indigo-500/50'
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="w-12 h-0.5 rounded-full bg-gray-300 dark:bg-zinc-700" />
      </div>

      {/* Lower Section: Live Arrangement View (2/3) */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(${100 - splitPosition}% - 4px)` }}
      >
        <LiveArrangementView
          users={users}
          currentUser={currentUser}
          audioLevels={audioLevels}
          isMaster={isMaster}
          onSeek={onSeek}
          sessionStartTime={sessionStartTime}
        />
      </div>
    </div>
  );
}
