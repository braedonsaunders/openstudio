import { getAdminSupabase } from '@/lib/supabase/server';
import { getEffectivePermissions, type RoomPermissions, type RoomRole } from '@/types/permissions';

export interface NativeBridgeAccess {
  allowed: boolean;
  reason?: string;
  role?: RoomRole;
  userName?: string;
}

interface RoomAccessRow {
  created_by?: string;
  default_role?: string;
  default_permissions?: Partial<RoomPermissions> | null;
}

interface RoomMemberAccessRow {
  user_name?: string;
  role?: string;
  custom_permissions?: Partial<RoomPermissions> | null;
  is_banned?: boolean | null;
}

function asRoomRole(value: string | undefined): RoomRole {
  const allowed: RoomRole[] = ['owner', 'co-host', 'performer', 'member', 'listener'];
  return allowed.includes(value as RoomRole) ? value as RoomRole : 'member';
}

export async function resolveNativeBridgeAccess(
  roomId: string,
  userId: string,
  preferredUserName?: string
): Promise<NativeBridgeAccess> {
  const supabase = getAdminSupabase();
  if (!supabase) {
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, reason: 'Database not configured' };
    }
    return { allowed: true, role: 'owner', userName: preferredUserName || userId };
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('created_by, default_role, default_permissions')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return { allowed: false, reason: 'Room not found' };
  }

  const roomData = room as RoomAccessRow;
  let role: RoomRole;
  let customPermissions: Partial<RoomPermissions> | undefined;
  let userName = preferredUserName || userId;

  if (roomData.created_by === userId) {
    role = 'owner';
  } else {
    const { data: member } = await supabase
      .from('room_members')
      .select('user_name, role, custom_permissions, is_banned')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    const memberData = member as RoomMemberAccessRow | null;
    if (memberData?.is_banned) {
      return { allowed: false, reason: 'User is banned from this room' };
    }

    role = asRoomRole(memberData?.role || roomData.default_role);
    customPermissions = memberData?.custom_permissions || roomData.default_permissions || undefined;
    userName = memberData?.user_name || userName;
  }

  const permissions = getEffectivePermissions(role, customPermissions);
  if (!permissions.recording.record) {
    return { allowed: false, reason: 'Native bridge performance requires recording permission', role, userName };
  }

  return { allowed: true, role, userName };
}
