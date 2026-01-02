'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import { useAuthStore } from '@/stores/auth-store';
import type { PendingInvitation, AcceptInvitationResponse } from '@/types/invitations';

interface UseMyInvitationsResult {
  invitations: PendingInvitation[];
  count: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<AcceptInvitationResponse | null>;
  declineInvitation: (invitationId: string) => Promise<boolean>;
}

export function useMyInvitations(): UseMyInvitationsResult {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const hasFetched = useRef(false);

  const fetchInvitations = useCallback(async () => {
    if (!user) {
      setInvitations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authFetch('/api/invitations');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch invitations');
      }

      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Failed to fetch my invitations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invitations');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    if (isInitialized && user && !hasFetched.current) {
      hasFetched.current = true;
      fetchInvitations();
    } else if (!user) {
      hasFetched.current = false;
      setInvitations([]);
      setIsLoading(false);
    }
  }, [isInitialized, user, fetchInvitations]);

  const acceptInvitation = useCallback(
    async (invitationId: string): Promise<AcceptInvitationResponse | null> => {
      try {
        const response = await authFetchJson('/api/invitations', 'POST', {
          invitationId,
          action: 'accept',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to accept invitation');
        }

        const data = await response.json();

        // Remove from local state
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));

        return {
          success: true,
          roomId: data.roomId,
          role: data.role,
        };
      } catch (err) {
        console.error('Failed to accept invitation:', err);
        return {
          success: false,
          roomId: '',
          role: '',
          error: err instanceof Error ? err.message : 'Failed to accept invitation',
        };
      }
    },
    []
  );

  const declineInvitation = useCallback(
    async (invitationId: string): Promise<boolean> => {
      try {
        const response = await authFetchJson('/api/invitations', 'POST', {
          invitationId,
          action: 'decline',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to decline invitation');
        }

        // Remove from local state
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));

        return true;
      } catch (err) {
        console.error('Failed to decline invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to decline invitation');
        return false;
      }
    },
    []
  );

  return {
    invitations,
    count: invitations.length,
    isLoading,
    error,
    refresh: fetchInvitations,
    acceptInvitation,
    declineInvitation,
  };
}

// Hook for accepting invite links
interface UseInviteLinkResult {
  isLoading: boolean;
  error: string | null;
  roomInfo: {
    valid: boolean;
    roomId?: string;
    roomName?: string;
    roomColor?: string;
    roomIcon?: string;
    inviterName?: string;
    expiresAt?: string;
    error?: string;
  } | null;
  fetchLinkInfo: (code: string) => Promise<void>;
  acceptInviteLink: (code: string) => Promise<AcceptInvitationResponse | null>;
}

export function useInviteLink(): UseInviteLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<UseInviteLinkResult['roomInfo']>(null);

  const fetchLinkInfo = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${code}`);
      const data = await response.json();

      setRoomInfo(data);

      if (!data.valid) {
        setError(data.error || 'Invalid invite link');
      }
    } catch (err) {
      console.error('Failed to fetch invite link info:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify invite link');
      setRoomInfo({ valid: false, error: 'Failed to verify invite link' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acceptInviteLink = useCallback(
    async (code: string): Promise<AcceptInvitationResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authFetchJson(`/api/invitations/${code}`, 'POST', {});

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to accept invitation');
        }

        const data = await response.json();

        return {
          success: true,
          roomId: data.roomId,
          role: data.role,
        };
      } catch (err) {
        console.error('Failed to accept invite link:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation';
        setError(errorMessage);
        return {
          success: false,
          roomId: '',
          role: '',
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    error,
    roomInfo,
    fetchLinkInfo,
    acceptInviteLink,
  };
}
