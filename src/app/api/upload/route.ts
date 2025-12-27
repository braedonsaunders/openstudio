import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { BackingTrack } from '@/types';

// Mock storage - in production would use R2
const tracks = new Map<string, BackingTrack>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const artist = formData.get('artist') as string | null;
    const roomId = formData.get('roomId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Track name is required' },
        { status: 400 }
      );
    }

    // In production, upload to R2
    // For now, create a mock track
    const trackId = uuidv4();

    // Calculate duration (mock - would use audio analysis in production)
    const duration = 180; // 3 minutes default

    // Create track URL (would be R2 URL in production)
    const url = `/api/tracks/${trackId}/audio`;

    const track: BackingTrack = {
      id: trackId,
      name,
      artist: artist || undefined,
      duration,
      url,
      uploadedBy: 'user', // Would be actual user ID
      uploadedAt: new Date().toISOString(),
      aiGenerated: false,
    };

    tracks.set(trackId, track);

    return NextResponse.json(track);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload track' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');

  // Return all tracks for a room
  const roomTracks = Array.from(tracks.values());
  return NextResponse.json(roomTracks);
}
