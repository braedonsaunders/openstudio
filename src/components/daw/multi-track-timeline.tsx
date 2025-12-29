'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSongsStore } from '@/stores/songs-store';
import { useRoomStore } from '@/stores/room-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
import { getLoopById } from '@/lib/audio/loop-library';
import { getCachedLoopById } from '@/hooks/use-loop-library';
import { generateWaveformFromUrl } from '@/lib/audio/waveform-generator';
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
  Pencil,
  Grid3X3,
} from 'lucide-react';
import type { SongTrackReference } from '@/types/songs';
import type { MidiNote, LoopDefinition, LoopTrackState } from '@/types/loops';
import { MainViewSwitcher, type MainViewType } from './main-view-switcher';
import { LoopCreatorModal } from '@/components/loops/loop-creator-modal';
import { useCustomLoopsStore } from '@/stores/custom-loops-store';

// Context menu state
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  trackRef: SongTrackReference | null;
  trackName: string;
  trackType: 'audio' | 'loop';
}

// Track row context menu state
interface TrackRowContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  position: number;
  name: string;
  clipIds: string[];
}

// Loop copy dialog state
interface LoopCopyDialogState {
  isOpen: boolean;
  trackRef: SongTrackReference | null;
  trackDuration: number;
  copyCount: number;
}

// Drag state for moving track clips (horizontal and vertical)
interface DragState {
  isDragging: boolean;
  trackRefId: string | null;
  startX: number;
  startY: number;
  originalOffset: number;
  originalPosition: number; // Track row position
  currentTargetRow: number | null; // Row being hovered over during drag
}

// Layout constants
const TRACK_LABEL_WIDTH = 160; // w-40 = 160px for track labels with mixer controls
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
  // View switcher props
  activeView?: MainViewType;
  onViewChange?: (view: MainViewType) => void;
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
  activeView,
  onViewChange,
}: MultiTrackTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(10); // pixels per second - start zoomed out
  const [scrollLeft, setScrollLeft] = useState(0);
  const hasSetInitialZoom = useRef(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    trackRef: null,
    trackName: '',
    trackType: 'audio',
  });
  const [trackRowContextMenu, setTrackRowContextMenu] = useState<TrackRowContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    position: 0,
    name: '',
    clipIds: [],
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    trackRefId: null,
    startX: 0,
    startY: 0,
    originalOffset: 0,
    originalPosition: 0,
    currentTargetRow: null,
  });
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragOffsetRef = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const userScrolledRecently = useRef(false);
  const userScrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const [snapType, setSnapType] = useState<'beat' | 'bar' | 'track-end' | null>(null);
  const [isPlayheadDragging, setIsPlayheadDragging] = useState(false);

  // Track row height constant - increased to accommodate mixer controls
  const trackHeight = 64;
  const [loopCopyDialog, setLoopCopyDialog] = useState<LoopCopyDialogState>({
    isOpen: false,
    trackRef: null,
    trackDuration: 0,
    copyCount: 2,
  });
  const [isDragOver, setIsDragOver] = useState(false);

  // Loop editor state
  const [loopEditorState, setLoopEditorState] = useState<{
    isOpen: boolean;
    loopId: string | null;
    loopTrackId: string | null;
  }>({
    isOpen: false,
    loopId: null,
    loopTrackId: null,
  });

  // Waveform data cache by track URL
  const [waveformDataCache, setWaveformDataCache] = useState<Map<string, number[]>>(new Map());

  // Gridlines visibility
  const [showGridlines, setShowGridlines] = useState(true);

  // Container width for responsive timeline
  const [containerWidth, setContainerWidth] = useState(800);

  const { getCurrentSong } = useSongsStore();
  const { queue, setCurrentTrack } = useRoomStore();
  const { getTracksByRoom } = useLoopTracksStore();
  const { isPlaying, currentTime, duration, setPlaying } = useAudioStore();
  const sessionTempo = useSessionTempoStore((s) => s.tempo);
  const { getLoop: getCustomLoop } = useCustomLoopsStore();

  const currentSong = getCurrentSong();
  const loopTracks = getTracksByRoom(roomId);
  const previousSongIdRef = useRef<string | null>(null);

  // Reset playback state when song changes
  useEffect(() => {
    const songId = currentSong?.id || null;
    if (previousSongIdRef.current !== null && previousSongIdRef.current !== songId) {
      // Song changed - reset playback state
      const { setCurrentTime, setPlaying: setPlayingState } = useAudioStore.getState();
      setPlayingState(false);
      setCurrentTime(0);
      if (onStop) onStop();
      // Reset zoom tracking for new song
      hasSetInitialZoom.current = false;
    }
    previousSongIdRef.current = songId;
  }, [currentSong?.id, onStop]);

  // Calculate loop duration using session tempo (loops auto-adjust unless tempo-locked)
  const getLoopDuration = useCallback((loopDef: LoopDefinition | undefined, tempoLocked = false): number => {
    if (!loopDef) return 0;
    const effectiveBpm = tempoLocked ? loopDef.bpm : sessionTempo;
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / effectiveBpm) * 60;
  }, [sessionTempo]);

  // Build unified track list with all resolved data
  const unifiedTracks = useMemo(() => {
    if (!currentSong) return [];

    return currentSong.tracks.map((trackRef) => {
      if (trackRef.type === 'loop') {
        const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
        // Check: 1) cached library (database-fetched), 2) custom loops store, 3) hardcoded library
        let loopDef = loopTrack ? getCachedLoopById(loopTrack.loopId) : undefined;
        if (!loopDef && loopTrack) {
          loopDef = getCustomLoop(loopTrack.loopId);
        }
        const loopDuration = getLoopDuration(loopDef, loopTrack?.tempoLocked);
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
      } else if (trackRef.type === 'lyria') {
        // Lyria tracks are infinite duration - use a large placeholder
        return {
          ref: trackRef,
          type: 'lyria' as const,
          name: trackRef.lyriaConfig?.customPrompt || 'AI Live Music',
          duration: Infinity, // Lyria is infinite
          color: '#a855f7', // Purple for AI
          muted: trackRef.muted || false,
          lyriaConfig: trackRef.lyriaConfig,
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
          audioUrl: audioTrack?.url,
          waveformData: audioTrack?.url ? waveformDataCache.get(audioTrack.url) : undefined,
        };
      }
    });
  }, [currentSong, loopTracks, queue.tracks, getLoopDuration, waveformDataCache, getCustomLoop]);

  // Group tracks by position (track row) for rendering multiple clips on same row
  const trackRows = useMemo(() => {
    const rows = new Map<number, typeof unifiedTracks>();

    unifiedTracks.forEach((track) => {
      const position = track.ref.position;
      if (!rows.has(position)) {
        rows.set(position, []);
      }
      rows.get(position)!.push(track);
    });

    // Sort rows by position and return as array
    return Array.from(rows.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([position, clips]) => {
        // Aggregate mute/solo/volume from clips in this row
        // If ANY clip is muted, show as muted; if ANY is solo'd, show as solo
        const anyMuted = clips.some((c) => c.ref.muted);
        const anySolo = clips.some((c) => c.ref.solo);
        // Use first clip's volume as representative (or average)
        const avgVolume = clips.reduce((sum, c) => sum + (c.ref.volume ?? 1), 0) / clips.length;

        return {
          position,
          clips,
          // Use first clip's properties for row metadata
          name: clips[0]?.name || 'Track',
          color: clips[0]?.color || '#6366f1',
          type: clips[0]?.type || 'audio',
          // Row-level mixer state
          muted: anyMuted,
          solo: anySolo,
          volume: avgVolume,
        };
      });
  }, [unifiedTracks]);

  // Generate waveforms for audio tracks that don't have waveform data yet
  useEffect(() => {
    const audioTracks = unifiedTracks.filter(
      (track) => track.type === 'audio' && track.audioUrl && !waveformDataCache.has(track.audioUrl)
    );

    if (audioTracks.length === 0) return;

    // Generate waveforms for each audio track
    audioTracks.forEach((track) => {
      if (!track.audioUrl) return;
      const url = track.audioUrl;

      generateWaveformFromUrl(url, 200)
        .then((waveform) => {
          if (waveform.length > 0) {
            setWaveformDataCache((prev) => {
              const next = new Map(prev);
              next.set(url, waveform);
              return next;
            });
          }
        })
        .catch((err) => {
          console.error('[MultiTrackTimeline] Failed to generate waveform:', err);
        });
    });
  }, [unifiedTracks, waveformDataCache]);

  // Track container size with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width - TRACK_LABEL_WIDTH; // Account for track labels
        setContainerWidth(Math.max(400, width));
      }
    });

    observer.observe(containerRef.current);
    // Set initial width
    setContainerWidth(Math.max(400, containerRef.current.clientWidth - TRACK_LABEL_WIDTH));

    return () => observer.disconnect();
  }, []);

  // Track count for auto-zoom detection
  const prevTrackCountRef = useRef(0);

  // Auto-zoom to fit content when tracks are added
  useEffect(() => {
    if (!containerRef.current) return;

    const trackCount = unifiedTracks.length;
    const prevCount = prevTrackCountRef.current;
    prevTrackCountRef.current = trackCount;

    // Zoom to fit when:
    // 1. First track is added (hasSetInitialZoom is false)
    // 2. New tracks are added (count increased)
    const shouldZoom = !hasSetInitialZoom.current || (trackCount > prevCount && trackCount > 0);

    if (!shouldZoom || trackCount === 0) return;

    // Calculate max end time
    let maxEndTime = 0;
    unifiedTracks.forEach((track) => {
      const endTime = track.ref.startOffset + track.duration;
      maxEndTime = Math.max(maxEndTime, endTime);
    });

    if (maxEndTime > 0) {
      // Zoom to fit content with some padding
      const idealZoom = containerWidth / (maxEndTime * 1.1);
      // Clamp zoom to reasonable range (10-200 pixels per second)
      const newZoom = Math.min(200, Math.max(10, idealZoom));
      setZoom(newZoom);
      hasSetInitialZoom.current = true;
    }
  }, [unifiedTracks, containerWidth]);

  // Check if this is a Lyria-only song (infinite duration)
  const isLyriaSong = useMemo(() => {
    return unifiedTracks.length > 0 && unifiedTracks.some(t => t.type === 'lyria');
  }, [unifiedTracks]);

  // Calculate total song duration
  const songDuration = useMemo(() => {
    if (unifiedTracks.length === 0) return duration || 60;

    // If it's a Lyria-only song, use a fixed display duration
    const hasOnlyLyria = unifiedTracks.every(t => t.type === 'lyria');
    if (hasOnlyLyria) {
      // Use 5 minutes as the display duration for Lyria songs
      return 300;
    }

    let maxDuration = 0;
    unifiedTracks.forEach((track) => {
      // Skip Lyria tracks for duration calculation (they're infinite)
      if (track.type === 'lyria') return;
      const endTime = track.ref.startOffset + track.duration;
      maxDuration = Math.max(maxDuration, endTime);
    });

    return maxDuration || duration || 60;
  }, [unifiedTracks, duration]);

  // Timeline width should be at least the container width or the content width
  const timelineWidth = Math.max(songDuration * zoom, containerWidth + TRACK_LABEL_WIDTH, 800);

  // Get track icon
  const getTrackIcon = (track: typeof unifiedTracks[0]) => {
    if (track.type === 'lyria') return <Sparkles className="w-3 h-3" />;
    if (track.type === 'loop') return <Repeat className="w-3 h-3" />;
    if (track.youtubeId) return <Youtube className="w-3 h-3" />;
    if (track.aiGenerated) return <Sparkles className="w-3 h-3" />;
    return <Music className="w-3 h-3" />;
  };

  // Handle timeline click to seek - accurate positioning without snapping
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onSeek || !containerRef.current) return;

      // Don't seek if clicking on a track clip (handled by drag)
      const target = e.target as HTMLElement;
      if (target.closest('[data-track-clip]')) return;
      if (target.closest('[data-playhead]')) return;

      const rect = containerRef.current.getBoundingClientRect();
      // Account for the 96px track label width offset
      const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
      const time = Math.max(0, x / zoom);
      // Precise seek - no rounding or snapping
      onSeek(Math.min(songDuration, time));
    },
    [onSeek, scrollLeft, zoom, songDuration]
  );

  // Playhead drag handler - for precise seeking by dragging the playhead
  const handlePlayheadDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlayheadDragging(true);
  }, []);

  // Playhead drag effect
  useEffect(() => {
    if (!isPlayheadDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!onSeek || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
      const time = Math.max(0, Math.min(songDuration, x / zoom));

      // Update time immediately for responsive feel
      onSeek(time);
    };

    const handleMouseUp = () => {
      setIsPlayheadDragging(false);
    };

    // Use capture phase for smoother dragging
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, [isPlayheadDragging, onSeek, scrollLeft, zoom, songDuration]);

  // Handle scroll - track user scrolling to disable auto-follow
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }
    setScrollLeft(e.currentTarget.scrollLeft);

    // Mark that user scrolled manually - disable auto-follow for 3 seconds
    userScrolledRecently.current = true;
    if (userScrollTimeout.current) {
      clearTimeout(userScrollTimeout.current);
    }
    userScrollTimeout.current = setTimeout(() => {
      userScrolledRecently.current = false;
    }, 3000);
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

  // Track row context menu handler
  const handleTrackRowContextMenu = useCallback(
    (e: React.MouseEvent, row: { position: number; name: string; clips: typeof unifiedTracks }) => {
      e.preventDefault();
      e.stopPropagation();
      setTrackRowContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        position: row.position,
        name: row.name,
        clipIds: row.clips.map((c) => c.ref.id),
      });
    },
    []
  );

  const closeTrackRowContextMenu = useCallback(() => {
    setTrackRowContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Delete entire track row
  const handleDeleteTrackRow = useCallback(() => {
    if (trackRowContextMenu.clipIds.length === 0) return;

    const { getCurrentSong, removeTrackFromSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    // Stop playback when deleting tracks
    const { isPlaying: wasPlaying } = useAudioStore.getState();
    if (wasPlaying) {
      if (onStop) onStop();
      setPlaying(false);
    }

    // Remove all clips in this row (only from song, not from asset library)
    for (const clipId of trackRowContextMenu.clipIds) {
      const trackRef = song.tracks.find((t) => t.id === clipId);
      if (trackRef) {
        removeTrackFromSong(song.id, clipId);
        // NOTE: We do NOT remove from loop-tracks-store or room-store.queue
        // Those are the "asset libraries" - timeline clips are just references
      }
    }

    // Reset current time
    const { setCurrentTime } = useAudioStore.getState();
    setCurrentTime(0);

    closeTrackRowContextMenu();
  }, [trackRowContextMenu.clipIds, onStop, setPlaying, closeTrackRowContextMenu]);

  // Close context menu on click outside
  useEffect(() => {
    if (contextMenu.isOpen || trackRowContextMenu.isOpen) {
      const handleClick = () => {
        closeContextMenu();
        closeTrackRowContextMenu();
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu.isOpen, trackRowContextMenu.isOpen, closeContextMenu, closeTrackRowContextMenu]);

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

    // Remove from song (only the reference, not the underlying asset)
    removeTrackFromSong(song.id, trackRef.id);
    // NOTE: We do NOT remove from loop-tracks-store or room-store.queue
    // Those are the "asset libraries" - timeline clips are just references

    // Reset current time to avoid being past the end of remaining content
    const { setCurrentTime } = useAudioStore.getState();
    setCurrentTime(0);

    closeContextMenu();
  }, [contextMenu.trackRef, onStop, setPlaying, setCurrentTrack, closeContextMenu]);

  // Toggle mute handler (for context menu)
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

  // Edit loop handler - opens the loop editor modal
  const handleEditLoop = useCallback(async () => {
    if (!contextMenu.trackRef || contextMenu.trackRef.type !== 'loop') return;

    // Find the loop track
    const loopTrack = loopTracks.find((t) => t.id === contextMenu.trackRef!.trackId);
    if (!loopTrack) return;

    // Check if it's a custom loop by looking in the custom loops store
    const { duplicateLoop, getLoop } = useCustomLoopsStore.getState();
    const existingCustomLoop = getLoop(loopTrack.loopId);

    if (existingCustomLoop) {
      // It's already a custom loop - edit directly
      setLoopEditorState({
        isOpen: true,
        loopId: loopTrack.loopId,
        loopTrackId: loopTrack.id,
      });
    } else {
      // It's a built-in loop - duplicate it first to make it editable
      const newCustomLoop = await duplicateLoop(loopTrack.loopId);
      if (newCustomLoop) {
        // Update the loop track to use the new custom loop
        useLoopTracksStore.getState().updateTrack(loopTrack.id, {
          loopId: newCustomLoop.id,
        });
        // Open the editor with the new custom loop
        setLoopEditorState({
          isOpen: true,
          loopId: newCustomLoop.id,
          loopTrackId: loopTrack.id,
        });
      }
    }

    closeContextMenu();
  }, [contextMenu.trackRef, loopTracks, closeContextMenu]);

  // Toggle mute for all clips in a row
  const handleRowMute = useCallback((row: { clips: typeof unifiedTracks; muted: boolean }) => {
    const { getCurrentSong, updateTrackInSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const newMuted = !row.muted;
    for (const clip of row.clips) {
      updateTrackInSong(song.id, clip.ref.id, { muted: newMuted });
    }
  }, []);

  // Toggle solo for all clips in a row
  const handleRowSolo = useCallback((row: { clips: typeof unifiedTracks; solo: boolean }) => {
    const { getCurrentSong, updateTrackInSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const newSolo = !row.solo;
    for (const clip of row.clips) {
      updateTrackInSong(song.id, clip.ref.id, { solo: newSolo });
    }
  }, []);

  // Set volume for all clips in a row
  const handleRowVolume = useCallback((row: { clips: typeof unifiedTracks }, volume: number) => {
    const { getCurrentSong, updateTrackInSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    for (const clip of row.clips) {
      updateTrackInSong(song.id, clip.ref.id, { volume });
    }
  }, []);

  // Duplicate track handler - keeps clip on same track row
  const handleDuplicateTrack = useCallback(() => {
    if (!contextMenu.trackRef) return;

    // Get current song from store state to avoid stale closures
    const { getCurrentSong, updateSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const trackRef = contextMenu.trackRef;

    // Find the duration of this track
    let trackDuration = 0;
    if (trackRef.type === 'loop') {
      const loopTrack = loopTracks.find((t) => t.id === trackRef.trackId);
      const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
      trackDuration = getLoopDuration(loopDef);
    } else {
      const audioTrack = queue.tracks.find((t) => t.id === trackRef.trackId);
      trackDuration = audioTrack?.duration || 0;
    }

    // Place duplicate immediately after the original
    const newTrack: SongTrackReference = {
      id: crypto.randomUUID(),
      type: trackRef.type,
      trackId: trackRef.trackId,
      position: trackRef.position, // SAME track row
      startOffset: trackRef.startOffset + trackDuration, // Place after original
      muted: trackRef.muted,
      volume: trackRef.volume,
    };

    // Add to song tracks directly to preserve position
    updateSong(song.id, {
      tracks: [...song.tracks, newTrack],
    });

    closeContextMenu();
  }, [contextMenu.trackRef, loopTracks, queue.tracks, getLoopDuration, closeContextMenu]);

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

  // Execute loop copy - keeps clips on same track row
  const handleExecuteLoopCopy = useCallback(() => {
    if (!loopCopyDialog.trackRef || loopCopyDialog.copyCount < 1) return;

    const { getCurrentSong, updateSong } = useSongsStore.getState();
    const song = getCurrentSong();
    if (!song) return;

    const trackRef = loopCopyDialog.trackRef;
    const duration = loopCopyDialog.trackDuration;
    const endOfOriginal = trackRef.startOffset + duration;

    // Create copies placed back-to-back after the original - same track row
    const newTracks: SongTrackReference[] = [];
    for (let i = 0; i < loopCopyDialog.copyCount; i++) {
      newTracks.push({
        id: crypto.randomUUID(),
        type: trackRef.type,
        trackId: trackRef.trackId,
        position: trackRef.position, // SAME track row
        startOffset: endOfOriginal + (i * duration),
        muted: trackRef.muted,
        volume: trackRef.volume,
      });
    }

    // Add to song tracks directly to preserve position
    updateSong(song.id, {
      tracks: [...song.tracks, ...newTracks],
    });

    setLoopCopyDialog({
      isOpen: false,
      trackRef: null,
      trackDuration: 0,
      copyCount: 2,
    });
  }, [loopCopyDialog]);

  // Drag handlers for moving clips along timeline and between track rows
  const handleDragStart = useCallback(
    (e: React.MouseEvent, trackRef: SongTrackReference) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({
        isDragging: true,
        trackRefId: trackRef.id,
        startX: e.clientX,
        startY: e.clientY,
        originalOffset: trackRef.startOffset,
        originalPosition: trackRef.position,
        currentTargetRow: trackRef.position,
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
      // Horizontal dragging
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;
      const rawOffset = Math.max(0, dragState.originalOffset + deltaTime);

      // Use session tempo for snap calculations
      const bpm = useSessionTempoStore.getState().tempo;

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

      // Vertical dragging - calculate target row
      const deltaY = e.clientY - dragState.startY;
      const rowDelta = Math.round(deltaY / trackHeight);
      const newTargetRow = Math.max(0, dragState.originalPosition + rowDelta);

      if (newTargetRow !== dragState.currentTargetRow) {
        setDragState((prev) => ({
          ...prev,
          currentTargetRow: newTargetRow,
        }));
      }
    };

    const handleMouseUp = () => {
      const finalOffset = dragOffsetRef.current;
      const finalRow = dragState.currentTargetRow;

      // Get current song from store state to avoid stale closure
      const { getCurrentSong, updateTrackInSong: updateTrack } = useSongsStore.getState();
      const song = getCurrentSong();

      if (dragState.trackRefId && song && finalOffset !== null) {
        // Update the track's start offset and position (row)
        const updates: { startOffset?: number; position?: number } = {
          startOffset: Math.round(finalOffset * 1000) / 1000, // Round to 0.001s
        };

        // Only update position if it changed
        if (finalRow !== null && finalRow !== dragState.originalPosition) {
          updates.position = finalRow;
        }

        updateTrack(song.id, dragState.trackRefId, updates);
      }
      setDragState({
        isDragging: false,
        trackRefId: null,
        startX: 0,
        startY: 0,
        originalOffset: 0,
        originalPosition: 0,
        currentTargetRow: null,
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
  }, [dragState, zoom, trackInfoForSnap, trackHeight]);

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

      const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH; // Account for track label width
      const dropTime = Math.max(0, x / zoom);

      // Get song and use session tempo for snapping
      const song = useSongsStore.getState().getCurrentSong();
      if (!song) return;

      const bpm = useSessionTempoStore.getState().tempo;
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

  // Keep playhead visible during playback (only if user hasn't scrolled manually)
  useEffect(() => {
    if (!containerRef.current || !isPlaying || userScrolledRecently.current) return;

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

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0a0a0f] border-b border-gray-200 dark:border-white/5">
      {/* Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            {currentSong?.name || 'No Song Selected'}
          </span>
          {isLyriaSong ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded-full">
              <Sparkles className="w-2.5 h-2.5" />
              ∞ Live
            </span>
          ) : (
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">
              {trackRows.length} track{trackRows.length !== 1 ? 's' : ''}, {unifiedTracks.length} clip{unifiedTracks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Gridlines toggle */}
          <button
            onClick={() => setShowGridlines(!showGridlines)}
            className={cn(
              'p-1 rounded transition-colors',
              showGridlines
                ? 'text-indigo-500 bg-indigo-500/10'
                : 'text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/10'
            )}
            title={showGridlines ? 'Hide grid' : 'Show grid'}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>

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
          <div
            className="h-5 sticky top-0 bg-gray-50 dark:bg-[#0d0d14] border-b border-gray-200 dark:border-white/10 z-10"
            style={{ width: timelineWidth, minWidth: '100%' }}
          >
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
            {/* Gridlines - render behind content */}
            {showGridlines && trackRows.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ left: TRACK_LABEL_WIDTH }}
              >
                {/* Bar lines (every bar) */}
                {Array.from({ length: Math.ceil(songDuration / (60 / (currentSong?.bpm || 120) * 4)) + 1 }).map((_, i) => {
                  const barDuration = (60 / (currentSong?.bpm || 120)) * 4; // 4 beats per bar
                  const x = i * barDuration * zoom;
                  return (
                    <div
                      key={`bar-${i}`}
                      className="absolute top-0 bottom-0 w-px bg-gray-200/50 dark:bg-zinc-700/30"
                      style={{ left: x }}
                    />
                  );
                })}
                {/* Beat lines (every beat, lighter) */}
                {Array.from({ length: Math.ceil(songDuration / (60 / (currentSong?.bpm || 120))) + 1 }).map((_, i) => {
                  const beatDuration = 60 / (currentSong?.bpm || 120);
                  const x = i * beatDuration * zoom;
                  // Skip bar positions (every 4th beat)
                  if (i % 4 === 0) return null;
                  return (
                    <div
                      key={`beat-${i}`}
                      className="absolute top-0 bottom-0 w-px bg-gray-100/30 dark:bg-zinc-800/20"
                      style={{ left: x }}
                    />
                  );
                })}
              </div>
            )}

            {trackRows.length === 0 ? (
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
              trackRows.map((row) => (
                <div
                  key={`row-${row.position}`}
                  className="relative border-b border-gray-100 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                  style={{ height: trackHeight }}
                >
                  {/* Track label on left - with mixer controls */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-40 flex flex-col justify-center gap-0.5 px-2 py-1 bg-gray-50/80 dark:bg-[#0d0d14]/80 border-r border-gray-100 dark:border-white/5 z-10"
                    onContextMenu={(e) => handleTrackRowContextMenu(e, row)}
                  >
                    {/* Top row: icon + name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: row.color, color: 'white' }}
                      >
                        {getTrackIcon(row.clips[0])}
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 truncate flex-1">
                        {row.name}
                      </span>
                      {row.clips.length > 1 && (
                        <span className="text-[9px] text-gray-400 dark:text-zinc-500 shrink-0">
                          ×{row.clips.length}
                        </span>
                      )}
                    </div>

                    {/* Bottom row: mute, solo, volume */}
                    <div className="flex items-center gap-1">
                      {/* Mute button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowMute(row);
                        }}
                        className={cn(
                          'w-6 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-colors shrink-0',
                          row.muted
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-600'
                        )}
                        title="Mute"
                      >
                        M
                      </button>

                      {/* Solo button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowSolo(row);
                        }}
                        className={cn(
                          'w-6 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-colors shrink-0',
                          row.solo
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-600'
                        )}
                        title="Solo"
                      >
                        S
                      </button>

                      {/* Volume slider */}
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.01"
                        value={row.volume}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleRowVolume(row, parseFloat(e.target.value));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 h-1 ml-1 bg-gray-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer shrink-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-500 dark:[&::-webkit-slider-thumb]:bg-zinc-400"
                        title={`Volume: ${Math.round(row.volume * 100)}%`}
                      />
                    </div>
                  </div>

                  {/* All clips on this row */}
                  {row.clips.map((track) => {
                    // For Lyria tracks, extend to fill the visible timeline
                    const isLyriaTrack = track.type === 'lyria';
                    const clipWidth = isLyriaTrack
                      ? Math.max(timelineWidth - TRACK_LABEL_WIDTH, containerWidth)
                      : Math.max(track.duration * zoom, 40);
                    const isDraggingThis = dragState.isDragging && dragState.trackRefId === track.ref.id;
                    const displayOffset = isDraggingThis && dragOffset !== null ? dragOffset : track.ref.startOffset;
                    const clipLeft = displayOffset * zoom;

                    return (
                      <div
                        key={track.ref.id}
                        data-track-clip
                        className={cn(
                          'absolute top-1 bottom-1 rounded-md overflow-hidden transition-opacity',
                          // Lyria tracks are not draggable (they're infinite)
                          !isLyriaTrack && 'cursor-grab hover:ring-1 hover:ring-white/20',
                          isLyriaTrack && 'cursor-default',
                          track.muted ? 'opacity-40' : 'opacity-100',
                          isDraggingThis && 'cursor-grabbing z-20',
                          isDraggingThis && snapType === 'track-end' && 'ring-2 ring-green-500 shadow-lg shadow-green-500/30',
                          isDraggingThis && snapType === 'bar' && 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/30',
                          isDraggingThis && snapType === 'beat' && 'ring-2 ring-indigo-400 shadow-lg shadow-indigo-400/20',
                          isDraggingThis && !snapType && 'ring-2 ring-indigo-500'
                        )}
                        style={{
                          left: clipLeft + TRACK_LABEL_WIDTH,
                          width: clipWidth,
                          backgroundColor: isLyriaTrack ? `${track.color}10` : `${track.color}20`,
                          borderLeft: `3px solid ${track.color}`,
                        }}
                        onMouseDown={(e) => !isLyriaTrack && handleDragStart(e, track.ref)}
                        onContextMenu={(e) => !isLyriaTrack && handleContextMenu(e, track)}
                      >
                        {/* Snap indicator */}
                        {isDraggingThis && snapType && (
                          <div className={cn(
                            'absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap z-30',
                            snapType === 'track-end' && 'bg-green-500 text-white',
                            snapType === 'bar' && 'bg-amber-500 text-white',
                            snapType === 'beat' && 'bg-indigo-400 text-white'
                          )}>
                            {snapType === 'track-end' ? 'Snap to track' : snapType === 'bar' ? 'Snap to bar' : 'Snap to beat'}
                          </div>
                        )}

                        {/* Content visualization */}
                        {track.type === 'lyria' ? (
                          // Lyria infinite track visualization
                          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                            {/* Animated gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-purple-500/20 animate-pulse" />
                            {/* Infinite symbol and label */}
                            <div className="relative z-10 flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-full backdrop-blur-sm">
                              <Sparkles className="w-3 h-3 text-purple-400" />
                              <span className="text-[10px] font-medium text-purple-400">∞ AI Live Music</span>
                            </div>
                            {/* Decorative pattern */}
                            <div className="absolute inset-0 opacity-30">
                              {Array.from({ length: 20 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="absolute w-1 rounded-full bg-purple-500/40"
                                  style={{
                                    left: `${i * 5 + 2}%`,
                                    top: `${20 + Math.sin(i * 0.5) * 30}%`,
                                    height: `${40 + Math.sin(i * 0.7) * 20}%`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ) : track.type === 'loop' && track.loopDef ? (
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
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Playhead - draggable for seeking */}
          <div
            data-playhead
            className={cn(
              'absolute top-0 bottom-0 z-30 group',
              isPlayheadDragging ? 'cursor-grabbing' : 'cursor-grab'
            )}
            style={{ left: currentTime * zoom + TRACK_LABEL_WIDTH - 6 }}
            onMouseDown={handlePlayheadDragStart}
          >
            {/* Wider hit area for easier grabbing */}
            <div className="absolute inset-0 w-3 -ml-0" />
            {/* Visible playhead line */}
            <div className={cn(
              'absolute left-1.5 top-0 bottom-0 w-0.5 transition-colors',
              isPlayheadDragging ? 'bg-red-400' : 'bg-red-500 group-hover:bg-red-400'
            )} />
            {/* Playhead handle */}
            <div className={cn(
              'w-3 h-3 bg-red-500 rounded-sm rotate-45 transition-all',
              isPlayheadDragging && 'scale-125 bg-red-400',
              'group-hover:scale-110'
            )} style={{ marginTop: '12px' }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      {currentSong && (
        <div className="h-6 px-3 flex items-center justify-between border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0d0d14] shrink-0">
          <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
            {isLyriaSong ? (
              <span className="flex items-center gap-1">
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                <span className="text-purple-400">/ ∞</span>
              </span>
            ) : (
              <span>
                {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(songDuration / 60)}:{Math.floor(songDuration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {isLyriaSong && <span className="text-purple-500">● Lyria</span>}
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

          {/* Edit Loop - only shown for loop clips */}
          {contextMenu.trackRef?.type === 'loop' && (
            <button
              onClick={handleEditLoop}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-amber-600 dark:text-amber-400"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Loop</span>
            </button>
          )}

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

      {/* Track Row Context Menu */}
      {trackRowContextMenu.isOpen && (
        <div
          className="fixed z-50 min-w-40 py-1 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700"
          style={{
            left: trackRowContextMenu.x,
            top: trackRowContextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800 truncate">
            Track: {trackRowContextMenu.name}
          </div>

          <button
            onClick={handleDeleteTrackRow}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Track ({trackRowContextMenu.clipIds.length} clip{trackRowContextMenu.clipIds.length !== 1 ? 's' : ''})</span>
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

      {/* Loop Editor Modal */}
      <LoopCreatorModal
        isOpen={loopEditorState.isOpen}
        onClose={() => setLoopEditorState({ isOpen: false, loopId: null, loopTrackId: null })}
        editingLoopId={loopEditorState.loopId || undefined}
        onSave={(savedLoop) => {
          // Update the loop track to use the saved loop's MIDI data
          if (loopEditorState.loopTrackId) {
            useLoopTracksStore.getState().updateTrack(loopEditorState.loopTrackId, {
              loopId: savedLoop.id,
            });
          }
          setLoopEditorState({ isOpen: false, loopId: null, loopTrackId: null });
        }}
      />
    </div>
  );
}
