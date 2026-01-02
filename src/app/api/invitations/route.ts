import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';
import type { PendingInvitation } from '@/types/invitations';

// GET /api/invitations - Get current user's pending invitations
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    // Get user's email for email-based invitations
    const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
    const userEmail = authUser?.user?.email?.toLowerCase();

    // Build query conditions
    let query = supabase
      .from('room_invitations')
      .select(`
        id,
        room_id,
        invited_by,
        message,
        expires_at,
        created_at,
        rooms!inner (
          name,
          color,
          icon
        )
      `)
      .eq('status', 'pending');

    // Filter by user ID or email
    if (userEmail) {
      query = query.or(`invited_user_id.eq.${user.id},invited_email.eq.${userEmail}`);
    } else {
      query = query.eq('invited_user_id', user.id);
    }

    // Filter out expired invitations
    query = query.or('expires_at.is.null,expires_at.gt.now()');
    query = query.order('created_at', { ascending: false });

    const { data: invitations, error } = await query;

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Get inviter details
    const inviterIds = [...new Set(invitations?.map(i => i.invited_by) || [])];
    const { data: inviters } = inviterIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url')
          .in('id', inviterIds)
      : { data: [] };

    const inviterMap = new Map(inviters?.map(i => [i.id, i]) || []);

    // Transform to response format
    const pendingInvitations: PendingInvitation[] = (invitations || []).map(inv => {
      const inviter = inviterMap.get(inv.invited_by);
      const room = inv.rooms as unknown as { name: string; color?: string; icon?: string };

      return {
        id: inv.id,
        roomId: inv.room_id,
        roomName: room?.name || 'Unknown Room',
        roomColor: room?.color,
        roomIcon: room?.icon,
        invitedBy: inv.invited_by,
        inviterName: inviter?.display_name,
        inviterAvatar: inviter?.avatar_url,
        message: inv.message,
        expiresAt: inv.expires_at,
        createdAt: inv.created_at,
      };
    });

    return NextResponse.json({ invitations: pendingInvitations });
  } catch (error) {
    console.error('Error in GET invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

// POST /api/invitations - Accept or decline an invitation
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { invitationId, action } = body;

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "accept" or "decline"' }, { status: 400 });
    }

    // Get user's email for email-based invitations
    const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
    const userEmail = authUser?.user?.email?.toLowerCase();

    // Get the invitation and verify ownership
    const { data: invitation, error: fetchError } = await supabase
      .from('room_invitations')
      .select('*, rooms!inner(name, default_role)')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found or already responded' }, { status: 404 });
    }

    // Verify the invitation is for this user
    const isForUser = invitation.invited_user_id === user.id ||
                      (userEmail && invitation.invited_email === userEmail);

    if (!isForUser) {
      return NextResponse.json({ error: 'This invitation is not for you' }, { status: 403 });
    }

    // Check if invitation is expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('room_invitations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invitationId);

      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    const room = invitation.rooms as unknown as { name: string; default_role?: string };

    if (action === 'decline') {
      // Update invitation status to declined
      await supabase
        .from('room_invitations')
        .update({
          status: 'declined',
          invited_user_id: user.id, // Set user ID for email invites
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      return NextResponse.json({ success: true, action: 'declined' });
    }

    // Accept the invitation
    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', invitation.room_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      // Just update the invitation status
      await supabase
        .from('room_invitations')
        .update({
          status: 'accepted',
          invited_user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      return NextResponse.json({
        success: true,
        action: 'accepted',
        roomId: invitation.room_id,
        role: 'member',
        message: 'Already a member',
      });
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

    // Update invitation status
    await supabase
      .from('room_invitations')
      .update({
        status: 'accepted',
        invited_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    return NextResponse.json({
      success: true,
      action: 'accepted',
      roomId: invitation.room_id,
      role: defaultRole,
    });
  } catch (error) {
    console.error('Error in POST invitation response:', error);
    return NextResponse.json({ error: 'Failed to respond to invitation' }, { status: 500 });
  }
}
