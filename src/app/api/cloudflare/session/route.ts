import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAdminSupabase, getUserFromRequest, getRoomMembership } from '@/lib/supabase/server';
import { validateGuestId, getEffectiveUserId } from '@/lib/auth/guest';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

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

// SECURITY: Verify session ownership before deletion
async function getSessionOwner(roomId: string, sessionId: string): Promise<string | null> {
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('room_webrtc_sessions')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('session_id', sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.user_id;
    } catch {
      return null;
    }
  }

  // Fallback to in-memory
  const roomSessions = inMemoryFallback.get(roomId);
  if (roomSessions) {
    for (const [uid, sid] of roomSessions.entries()) {
      if (sid === sessionId) {
        return uid;
      }
    }
  }
  return null;
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

// SECURITY: Check if room is public (for guest access)
async function isRoomPublic(roomId: string): Promise<boolean> {
  const supabase = getAdminSupabase();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('is_public')
      .eq('id', roomId)
      .single();

    if (error || !data) return false;
    return data.is_public === true;
  } catch {
    return false;
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
    throw new Error(`Cloudflare API error: ${response.status}`);
  }

  return text ? JSON.parse(text) : {};
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`webrtc:${clientId}`, rateLimiters.webrtc);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  // SECURITY: Support both authenticated users and validated guest users
  const user = await getUserFromRequest(request);

  try {
    const body = await request.json();
    const { action, roomId, sessionId, trackName, sdp, mid, userId: clientUserId } = body;

    // SECURITY: Get effective user ID with guest validation
    const effectiveUserId = getEffectiveUserId(user?.id, clientUserId);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: 'Valid authentication required (login or use /api/auth/guest to get a guest ID)' },
        { status: 401 }
      );
    }

    // SECURITY: For guests, validate the guest ID format
    if (!user && clientUserId && !validateGuestId(clientUserId)) {
      return NextResponse.json(
        { error: 'Invalid guest ID. Use /api/auth/guest to get a valid guest ID.' },
        { status: 401 }
      );
    }

    if (!CLOUDFLARE_CALLS_APP_ID || !CLOUDFLARE_CALLS_APP_SECRET) {
      return NextResponse.json(
        { error: 'WebRTC service not configured' },
        { status: 503 }
      );
    }

    // SECURITY: For room-scoped actions, verify access
    if (roomId && action !== 'syncClock') {
      if (user) {
        // Authenticated users: verify membership (except for initial join via 'create')
        const membership = await getRoomMembership(roomId, user.id);
        if (!membership && action !== 'create') {
          return NextResponse.json(
            { error: 'Room membership required' },
            { status: 403 }
          );
        }
      } else {
        // Guest users: verify room is public
        const roomIsPublic = await isRoomPublic(roomId);
        if (!roomIsPublic) {
          return NextResponse.json(
            { error: 'This room requires authentication to join' },
            { status: 403 }
          );
        }
      }
    }

    switch (action) {
      case 'create': {
        // Create a new session
        const result = await callCloudflareAPI('/sessions/new', 'POST');

        // NOTE: We intentionally do NOT store the session here anymore.
        // Storing on create caused race conditions where other users would try
        // to pull tracks from a session that wasn't fully connected yet (410 error).
        // Sessions are now only stored after pushTrack succeeds.
        console.log(`[WebRTC Sessions] Created session ${result.sessionId} for user ${effectiveUserId} in room ${roomId} (not stored until track pushed)`);

        return NextResponse.json({
          sessionId: result.sessionId,
        });
      }

      case 'pushTrack': {
        // Push a local track to Cloudflare
        // Track name uses the effective user ID (authenticated or guest)
        const secureTrackName = `audio-${effectiveUserId}`;

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

        // Store session with effective user ID
        await storeRoomSession(roomId, effectiveUserId, sessionId, secureTrackName);
        console.log(`[WebRTC Sessions] Pushed track ${secureTrackName} for user ${effectiveUserId}, session ${sessionId}`);

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
            { error: 'Remote user session not found' },
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
        // SECURITY: Verify session ownership before deletion
        const owner = await getSessionOwner(roomId, sessionId);
        if (owner && owner !== effectiveUserId) {
          return NextResponse.json(
            { error: 'Cannot close another user\'s session' },
            { status: 403 }
          );
        }

        // Close tracks in a session - remove from persistent storage
        await removeRoomSession(roomId, sessionId);
        console.log(`[WebRTC Sessions] Closed session ${sessionId} in room ${roomId} by ${effectiveUserId}`);

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

      case 'initSession': {
        // Initialize a receive-only session for listeners
        // This establishes the WebRTC connection without pushing any tracks
        // Listeners don't publish audio, so we don't store them in roomSessions
        console.log(`[WebRTC Sessions] Initializing receive-only session ${sessionId} for listener ${effectiveUserId}`);

        try {
          // Use renegotiate to establish the session
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
            sessionId: sessionId,
            sdp: result.sessionDescription?.sdp,
          });
        } catch (err) {
          // If renegotiate fails, just return success - listener can still try to pull tracks
          console.warn(`[WebRTC Sessions] initSession renegotiate failed, continuing:`, err);
          return NextResponse.json({
            sessionId: sessionId,
            sdp: null,
          });
        }
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cloudflare session error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`webrtc:${clientId}`, rateLimiters.webrtc);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  // SECURITY: Get authenticated user or validate guest ID
  const user = await getUserFromRequest(request);

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const roomId = searchParams.get('roomId');
    const guestUserId = searchParams.get('guestUserId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID required' },
        { status: 400 }
      );
    }

    // SECURITY: Get effective user ID with validation
    const effectiveUserId = getEffectiveUserId(user?.id, guestUserId);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // SECURITY: Validate guest ID if provided
    if (!user && guestUserId && !validateGuestId(guestUserId)) {
      return NextResponse.json(
        { error: 'Invalid guest ID' },
        { status: 401 }
      );
    }

    // SECURITY: Verify session ownership before deletion
    const owner = await getSessionOwner(roomId, sessionId);
    if (owner && owner !== effectiveUserId) {
      return NextResponse.json(
        { error: 'Cannot delete another user\'s session' },
        { status: 403 }
      );
    }

    // Remove session from persistent storage
    await removeRoomSession(roomId, sessionId);
    console.log(`[WebRTC Sessions] Deleted session ${sessionId} from room ${roomId} by ${effectiveUserId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json(
      { error: 'Failed to close session' },
      { status: 500 }
    );
  }
}
