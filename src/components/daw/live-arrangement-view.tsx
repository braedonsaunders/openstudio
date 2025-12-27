'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { LiveTrackLane } from './live-track-lane';
import { UserTrackLane } from './user-track-lane';
import { LoopTrackLane } from '../loops/loop-track-lane';
import { SeekableBackingTrack } from './seekable-backing-track';
import { NowLine } from './now-line';
import type { User } from '@/types';

interface LiveArrangementViewProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  isMaster: boolean;
  onSeek: (time: number) => void;
  sessionStartTime?: number;
  roomId?: string;
}

// Track color palette for remote users
const TRACK_COLORS = [
  '#f472b6', '#fb923c', '#a3e635', '#22d3ee', '#a78bfa',
  '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#c084fc',
];

// How many seconds of history to show
const HISTORY_SECONDS = 60;

export function LiveArrangementView({
  users,
  currentUser,
  audioLevels,
  isMaster,
  onSeek,
  sessionStartTime = Date.now(),
  roomId,
}: LiveArrangementViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const { isPlaying, currentTime, duration } = useAudioStore();
  const { currentTrack, stemsAvailable, stemMixState, waveformData, queue } = useRoomStore();
  const { getTracksByUser, trackLevels } = useUserTracksStore();
  const { getTracksByRoom } = useLoopTracksStore();

  // Get loop tracks for this room
  const loopTracks = roomId ? getTracksByRoom(roomId) : [];

  // Fallback: if no currentTrack but queue has tracks, use the first one
  // This ensures waveform is always visible when tracks exist
  const displayTrack = currentTrack || (queue.tracks.length > 0 ? queue.tracks[0] : null);

  // Calculate session elapsed time
  const [sessionTime, setSessionTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime((Date.now() - sessionStartTime) / 1000);
    }, 50);

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Get local user tracks
  const localTracks = currentUser ? getTracksByUser(currentUser.id) : [];

  // Remote users (excluding current user)
  const remoteUsers = users.filter((u) => u.id !== currentUser?.id);

  // Handle zoom with scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.5, Math.min(3, z * delta)));
    }
  }, []);

  // Total track count
  const totalTracks = localTracks.length + remoteUsers.length + loopTracks.length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0a0a0f]">
      {/* Seekable Backing Track (independent from live timeline) */}
      {/* Always show when there are tracks in the queue */}
      {displayTrack && (
        <SeekableBackingTrack
          track={displayTrack}
          currentTime={currentTime}
          duration={duration || displayTrack.duration || 0}
          isPlaying={isPlaying}
          isMaster={isMaster}
          onSeek={onSeek}
          stemsAvailable={stemsAvailable}
          stemMixState={stemMixState}
          waveformData={waveformData}
        />
      )}

      {/* Live Session Header */}
      <div className="h-8 px-4 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#0d0d14]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-900 dark:text-white">LIVE SESSION</span>
          </div>
          <div className="h-4 w-px bg-gray-300 dark:bg-white/10" />
          <span className="text-xs text-gray-500 dark:text-zinc-500 font-mono">{formatSessionTime(sessionTime)}</span>
          <div className="h-4 w-px bg-gray-300 dark:bg-white/10" />
          <span className="text-xs text-gray-500 dark:text-zinc-500">
            {totalTracks} track{totalTracks !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-600">
          <span>← PAST</span>
          <div className="w-16 h-px bg-gradient-to-r from-gray-400 dark:from-zinc-700 to-indigo-500" />
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">NOW</span>
        </div>
      </div>

      {/* Live Tracks Area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onWheel={handleWheel}
      >
        {/* Live Track Lanes */}
        <div className="absolute inset-0 flex flex-col overflow-y-auto">
          {/* Local User Tracks Section */}
          {localTracks.length > 0 && (
            <div>
              {localTracks.map((track) => {
                const level = trackLevels.get(track.id) || audioLevels.get('local') || 0;
                return (
                  <UserTrackLane
                    key={track.id}
                    track={track}
                    audioLevel={level}
                    zoom={zoom}
                    historySeconds={HISTORY_SECONDS}
                  />
                );
              })}
            </div>
          )}

          {/* Loop Tracks Section */}
          {loopTracks.length > 0 && (
            <div>
              {loopTracks.map((track) => (
                <div
                  key={track.id}
                  className="h-24 border-b border-slate-700"
                  style={{ borderLeftColor: track.color, borderLeftWidth: '3px' }}
                >
                  <LoopTrackLane
                    track={track}
                    width={HISTORY_SECONDS * 100 * zoom}
                    pixelsPerSecond={100 * zoom}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Remote Users Section */}
          {remoteUsers.map((user, index) => {
            const level = audioLevels.get(user.id) || 0;
            const trackColor = TRACK_COLORS[index % TRACK_COLORS.length];

            return (
              <LiveTrackLane
                key={user.id}
                user={user}
                isLocal={false}
                audioLevel={level}
                trackColor={trackColor}
                zoom={zoom}
                historySeconds={HISTORY_SECONDS}
              />
            );
          })}

          {/* Empty state */}
          {totalTracks === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-white/80 dark:bg-transparent dark:glass-panel rounded-2xl max-w-md border border-gray-200 dark:border-transparent shadow-lg dark:shadow-none">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Waiting for Musicians</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Share the room code to invite others to join this live jam session.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* NOW Line (fixed on right side) */}
        <NowLine isRecording={true} className="right-6" />

        {/* Fade gradient on left edge (history fading out) */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white dark:from-[#0a0a0f] to-transparent pointer-events-none z-20" />
      </div>

      {/* Zoom Control */}
      <div className="h-8 px-4 flex items-center justify-between border-t border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#0d0d14]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-zinc-500">History:</span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-24 h-1 accent-indigo-500"
          />
          <span className="text-xs text-gray-500 dark:text-zinc-400 w-16">
            {Math.round(HISTORY_SECONDS / zoom)}s visible
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
          <span>Ctrl+Scroll to zoom</span>
          <span className="text-indigo-600 dark:text-indigo-400">● Live audio flows ← from NOW</span>
        </div>
      </div>
    </div>
  );
}

function formatSessionTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
