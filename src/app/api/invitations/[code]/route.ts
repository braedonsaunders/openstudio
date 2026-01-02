import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';
import type { InviteLinkInfo } from '@/types/invitations';

interface RouteContext {
  params: Promise<{ code: string }>;
}

// GET /api/invitations/[code] - Get invite link info (public, for landing page)
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { code } = await context.params;

    // Find the invitation by code
    const { data: invitation, error } = await supabase
      .from('room_invitations')
      .select(`
        id,
        room_id,
        invited_by,
        status,
        expires_at,
        rooms!inner (
          name,
          color,
          icon
        )
      `)
      .eq('invite_code', code)
      .single();

    if (error || !invitation) {
      const info: InviteLinkInfo = {
        valid: false,
        error: 'Invite link not found',
      };
      return NextResponse.json(info);
    }

    // Check status
    if (invitation.status !== 'pending') {
      const info: InviteLinkInfo = {
        valid: false,
        error: invitation.status === 'revoked'
          ? 'This invite has been revoked'
          : invitation.status === 'expired'
            ? 'This invite has expired'
            : 'This invite is no longer valid',
      };
      return NextResponse.json(info);
    }

    // Check expiration
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('room_invitations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      const info: InviteLinkInfo = {
        valid: false,
        error: 'This invite has expired',
      };
      return NextResponse.json(info);
    }

    // Get inviter info
    const { data: inviter } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', invitation.invited_by)
      .single();

    const room = invitation.rooms as { name: string; color?: string; icon?: string };

    const info: InviteLinkInfo = {
      valid: true,
      roomId: invitation.room_id,
      roomName: room?.name,
      roomColor: room?.color,
      roomIcon: room?.icon,
      inviterName: inviter?.display_name,
      expiresAt: invitation.expires_at,
    };

    return NextResponse.json(info);
  } catch (error) {
    console.error('Error in GET invite code:', error);
    return NextResponse.json({ valid: false, error: 'Failed to verify invite' });
  }
}

// POST /api/invitations/[code] - Accept invite link (requires auth)
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { code } = await context.params;

    // Find the invitation by code
    const { data: invitation, error } = await supabase
      .from('room_invitations')
      .select('*, rooms!inner(name, default_role)')
      .eq('invite_code', code)
      .eq('status', 'pending')
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 });
    }

    // Check expiration
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('room_invitations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'Invite link has expired' }, { status: 400 });
    }

    const room = invitation.rooms as { name: string; default_role?: string };

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', invitation.room_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      return NextResponse.json({
        success: true,
        roomId: invitation.room_id,
        role: 'member',
        message: 'Already a member',
      });
    }

    // Check if user is banned
    const { data: ban } = await supabase
      .from('room_bans')
      .select('id')
      .eq('room_id', invitation.room_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();

    if (ban) {
      return NextResponse.json({ error: 'You are banned from this room' }, { status: 403 });
    }

    // Get user profile for display name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    // Add user to room members
    const defaultRole = room?.default_role || 'member';
    const { error: memberError } = await supabase
      .from('room_members')
      .insert({
        room_id: invitation.room_id,
        user_id: user.id,
        user_name: userProfile?.display_name || 'User',
        user_avatar: userProfile?.avatar_url,
        role: defaultRole,
        invited_by: invitation.invited_by,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Error adding member:', memberError);
      return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }

    // Note: We don't mark link-based invitations as "accepted" since they can be reused
    // Only user-specific invitations get marked as accepted

    return NextResponse.json({
      success: true,
      roomId: invitation.room_id,
      role: defaultRole,
    });
  } catch (error) {
    console.error('Error in POST invite code:', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
