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
  Trash2,
  Copy,
  Volume2,
  VolumeX,
  MoreHorizontal,
} from 'lucide-react';
import type { SongTrackReference } from '@/types/songs';
import type { MidiNote, LoopDefinition } from '@/types/loops';

// Context menu state
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  trackRef: SongTrackReference | null;
  trackName: string;
  trackType: 'audio' | 'loop';
}

// Loop copy dialog state
interface LoopCopyDialogState {
  isOpen: boolean;
  trackRef: SongTrackReference | null;
  trackDuration: number;
  copyCount: number;
}

// Drag state for moving track clips
interface DragState {
  isDragging: boolean;
  trackRefId: string | null;
  startX: number;
  originalOffset: number;
}

// Snap settings
const SNAP_THRESHOLD = 10; // pixels - how close before snapping

// Calculate snap points based on BPM and other tracks
function calculateSnapPoints(
  bpm: number,
  tracks: { startOffset: number; duration: number; id: string }[],
  currentTrackId: string,
  zoom: number
): { time: number; type: 'beat' | 'bar' | 'track-end' }[] {
  const snapPoints: { time: number; type: 'beat' | 'bar' | 'track-end' }[] = [];

  // Add beat/bar grid snap points
  const beatsPerSecond = bpm / 60;
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * 4; // Assume 4/4 time

  // Only add grid points that are reasonably spaced at current zoom
  const minPixelsBetweenPoints = 20;
  const minSecondsBetweenPoints = minPixelsBetweenPoints / zoom;

  // Add bar markers (higher priority snap points)
  for (let bar = 0; bar < 100; bar++) {
    const barTime = bar * secondsPerBar;
    if (barTime > 300) break; // Limit to 5 minutes
    snapPoints.push({ time: barTime, type: 'bar' });
  }

  // Add beat markers if zoom is high enough
  if (secondsPerBeat >= minSecondsBetweenPoints) {
    for (let beat = 0; beat < 400; beat++) {
      const beatTime = beat * secondsPerBeat;
      if (beatTime > 300) break;
      // Skip bar positions (already added)
      if (beat % 4 !== 0) {
        snapPoints.push({ time: beatTime, type: 'beat' });
      }
    }
  }

  // Add track end snap points (for seamless looping)
  tracks.forEach((track) => {
    if (track.id !== currentTrackId) {
      const trackEnd = track.startOffset + track.duration;
      snapPoints.push({ time: trackEnd, type: 'track-end' });
      snapPoints.push({ time: track.startOffset, type: 'track-end' });
    }
  });

  return snapPoints;
}

// Find nearest snap point
function findNearestSnap(
  offset: number,
  snapPoints: { time: number; type: 'beat' | 'bar' | 'track-end' }[],
  zoom: number,
  threshold: number
): { snappedOffset: number; snapType: 'beat' | 'bar' | 'track-end' | null } {
  let nearestSnap: { time: number; type: 'beat' | 'bar' | 'track-end' } | null = null;
  let nearestDistance = Infinity;

  // Prioritize track-end snaps, then bar, then beat
  const priorityOrder = { 'track-end': 0, 'bar': 1, 'beat': 2 };

  for (const point of snapPoints) {
    const distance = Math.abs(offset - point.time) * zoom;
    if (distance < threshold && distance < nearestDistance) {
      // Use priority to prefer track-end > bar > beat when distances are similar
      const priorityBonus = (threshold - distance) * 0.1 * (2 - priorityOrder[point.type]);
      const effectiveDistance = distance - priorityBonus;

      if (effectiveDistance < nearestDistance || (effectiveDistance === nearestDistance && priorityOrder[point.type] < priorityOrder[nearestSnap?.type || 'beat'])) {
        nearestSnap = point;
        nearestDistance = distance;
      }
    }
  }

  if (nearestSnap) {
    return { snappedOffset: nearestSnap.time, snapType: nearestSnap.type };
  }

  return { snappedOffset: offset, snapType: null };
}

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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    trackRef: null,
    trackName: '',
    trackType: 'audio',
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    trackRefId: null,
    startX: 0,
    originalOffset: 0,
  });
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragOffsetRef = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const [snapType, setSnapType] = useState<'beat' | 'bar' | 'track-end' | null>(null);
  const [loopCopyDialog, setLoopCopyDialog] = useState<LoopCopyDialogState>({
    isOpen: false,
    trackRef: null,
    trackDuration: 0,
    copyCount: 2,
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const { getCurrentSong } = useSongsStore();
  const { queue, setCurrentTrack } = useRoomStore();
  const { getTracksByRoom, removeTrack: removeLoopTrack } = useLoopTracksStore();
  const { isPlaying, currentTime, duration, setPlaying } = useAudioStore();

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

  // Handle scroll - ignore programmatic scrolls to avoid infinite loops
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }
    setScrollLeft(e.currentTarget.scrollLeft);
  }, []);

  // Handle zoom - allow minimum of 2 pixels per second (much more zoomed out)
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(200, z * 1.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(2, z / 1.25));
  }, []);

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, track: { ref: SongTrackReference; name: string; type: 'audio' | 'loop' }) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        trackRef: track.ref,
        trackName: track.name,
        trackType: track.type,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu.isOpen) {
      const handleClick = () => closeContextMenu();
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu.isOpen, closeContextMenu]);

  // Delete track handler - stops playback if needed
  const handleDeleteTrack = useCallback(() => {
    if (!contextMenu.trackRef) return;

    // Get current song from store state to avoid stale closures
    const { getCurrentSong, removeTrackFromSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const trackRef = contextMenu.trackRef;

    // Always stop playback when deleting a track to avoid orphaned state
    const { isPlaying: wasPlaying } = useAudioStore.getState();
    if (wasPlaying) {
      if (onStop) onStop();
      setPlaying(false);
    }

    // If this is an audio track and it's currently playing, clear current track
    const { currentTrack } = useRoomStore.getState();
    if (trackRef.type === 'audio' && currentTrack?.id === trackRef.trackId) {
      setCurrentTrack(null);
    }

    // Remove from song
    removeTrackFromSong(song.id, trackRef.id);

    // If it's a loop track, also remove from loop tracks store
    if (trackRef.type === 'loop') {
      removeLoopTrack(trackRef.trackId);
    }

    // Reset current time to avoid being past the end of remaining content
    const { setCurrentTime } = useAudioStore.getState();
    setCurrentTime(0);

    closeContextMenu();
  }, [contextMenu.trackRef, onStop, setPlaying, setCurrentTrack, removeLoopTrack, closeContextMenu]);

  // Toggle mute handler
  const handleToggleMute = useCallback(() => {
    if (!contextMenu.trackRef) return;

    // Get current song from store state to avoid stale closures
    const { getCurrentSong, updateTrackInSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    updateTrackInSong(song.id, contextMenu.trackRef.id, {
      muted: !contextMenu.trackRef.muted,
    });

    closeContextMenu();
  }, [contextMenu.trackRef, closeContextMenu]);

  // Duplicate track handler
  const handleDuplicateTrack = useCallback(() => {
    if (!contextMenu.trackRef) return;

    // Get current song from store state to avoid stale closures
    const { getCurrentSong, addTrackToSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const trackRef = contextMenu.trackRef;

    addTrackToSong(song.id, {
      type: trackRef.type,
      trackId: trackRef.trackId,
      startOffset: trackRef.startOffset + 1, // Offset slightly
      muted: trackRef.muted,
      volume: trackRef.volume,
    });

    closeContextMenu();
  }, [contextMenu.trackRef, closeContextMenu]);

  // Open loop copy dialog
  const handleOpenLoopCopyDialog = useCallback(() => {
    if (!contextMenu.trackRef) return;

    // Find the track duration
    const trackRef = contextMenu.trackRef;
    let duration = 0;

    if (trackRef.type === 'loop') {
      const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
      const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
      duration = getLoopDuration(loopDef);
    } else {
      const audioTrack = queue.tracks.find((t) => t.id === trackRef.trackId);
      duration = audioTrack?.duration || 0;
    }

    setLoopCopyDialog({
      isOpen: true,
      trackRef,
      trackDuration: duration,
      copyCount: 2,
    });
    closeContextMenu();
  }, [contextMenu.trackRef, loopTracks, queue.tracks, getLoopDuration, closeContextMenu]);

  // Execute loop copy
  const handleExecuteLoopCopy = useCallback(() => {
    if (!loopCopyDialog.trackRef || loopCopyDialog.copyCount < 1) return;

    const { getCurrentSong, addTrackToSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const trackRef = loopCopyDialog.trackRef;
    const duration = loopCopyDialog.trackDuration;
    const endOfOriginal = trackRef.startOffset + duration;

    // Create copies placed back-to-back after the original
    for (let i = 0; i < loopCopyDialog.copyCount; i++) {
      addTrackToSong(song.id, {
        type: trackRef.type,
        trackId: trackRef.trackId,
        startOffset: endOfOriginal + (i * duration),
        muted: trackRef.muted,
        volume: trackRef.volume,
      });
    }

    setLoopCopyDialog({
      isOpen: false,
      trackRef: null,
      trackDuration: 0,
      copyCount: 2,
    });
  }, [loopCopyDialog]);

  // Drag handlers for moving clips along timeline
  const handleDragStart = useCallback(
    (e: React.MouseEvent, trackRef: SongTrackReference) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        isDragging: true,
        trackRefId: trackRef.id,
        startX: e.clientX,
        originalOffset: trackRef.startOffset,
      });
      setDragOffset(trackRef.startOffset);
      dragOffsetRef.current = trackRef.startOffset;
    },
    []
  );

  // Build track info for snap calculations
  const trackInfoForSnap = useMemo(() => {
    return unifiedTracks.map((t) => ({
      startOffset: t.ref.startOffset,
      duration: t.duration,
      id: t.ref.id,
    }));
  }, [unifiedTracks]);

  // Handle drag move - use refs and getState() to avoid dependency loops
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;
      const rawOffset = Math.max(0, dragState.originalOffset + deltaTime);

      // Calculate snap points based on current song BPM
      const song = useSongsStore.getState().getCurrentSong();
      const bpm = song?.bpm || 120;

      const snapPoints = calculateSnapPoints(
        bpm,
        trackInfoForSnap,
        dragState.trackRefId || '',
        zoom
      );

      // Check if holding Shift to disable snapping
      const snapEnabled = !e.shiftKey;

      if (snapEnabled) {
        const { snappedOffset, snapType: newSnapType } = findNearestSnap(
          rawOffset,
          snapPoints,
          zoom,
          SNAP_THRESHOLD
        );
        setDragOffset(snappedOffset);
        dragOffsetRef.current = snappedOffset;
        setSnapType(newSnapType);
      } else {
        setDragOffset(rawOffset);
        dragOffsetRef.current = rawOffset;
        setSnapType(null);
      }
    };

    const handleMouseUp = () => {
      const finalOffset = dragOffsetRef.current;
      // Get current song from store state to avoid stale closure
      const { getCurrentSong, updateTrackInSong: updateTrack } = useSongsStore.getState();
      const song = getCurrentSong();

      if (dragState.trackRefId && song && finalOffset !== null) {
        // Update the track's start offset (already snapped, just round for precision)
        updateTrack(song.id, dragState.trackRefId, {
          startOffset: Math.round(finalOffset * 1000) / 1000, // Round to 0.001s
        });
      }
      setDragState({
        isDragging: false,
        trackRefId: null,
        startX: 0,
        originalOffset: 0,
      });
      setDragOffset(null);
      dragOffsetRef.current = null;
      setSnapType(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, trackInfoForSnap]);

  // Handle drag over for drop zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-track')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false if leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const trackData = e.dataTransfer.getData('application/x-track');
    if (!trackData) return;

    try {
      const { type, trackId } = JSON.parse(trackData) as {
        type: 'audio' | 'loop';
        trackId: string;
        name: string;
        duration: number;
      };

      // Calculate drop position in timeline
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left + scrollLeft - 96; // Account for track label width
      const dropTime = Math.max(0, x / zoom);

      // Get BPM for snapping
      const song = useSongsStore.getState().getCurrentSong();
      if (!song) return;

      const bpm = song.bpm || 120;
      const snapPoints = calculateSnapPoints(bpm, trackInfoForSnap, '', zoom);
      const { snappedOffset } = findNearestSnap(dropTime, snapPoints, zoom, SNAP_THRESHOLD);

      // Add track to song at drop position
      const { addTrackToSong } = useSongsStore.getState();
      addTrackToSong(song.id, {
        type,
        trackId,
        startOffset: snappedOffset,
      });
    } catch (err) {
      console.error('Failed to handle drop:', err);
    }
  }, [scrollLeft, zoom, trackInfoForSnap]);

  // Generate time markers - adapt intervals for all zoom levels
  const timeMarkers = useMemo(() => {
    const markers: { time: number; label: string }[] = [];
    // More granular intervals for different zoom levels
    const interval = zoom > 100 ? 1 : zoom > 50 ? 5 : zoom > 25 ? 10 : zoom > 10 ? 30 : zoom > 5 ? 60 : 120;

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
      isProgrammaticScroll.current = true;
      container.scrollLeft = playheadX - visibleWidth + 200;
    } else if (playheadX < scrollPosition) {
      isProgrammaticScroll.current = true;
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
        className={cn(
          'flex-1 overflow-x-auto overflow-y-auto relative transition-colors',
          isDragOver && 'bg-indigo-500/10 ring-2 ring-inset ring-indigo-500/50'
        )}
        onScroll={handleScroll}
        onClick={handleTimelineClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
              <div className={cn(
                'h-32 flex items-center justify-center border-2 border-dashed rounded-lg m-2 transition-colors',
                isDragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-gray-200 dark:border-zinc-700'
              )}>
                <div className="text-center">
                  <Layers className={cn(
                    'w-8 h-8 mx-auto mb-2 transition-colors',
                    isDragOver ? 'text-indigo-500' : 'text-gray-300 dark:text-zinc-700'
                  )} />
                  <p className={cn(
                    'text-sm transition-colors',
                    isDragOver ? 'text-indigo-500 font-medium' : 'text-gray-400 dark:text-zinc-600'
                  )}>
                    {isDragOver ? 'Drop to add track' : 'No tracks in song'}
                  </p>
                  <p className="text-xs text-gray-300 dark:text-zinc-700 mt-1">
                    {isDragOver ? 'Release to place at this position' : 'Drag tracks here or add from left panel'}
                  </p>
                </div>
              </div>
            ) : (
              unifiedTracks.map((track) => {
                const clipWidth = Math.max(track.duration * zoom, 40);
                // Use drag offset if this track is being dragged
                const isDraggingThis = dragState.isDragging && dragState.trackRefId === track.ref.id;
                const displayOffset = isDraggingThis && dragOffset !== null ? dragOffset : track.ref.startOffset;
                const clipLeft = displayOffset * zoom;

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
                        'absolute top-1 bottom-1 rounded-md overflow-hidden transition-opacity cursor-grab hover:ring-1 hover:ring-white/20',
                        track.muted ? 'opacity-40' : 'opacity-100',
                        isDraggingThis && 'cursor-grabbing z-20',
                        isDraggingThis && snapType === 'track-end' && 'ring-2 ring-green-500 shadow-lg shadow-green-500/30',
                        isDraggingThis && snapType === 'bar' && 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/30',
                        isDraggingThis && snapType === 'beat' && 'ring-2 ring-indigo-400 shadow-lg shadow-indigo-400/20',
                        isDraggingThis && !snapType && 'ring-2 ring-indigo-500'
                      )}
                      style={{
                        left: clipLeft + 96,
                        width: clipWidth,
                        backgroundColor: `${track.color}20`,
                        borderLeft: `3px solid ${track.color}`,
                      }}
                      onMouseDown={(e) => handleDragStart(e, track.ref)}
                      onContextMenu={(e) => handleContextMenu(e, track)}
                    >
                      {/* Snap indicator */}
                      {isDraggingThis && snapType && (
                        <div className={cn(
                          'absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap',
                          snapType === 'track-end' && 'bg-green-500 text-white',
                          snapType === 'bar' && 'bg-amber-500 text-white',
                          snapType === 'beat' && 'bg-indigo-400 text-white'
                        )}>
                          {snapType === 'track-end' ? 'Snap to track' : snapType === 'bar' ? 'Snap to bar' : 'Snap to beat'}
                        </div>
                      )}

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

      {/* Context Menu */}
      {contextMenu.isOpen && (
        <div
          className="fixed z-50 min-w-[160px] py-1 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800 truncate">
            {contextMenu.trackName}
          </div>

          <button
            onClick={handleToggleMute}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {contextMenu.trackRef?.muted ? (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Unmute</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span>Mute</span>
              </>
            )}
          </button>

          <button
            onClick={handleDuplicateTrack}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>Duplicate</span>
          </button>

          <button
            onClick={handleOpenLoopCopyDialog}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Repeat className="w-4 h-4" />
            <span>New Loop...</span>
          </button>

          <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />

          <button
            onClick={handleDeleteTrack}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Loop Copy Dialog */}
      {loopCopyDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 p-4 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-amber-500" />
              Create Loop Copies
            </h3>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1.5">
                Number of copies
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLoopCopyDialog((prev) => ({
                    ...prev,
                    copyCount: Math.max(1, prev.copyCount - 1),
                  }))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={loopCopyDialog.copyCount}
                  onChange={(e) => setLoopCopyDialog((prev) => ({
                    ...prev,
                    copyCount: Math.min(32, Math.max(1, parseInt(e.target.value) || 1)),
                  }))}
                  className="flex-1 h-8 px-3 text-center text-sm bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setLoopCopyDialog((prev) => ({
                    ...prev,
                    copyCount: Math.min(32, prev.copyCount + 1),
                  }))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1.5">
                {loopCopyDialog.copyCount} cop{loopCopyDialog.copyCount === 1 ? 'y' : 'ies'} × {loopCopyDialog.trackDuration.toFixed(1)}s = {(loopCopyDialog.copyCount * loopCopyDialog.trackDuration).toFixed(1)}s total
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLoopCopyDialog({
                  isOpen: false,
                  trackRef: null,
                  trackDuration: 0,
                  copyCount: 2,
                })}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteLoopCopy}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
