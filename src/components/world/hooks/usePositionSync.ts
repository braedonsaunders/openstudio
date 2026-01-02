'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useSpring, useMotionValue } from 'framer-motion';
import { useRoomStore, type WorldPosition } from '@/stores/room-store';
import type { EntityState } from '../types';

// Position change threshold (percentage) - only broadcast if moved more than this
const POSITION_CHANGE_THRESHOLD = 0.5;

// Broadcast throttle interval (ms) - maximum 10 updates per second
const BROADCAST_INTERVAL = 100;

// Staleness threshold (ms) - remove positions older than this
const STALE_THRESHOLD = 5000;

/**
 * Hook to broadcast local user's position to other clients.
 * Throttles updates and only sends when position changes significantly.
 */
export function usePositionBroadcast(
  localPosition: EntityState | null,
  userId: string | null,
  broadcastFn: ((position: Omit<WorldPosition, 'userId' | 'timestamp'>) => Promise<void>) | null,
  isVisible: boolean = true
) {
  const lastBroadcastRef = useRef<{ position: EntityState; time: number } | null>(null);

  useEffect(() => {
    if (!isVisible || !localPosition || !userId || !broadcastFn) return;

    const now = Date.now();
    const last = lastBroadcastRef.current;

    // Throttle: don't broadcast more often than BROADCAST_INTERVAL
    if (last && now - last.time < BROADCAST_INTERVAL) return;

    // Check if position changed significantly
    if (last) {
      const dx = Math.abs(localPosition.x - last.position.x);
      const dy = Math.abs(localPosition.y - last.position.y);
      const directionChanged = localPosition.facingRight !== last.position.facingRight;
      const walkingChanged = localPosition.isWalking !== last.position.isWalking;

      // Only broadcast if something changed
      if (dx < POSITION_CHANGE_THRESHOLD && dy < POSITION_CHANGE_THRESHOLD && !directionChanged && !walkingChanged) {
        return;
      }
    }

    // Broadcast position
    lastBroadcastRef.current = { position: localPosition, time: now };

    broadcastFn({
      x: localPosition.x,
      y: localPosition.y,
      facingRight: localPosition.facingRight,
      isWalking: localPosition.isWalking,
      targetX: localPosition.targetX,
      targetY: localPosition.targetY,
    }).catch((err) => {
      console.warn('[WorldPositionSync] Broadcast failed:', err);
    });
  }, [localPosition, userId, broadcastFn, isVisible]);
}

/**
 * Hook to receive and store remote positions.
 * Sets up listener for world:position events.
 */
export function usePositionReceiver(
  currentUserId: string | null,
  onPositionReceived: ((position: WorldPosition) => void) | null,
  isVisible: boolean = true
) {
  const setWorldPosition = useRoomStore((state) => state.setWorldPosition);
  const removeWorldPosition = useRoomStore((state) => state.removeWorldPosition);

  // Handle incoming position updates
  const handlePosition = useCallback(
    (data: unknown) => {
      if (!isVisible) return;

      const position = data as WorldPosition;

      // Ignore our own position
      if (position.userId === currentUserId) return;

      // Store in room store
      setWorldPosition(position.userId, position);

      // Call optional callback
      onPositionReceived?.(position);
    },
    [currentUserId, setWorldPosition, onPositionReceived, isVisible]
  );

  return { handlePosition, removeWorldPosition };
}

/**
 * Hook to clean up stale positions (from users who left).
 * Runs periodically to remove old entries.
 */
export function useStalePositionCleanup(interval: number = 2000) {
  const worldPositions = useRoomStore((state) => state.worldPositions);
  const removeWorldPosition = useRoomStore((state) => state.removeWorldPosition);

  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();

      worldPositions.forEach((position, userId) => {
        if (now - position.timestamp > STALE_THRESHOLD) {
          removeWorldPosition(userId);
        }
      });
    };

    const intervalId = setInterval(cleanup, interval);

    return () => clearInterval(intervalId);
  }, [worldPositions, removeWorldPosition, interval]);
}

/**
 * Hook to interpolate a remote user's position for smooth movement.
 * Returns spring-animated x and y values.
 */
export function useInterpolatedPosition(
  targetPosition: WorldPosition | null,
  config?: {
    stiffness?: number;
    damping?: number;
  }
) {
  const { stiffness = 80, damping = 15 } = config || {};

  // Create spring values
  const x = useMotionValue(targetPosition?.x ?? 50);
  const y = useMotionValue(targetPosition?.y ?? 50);

  const springX = useSpring(x, { stiffness, damping });
  const springY = useSpring(y, { stiffness, damping });

  // Update target when position changes
  useEffect(() => {
    if (targetPosition) {
      x.set(targetPosition.x);
      y.set(targetPosition.y);
    }
  }, [targetPosition, x, y]);

  return {
    x: springX,
    y: springY,
    facingRight: targetPosition?.facingRight ?? true,
    isWalking: targetPosition?.isWalking ?? false,
  };
}

/**
 * Combined hook for full position sync functionality.
 * Handles broadcasting local position and receiving remote positions.
 */
export function useWorldPositionSync(
  localPosition: EntityState | null,
  currentUserId: string | null,
  broadcastFn: ((position: Omit<WorldPosition, 'userId' | 'timestamp'>) => Promise<void>) | null,
  isVisible: boolean = true
) {
  // Broadcast local position
  usePositionBroadcast(localPosition, currentUserId, broadcastFn, isVisible);

  // Get remote positions from store
  const worldPositions = useRoomStore((state) => state.worldPositions);

  // Clean up stale positions
  useStalePositionCleanup();

  // Return remote positions (excluding current user)
  const remotePositions = useMemo(() => {
    const result = new Map<string, WorldPosition>();
    worldPositions.forEach((pos, id) => {
      if (id !== currentUserId) {
        result.set(id, pos);
      }
    });
    return result;
  }, [worldPositions, currentUserId]);

  return {
    remotePositions,
    localPosition,
  };
}

/**
 * Hook to get all positions (local + remote) for rendering.
 * Local user's position comes from local state, remote from store.
 */
export function useCombinedPositions(
  localUserId: string | null,
  localPosition: EntityState | null
): Map<string, EntityState | WorldPosition> {
  const remotePositions = useRoomStore((state) => state.worldPositions);

  return useMemo(() => {
    const combined = new Map<string, EntityState | WorldPosition>();

    // Add remote positions first
    remotePositions.forEach((pos, id) => {
      if (id !== localUserId) {
        combined.set(id, pos);
      }
    });

    // Add local position (overwrites if somehow duplicated)
    if (localUserId && localPosition) {
      combined.set(localUserId, localPosition);
    }

    return combined;
  }, [remotePositions, localUserId, localPosition]);
}
