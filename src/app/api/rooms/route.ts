import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// In-memory room storage (would use database in production)
const rooms = new Map<string, {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  popLocation: string;
  users: string[];
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, createdBy } = body;

    const roomId = uuidv4().slice(0, 8);
    const room = {
      id: roomId,
      name: name || `Room ${roomId}`,
      createdBy: createdBy || 'anonymous',
      createdAt: new Date().toISOString(),
      popLocation: 'auto', // Would be determined by Cloudflare in production
      users: [],
    };

    rooms.set(roomId, room);

    return NextResponse.json(room);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id');

  if (roomId) {
    const room = rooms.get(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(room);
  }

  // Return all public rooms
  const publicRooms = Array.from(rooms.values());
  return NextResponse.json(publicRooms);
}
