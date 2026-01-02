'use client';

import { useState, useCallback, useEffect } from 'react';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import type {
  RoomInvitationWithDetails,
  CreateInvitationInput,
  CreateInvitationResponse,
} from '@/types/invitations';

interface UseRoomInvitationsResult {
  invitations: RoomInvitationWithDetails[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createInvitation: (input: Omit<CreateInvitationInput, 'roomId'>) => Promise<CreateInvitationResponse | null>;
  revokeInvitation: (invitationId: string) => Promise<boolean>;
}

export function useRoomInvitations(roomId: string): UseRoomInvitationsResult {
  const [invitations, setInvitations] = useState<RoomInvitationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!roomId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/rooms/${roomId}/invitations`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch invitations');
      }

      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invitations');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const createInvitation = useCallback(
    async (input: Omit<CreateInvitationInput, 'roomId'>): Promise<CreateInvitationResponse | null> => {
      try {
        const response = await authFetchJson(`/api/rooms/${roomId}/invitations`, 'POST', input);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create invitation');
        }

        const data = await response.json();

        // Refresh the list
        await fetchInvitations();

        return data;
      } catch (err) {
        console.error('Failed to create invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to create invitation');
        return null;
      }
    },
    [roomId, fetchInvitations]
  );

  const revokeInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      try {
        const response = await authFetch(
          `/api/rooms/${roomId}/invitations?id=${invitationId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to revoke invitation');
        }

        // Remove from local state
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));

        return true;
      } catch (err) {
        console.error('Failed to revoke invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
        return false;
      }
    },
    [roomId]
  );

  return {
    invitations,
    isLoading,
    error,
    refresh: fetchInvitations,
    createInvitation,
    revokeInvitation,
  };
}
