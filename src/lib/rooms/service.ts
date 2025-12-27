// Room service for managing rooms
import type { RoomListItem, CreateRoomInput, RoomSearchParams, RoomActivity } from '@/types';
import { generateRoomId } from '@/lib/utils';

const API_BASE = '/api/rooms';

// Fetch all public rooms
export async function getPublicRooms(): Promise<RoomListItem[]> {
  const response = await fetch(API_BASE);
  if (!response.ok) {
    throw new Error('Failed to fetch public rooms');
  }
  return response.json();
}

// Fetch rooms by user ID
export async function getUserRooms(userId: string): Promise<RoomListItem[]> {
  const response = await fetch(`${API_BASE}?createdBy=${userId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch user rooms');
  }
  return response.json();
}

// Fetch a single room by ID
export async function getRoom(roomId: string): Promise<RoomListItem | null> {
  const response = await fetch(`${API_BASE}?id=${roomId}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch room');
  }
  return response.json();
}

// Create a new room
export async function createRoom(
  input: CreateRoomInput,
  createdBy: string
): Promise<RoomListItem> {
  const roomId = generateRoomId();

  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: roomId,
      name: input.name,
      createdBy,
      isPublic: input.isPublic,
      maxUsers: input.maxUsers,
      description: input.description,
      genre: input.genre,
      tags: input.tags,
      settings: input.settings || {},
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create room');
  }

  return response.json();
}

// Delete a room
export async function deleteRoom(roomId: string): Promise<void> {
  const response = await fetch(`${API_BASE}?id=${roomId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete room');
  }
}

// Search rooms with filters
export async function searchRooms(params: RoomSearchParams): Promise<RoomListItem[]> {
  const searchParams = new URLSearchParams();

  if (params.filter) searchParams.set('filter', params.filter);
  if (params.genre) searchParams.set('genre', params.genre);
  if (params.search) searchParams.set('search', params.search);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  const url = searchParams.toString() ? `${API_BASE}?${searchParams}` : API_BASE;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to search rooms');
  }

  return response.json();
}

// Get room activity (active users, live status)
export async function getRoomActivity(roomIds: string[]): Promise<Record<string, RoomActivity>> {
  // This would typically connect to a realtime presence system
  // For now, return empty activity
  const activity: Record<string, RoomActivity> = {};

  for (const roomId of roomIds) {
    activity[roomId] = {
      roomId,
      activeUsers: 0,
      lastActivity: new Date().toISOString(),
      isLive: false,
    };
  }

  return activity;
}

// Genre options for rooms
export const ROOM_GENRES = [
  { value: 'rock', label: 'Rock' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'blues', label: 'Blues' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'hiphop', label: 'Hip Hop' },
  { value: 'classical', label: 'Classical' },
  { value: 'folk', label: 'Folk' },
  { value: 'metal', label: 'Metal' },
  { value: 'pop', label: 'Pop' },
  { value: 'rnb', label: 'R&B' },
  { value: 'country', label: 'Country' },
  { value: 'funk', label: 'Funk' },
  { value: 'experimental', label: 'Experimental' },
  { value: 'jam', label: 'Jam Session' },
  { value: 'other', label: 'Other' },
] as const;

// Max user options
export const MAX_USER_OPTIONS = [
  { value: 2, label: '2 musicians' },
  { value: 4, label: '4 musicians' },
  { value: 6, label: '6 musicians' },
  { value: 8, label: '8 musicians' },
  { value: 10, label: '10 musicians' },
] as const;
