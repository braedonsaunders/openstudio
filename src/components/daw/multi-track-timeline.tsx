'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react';
import type { SongTrackReference } from '@/types/songs';
import type { MidiNote, LoopDefinition } from '@/types/loops';

interface MultiTrackTimelineProps {
  roomId: string;
  onSeek?: (time: number) => void;
  onPlay?: () => void;
  onStop?: () => void;
}

// MIDI note range for display (C1 to C6 = notes 24-84)
const MIN_NOTE = 24;
const MAX_NOTE = 84;
const NOTE_RANGE = MAX_NOTE - MIN_NOTE;

// Render MIDI notes as piano roll visualization
function MidiNoteVisualization({
  notes,
  loopDef,
  width,
  height,
  color,
}: {
  notes: MidiNote[];
  loopDef: LoopDefinition;
  width: number;
  height: number;
  color: string;
}) {
  if (!notes || notes.length === 0) {
    return null;
  }

  // Calculate note dimensions
  const noteHeight = Math.max(2, height / NOTE_RANGE);

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0"
      style={{ pointerEvents: 'none' }}
    >
      {notes.map((note, i) => {
        // Normalize note position
        const x = note.t * width;
        const noteWidth = Math.max(2, note.d * width);

        // Y position (inverted - higher notes at top)
        const normalizedNote = Math.max(0, Math.min(1, (note.n - MIN_NOTE) / NOTE_RANGE));
        const y = height - (normalizedNote * height) - noteHeight;

        // Velocity affects opacity
        const opacity = 0.4 + (note.v / 127) * 0.6;

        return (
          <rect
            key={`${i}-${note.t}-${note.n}`}
            x={x}
            y={Math.max(0, y)}
            width={noteWidth}
            height={noteHeight}
            fill={color}
            opacity={opacity}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// Simple waveform visualization placeholder
function WaveformVisualization({
  width,
  height,
  color,
  waveformData,
}: {
  width: number;
  height: number;
  color: string;
  waveformData?: number[];
}) {
  // If we have actual waveform data, render it
  if (waveformData && waveformData.length > 0) {
    const barWidth = Math.max(1, width / waveformData.length);
    const centerY = height / 2;

    return (
      <svg
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ pointerEvents: 'none' }}
      >
        {waveformData.map((value, i) => {
          const barHeight = value * height * 0.8;
          return (
            <rect
              key={i}
              x={i * barWidth}
              y={centerY - barHeight / 2}
              width={Math.max(1, barWidth - 1)}
              height={barHeight}
              fill={color}
              opacity={0.6}
            />
          );
        })}
      </svg>
    );
  }

  // Placeholder waveform pattern
  const bars = Math.floor(width / 3);
  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0"
      style={{ pointerEvents: 'none' }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const barHeight = (Math.sin(i * 0.3) * 0.3 + 0.5) * height * 0.7;
        return (
          <rect
            key={i}
            x={i * 3}
            y={(height - barHeight) / 2}
            width={2}
            height={barHeight}
            fill={color}
            opacity={0.4}
          />
        );
      })}
    </svg>
  );
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

  // Calculate loop duration from definition
  const getLoopDuration = useCallback((loopDef: LoopDefinition | undefined): number => {
    if (!loopDef) return 0;
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / loopDef.bpm) * 60;
  }, []);

  // Build unified track list with all resolved data
  const unifiedTracks = useMemo(() => {
    if (!currentSong) return [];

    return currentSong.tracks.map((trackRef) => {
      if (trackRef.type === 'loop') {
        const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
        const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
        const loopDuration = getLoopDuration(loopDef);
        const midiNotes = loopTrack?.customMidiData || loopDef?.midiData || [];

        return {
          ref: trackRef,
          type: 'loop' as const,
          name: loopTrack?.name || loopDef?.name || 'Loop',
          duration: loopDuration,
          color: loopTrack?.color || '#f59e0b',
          muted: loopTrack?.muted || trackRef.muted || false,
          loopDef,
          midiNotes,
        };
      } else {
        const audioTrack = queue.tracks.find((t) => t.id === trackRef.trackId);
        return {
          ref: trackRef,
          type: 'audio' as const,
          name: audioTrack?.name || 'Unknown Track',
          duration: audioTrack?.duration || 0,
          color: '#6366f1',
          muted: trackRef.muted || false,
          youtubeId: audioTrack?.youtubeId,
          aiGenerated: audioTrack?.aiGenerated,
          waveformData: undefined,
        };
      }
    });
  }, [currentSong, loopTracks, queue.tracks, getLoopDuration]);

  // Calculate total song duration
  const songDuration = useMemo(() => {
    if (unifiedTracks.length === 0) return duration || 60;

    let maxDuration = 0;
    unifiedTracks.forEach((track) => {
      const endTime = track.ref.startOffset + track.duration;
      maxDuration = Math.max(maxDuration, endTime);
    });

    return maxDuration || duration || 60;
  }, [unifiedTracks, duration]);

  const timelineWidth = Math.max(songDuration * zoom, 800);

  // Get track icon
  const getTrackIcon = (track: typeof unifiedTracks[0]) => {
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
  const timeMarkers = useMemo(() => {
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

  // Keep playhead visible during playback
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

  const trackHeight = 48;

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
            {unifiedTracks.length} track{unifiedTracks.length !== 1 ? 's' : ''}
          </span>
          {currentSong && (
            <span className="text-[10px] text-gray-400 dark:text-zinc-600">
              {currentSong.bpm} BPM
            </span>
          )}
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
            {unifiedTracks.length === 0 ? (
              <div className="h-32 flex items-center justify-center">
                <div className="text-center">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-zinc-700" />
                  <p className="text-sm text-gray-400 dark:text-zinc-600">No tracks in song</p>
                  <p className="text-xs text-gray-300 dark:text-zinc-700 mt-1">
                    Add audio or loops from the left panel
                  </p>
                </div>
              </div>
            ) : (
              unifiedTracks.map((track) => {
                const clipWidth = Math.max(track.duration * zoom, 40);
                const clipLeft = track.ref.startOffset * zoom;

                return (
                  <div
                    key={track.ref.id}
                    className="relative border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                    style={{ height: trackHeight }}
                  >
                    {/* Track label on left */}
                    <div className="absolute left-0 top-0 bottom-0 w-24 flex items-center gap-1.5 px-2 bg-gray-50/80 dark:bg-[#0d0d14]/80 border-r border-gray-100 dark:border-white/5 z-10">
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: track.color, color: 'white' }}
                      >
                        {getTrackIcon(track)}
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate">
                        {track.name}
                      </span>
                    </div>

                    {/* Track clip */}
                    <div
                      className={cn(
                        'absolute top-1 bottom-1 rounded-md overflow-hidden transition-opacity',
                        track.muted ? 'opacity-40' : 'opacity-100'
                      )}
                      style={{
                        left: clipLeft + 96,
                        width: clipWidth,
                        backgroundColor: `${track.color}20`,
                        borderLeft: `3px solid ${track.color}`,
                      }}
                    >
                      {/* Content visualization */}
                      {track.type === 'loop' && track.loopDef ? (
                        <MidiNoteVisualization
                          notes={track.midiNotes}
                          loopDef={track.loopDef}
                          width={clipWidth - 3}
                          height={trackHeight - 8}
                          color={track.color}
                        />
                      ) : (
                        <WaveformVisualization
                          width={clipWidth - 3}
                          height={trackHeight - 8}
                          color={track.color}
                          waveformData={track.waveformData}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: currentTime * zoom + 96 }}
          >
            <div className="w-3 h-3 -ml-[5px] bg-red-500 rounded-sm rotate-45" style={{ marginTop: '12px' }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      {currentSong && (
        <div className="h-6 px-3 flex items-center justify-between border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d0d14] shrink-0">
          <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
            <span>
              {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(songDuration / 60)}:{Math.floor(songDuration % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-amber-500">● MIDI</span>
            <span className="text-indigo-500">● Audio</span>
          </div>
        </div>
      )}
    </div>
  );
}
