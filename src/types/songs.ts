// Song Types - Groups of tracks (audio + loops) that play together

import type { BackingTrack } from './index';
import type { LoopTrackState } from './loops';

// =============================================================================
// Song Track Reference - unified reference to audio or loop track
// =============================================================================

export type SongTrackType = 'audio' | 'loop';

export interface SongTrackReference {
  id: string;
  type: SongTrackType;
  trackId: string; // Reference to BackingTrack.id or LoopTrackState.id
  position: number; // Order in the song's track list
  startOffset: number; // When this track starts (in seconds from song start)
  // Overrides (if different from source track)
  volume?: number;
  muted?: boolean;
  solo?: boolean;
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
