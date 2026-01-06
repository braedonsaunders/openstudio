'use client';

import { useCallback } from 'react';
import { usePermissionsStore } from '@/stores/permissions-store';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import { toast } from 'sonner';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';

export function useRoomPermissions(roomId: string) {

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
      // Get current role for rollback
      const currentMember = members.find((m: RoomMember) => m.oduserId === targetUserId);
      const previousRole = currentMember?.role;

      // Update local store optimistically
      storeUpdateMemberRole(targetUserId, role);

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        const response = await authFetchJson(`/api/rooms/${roomId}/permissions`, 'PATCH', {
          userId: targetUserId,
          role,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update role');
        }
      } catch (err) {
        // Rollback on failure
        if (previousRole) {
          storeUpdateMemberRole(targetUserId, previousRole);
        }
        const message = err instanceof Error ? err.message : 'Failed to update role';
        toast.error(message);
        console.error('Failed to update role:', err);
      }
    },
    [roomId, storeUpdateMemberRole, members]
  );

  const updateUserPermissions = useCallback(
    async (targetUserId: string, customPermissions: Partial<RoomPermissions> | null) => {
      // Get current permissions for rollback
      const currentMember = members.find((m: RoomMember) => m.oduserId === targetUserId);
      const previousPermissions = currentMember?.customPermissions;

      if (customPermissions === null) {
        clearMemberCustomPermissions(targetUserId);
      } else {
        storeUpdateMemberPermissions(targetUserId, customPermissions);
      }

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        const response = await authFetchJson(`/api/rooms/${roomId}/permissions`, 'PATCH', {
          userId: targetUserId,
          customPermissions,
          clearCustom: customPermissions === null,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update permissions');
        }
      } catch (err) {
        // Rollback on failure
        if (previousPermissions) {
          storeUpdateMemberPermissions(targetUserId, previousPermissions);
        } else {
          clearMemberCustomPermissions(targetUserId);
        }
        const message = err instanceof Error ? err.message : 'Failed to update permissions';
        toast.error(message);
        console.error('Failed to update permissions:', err);
      }
    },
    [roomId, storeUpdateMemberPermissions, clearMemberCustomPermissions, members]
  );

  const kickUser = useCallback(
    async (targetUserId: string) => {
      removeMember(targetUserId);

      // Persist to database (performedBy is now derived from JWT on server)
      try {
        const response = await authFetch(
          `/api/rooms/${roomId}/permissions?userId=${targetUserId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to kick user');
        }

        toast.success('User kicked from room');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to kick user';
        toast.error(message);
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

        const response = await authFetch(`/api/rooms/${roomId}/permissions?${params}`, { method: 'DELETE' });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to ban user');
        }

        toast.success('User banned from room');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to ban user';
        toast.error(message);
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
