import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getAdminSupabase, getUserFromRequest, getRoomMembership } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// GET /api/rooms/[roomId]/user-tracks - Load all user tracks for a room
// SECURITY: Supports authenticated users and guests joining public rooms
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Support both authenticated users and guests
  const user = await getUserFromRequest(request);

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // For authenticated users, optionally verify membership
    // For guests joining public rooms, skip membership check
    if (user) {
      const membership = await getRoomMembership(roomId, user.id);
      // Even if not a member, allow reading tracks (they're joining)
    }

    // Get all tracks for this room (room members can see all tracks)
    const { data: tracks, error } = await supabase
      .from('user_tracks')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading user tracks:', error);
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: 'Failed to load user tracks' }, { status: 500 });
    }

    // Transform database records to UserTrack format
    const userTracks = (tracks || []).map((track) => ({
      id: track.id,
      userId: track.user_id,
      name: track.name,
      color: track.color,
      type: track.track_type || 'audio',
      audioSettings: track.audio_settings,
      midiSettings: track.midi_settings,
      isMuted: track.is_muted,
      isSolo: track.is_solo,
      volume: track.volume,
      pan: track.pan ?? 0,
      isArmed: track.is_armed,
      isRecording: track.is_recording,
      createdAt: new Date(track.created_at).getTime(),
      ownerUserId: track.owner_user_id || track.user_id,
      ownerUserName: track.owner_user_name,
      isActive: track.is_active ?? true,
      activeMidiNotes: track.track_type === 'midi' ? [] : undefined,
    }));

    return NextResponse.json(userTracks);
  } catch (error) {
    console.error('Error in GET user tracks:', error);
    return NextResponse.json({ error: 'Failed to load user tracks' }, { status: 500 });
  }
}

// POST /api/rooms/[roomId]/user-tracks - Create or update a user track
// SECURITY: Supports authenticated users and guests; track ownership is tied to user ID
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  // Support both authenticated users and guests
  const user = await getUserFromRequest(request);

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;
    const track = await request.json();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // SECURITY: Verify room exists (don't auto-create rooms from track creation)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Use authenticated user ID if available, otherwise use provided userId (for guests)
    const effectiveUserId = user?.id || track.userId;
    if (!effectiveUserId) {
      return NextResponse.json(
        { error: 'User identification required' },
        { status: 400 }
      );
    }

    // Create or update track
    const { data, error } = await supabase
      .from('user_tracks')
      .upsert({
        id: track.id,
        room_id: roomId,
        user_id: effectiveUserId,
        name: track.name,
        color: track.color,
        track_type: track.type || 'audio',
        audio_settings: track.audioSettings,
        midi_settings: track.midiSettings,
        is_muted: track.isMuted ?? false,
        is_solo: track.isSolo ?? false,
        volume: track.volume ?? 1,
        pan: track.pan ?? 0,
        is_armed: track.isArmed ?? false,
        is_recording: track.isRecording ?? false,
        // Note: owner_user_id, owner_user_name, is_active require migration
        // They will be ignored if columns don't exist
        ...(track.ownerUserId && { owner_user_id: track.ownerUserId }),
        ...(track.ownerUserName && { owner_user_name: track.ownerUserName }),
        ...(track.isActive !== undefined && { is_active: track.isActive }),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving user track:', error);
      // Handle missing column errors by retrying without new columns
      if (error.message?.includes('is_active') || error.message?.includes('owner_user_id')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_tracks')
          .upsert({
            id: track.id,
            room_id: roomId,
            user_id: effectiveUserId,
            name: track.name,
            color: track.color,
            audio_settings: track.audioSettings,
            is_muted: track.isMuted ?? false,
            is_solo: track.isSolo ?? false,
            volume: track.volume ?? 1,
            pan: track.pan ?? 0,
            is_armed: track.isArmed ?? false,
            is_recording: track.isRecording ?? false,
          }, { onConflict: 'id' })
          .select()
          .single();

        if (fallbackError) {
          if (fallbackError.code === '42P01') {
            return NextResponse.json(
              { error: 'Database schema not ready' },
              { status: 503 }
            );
          }
          return NextResponse.json(
            { error: 'Failed to save user track', details: fallbackError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          id: fallbackData.id,
          userId: fallbackData.user_id,
          name: fallbackData.name,
          color: fallbackData.color,
          audioSettings: fallbackData.audio_settings,
          isMuted: fallbackData.is_muted,
          isSolo: fallbackData.is_solo,
          volume: fallbackData.volume,
          pan: fallbackData.pan ?? 0,
          isArmed: fallbackData.is_armed,
          isRecording: fallbackData.is_recording,
          createdAt: new Date(fallbackData.created_at).getTime(),
          ownerUserId: fallbackData.user_id,
          ownerUserName: track.ownerUserName,
          isActive: true,
        });
      }
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Database schema not ready' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to save user track', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      color: data.color,
      type: data.track_type || 'audio',
      audioSettings: data.audio_settings,
      midiSettings: data.midi_settings,
      isMuted: data.is_muted,
      isSolo: data.is_solo,
      volume: data.volume,
      pan: data.pan ?? 0,
      isArmed: data.is_armed,
      isRecording: data.is_recording,
      createdAt: new Date(data.created_at).getTime(),
      ownerUserId: data.owner_user_id || data.user_id,
      ownerUserName: data.owner_user_name,
      isActive: data.is_active ?? true,
      activeMidiNotes: data.track_type === 'midi' ? [] : undefined,
    });
  } catch (error) {
    console.error('Error in POST user track:', error);
    return NextResponse.json({ error: 'Failed to save user track' }, { status: 500 });
  }
}

// PATCH /api/rooms/[roomId]/user-tracks - Update track settings
// SECURITY: Users can only update their own tracks (supports guests)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  // Support both authenticated users and guests
  const user = await getUserFromRequest(request);

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;
    const { trackId, userId: clientUserId, ...updates } = await request.json();

    // Determine effective user ID
    const effectiveUserId = user?.id || clientUserId;
    if (!effectiveUserId) {
      return NextResponse.json(
        { error: 'User identification required' },
        { status: 400 }
      );
    }

    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // SECURITY: Verify the user owns this track
    // Allow access if: user_id matches, OR owner_user_id matches (for rejoining users)
    const { data: track } = await supabase
      .from('user_tracks')
      .select('user_id, owner_user_id, owner_user_name')
      .eq('id', trackId)
      .eq('room_id', roomId)
      .single();

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Allow if: current user owns the track, OR they're the original owner (rejoining)
    const isCurrentOwner = track.user_id === effectiveUserId;
    const isOriginalOwner = track.owner_user_id === effectiveUserId;
    // Also allow if they're reassigning ownership to themselves (ownerUserId in updates matches)
    const isClaimingOwnership = updates.ownerUserId === effectiveUserId;

    if (!isCurrentOwner && !isOriginalOwner && !isClaimingOwnership) {
      return NextResponse.json(
        { error: 'You can only modify your own tracks' },
        { status: 403 }
      );
    }

    // Map camelCase to snake_case for database
    // Split into core updates (always work) and optional updates (require migration)
    const coreUpdates: Record<string, unknown> = {};
    const optionalUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) coreUpdates.name = updates.name;
    if (updates.color !== undefined) coreUpdates.color = updates.color;
    if (updates.type !== undefined) coreUpdates.track_type = updates.type;
    if (updates.audioSettings !== undefined) coreUpdates.audio_settings = updates.audioSettings;
    if (updates.midiSettings !== undefined) coreUpdates.midi_settings = updates.midiSettings;
    if (updates.isMuted !== undefined) coreUpdates.is_muted = updates.isMuted;
    if (updates.isSolo !== undefined) coreUpdates.is_solo = updates.isSolo;
    if (updates.volume !== undefined) coreUpdates.volume = updates.volume;
    if (updates.pan !== undefined) coreUpdates.pan = updates.pan;
    if (updates.isArmed !== undefined) coreUpdates.is_armed = updates.isArmed;
    if (updates.isRecording !== undefined) coreUpdates.is_recording = updates.isRecording;
    if (updates.userId !== undefined) coreUpdates.user_id = updates.userId;

    // These columns require migration - may not exist
    if (updates.ownerUserId !== undefined) optionalUpdates.owner_user_id = updates.ownerUserId;
    if (updates.ownerUserName !== undefined) optionalUpdates.owner_user_name = updates.ownerUserName;
    if (updates.isActive !== undefined) optionalUpdates.is_active = updates.isActive;

    // Try with all updates first
    const dbUpdates = { ...coreUpdates, ...optionalUpdates };

    const { error } = await supabase
      .from('user_tracks')
      .update(dbUpdates)
      .eq('id', trackId)
      .eq('room_id', roomId);

    if (error) {
      console.error('Error updating user track:', error);
      // If error is due to missing columns, retry with only core updates
      if (error.message?.includes('is_active') || error.message?.includes('owner_user_id')) {
        if (Object.keys(coreUpdates).length > 0) {
          const { error: retryError } = await supabase
            .from('user_tracks')
            .update(coreUpdates)
            .eq('id', trackId)
            .eq('room_id', roomId);

          if (retryError && retryError.code !== '42P01') {
            return NextResponse.json({ error: 'Failed to update user track' }, { status: 500 });
          }
        }
        return NextResponse.json({ success: true });
      }
      if (error.code === '42P01') {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Failed to update user track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH user track:', error);
    return NextResponse.json({ error: 'Failed to update user track' }, { status: 500 });
  }
}

// DELETE /api/rooms/[roomId]/user-tracks?trackId=xxx - Remove a user track
// SECURITY: Users can only delete their own tracks (supports guests)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  // Support both authenticated users and guests
  const user = await getUserFromRequest(request);

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const guestUserId = searchParams.get('userId');

    // Determine effective user ID
    const effectiveUserId = user?.id || guestUserId;
    if (!effectiveUserId) {
      return NextResponse.json(
        { error: 'User identification required' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    if (trackId) {
      // Deleting a specific track - verify ownership
      const { data: track } = await supabase
        .from('user_tracks')
        .select('user_id')
        .eq('id', trackId)
        .eq('room_id', roomId)
        .single();

      if (!track) {
        return NextResponse.json({ error: 'Track not found' }, { status: 404 });
      }

      if (track.user_id !== effectiveUserId) {
        return NextResponse.json(
          { error: 'You can only delete your own tracks' },
          { status: 403 }
        );
      }

      const { error } = await supabase
        .from('user_tracks')
        .delete()
        .eq('id', trackId)
        .eq('room_id', roomId);

      if (error) {
        console.error('Error deleting user track:', error);
        return NextResponse.json({ error: 'Failed to delete user track' }, { status: 500 });
      }
    } else {
      // Deleting all tracks for the user (e.g., when leaving room)
      const { error } = await supabase
        .from('user_tracks')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', effectiveUserId);

      if (error) {
        console.error('Error deleting user tracks:', error);
        return NextResponse.json({ error: 'Failed to delete user tracks' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE user track:', error);
    return NextResponse.json({ error: 'Failed to delete user track' }, { status: 500 });
  }
}
