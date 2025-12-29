import { NextRequest, NextResponse } from 'next/server';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';
import { getSupabase } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// GET /api/rooms/[roomId]/permissions - Load all members and their permissions for a room
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // If Supabase is not configured, return empty response
    if (!supabase) {
      return NextResponse.json({
        members: [],
        defaultRole: 'member',
        requireApproval: false,
      });
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

    // If userId is provided, also return the user's own permissions
    let myMember: RoomMember | null = null;
    if (userId) {
      myMember = roomMembers.find((m) => m.oduserId === userId) || null;

      // If user is room creator but not in members, they're the owner
      if (!myMember && room?.created_by === userId) {
        myMember = {
          id: 'owner-' + userId,
          oduserId: userId,
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
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const body = await request.json();
    const { userId, userName, userAvatar, role, invitedBy } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // If Supabase is not configured, just return success
    if (!supabase) {
      return NextResponse.json({ success: true, role: role || 'member' });
    }

    // Get room default role
    const { data: room } = await supabase
      .from('rooms')
      .select('default_role')
      .eq('id', roomId)
      .single();

    const memberRole = role || room?.default_role || 'member';

    // Upsert member record
    const { data, error } = await supabase
      .from('room_members')
      .upsert({
        room_id: roomId,
        user_id: userId,
        user_name: userName || 'User',
        user_avatar: userAvatar,
        role: memberRole,
        invited_by: invitedBy,
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
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

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

    // If Supabase is not configured, just return success
    if (!supabase) {
      return NextResponse.json({ success: true });
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

    // Log permission change
    if (role || customPermissions) {
      try {
        await supabase.from('room_permission_logs').insert({
          room_id: roomId,
          target_user_id: userId,
          action: role ? 'role_change' : 'permissions_update',
          old_value: null,
          new_value: role || customPermissions,
          performed_by: body.performedBy || 'unknown',
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
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const supabase = getSupabase();

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const ban = searchParams.get('ban') === 'true';
    const banReason = searchParams.get('reason') || undefined;
    const performedBy = searchParams.get('performedBy') || 'unknown';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // If Supabase is not configured, just return success
    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    if (ban) {
      // Add to ban list (upsert to room_bans table)
      try {
        await supabase.from('room_bans').upsert({
          room_id: roomId,
          user_id: userId,
          reason: banReason,
          banned_by: performedBy,
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
        .eq('user_id', userId);
    } else {
      // Just remove from members (kick)
      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);
    }

    // Log the action
    try {
      await supabase.from('room_permission_logs').insert({
        room_id: roomId,
        target_user_id: userId,
        action: ban ? 'ban' : 'kick',
        new_value: banReason ? { reason: banReason } : null,
        performed_by: performedBy,
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
