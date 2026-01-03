// Song Types - Groups of tracks (audio + loops) that play together

import type { BackingTrack } from './index';
import type { LoopTrackState } from './loops';
import type { LyriaStyleId, LyriaMoodId } from '@/lib/ai/lyria';

// =============================================================================
// Notation Types - Chords, sections, and tab data per song
// =============================================================================

export interface SongChord {
  name: string;           // e.g., "Am", "G7", "Cmaj7"
  root: string;           // e.g., "A", "G", "C"
  quality: string;        // e.g., "m", "7", "maj7"
  bass?: string;          // For slash chords, e.g., "C/G"
  startBeat: number;      // Position in beats from start
  duration: number;       // Duration in beats
  frets?: number[];       // Guitar fret positions (6 strings, -1 for muted, 0 for open)
  fingers?: number[];     // Finger positions (0 = no finger)
  confidence?: number;    // AI detection confidence (0-1)
}

export interface SongSection {
  id: string;
  name: string;           // e.g., "Verse 1", "Chorus", "Bridge"
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'breakdown' | 'custom';
  startBeat: number;
  endBeat: number;
  chords: SongChord[];
  color?: string;
}

export interface SongNotation {
  format: 'chord-chart' | 'tab' | 'sheet' | 'nashville' | 'lead-sheet';
  sections: SongSection[];
  chords: SongChord[];        // Flat list for simple chord charts
  detectedChords?: SongChord[]; // AI-detected chords
  instrument?: 'guitar' | 'bass' | 'ukulele';
  tuning?: string[];          // e.g., ['E', 'A', 'D', 'G', 'B', 'E']
  capo?: number;
}

// =============================================================================
// Lyrics Types - Timed lyrics for teleprompter
// =============================================================================

export interface LyricSyllable {
  text: string;
  startTime: number;
  endTime: number;
}

export interface SongLyricLine {
  id: string;
  text: string;
  startTime: number;      // In seconds
  endTime: number;
  syllables?: LyricSyllable[]; // For karaoke-style highlighting
}

export interface SongLyrics {
  lines: SongLyricLine[];
  source?: string;        // e.g., 'manual', 'lrc-import', 'ai-detected'
}

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

  // Notation data (chords, sections, tabs)
  notation?: SongNotation;

  // Lyrics data (timed lines for teleprompter)
  lyrics?: SongLyrics;

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
