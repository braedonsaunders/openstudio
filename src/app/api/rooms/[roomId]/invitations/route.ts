import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest, getRoomMembership } from '@/lib/supabase/server';
import type { RoomInvitation, RoomInvitationWithDetails } from '@/types/invitations';

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

// GET /api/rooms/[roomId]/invitations - List all invitations for a room
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { roomId } = await context.params;

    // Verify user is a moderator of this room
    const membership = await getRoomMembership(roomId, user.id);
    if (!membership || !membership.isModerator) {
      return NextResponse.json(
        { error: 'Only room moderators can view invitations' },
        { status: 403 }
      );
    }

    // Get all invitations for this room with user details
    const { data: invitations, error } = await supabase
      .from('room_invitations')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Get inviter details
    const inviterIds = [...new Set(invitations?.map(i => i.invited_by) || [])];
    const { data: inviters } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url')
      .in('id', inviterIds);

    const inviterMap = new Map(inviters?.map(i => [i.id, i]) || []);

    // Get invited user details (for user ID invites)
    const invitedUserIds = invitations?.filter(i => i.invited_user_id).map(i => i.invited_user_id) || [];
    const { data: invitedUsers } = invitedUserIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url')
          .in('id', invitedUserIds)
      : { data: [] };

    const invitedUserMap = new Map(invitedUsers?.map(u => [u.id, u]) || []);

    // Transform to response format
    const formattedInvitations: RoomInvitationWithDetails[] = (invitations || []).map(inv => {
      const inviter = inviterMap.get(inv.invited_by);
      const invitedUser = inv.invited_user_id ? invitedUserMap.get(inv.invited_user_id) : null;

      return {
        id: inv.id,
        roomId: inv.room_id,
        invitedUserId: inv.invited_user_id,
        invitedEmail: inv.invited_email,
        invitedBy: inv.invited_by,
        status: inv.status,
        inviteCode: inv.invite_code,
        message: inv.message,
        expiresAt: inv.expires_at,
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
        roomName: '', // Not needed for room-specific list
        inviterName: inviter?.display_name,
        inviterAvatar: inviter?.avatar_url,
        invitedUserName: invitedUser?.display_name,
        invitedUserAvatar: invitedUser?.avatar_url,
      };
    });

    return NextResponse.json({ invitations: formattedInvitations });
  } catch (error) {
    console.error('Error in GET invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

// POST /api/rooms/[roomId]/invitations - Create a new invitation
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
    const { roomId } = await context.params;
    const body = await request.json();
    const { userId, email, generateLink, message, expiresInHours } = body;

    // Verify user is a moderator of this room
    const membership = await getRoomMembership(roomId, user.id);
    if (!membership || !membership.isModerator) {
      return NextResponse.json(
        { error: 'Only room moderators can create invitations' },
        { status: 403 }
      );
    }

    // Validate input - at least one target must be specified
    if (!userId && !email && !generateLink) {
      return NextResponse.json(
        { error: 'Must specify userId, email, or generateLink' },
        { status: 400 }
      );
    }

    // Check if user is already a member
    if (userId) {
      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this room' },
          { status: 400 }
        );
      }

      // Check for existing pending invitation
      const { data: existingInvite } = await supabase
        .from('room_invitations')
        .select('id')
        .eq('room_id', roomId)
        .eq('invited_user_id', userId)
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        return NextResponse.json(
          { error: 'User already has a pending invitation' },
          { status: 400 }
        );
      }
    }

    // Check for existing email invitation
    if (email) {
      const { data: existingEmailInvite } = await supabase
        .from('room_invitations')
        .select('id')
        .eq('room_id', roomId)
        .eq('invited_email', email.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (existingEmailInvite) {
        return NextResponse.json(
          { error: 'Email already has a pending invitation' },
          { status: 400 }
        );
      }
    }

    // Generate invite code if needed
    let inviteCode: string | null = null;
    if (generateLink) {
      // Generate a unique code
      const { data: codeResult } = await supabase.rpc('generate_invite_code', { length: 12 });
      inviteCode = codeResult || generateRandomCode(12);
    }

    // Calculate expiration
    let expiresAt: string | null = null;
    if (expiresInHours && expiresInHours > 0) {
      const expDate = new Date();
      expDate.setHours(expDate.getHours() + expiresInHours);
      expiresAt = expDate.toISOString();
    }

    // Create the invitation
    const { data: invitation, error } = await supabase
      .from('room_invitations')
      .insert({
        room_id: roomId,
        invited_user_id: userId || null,
        invited_email: email?.toLowerCase() || null,
        invited_by: user.id,
        invite_code: inviteCode,
        message: message || null,
        expires_at: expiresAt,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Build invite link if code was generated
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || '';
    const inviteLink = inviteCode ? `${baseUrl}/invite/${inviteCode}` : undefined;

    const response: RoomInvitation = {
      id: invitation.id,
      roomId: invitation.room_id,
      invitedUserId: invitation.invited_user_id,
      invitedEmail: invitation.invited_email,
      invitedBy: invitation.invited_by,
      status: invitation.status,
      inviteCode: invitation.invite_code,
      message: invitation.message,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
      updatedAt: invitation.updated_at,
    };

    return NextResponse.json({ invitation: response, inviteLink });
  } catch (error) {
    console.error('Error in POST invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}

// DELETE /api/rooms/[roomId]/invitations?id=xxx - Revoke an invitation
export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { roomId } = await context.params;
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Verify user is a moderator of this room
    const membership = await getRoomMembership(roomId, user.id);
    if (!membership || !membership.isModerator) {
      return NextResponse.json(
        { error: 'Only room moderators can revoke invitations' },
        { status: 403 }
      );
    }

    // Update invitation status to revoked
    const { error } = await supabase
      .from('room_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('room_id', roomId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error revoking invitation:', error);
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE invitation:', error);
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
  }
}

// Helper to generate random code (fallback if DB function doesn't exist)
function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
