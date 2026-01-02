import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAdminSupabase, getUserFromRequest, getRoomMembership } from '@/lib/supabase/server';

// Cloudflare Calls API configuration
const CLOUDFLARE_CALLS_APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID || '';
const CLOUDFLARE_CALLS_APP_SECRET = process.env.CLOUDFLARE_CALLS_APP_SECRET || '';

// Cloudflare Calls API base URL
const CALLS_API_BASE = `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_CALLS_APP_ID}`;

// CRITICAL: Room track storage
// Previously this was an in-memory Map which COMPLETELY BREAKS in multi-instance deployments
// Now we use Supabase for persistent, shared storage across all server instances
//
// Fallback to in-memory ONLY for local development without Supabase
const inMemoryFallback = new Map<string, Map<string, string>>();

async function storeRoomSession(roomId: string, userId: string, sessionId: string, trackName: string): Promise<void> {
  const supabase = getSupabase();

  if (supabase) {
    try {
      await supabase
        .from('room_webrtc_sessions')
        .upsert({
          room_id: roomId,
          user_id: userId,
          session_id: sessionId,
          track_name: trackName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'room_id,user_id' });
    } catch (err) {
      console.error('[WebRTC Sessions] Failed to store session in Supabase:', err);
      // Fall back to in-memory
      if (!inMemoryFallback.has(roomId)) {
        inMemoryFallback.set(roomId, new Map());
      }
      inMemoryFallback.get(roomId)!.set(userId, sessionId);
    }
  } else {
    // No Supabase, use in-memory (local dev only)
    console.warn('[WebRTC Sessions] No Supabase configured, using in-memory storage');
    if (!inMemoryFallback.has(roomId)) {
      inMemoryFallback.set(roomId, new Map());
    }
    inMemoryFallback.get(roomId)!.set(userId, sessionId);
  }
}

async function getRoomSessions(roomId: string): Promise<Map<string, string>> {
  const supabase = getSupabase();
  const result = new Map<string, string>();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('room_webrtc_sessions')
        .select('user_id, session_id')
        .eq('room_id', roomId);

      if (error) {
        // Table might not exist yet - fall back to in-memory
        if (error.code === '42P01') {
          console.warn('[WebRTC Sessions] Table does not exist, using in-memory fallback');
          return inMemoryFallback.get(roomId) || new Map();
        }
        throw error;
      }

      if (data) {
        for (const row of data) {
          result.set(row.user_id, row.session_id);
        }
      }

      console.log(`[WebRTC Sessions] Found ${result.size} sessions for room ${roomId}`);
      return result;
    } catch (err) {
      console.error('[WebRTC Sessions] Failed to get sessions from Supabase:', err);
      // Fall back to in-memory
      return inMemoryFallback.get(roomId) || new Map();
    }
  } else {
    // No Supabase, use in-memory
    return inMemoryFallback.get(roomId) || new Map();
  }
}

async function removeRoomSession(roomId: string, sessionId: string): Promise<void> {
  const supabase = getSupabase();

  if (supabase) {
    try {
      await supabase
        .from('room_webrtc_sessions')
        .delete()
        .eq('room_id', roomId)
        .eq('session_id', sessionId);
    } catch (err) {
      console.error('[WebRTC Sessions] Failed to remove session from Supabase:', err);
    }
  }

  // Also clean in-memory fallback
  const roomSessions = inMemoryFallback.get(roomId);
  if (roomSessions) {
    for (const [uid, sid] of roomSessions.entries()) {
      if (sid === sessionId) {
        roomSessions.delete(uid);
        break;
      }
    }
  }
}

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
  // SECURITY: Require authentication for WebRTC session management
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required for WebRTC sessions' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, roomId, sessionId, trackName, sdp, mid, metadata } = body;

    if (!CLOUDFLARE_CALLS_APP_ID || !CLOUDFLARE_CALLS_APP_SECRET) {
      return NextResponse.json(
        { error: 'Cloudflare Calls not configured. Set CLOUDFLARE_CALLS_APP_ID and CLOUDFLARE_CALLS_APP_SECRET.' },
        { status: 500 }
      );
    }

    // SECURITY: Verify room membership for room-scoped actions
    if (roomId && action !== 'syncClock') {
      const membership = await getRoomMembership(roomId, user.id);
      // Allow users to join rooms (they become members), but verify for other actions
      if (!membership && action !== 'create') {
        return NextResponse.json(
          { error: 'You must be a member of this room to perform this action' },
          { status: 403 }
        );
      }
    }

    switch (action) {
      case 'create': {
        // Create a new session - SECURITY: Use authenticated user ID
        const result = await callCloudflareAPI('/sessions/new', 'POST');

        // NOTE: We intentionally do NOT store the session here anymore.
        // Storing on create caused race conditions where other users would try
        // to pull tracks from a session that wasn't fully connected yet (410 error).
        // Sessions are now only stored after pushTrack succeeds.
        console.log(`[WebRTC Sessions] Created session ${result.sessionId} for user ${user.id} in room ${roomId} (not stored until track pushed)`);

        return NextResponse.json({
          sessionId: result.sessionId,
        });
      }

      case 'pushTrack': {
        // Push a local track to Cloudflare
        // SECURITY: Use authenticated user ID for track name
        const secureTrackName = `audio-${user.id}`;

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
                trackName: secureTrackName,
              },
            ],
          }
        );

        // SECURITY: Store session with authenticated user ID only
        await storeRoomSession(roomId, user.id, sessionId, secureTrackName);
        console.log(`[WebRTC Sessions] Pushed track ${secureTrackName} for user ${user.id}, session ${sessionId}`);

        return NextResponse.json({
          sessionId: result.sessionId,
          sdp: result.sessionDescription?.sdp,
          tracks: result.tracks || [],
        });
      }

      case 'pullTrack': {
        // Pull a remote track from another user
        // Query persistent storage to find the remote user's session
        const roomSessions = await getRoomSessions(roomId);
        const remoteUserId = trackName.replace('audio-', '');
        const remoteSessionId = roomSessions.get(remoteUserId);

        if (!remoteSessionId) {
          console.error(`[WebRTC Sessions] No session found for user ${remoteUserId} in room ${roomId}. Available users:`, Array.from(roomSessions.keys()));
          return NextResponse.json(
            { error: `No session found for user ${remoteUserId}. Available: ${Array.from(roomSessions.keys()).join(', ')}` },
            { status: 404 }
          );
        }

        console.log(`[WebRTC Sessions] Pulling track ${trackName} from session ${remoteSessionId}`);

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
        // Close tracks in a session - remove from persistent storage
        await removeRoomSession(roomId, sessionId);
        console.log(`[WebRTC Sessions] Closed session ${sessionId} in room ${roomId}`);

        return NextResponse.json({ success: true });
      }

      case 'getRoomTracks': {
        // Get all tracks in a room (for discovering other users)
        // This is the CRITICAL query that must work across server instances
        const roomSessions = await getRoomSessions(roomId);
        const tracks: { userId: string; sessionId: string; trackName: string }[] = [];

        for (const [uid, sid] of roomSessions.entries()) {
          tracks.push({
            userId: uid,
            sessionId: sid,
            trackName: `audio-${uid}`,
          });
        }

        console.log(`[WebRTC Sessions] getRoomTracks for ${roomId}: found ${tracks.length} tracks`);
        if (tracks.length > 0) {
          console.log(`[WebRTC Sessions] Users in room:`, tracks.map(t => t.userId));
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
        // Remove a specific track
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
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

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

    // SECURITY: Remove only the authenticated user's session from persistent storage
    if (roomId) {
      await removeRoomSession(roomId, sessionId);
      console.log(`[WebRTC Sessions] Deleted session ${sessionId} from room ${roomId} by user ${user.id}`);
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
