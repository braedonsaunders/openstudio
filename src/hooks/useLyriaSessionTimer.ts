'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useLyriaStore } from '@/stores/lyria-store';

export type SessionWarningLevel = 'none' | 'info' | 'warning' | 'urgent' | 'expired';

interface SessionTimerState {
  remainingSeconds: number | null;
  warningLevel: SessionWarningLevel;
  isPlaying: boolean;
  isSessionExpired: boolean;
  extendSession: () => Promise<void>;
  formattedTime: string;
}

// Warning thresholds in seconds
const WARNING_THRESHOLDS = {
  INFO: 120,     // 2 minutes - "Extend" button appears
  WARNING: 60,   // 1 minute - yellow warning
  URGENT: 30,    // 30 seconds - red urgent
};

/**
 * Hook to track Lyria session time remaining and handle expiration
 * Shows progressive toast warnings and provides extend session functionality
 */
export function useLyriaSessionTimer(): SessionTimerState {
  const sessionState = useLyriaStore((s) => s.sessionState);
  const sessionStartedAt = useLyriaStore((s) => s.sessionStartedAt);
  const maxSessionSeconds = useLyriaStore((s) => s.maxSessionSeconds);
  const isSessionExpired = useLyriaStore((s) => s.isSessionExpired);
  const extendSessionAction = useLyriaStore((s) => s.extendSession);
  const handleSessionExpired = useLyriaStore((s) => s.handleSessionExpired);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [warningLevel, setWarningLevel] = useState<SessionWarningLevel>('none');

  // Track which warnings have been shown to avoid duplicates
  const warningsShown = useRef<Set<number>>(new Set());
  const isExtending = useRef(false);

  // Formatted time display (MM:SS)
  const formattedTime = remainingSeconds !== null
    ? `${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, '0')}`
    : '--:--';

  // Extend session with loading state handling
  const extendSession = useCallback(async () => {
    if (isExtending.current) return;
    isExtending.current = true;

    try {
      toast.loading('Extending session...', { id: 'lyria-extend' });
      await extendSessionAction();
      toast.success('Session extended! You have another 10 minutes.', { id: 'lyria-extend' });

      // Reset warnings for the new session
      warningsShown.current.clear();
      setWarningLevel('none');
    } catch (error) {
      toast.error('Failed to extend session. Please try again.', { id: 'lyria-extend' });
      console.error('[useLyriaSessionTimer] Failed to extend:', error);
    } finally {
      isExtending.current = false;
    }
  }, [extendSessionAction]);

  // Timer update effect
  useEffect(() => {
    // Only track time when playing and we have a start time
    if (sessionState !== 'playing' || !sessionStartedAt) {
      // Keep showing remaining time if connected but not playing
      if (sessionState === 'connected' && sessionStartedAt) {
        const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
        const remaining = Math.max(0, maxSessionSeconds - elapsed);
        setRemainingSeconds(remaining);
      } else {
        setRemainingSeconds(null);
        setWarningLevel('none');
      }
      return;
    }

    // Initial calculation
    const calculateRemaining = () => {
      const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
      return Math.max(0, maxSessionSeconds - elapsed);
    };

    setRemainingSeconds(calculateRemaining());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      // Determine warning level
      if (remaining <= 0) {
        setWarningLevel('expired');
      } else if (remaining <= WARNING_THRESHOLDS.URGENT) {
        setWarningLevel('urgent');
      } else if (remaining <= WARNING_THRESHOLDS.WARNING) {
        setWarningLevel('warning');
      } else if (remaining <= WARNING_THRESHOLDS.INFO) {
        setWarningLevel('info');
      } else {
        setWarningLevel('none');
      }

      // Show toast warnings at thresholds (only once per threshold)
      if (remaining <= WARNING_THRESHOLDS.URGENT && !warningsShown.current.has(WARNING_THRESHOLDS.URGENT)) {
        toast.error('Session ending in 30 seconds!', {
          description: 'Click "Extend" to continue playing',
          duration: 10000,
          action: {
            label: 'Extend Now',
            onClick: extendSession,
          },
        });
        warningsShown.current.add(WARNING_THRESHOLDS.URGENT);
      } else if (remaining <= WARNING_THRESHOLDS.WARNING && !warningsShown.current.has(WARNING_THRESHOLDS.WARNING)) {
        toast.warning('Session ending in 1 minute', {
          description: 'Extend your session to keep the music playing',
          duration: 8000,
        });
        warningsShown.current.add(WARNING_THRESHOLDS.WARNING);
      } else if (remaining <= WARNING_THRESHOLDS.INFO && !warningsShown.current.has(WARNING_THRESHOLDS.INFO)) {
        toast.info('Session ending in 2 minutes', {
          description: 'Click "Extend" in the AI panel to continue',
          duration: 6000,
        });
        warningsShown.current.add(WARNING_THRESHOLDS.INFO);
      }

      // Handle expiration
      if (remaining <= 0 && !warningsShown.current.has(0)) {
        warningsShown.current.add(0);
        handleSessionExpired();
        toast.error('Session ended (10-minute limit)', {
          description: 'Click "Reconnect" to start a new session',
          duration: 15000,
          action: {
            label: 'Reconnect',
            onClick: extendSession,
          },
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, sessionStartedAt, maxSessionSeconds, handleSessionExpired, extendSession]);

  // Reset warnings when session changes
  useEffect(() => {
    if (sessionState === 'disconnected') {
      warningsShown.current.clear();
      setWarningLevel('none');
    }
  }, [sessionState]);

  return {
    remainingSeconds,
    warningLevel,
    isPlaying: sessionState === 'playing',
    isSessionExpired,
    extendSession,
    formattedTime,
  };
}
