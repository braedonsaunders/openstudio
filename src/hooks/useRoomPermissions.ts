'use client';

import { useCallback } from 'react';
import { usePermissionsStore } from '@/stores/permissions-store';
import { useAuthStore } from '@/stores/auth-store';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';

export function useRoomPermissions(roomId: string) {
  const authUser = useAuthStore((state) => state.user);
  const userId = authUser?.id || '';

  const {
    members,
    defaultRole,
    requireApproval,
    myRole,
    myPermissions,
    updateMemberRole: storeUpdateMemberRole,
    updateMemberPermissions: storeUpdateMemberPermissions,
    clearMemberCustomPermissions,
    removeMember,
    setDefaultRole: storeSetDefaultRole,
    setRequireApproval: storeSetRequireApproval,
  } = usePermissionsStore();

  const updateUserRole = useCallback(
    async (targetUserId: string, role: RoomRole) => {
      // Update local store
      storeUpdateMemberRole(targetUserId, role);

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        await authFetchJson(`/api/rooms/${roomId}/permissions`, 'PATCH', {
          userId: targetUserId,
          role,
        });
      } catch (err) {
        console.error('Failed to update role:', err);
      }
    },
    [roomId, storeUpdateMemberRole]
  );

  const updateUserPermissions = useCallback(
    async (targetUserId: string, customPermissions: Partial<RoomPermissions> | null) => {
      if (customPermissions === null) {
        clearMemberCustomPermissions(targetUserId);
      } else {
        storeUpdateMemberPermissions(targetUserId, customPermissions);
      }

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        await authFetchJson(`/api/rooms/${roomId}/permissions`, 'PATCH', {
          userId: targetUserId,
          customPermissions,
          clearCustom: customPermissions === null,
        });
      } catch (err) {
        console.error('Failed to update permissions:', err);
      }
    },
    [roomId, storeUpdateMemberPermissions, clearMemberCustomPermissions]
  );

  const kickUser = useCallback(
    async (targetUserId: string) => {
      removeMember(targetUserId);

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        await authFetch(
          `/api/rooms/${roomId}/permissions?userId=${targetUserId}`,
          { method: 'DELETE' }
        );
      } catch (err) {
        console.error('Failed to kick user:', err);
      }
    },
    [roomId, removeMember]
  );

  const banUser = useCallback(
    async (targetUserId: string, reason?: string) => {
      removeMember(targetUserId);

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        const params = new URLSearchParams({
          userId: targetUserId,
          ban: 'true',
        });
        if (reason) params.set('reason', reason);

        await authFetch(`/api/rooms/${roomId}/permissions?${params}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to ban user:', err);
      }
    },
    [roomId, removeMember]
  );

  const setDefaultRole = useCallback(
    async (role: RoomRole) => {
      storeSetDefaultRole(role);

      // TODO: Persist to database when rooms table is updated
    },
    [storeSetDefaultRole]
  );

  const setRequireApproval = useCallback(
    async (require: boolean) => {
      storeSetRequireApproval(require);

      // TODO: Persist to database when rooms table is updated
    },
    [storeSetRequireApproval]
  );

  return {
    members,
    defaultRole,
    requireApproval,
    myRole,
    myPermissions,
    updateUserRole,
    updateUserPermissions,
    kickUser,
    banUser,
    setDefaultRole,
    setRequireApproval,
  };
}
