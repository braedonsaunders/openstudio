'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Song, SongTrackReference, Setlist } from '@/types/songs';

// =============================================================================
// Persistence
// =============================================================================

// Debounced save to avoid hammering the API
const pendingSaves = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 500;

async function persistSong(song: Song): Promise<void> {
  // Clear any pending save for this song
  const existing = pendingSaves.get(song.id);
  if (existing) {
    clearTimeout(existing);
  }

  // Schedule a new save
  pendingSaves.set(
    song.id,
    setTimeout(async () => {
      pendingSaves.delete(song.id);
      try {
        const res = await fetch(`/api/rooms/${song.roomId}/songs`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songId: song.id,
            name: song.name,
            tracks: song.tracks,
            bpm: song.bpm,
            key: song.key,
            timeSignature: song.timeSignature,
            duration: song.duration,
            color: song.color,
            position: song.position,
          }),
        });
        if (!res.ok) {
          console.error('[SongsStore] Failed to persist song:', await res.text());
        }
      } catch (err) {
        console.error('[SongsStore] Failed to persist song:', err);
      }
    }, SAVE_DEBOUNCE_MS)
  );
}

async function createSongOnServer(song: Song): Promise<void> {
  try {
    const res = await fetch(`/api/rooms/${song.roomId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) {
      console.error('[SongsStore] Failed to create song on server:', await res.text());
    }
  } catch (err) {
    console.error('[SongsStore] Failed to create song on server:', err);
  }
}

async function deleteSongOnServer(roomId: string, songId: string): Promise<void> {
  try {
    const res = await fetch(`/api/rooms/${roomId}/songs?songId=${songId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      console.error('[SongsStore] Failed to delete song on server:', await res.text());
    }
  } catch (err) {
    console.error('[SongsStore] Failed to delete song on server:', err);
  }
}

// =============================================================================
// Song Colors
// =============================================================================

const SONG_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

// =============================================================================
// Store State
// =============================================================================

interface SongsState {
  // State
  songs: Map<string, Song>;
  currentSongId: string | null;
  isLoading: boolean;
  error: string | null;

  // Computed
  getSongsByRoom: (roomId: string) => Song[];
  getCurrentSong: () => Song | null;
  getSongById: (songId: string) => Song | null;

  // Actions
  loadSongs: (roomId: string) => Promise<void>;
  createSong: (roomId: string, name: string, createdBy: string, createdByName?: string) => Song;
  updateSong: (songId: string, changes: Partial<Song>) => void;
  deleteSong: (songId: string) => Promise<void>;
  selectSong: (songId: string | null) => Promise<void>;
  reorderSongs: (roomId: string, songIds: string[]) => void;

  // Track management within songs
  addTrackToSong: (songId: string, track: Omit<SongTrackReference, 'id' | 'position'>) => void;
  removeTrackFromSong: (songId: string, trackRefId: string) => void;
  updateTrackInSong: (songId: string, trackRefId: string, changes: Partial<SongTrackReference>) => void;
  reorderTracksInSong: (songId: string, trackRefIds: string[]) => void;

  // Bulk operations
  setSongs: (songs: Song[]) => void;
  clearSongs: (roomId: string) => void;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useSongsStore = create<SongsState>((set, get) => ({
  // Initial state
  songs: new Map(),
  currentSongId: null,
  isLoading: false,
  error: null,

  // Computed
  getSongsByRoom: (roomId: string) => {
    const { songs } = get();
    return Array.from(songs.values())
      .filter((s) => s.roomId === roomId)
      .sort((a, b) => a.position - b.position);
  },

  getCurrentSong: () => {
    const { songs, currentSongId } = get();
    if (!currentSongId) return null;
    return songs.get(currentSongId) || null;
  },

  getSongById: (songId: string) => {
    const { songs } = get();
    return songs.get(songId) || null;
  },

  // Actions
  loadSongs: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/rooms/${roomId}/songs`);
      if (!res.ok) throw new Error('Failed to load songs');
      const data = await res.json();
      const songs = new Map<string, Song>();
      (data.songs || []).forEach((song: Song) => {
        songs.set(song.id, song);
      });
      set({
        songs,
        currentSongId: data.currentSongId || (data.songs?.[0]?.id ?? null),
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createSong: (roomId: string, name: string, createdBy: string, createdByName?: string) => {
    const { songs, getSongsByRoom } = get();
    const existingSongs = getSongsByRoom(roomId);
    const position = existingSongs.length;
    const colorIndex = position % SONG_COLORS.length;

    const song: Song = {
      id: uuidv4(),
      roomId,
      name,
      tracks: [],
      bpm: 120,
      timeSignature: [4, 4],
      duration: 0,
      color: SONG_COLORS[colorIndex],
      position,
      createdBy,
      createdByName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newSongs = new Map(songs);
    newSongs.set(song.id, song);
    set({ songs: newSongs, currentSongId: song.id });

    // Persist to server
    createSongOnServer(song);

    return song;
  },

  updateSong: (songId: string, changes: Partial<Song>) => {
    const { songs } = get();
    const song = songs.get(songId);
    if (!song) return;

    const updatedSong = {
      ...song,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    const newSongs = new Map(songs);
    newSongs.set(songId, updatedSong);
    set({ songs: newSongs });

    // Persist to server (debounced)
    persistSong(updatedSong);
  },

  deleteSong: async (songId: string) => {
    const { songs, currentSongId, getSongsByRoom } = get();
    const song = songs.get(songId);
    if (!song) return;

    // Reset playback state when deleting a song
    const { useAudioStore } = await import('./audio-store');
    const { setPlaying, setCurrentTime } = useAudioStore.getState();
    setPlaying(false);
    setCurrentTime(0);

    const newSongs = new Map(songs);
    newSongs.delete(songId);

    // Update positions
    const roomSongs = getSongsByRoom(song.roomId).filter((s) => s.id !== songId);
    roomSongs.forEach((s, idx) => {
      newSongs.set(s.id, { ...s, position: idx });
    });

    // Update current song if needed
    let newCurrentSongId = currentSongId;
    if (currentSongId === songId) {
      newCurrentSongId = roomSongs[0]?.id || null;
    }

    set({ songs: newSongs, currentSongId: newCurrentSongId });

    // Delete from server
    deleteSongOnServer(song.roomId, songId);
  },

  selectSong: async (songId: string | null) => {
    const { currentSongId } = get();

    // Reset playback state when switching songs
    if (currentSongId !== songId) {
      const { useAudioStore } = await import('./audio-store');
      const { setPlaying, setCurrentTime } = useAudioStore.getState();
      setPlaying(false);
      setCurrentTime(0);
    }

    set({ currentSongId: songId });
  },

  reorderSongs: (roomId: string, songIds: string[]) => {
    const { songs } = get();
    const newSongs = new Map(songs);

    songIds.forEach((id, idx) => {
      const song = newSongs.get(id);
      if (song && song.roomId === roomId) {
        newSongs.set(id, { ...song, position: idx, updatedAt: new Date().toISOString() });
      }
    });

    set({ songs: newSongs });
  },

  // Track management
  addTrackToSong: (songId: string, track: Omit<SongTrackReference, 'id' | 'position'>) => {
    const { songs } = get();
    const song = songs.get(songId);
    if (!song) return;

    const trackRef: SongTrackReference = {
      ...track,
      id: uuidv4(),
      position: song.tracks.length,
    };

    const updatedSong = {
      ...song,
      tracks: [...song.tracks, trackRef],
      updatedAt: new Date().toISOString(),
    };

    const newSongs = new Map(songs);
    newSongs.set(songId, updatedSong);
    set({ songs: newSongs });

    // Persist to server (debounced)
    persistSong(updatedSong);
  },

  removeTrackFromSong: (songId: string, trackRefId: string) => {
    const { songs } = get();
    const song = songs.get(songId);
    if (!song) return;

    const newTracks = song.tracks
      .filter((t) => t.id !== trackRefId)
      .map((t, idx) => ({ ...t, position: idx }));

    const updatedSong = {
      ...song,
      tracks: newTracks,
      updatedAt: new Date().toISOString(),
    };

    const newSongs = new Map(songs);
    newSongs.set(songId, updatedSong);
    set({ songs: newSongs });

    // Persist to server (debounced)
    persistSong(updatedSong);
  },

  updateTrackInSong: (songId: string, trackRefId: string, changes: Partial<SongTrackReference>) => {
    const { songs } = get();
    const song = songs.get(songId);
    if (!song) return;

    const newTracks = song.tracks.map((t) =>
      t.id === trackRefId ? { ...t, ...changes } : t
    );

    const updatedSong = {
      ...song,
      tracks: newTracks,
      updatedAt: new Date().toISOString(),
    };

    const newSongs = new Map(songs);
    newSongs.set(songId, updatedSong);
    set({ songs: newSongs });

    // Persist to server (debounced)
    persistSong(updatedSong);
  },

  reorderTracksInSong: (songId: string, trackRefIds: string[]) => {
    const { songs } = get();
    const song = songs.get(songId);
    if (!song) return;

    const trackMap = new Map(song.tracks.map((t) => [t.id, t]));
    const newTracks = trackRefIds
      .map((id, idx) => {
        const track = trackMap.get(id);
        return track ? { ...track, position: idx } : null;
      })
      .filter((t): t is SongTrackReference => t !== null);

    const updatedSong = {
      ...song,
      tracks: newTracks,
      updatedAt: new Date().toISOString(),
    };

    const newSongs = new Map(songs);
    newSongs.set(songId, updatedSong);
    set({ songs: newSongs });

    // Persist to server (debounced)
    persistSong(updatedSong);
  },

  // Bulk operations
  setSongs: (songsList: Song[]) => {
    const songs = new Map<string, Song>();
    songsList.forEach((song) => songs.set(song.id, song));
    set({ songs });
  },

  clearSongs: (roomId: string) => {
    const { songs } = get();
    const newSongs = new Map(songs);
    for (const [id, song] of newSongs) {
      if (song.roomId === roomId) {
        newSongs.delete(id);
      }
    }
    set({ songs: newSongs, currentSongId: null });
  },
}));
