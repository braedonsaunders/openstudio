'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
 * Warnings are displayed inline in the AI panel (no global toasts)
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

  // Track if expiration has been handled
  const expirationHandled = useRef(false);
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
      await extendSessionAction();
      // Reset expiration tracking for the new session
      expirationHandled.current = false;
      setWarningLevel('none');
    } catch (error) {
      console.error('[useLyriaSessionTimer] Failed to extend:', error);
    } finally {
      isExtending.current = false;
    }
  }, [extendSessionAction]);

  // Timer update effect
  useEffect(() => {
    // Only track time when we have an active session
    const isActiveSession = sessionState === 'playing' || sessionState === 'connected' || sessionState === 'paused';

    if (!isActiveSession || !sessionStartedAt) {
      setRemainingSeconds(null);
      setWarningLevel('none');
      return;
    }

    // Calculate remaining time
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

      // Handle expiration (only once)
      if (remaining <= 0 && !expirationHandled.current) {
        expirationHandled.current = true;
        handleSessionExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, sessionStartedAt, maxSessionSeconds, handleSessionExpired]);

  // Reset expiration tracking when session changes
  useEffect(() => {
    if (sessionState === 'disconnected') {
      expirationHandled.current = false;
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
