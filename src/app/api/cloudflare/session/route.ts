import { NextRequest, NextResponse } from 'next/server';

// Cloudflare Calls API configuration
const CLOUDFLARE_CALLS_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID || '';
const CLOUDFLARE_CALLS_APP_SECRET = process.env.CLOUDFLARE_CALLS_APP_SECRET || '';

// Cloudflare Calls API base URL
// Format: https://rtc.live.cloudflare.com/v1/apps/{appId}
const CALLS_API_BASE = `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_CALLS_APP_ID}`;

// Store room -> track mappings (in production, use Redis or database)
const roomTracks = new Map<string, Map<string, string>>(); // roomId -> Map<userId, sessionId>

async function callCloudflareAPI(endpoint: string, method: string, body?: object) {
  const url = `${CALLS_API_BASE}${endpoint}`;
  console.log(`Cloudflare API: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_CALLS_APP_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  console.log(`Cloudflare API response (${response.status}):`, text);

  if (!response.ok) {
    throw new Error(`Cloudflare API error: ${response.status} - ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roomId, userId, sessionId, trackName, sdp, mid } = body;

    if (!CLOUDFLARE_CALLS_APP_ID || !CLOUDFLARE_CALLS_APP_SECRET) {
      return NextResponse.json(
        { error: 'Cloudflare Calls not configured. Set CLOUDFLARE_CALLS_APP_ID and CLOUDFLARE_CALLS_APP_SECRET.' },
        { status: 500 }
      );
    }

    switch (action) {
      case 'create': {
        // Create a new session
        // POST /sessions/new (no body required)
        const result = await callCloudflareAPI('/sessions/new', 'POST');

        // Track this session for the room
        if (!roomTracks.has(roomId)) {
          roomTracks.set(roomId, new Map());
        }
        roomTracks.get(roomId)!.set(userId, result.sessionId);

        return NextResponse.json({
          sessionId: result.sessionId,
        });
      }

      case 'pushTrack': {
        // Push a local track to Cloudflare
        // POST /sessions/{sessionId}/tracks/new
        const result = await callCloudflareAPI(
          `/sessions/${sessionId}/tracks/new`,
          'POST',
          {
            sessionDescription: {
              type: 'offer',
              sdp: sdp,
            },
            tracks: [
              {
                location: 'local',
                mid: mid,
                trackName: trackName,
              },
            ],
          }
        );

        // Update room tracks
        if (!roomTracks.has(roomId)) {
          roomTracks.set(roomId, new Map());
        }
        const userIdFromTrack = trackName.replace('audio-', '');
        roomTracks.get(roomId)!.set(userIdFromTrack, sessionId);

        return NextResponse.json({
          sessionId: result.sessionId,
          sdp: result.sessionDescription?.sdp,
          tracks: result.tracks || [],
        });
      }

      case 'pullTrack': {
        // Pull a remote track from another user
        // We need to find the session that has this track
        const roomSessions = roomTracks.get(roomId);
        const remoteUserId = trackName.replace('audio-', '');
        const remoteSessionId = roomSessions?.get(remoteUserId);

        if (!remoteSessionId) {
          return NextResponse.json(
            { error: `No session found for user ${remoteUserId}` },
            { status: 404 }
          );
        }

        // POST /sessions/{sessionId}/tracks/new with remote track
        const result = await callCloudflareAPI(
          `/sessions/${sessionId}/tracks/new`,
          'POST',
          {
            sessionDescription: {
              type: 'offer',
              sdp: sdp,
            },
            tracks: [
              {
                location: 'remote',
                sessionId: remoteSessionId,
                trackName: trackName,
                mid: mid,
              },
            ],
          }
        );

        return NextResponse.json({
          sessionId: result.sessionId,
          sdp: result.sessionDescription?.sdp,
          tracks: result.tracks || [],
        });
      }

      case 'renegotiate': {
        // Renegotiate the session
        // PUT /sessions/{sessionId}/renegotiate
        const result = await callCloudflareAPI(
          `/sessions/${sessionId}/renegotiate`,
          'PUT',
          {
            sessionDescription: {
              type: 'offer',
              sdp: sdp,
            },
          }
        );

        return NextResponse.json({
          sdp: result.sessionDescription?.sdp,
        });
      }

      case 'close': {
        // Close tracks in a session
        // We could close specific tracks, but for simplicity just remove from room
        const roomSessions = roomTracks.get(roomId);
        if (roomSessions) {
          // Find and remove the user from room tracking
          for (const [uid, sid] of roomSessions.entries()) {
            if (sid === sessionId) {
              roomSessions.delete(uid);
              break;
            }
          }
        }

        return NextResponse.json({ success: true });
      }

      case 'getRoomTracks': {
        // Get all tracks in a room (for discovering other users)
        const roomSessions = roomTracks.get(roomId);
        const tracks: { userId: string; sessionId: string; trackName: string }[] = [];

        if (roomSessions) {
          for (const [uid, sid] of roomSessions.entries()) {
            tracks.push({
              userId: uid,
              sessionId: sid,
              trackName: `audio-${uid}`,
            });
          }
        }

        return NextResponse.json({ tracks });
      }

      case 'syncClock': {
        // Return server time for clock synchronization
        return NextResponse.json({
          serverTime: Date.now(),
        });
      }

      case 'removeTrack': {
        // Remove a specific track (similar to close but for individual tracks)
        // For now, just acknowledge - actual track removal handled by renegotiation
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cloudflare session error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process session request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const roomId = searchParams.get('roomId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Remove from room tracking
    if (roomId) {
      const roomSessions = roomTracks.get(roomId);
      if (roomSessions) {
        for (const [uid, sid] of roomSessions.entries()) {
          if (sid === sessionId) {
            roomSessions.delete(uid);
            break;
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json(
      { error: 'Failed to close session' },
      { status: 500 }
    );
  }
}
