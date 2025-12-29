// Song Types - Groups of tracks (audio + loops) that play together

import type { BackingTrack } from './index';
import type { LoopTrackState } from './loops';
import type { LyriaStyleId, LyriaMoodId } from '@/lib/ai/lyria';

// =============================================================================
// Lyria Track Configuration - for AI-generated music tracks
// =============================================================================

export interface LyriaTrackConfig {
  // Style and mood settings
  styleId: LyriaStyleId;
  moodId: LyriaMoodId | null;
  customPrompt?: string;

  // Generation controls
  density: number;
  brightness: number;
  drums: number;
  bass: number;
  temperature: number;
}

// Default Lyria config for new tracks
export const DEFAULT_LYRIA_CONFIG: LyriaTrackConfig = {
  styleId: 'jazz',
  moodId: 'chill',
  density: 0.5,
  brightness: 0.5,
  drums: 0.7,
  bass: 0.7,
  temperature: 0.5,
};

// =============================================================================
// Song Track Reference - unified reference to audio, loop, or lyria track
// =============================================================================

export type SongTrackType = 'audio' | 'loop' | 'lyria';

export interface SongTrackReference {
  id: string;
  type: SongTrackType;
  trackId: string; // Reference to BackingTrack.id, LoopTrackState.id, or 'lyria-{id}' for Lyria
  position: number; // Order in the song's track list
  startOffset: number; // When this track starts (in seconds from song start)
  // Overrides (if different from source track)
  volume?: number;
  muted?: boolean;
  solo?: boolean;
  // Lyria-specific config (only for type='lyria')
  lyriaConfig?: LyriaTrackConfig;
}

// =============================================================================
// Song Definition - A group of tracks that play together
// =============================================================================

export interface Song {
  id: string;
  roomId: string;
  name: string;

  // Track references (audio files + loops combined)
  tracks: SongTrackReference[];

  // Song-level settings
  bpm: number;
  key?: string;
  timeSignature: [number, number];

  // Duration (calculated from longest track + offset)
  duration: number;

  // Metadata
  color: string;
  position: number; // Order in setlist

  // Creator info
  createdBy: string;
  createdByName?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Setlist - ordered collection of songs
// =============================================================================

export interface Setlist {
  roomId: string;
  songs: Song[];
  currentSongId: string | null;
  currentSongIndex: number;
}

// =============================================================================
// Song Events for real-time sync
// =============================================================================

export interface SongAddEvent {
  type: 'song:add';
  song: Song;
}

export interface SongRemoveEvent {
  type: 'song:remove';
  songId: string;
}

export interface SongUpdateEvent {
  type: 'song:update';
  songId: string;
  changes: Partial<Song>;
}

export interface SongSelectEvent {
  type: 'song:select';
  songId: string;
}

export interface SongReorderEvent {
  type: 'song:reorder';
  songIds: string[]; // New order
}

export interface SetlistSyncEvent {
  type: 'setlist:sync';
  songs: Song[];
  currentSongId: string | null;
}

export type SongEvent =
  | SongAddEvent
  | SongRemoveEvent
  | SongUpdateEvent
  | SongSelectEvent
  | SongReorderEvent
  | SetlistSyncEvent;

// =============================================================================
// Resolved Song Track - with full track data loaded
// =============================================================================

export interface ResolvedSongTrack extends SongTrackReference {
  // Resolved track data
  audioTrack?: BackingTrack;
  loopTrack?: LoopTrackState;
  // Computed
  name: string;
  displayDuration: number;
}

export interface ResolvedSong extends Omit<Song, 'tracks'> {
  tracks: ResolvedSongTrack[];
}
