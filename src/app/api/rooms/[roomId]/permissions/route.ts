import { NextRequest, NextResponse } from 'next/server';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';
import { getSupabase, getAdminSupabase, getUserFromRequest, getRoomMembership } from '@/lib/supabase/server';
import { validateGuestId, getEffectiveUserId } from '@/lib/auth/guest';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// Helper to check if room is public
async function isRoomPublic(supabase: ReturnType<typeof getAdminSupabase>, roomId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase
      .from('rooms')
      .select('is_public')
      .eq('id', roomId)
      .single();
    return data?.is_public === true;
  } catch {
    return false;
  }
}

// GET /api/rooms/[roomId]/permissions - Load all members and their permissions for a room
// SECURITY: Supports both authenticated users and validated guests (for joining public rooms)
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`permissions:${clientId}`, rateLimiters.api);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  // Support both authenticated users and validated guests
  const user = await getUserFromRequest(request);

  // For guests, get userId from query param and validate it
  const { searchParams } = new URL(request.url);
  const guestUserId = searchParams.get('guestUserId');

  // SECURITY: Validate guest ID if provided
  if (!user && guestUserId && !validateGuestId(guestUserId)) {
    return NextResponse.json(
      { error: 'Invalid guest ID. Use /api/auth/guest to get a valid guest ID.' },
      { status: 401 }
    );
  }

  const effectiveUserId = getEffectiveUserId(user?.id, guestUserId);

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;

    // If Supabase is not configured, return error
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // SECURITY: For authenticated users, verify membership or allow them to see public room info
    // For guests, verify the room is public before allowing access
    if (user) {
      const membership = await getRoomMembership(roomId, user.id);
      if (!membership) {
        // User is authenticated but not a member - allow reading to see room info
        // They'll get limited permissions as a new joiner
      }
    } else if (guestUserId) {
      // SECURITY: Guests can only access public rooms
      const roomIsPublic = await isRoomPublic(supabase, roomId);
      if (!roomIsPublic) {
        return NextResponse.json(
          { error: 'This room requires authentication to access' },
          { status: 403 }
        );
      }
    }

    // Load room settings
    const { data: room } = await supabase
      .from('rooms')
      .select('default_role, default_permissions, require_approval, created_by')
      .eq('id', roomId)
      .single();

    // Load all members for this room
    const { data: members, error } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    if (error && error.code !== '42P01') {
      console.error('Error loading room members:', error);
      return NextResponse.json(
        { error: 'Failed to load permissions' },
        { status: 500 }
      );
    }

    // Transform database records to RoomMember format
    interface DBRoomMember {
      id: string;
      user_id: string;
      user_name: string;
      user_avatar?: string;
      role: string;
      custom_permissions?: Partial<RoomPermissions>;
      joined_at: string;
      last_active_at: string;
      invited_by?: string;
      is_banned?: boolean;
      ban_reason?: string;
    }
    const roomMembers: RoomMember[] = (members || []).map((m: DBRoomMember) => ({
      id: m.id,
      oduserId: m.user_id,
      userName: m.user_name,
      userAvatar: m.user_avatar,
      role: m.role as RoomRole,
      customPermissions: m.custom_permissions || undefined,
      joinedAt: m.joined_at,
      lastActiveAt: m.last_active_at,
      invitedBy: m.invited_by,
      isBanned: m.is_banned,
      banReason: m.ban_reason,
    }));

    // Return the current user's permissions (authenticated or guest)
    let myMember: RoomMember | null = null;
    if (effectiveUserId) {
      myMember = roomMembers.find((m) => m.oduserId === effectiveUserId) || null;

      // If user is room creator but not in members, they're the owner
      if (!myMember && room?.created_by === effectiveUserId) {
        myMember = {
          id: 'owner-' + effectiveUserId,
          oduserId: effectiveUserId,
          userName: 'Owner',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        };
      }
    }

    return NextResponse.json({
      members: roomMembers,
      defaultRole: (room?.default_role as RoomRole) || 'member',
      defaultPermissions: room?.default_permissions || null,
      requireApproval: room?.require_approval || false,
      myMember,
    });
  } catch (error) {
    console.error('Error in GET permissions:', error);
    return NextResponse.json(
      { error: 'Failed to load permissions' },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[roomId]/permissions - Add/update a member's permissions
// SECURITY: Supports authenticated users and validated guests; users can only add themselves or moderators can add others
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`permissions:${clientId}`, rateLimiters.api);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  // Support both authenticated users and validated guests
  const user = await getUserFromRequest(request);

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;
    const body = await request.json();
    const { userId, userName, userAvatar, role, listenerMode } = body;

    // SECURITY: Validate guest ID if provided
    if (!user && userId && !validateGuestId(userId)) {
      return NextResponse.json(
        { error: 'Invalid guest ID. Use /api/auth/guest to get a valid guest ID.' },
        { status: 401 }
      );
    }

    // Determine effective user ID: prefer authenticated user, fall back to validated guest ID
    const effectiveUserId = getEffectiveUserId(user?.id, userId);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: 'Valid authentication required (login or use /api/auth/guest to get a guest ID)' },
        { status: 401 }
      );
    }

    // Target user for membership: the userId in body, or the effective user
    const targetUserId = userId || effectiveUserId;

    // SECURITY: Guests can only join public rooms
    if (!user && userId) {
      const roomIsPublic = await isRoomPublic(supabase, roomId);
      if (!roomIsPublic) {
        return NextResponse.json(
          { error: 'This room requires authentication to join' },
          { status: 403 }
        );
      }
    }

    // If Supabase is not configured, return error
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // SECURITY: Check permissions based on who is being added
    // Only authenticated users can add others (moderators)
    if (targetUserId !== effectiveUserId && user) {
      // Authenticated user is trying to add someone else - must be a moderator
      const membership = await getRoomMembership(roomId, user.id);
      if (!membership || !membership.isModerator) {
        return NextResponse.json(
          { error: 'Only room moderators can add other users' },
          { status: 403 }
        );
      }
    } else if (targetUserId !== effectiveUserId && !user) {
      // Guest cannot add someone else
      return NextResponse.json(
        { error: 'Authentication required to add other users' },
        { status: 401 }
      );
    }

    // Get room default role
    const { data: room } = await supabase
      .from('rooms')
      .select('default_role')
      .eq('id', roomId)
      .single();

    // SECURITY: Non-moderators can only join as default role or lower
    // Exception: Users can explicitly request 'listener' role (lower than member)
    let memberRole = role || room?.default_role || 'member';
    if (targetUserId === effectiveUserId) {
      // User joining themselves
      if (listenerMode) {
        // Listener mode explicitly requested - allow it (listener is lower than member)
        memberRole = 'listener';
      } else {
        // Default behavior - can only get default role
        memberRole = room?.default_role || 'member';
      }
    }

    // Upsert member record
    const { data, error } = await supabase
      .from('room_members')
      .upsert({
        room_id: roomId,
        user_id: targetUserId,
        user_name: userName || (user ? 'User' : 'Guest'),
        user_avatar: userAvatar,
        role: memberRole,
        invited_by: targetUserId !== effectiveUserId ? effectiveUserId : null,
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'room_id,user_id' })
      .select()
      .single();

    if (error && error.code !== '42P01') {
      console.error('Error adding member:', error);
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      member: data ? {
        id: data.id,
        oduserId: data.user_id,
        userName: data.user_name,
        userAvatar: data.user_avatar,
        role: data.role,
        joinedAt: data.joined_at,
        lastActiveAt: data.last_active_at,
      } : null,
    });
  } catch (error) {
    console.error('Error in POST permissions:', error);
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms/[roomId]/permissions - Update a member's role or permissions
// SECURITY: Only owner or co-host can modify roles
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  console.log('[PATCH permissions] User from request:', user?.id || 'not authenticated');
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;
    const body = await request.json();
    const { userId, role, customPermissions, clearCustom } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // If Supabase is not configured, return error
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // SECURITY: Verify the authenticated user has permission to modify roles
    const requesterMembership = await getRoomMembership(roomId, user.id);
    console.log('[PATCH permissions] Requester membership:', requesterMembership);
    if (!requesterMembership || !requesterMembership.isModerator) {
      return NextResponse.json(
        { error: 'Only room owner or co-host can modify permissions' },
        { status: 403 }
      );
    }

    // SECURITY: Prevent non-owners from promoting to owner
    if (role === 'owner' && !requesterMembership.isOwner) {
      return NextResponse.json(
        { error: 'Only the room owner can promote someone to owner' },
        { status: 403 }
      );
    }

    // SECURITY: Prevent non-owners from demoting the owner
    const targetMembership = await getRoomMembership(roomId, userId);
    if (targetMembership?.isOwner && !requesterMembership.isOwner) {
      return NextResponse.json(
        { error: 'Only the room owner can modify owner permissions' },
        { status: 403 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {
      last_active_at: new Date().toISOString(),
    };

    if (role) {
      updates.role = role;
    }

    if (clearCustom) {
      updates.custom_permissions = null;
    } else if (customPermissions !== undefined) {
      // Merge with existing custom permissions
      const { data: existing } = await supabase
        .from('room_members')
        .select('custom_permissions')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      updates.custom_permissions = customPermissions === null
        ? null
        : { ...existing?.custom_permissions, ...customPermissions };
    }

    const { error } = await supabase
      .from('room_members')
      .update(updates)
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error && error.code !== '42P01') {
      console.error('Error updating member:', error);
      return NextResponse.json(
        { error: 'Failed to update member' },
        { status: 500 }
      );
    }

    // Log permission change - SECURITY: Use authenticated user ID
    if (role || customPermissions) {
      try {
        await supabase.from('room_permission_logs').insert({
          room_id: roomId,
          target_user_id: userId,
          action: role ? 'role_change' : 'permissions_update',
          old_value: null,
          new_value: role || customPermissions,
          performed_by: user.id,
        });
      } catch {
        // Ignore logging errors
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[roomId]/permissions?userId=xxx - Kick or ban a user
// SECURITY: Only owner or co-host can kick/ban users
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  // SECURITY: Require authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = getAdminSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const ban = searchParams.get('ban') === 'true';
    const banReason = searchParams.get('reason') || undefined;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // If Supabase is not configured, return error
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // SECURITY: Verify the authenticated user has permission to kick/ban
    // Only owner can kick/ban users (not co-hosts)
    const requesterMembership = await getRoomMembership(roomId, user.id);
    if (!requesterMembership || !requesterMembership.isOwner) {
      return NextResponse.json(
        { error: 'Only the room owner can kick/ban users' },
        { status: 403 }
      );
    }

    // SECURITY: Prevent owner from kicking themselves
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: 'You cannot kick/ban yourself' },
        { status: 400 }
      );
    }

    // Get room to check if target is the creator
    const { data: room } = await supabase
      .from('rooms')
      .select('created_by')
      .eq('id', roomId)
      .single();

    // Prevent kicking the room creator unless you are the creator
    if (room?.created_by === targetUserId && user.id !== room.created_by) {
      return NextResponse.json(
        { error: 'Cannot kick the room creator' },
        { status: 403 }
      );
    }

    if (ban) {
      // Add to ban list (upsert to room_bans table)
      try {
        await supabase.from('room_bans').upsert({
          room_id: roomId,
          user_id: targetUserId,
          reason: banReason,
          banned_by: user.id,
          banned_at: new Date().toISOString(),
        }, { onConflict: 'room_id,user_id' });
      } catch {
        // Ignore ban table errors
      }

      // Update member record to mark as banned
      await supabase
        .from('room_members')
        .update({
          is_banned: true,
          ban_reason: banReason,
        })
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);
    } else {
      // Just remove from members (kick)
      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);
    }

    // Log the action - SECURITY: Use authenticated user ID
    try {
      await supabase.from('room_permission_logs').insert({
        room_id: roomId,
        target_user_id: targetUserId,
        action: ban ? 'ban' : 'kick',
        new_value: banReason ? { reason: banReason } : null,
        performed_by: user.id,
      });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE permissions:', error);
    return NextResponse.json(
      { error: 'Failed to remove user' },
      { status: 500 }
    );
  }
}
