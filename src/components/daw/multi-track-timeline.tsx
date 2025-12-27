'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSongsStore } from '@/stores/songs-store';
import { useRoomStore } from '@/stores/room-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { getLoopById } from '@/lib/audio/loop-library';
import {
  Music,
  Repeat,
  Youtube,
  Sparkles,
  Play,
  Square,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react';
import type { SongTrackReference } from '@/types/songs';

interface MultiTrackTimelineProps {
  roomId: string;
  onSeek?: (time: number) => void;
  onPlay?: () => void;
  onStop?: () => void;
}

export function MultiTrackTimeline({
  roomId,
  onSeek,
  onPlay,
  onStop,
}: MultiTrackTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(50); // pixels per second
  const [scrollLeft, setScrollLeft] = useState(0);

  const { getCurrentSong } = useSongsStore();
  const { queue } = useRoomStore();
  const { getTracksByRoom } = useLoopTracksStore();
  const { isPlaying, currentTime, duration } = useAudioStore();

  const currentSong = getCurrentSong();
  const loopTracks = getTracksByRoom(roomId);

  // Calculate total song duration
  const calculateSongDuration = useCallback(() => {
    if (!currentSong) return 0;

    let maxDuration = 0;
    currentSong.tracks.forEach((trackRef) => {
      if (trackRef.type === 'audio') {
        const audioTrack = queue.tracks.find((t) => t.id === trackRef.trackId);
        if (audioTrack) {
          const endTime = trackRef.startOffset + (audioTrack.duration || 0);
          maxDuration = Math.max(maxDuration, endTime);
        }
      } else if (trackRef.type === 'loop') {
        const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
        const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
        if (loopDef) {
          const beatsPerBar = loopDef.timeSignature[0];
          const totalBeats = loopDef.bars * beatsPerBar;
          const loopDuration = (totalBeats / loopDef.bpm) * 60;
          const endTime = trackRef.startOffset + loopDuration;
          maxDuration = Math.max(maxDuration, endTime);
        }
      }
    });

    return maxDuration || duration || 60;
  }, [currentSong, queue.tracks, loopTracks, duration]);

  const songDuration = calculateSongDuration();
  const timelineWidth = Math.max(songDuration * zoom, 800);

  // Resolve track info
  const resolveTrack = (trackRef: SongTrackReference) => {
    if (trackRef.type === 'loop') {
      const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
      const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
      const beatsPerBar = loopDef?.timeSignature[0] || 4;
      const totalBeats = (loopDef?.bars || 4) * beatsPerBar;
      const loopDuration = loopDef ? (totalBeats / loopDef.bpm) * 60 : 0;

      return {
        name: loopTrack?.name || loopDef?.name || 'Loop',
        duration: loopDuration,
        color: loopTrack?.color || '#f59e0b',
        muted: loopTrack?.muted || trackRef.muted || false,
        type: 'loop' as const,
      };
    } else {
      const audioTrack = queue.tracks.find((t) => t.id === trackRef.trackId);
      return {
        name: audioTrack?.name || 'Unknown Track',
        duration: audioTrack?.duration || 0,
        color: '#6366f1',
        muted: trackRef.muted || false,
        type: 'audio' as const,
        youtubeId: audioTrack?.youtubeId,
        aiGenerated: audioTrack?.aiGenerated,
      };
    }
  };

  // Get track icon
  const getTrackIcon = (track: ReturnType<typeof resolveTrack>) => {
    if (track.type === 'loop') return <Repeat className="w-3 h-3" />;
    if (track.youtubeId) return <Youtube className="w-3 h-3" />;
    if (track.aiGenerated) return <Sparkles className="w-3 h-3" />;
    return <Music className="w-3 h-3" />;
  };

  // Handle timeline click to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onSeek || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft;
      const time = x / zoom;
      onSeek(Math.max(0, Math.min(songDuration, time)));
    },
    [onSeek, scrollLeft, zoom, songDuration]
  );

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(200, z * 1.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(10, z / 1.25));
  }, []);

  // Generate time markers
  const generateTimeMarkers = useCallback(() => {
    const markers: { time: number; label: string }[] = [];
    const interval = zoom > 100 ? 1 : zoom > 50 ? 5 : zoom > 25 ? 10 : 30;

    for (let t = 0; t <= songDuration; t += interval) {
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      markers.push({
        time: t,
        label: `${mins}:${secs.toString().padStart(2, '0')}`,
      });
    }
    return markers;
  }, [songDuration, zoom]);

  const timeMarkers = generateTimeMarkers();
  const tracks = currentSong?.tracks.map((ref) => ({ ref, ...resolveTrack(ref) })) || [];

  // Keep playhead visible
  useEffect(() => {
    if (!containerRef.current || !isPlaying) return;

    const playheadX = currentTime * zoom;
    const container = containerRef.current;
    const scrollPosition = container.scrollLeft;
    const visibleWidth = container.clientWidth;

    if (playheadX > scrollPosition + visibleWidth - 100) {
      container.scrollLeft = playheadX - visibleWidth + 200;
    } else if (playheadX < scrollPosition) {
      container.scrollLeft = Math.max(0, playheadX - 100);
    }
  }, [currentTime, zoom, isPlaying]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0a0a0f] border-b border-gray-200 dark:border-white/5">
      {/* Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            {currentSong?.name || 'No Song Selected'}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-zinc-500">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback controls */}
          <div className="flex items-center gap-1">
            {onPlay && (
              <button
                onClick={isPlaying ? onStop : onPlay}
                className={cn(
                  'p-1 rounded transition-colors',
                  isPlaying
                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                    : 'bg-indigo-500/20 text-indigo-500 hover:bg-indigo-500/30'
                )}
                title={isPlaying ? 'Stop' : 'Play'}
              >
                {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-gray-500 dark:text-zinc-500 w-8 text-center">
              {Math.round(zoom)}x
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
        onScroll={handleScroll}
        onClick={handleTimelineClick}
      >
        <div className="min-h-full" style={{ width: timelineWidth }}>
          {/* Time Ruler */}
          <div className="h-5 sticky top-0 bg-gray-50 dark:bg-[#0d0d14] border-b border-gray-200 dark:border-white/10 z-10">
            {timeMarkers.map((marker) => (
              <div
                key={marker.time}
                className="absolute top-0 h-full flex flex-col items-start"
                style={{ left: marker.time * zoom }}
              >
                <div className="w-px h-2 bg-gray-300 dark:bg-zinc-700" />
                <span className="text-[9px] text-gray-500 dark:text-zinc-500 ml-0.5">
                  {marker.label}
                </span>
              </div>
            ))}
          </div>

          {/* Track Lanes */}
          <div className="relative">
            {tracks.length === 0 ? (
              <div className="h-24 flex items-center justify-center">
                <div className="text-center">
                  <Layers className="w-6 h-6 mx-auto mb-1 text-gray-300 dark:text-zinc-700" />
                  <p className="text-xs text-gray-400 dark:text-zinc-600">No tracks in song</p>
                </div>
              </div>
            ) : (
              tracks.map((track, index) => (
                <div
                  key={track.ref.id}
                  className="h-12 relative border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                >
                  {/* Track clip */}
                  <div
                    className={cn(
                      'absolute top-1 bottom-1 rounded-md flex items-center gap-1.5 px-2 overflow-hidden transition-opacity',
                      track.muted ? 'opacity-40' : 'opacity-100'
                    )}
                    style={{
                      left: track.ref.startOffset * zoom,
                      width: Math.max(track.duration * zoom, 40),
                      backgroundColor: `${track.color}30`,
                      borderLeft: `3px solid ${track.color}`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: track.color, color: 'white' }}
                    >
                      {getTrackIcon(track)}
                    </div>
                    <span className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate">
                      {track.name}
                    </span>

                    {/* Waveform placeholder - could be enhanced later */}
                    <div className="absolute inset-0 flex items-center pointer-events-none px-8">
                      <div
                        className="flex-1 h-4 opacity-30"
                        style={{
                          background: `repeating-linear-gradient(90deg, ${track.color} 0px, ${track.color} 2px, transparent 2px, transparent 6px)`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: currentTime * zoom }}
          >
            <div className="w-2 h-2 -ml-[3px] -mt-1 bg-red-500 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
