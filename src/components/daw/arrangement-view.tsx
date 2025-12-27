'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import { Timeline } from './timeline';
import { TrackLane } from './track-lane';
import { Playhead } from './playhead';
import { BackingTrackLane } from './backing-track-lane';
import type { User } from '@/types';

interface ArrangementViewProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  isMaster: boolean;
  onSeek: (time: number) => void;
}

// Track color palette (same as track headers)
const TRACK_COLORS = [
  '#f472b6', '#fb923c', '#a3e635', '#22d3ee', '#a78bfa',
  '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#c084fc',
];

export function ArrangementView({
  users,
  currentUser,
  audioLevels,
  isMaster,
  onSeek,
}: ArrangementViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1); // 1 = 1 second per 100px
  const [scrollLeft, setScrollLeft] = useState(0);

  const { isPlaying, currentTime, duration } = useAudioStore();
  const { currentTrack, stemsAvailable, stemMixState } = useRoomStore();

  // Build ordered user list
  const orderedUsers = currentUser
    ? [currentUser, ...users.filter(u => u.id !== currentUser.id)]
    : users;

  // Handle click to seek
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isMaster || !duration) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const pixelsPerSecond = 100 * zoom;
    const seekTime = x / pixelsPerSecond;

    if (seekTime >= 0 && seekTime <= duration) {
      onSeek(seekTime);
    }
  }, [isMaster, duration, scrollLeft, zoom, onSeek]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  // Handle zoom with scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.1, Math.min(10, z * delta)));
    }
  }, []);

  // Calculate total width based on duration
  const totalWidth = duration * 100 * zoom;
  const playheadPosition = currentTime * 100 * zoom;

  // Auto-scroll to follow playhead
  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const currentScroll = container.scrollLeft;

    // If playhead goes off-screen to the right, scroll to follow
    if (playheadPosition > currentScroll + containerWidth - 100) {
      container.scrollLeft = playheadPosition - 100;
    }
    // If playhead goes off-screen to the left, scroll back
    else if (playheadPosition < currentScroll + 50) {
      container.scrollLeft = Math.max(0, playheadPosition - 50);
    }
  }, [playheadPosition, isPlaying]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0a0a0f]">
      {/* Timeline Ruler */}
      <Timeline
        duration={duration}
        zoom={zoom}
        scrollLeft={scrollLeft}
        onSeek={isMaster ? onSeek : undefined}
      />

      {/* Scrollable Track Area */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-x-auto overflow-y-auto relative',
          isMaster ? 'cursor-crosshair' : 'cursor-default'
        )}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onClick={handleClick}
      >
        {/* Content wrapper with minimum width */}
        <div
          className="relative min-w-full"
          style={{ width: totalWidth > 0 ? `${totalWidth}px` : '100%', minHeight: '100%' }}
        >
          {/* Grid Lines */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: Math.ceil(duration / (zoom > 0.5 ? 1 : 5)) }).map((_, i) => {
              const interval = zoom > 0.5 ? 1 : 5;
              const x = i * interval * 100 * zoom;
              return (
                <div
                  key={i}
                  className={cn(
                    'absolute top-0 bottom-0 w-px',
                    i % 4 === 0 ? 'bg-gray-300 dark:bg-white/10' : 'bg-gray-200 dark:bg-white/5'
                  )}
                  style={{ left: x }}
                />
              );
            })}
          </div>

          {/* Backing Track Lane (if track loaded) */}
          {currentTrack && (
            <BackingTrackLane
              track={currentTrack}
              zoom={zoom}
              currentTime={currentTime}
              duration={duration}
              stemsAvailable={stemsAvailable}
              stemMixState={stemMixState}
            />
          )}

          {/* User Track Lanes */}
          {orderedUsers.map((user, index) => {
            const isLocal = user.id === currentUser?.id;
            const level = audioLevels.get(isLocal ? 'local' : user.id) || 0;
            const trackColor = TRACK_COLORS[index % TRACK_COLORS.length];

            return (
              <TrackLane
                key={user.id}
                user={user}
                isLocal={isLocal}
                audioLevel={level}
                trackColor={trackColor}
                zoom={zoom}
                currentTime={currentTime}
              />
            );
          })}

          {/* Empty state */}
          {!currentTrack && users.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 backdrop-blur-sm rounded-2xl max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to Jam</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Add a backing track from the Queue panel to get started, or wait for other musicians to join.
                </p>
              </div>
            </div>
          )}

          {/* Playhead */}
          {duration > 0 && (
            <Playhead
              position={playheadPosition}
              isPlaying={isPlaying}
            />
          )}
        </div>
      </div>

      {/* Zoom Control */}
      <div className="h-8 px-4 flex items-center justify-between border-t border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#0d0d14]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-zinc-500">Zoom:</span>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-24 h-1"
          />
          <span className="text-xs text-gray-500 dark:text-zinc-400 w-12">{zoom.toFixed(1)}x</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
          <span>Ctrl+Scroll to zoom</span>
          {isMaster && <span>Click to seek</span>}
        </div>
      </div>
    </div>
  );
}
