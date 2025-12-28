'use client';

import { useCallback } from 'react';
import { usePermissionsStore } from '@/stores/permissions-store';
import { useAuthStore } from '@/stores/auth-store';
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

      // Persist to database
      try {
        await fetch(`/api/rooms/${roomId}/permissions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetUserId,
            role,
            performedBy: userId,
          }),
        });
      } catch (err) {
        console.error('Failed to update role:', err);
      }
    },
    [roomId, userId, storeUpdateMemberRole]
  );

  const updateUserPermissions = useCallback(
    async (targetUserId: string, customPermissions: Partial<RoomPermissions> | null) => {
      if (customPermissions === null) {
        clearMemberCustomPermissions(targetUserId);
      } else {
        storeUpdateMemberPermissions(targetUserId, customPermissions);
      }

      // Persist to database
      try {
        await fetch(`/api/rooms/${roomId}/permissions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetUserId,
            customPermissions,
            clearCustom: customPermissions === null,
            performedBy: userId,
          }),
        });
      } catch (err) {
        console.error('Failed to update permissions:', err);
      }
    },
    [roomId, userId, storeUpdateMemberPermissions, clearMemberCustomPermissions]
  );

  const kickUser = useCallback(
    async (targetUserId: string) => {
      removeMember(targetUserId);

      try {
        await fetch(
          `/api/rooms/${roomId}/permissions?userId=${targetUserId}&performedBy=${userId}`,
          { method: 'DELETE' }
        );
      } catch (err) {
        console.error('Failed to kick user:', err);
      }
    },
    [roomId, userId, removeMember]
  );

  const banUser = useCallback(
    async (targetUserId: string, reason?: string) => {
      removeMember(targetUserId);

      try {
        const params = new URLSearchParams({
          userId: targetUserId,
          ban: 'true',
          performedBy: userId,
        });
        if (reason) params.set('reason', reason);

        await fetch(`/api/rooms/${roomId}/permissions?${params}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to ban user:', err);
      }
    },
    [roomId, userId, removeMember]
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
