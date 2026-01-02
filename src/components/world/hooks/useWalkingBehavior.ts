'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { SceneGroundConfig } from '../scene-config';
import type { EntityState, WalkingConfig, ExclusionZone, AudioLevels } from '../types';
import { DEFAULT_WALKING_CONFIG } from '../types';
import { useVisibilityAwareAnimationFrame } from './useWorldVisibility';

// ============================================
// Collision Detection Utilities
// ============================================

// Check if a position would collide with any other entity
function wouldCollide(
  x: number,
  y: number,
  otherPositions: Array<{ x: number; y: number }>,
  minDistance: number
): boolean {
  for (const other of otherPositions) {
    const dx = x - other.x;
    const dy = y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistance) {
      return true;
    }
  }
  return false;
}

// Find a position that avoids collisions
function findNonCollidingPosition(
  baseX: number,
  baseY: number,
  otherPositions: Array<{ x: number; y: number }>,
  walkableArea: { minX: number; maxX: number; minY: number; maxY: number },
  minDistance: number,
  maxAttempts: number = 8
): { x: number; y: number } {
  if (!wouldCollide(baseX, baseY, otherPositions, minDistance)) {
    return { x: baseX, y: baseY };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = (attempt / maxAttempts) * Math.PI * 2;
    const distance = minDistance + Math.random() * 5;
    const newX = baseX + Math.cos(angle) * distance;
    const newY = baseY + Math.sin(angle) * distance;

    const clampedX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, newX));
    const clampedY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, newY));

    if (!wouldCollide(clampedX, clampedY, otherPositions, minDistance)) {
      return { x: clampedX, y: clampedY };
    }
  }

  return { x: baseX, y: baseY };
}

// ============================================
// Exclusion Zone Utilities
// ============================================

function isInsideExclusionZone(x: number, y: number, zones: ExclusionZone[]): boolean {
  for (const zone of zones) {
    if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) {
      return true;
    }
  }
  return false;
}

function pathCrossesExclusionZone(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zones: ExclusionZone[]
): boolean {
  if (zones.length === 0) return false;

  if (isInsideExclusionZone(x1, y1, zones) || isInsideExclusionZone(x2, y2, zones)) {
    return true;
  }

  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (isInsideExclusionZone(px, py, zones)) {
      return true;
    }
  }
  return false;
}

function pushOutOfExclusionZone(
  x: number,
  y: number,
  zones: ExclusionZone[],
  walkableArea: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  for (const zone of zones) {
    if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) {
      const distToLeft = x - zone.minX;
      const distToRight = zone.maxX - x;
      const distToTop = y - zone.minY;
      const distToBottom = zone.maxY - y;

      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

      if (minDist === distToLeft) x = zone.minX - 3;
      else if (minDist === distToRight) x = zone.maxX + 3;
      else if (minDist === distToTop) y = zone.minY - 3;
      else y = zone.maxY + 3;

      x = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, x));
      y = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, y));
    }
  }
  return { x, y };
}

// ============================================
// Spawn Position Generation
// ============================================

function generateSpawnPosition(
  config: WalkingConfig,
  groundConfig: SceneGroundConfig,
  otherPositions: Array<{ x: number; y: number }>
): { x: number; y: number } {
  const { walkableArea } = groundConfig;

  let x: number, y: number;

  if (config.spawnBias === 'bottom' && config.spawnMinY) {
    // Spawn in bottom area only
    x = walkableArea.minX + 5 + Math.random() * (walkableArea.maxX - walkableArea.minX - 10);
    y = config.spawnMinY + Math.random() * (walkableArea.maxY - config.spawnMinY - 3);
  } else {
    // Distributed spawning
    x = walkableArea.minX + Math.random() * (walkableArea.maxX - walkableArea.minX);
    y = walkableArea.minY + Math.random() * (walkableArea.maxY - walkableArea.minY);
  }

  // Avoid exclusion zones
  if (config.exclusionZones) {
    const pushed = pushOutOfExclusionZone(x, y, config.exclusionZones, walkableArea);
    x = pushed.x;
    y = pushed.y;
  }

  // Avoid collisions
  return findNonCollidingPosition(x, y, otherPositions, walkableArea, config.minEntityDistance);
}

// ============================================
// Target Position Generation
// ============================================

function generateTargetPosition(
  currentX: number,
  currentY: number,
  config: WalkingConfig,
  groundConfig: SceneGroundConfig,
  otherPositions: Array<{ x: number; y: number }>
): { x: number; y: number } | null {
  const { walkableArea } = groundConfig;
  const maxStepX = 12;
  const maxStepY = 10;

  // For bottom bias, constrain targets to bottom area
  const targetMinY = config.spawnBias === 'bottom' && config.spawnMinY
    ? config.spawnMinY
    : walkableArea.minY;

  for (let attempt = 0; attempt < 8; attempt++) {
    const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
    const offsetY = (Math.random() - 0.3) * 2 * maxStepY;

    let targetX = currentX + offsetX;
    let targetY = currentY + offsetY;

    // Clamp to walkable area
    targetX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, targetX));
    targetY = Math.max(targetMinY, Math.min(walkableArea.maxY, targetY));

    // Push out of exclusion zones
    if (config.exclusionZones) {
      const pushed = pushOutOfExclusionZone(targetX, targetY, config.exclusionZones, walkableArea);
      targetX = pushed.x;
      targetY = pushed.y;
    }

    // Find non-colliding position
    const nonColliding = findNonCollidingPosition(
      targetX,
      targetY,
      otherPositions,
      walkableArea,
      config.minEntityDistance
    );

    // Check if path crosses exclusion zones
    if (config.exclusionZones && pathCrossesExclusionZone(
      currentX, currentY, nonColliding.x, nonColliding.y, config.exclusionZones
    )) {
      continue;
    }

    return nonColliding;
  }

  return null;
}

// ============================================
// Initial State Creation
// ============================================

function createInitialState(
  x: number,
  y: number,
  config: WalkingConfig
): EntityState {
  return {
    x,
    y,
    targetX: x,
    targetY: y,
    facingRight: Math.random() > 0.5,
    isWalking: false,
    isSettling: false,
    walkTimer: 0,
    idleTimer: config.idleDuration[0] + Math.random() * (config.idleDuration[1] - config.idleDuration[0]),
    settlingTimer: 0,
    timestamp: Date.now(),
  };
}

// ============================================
// Entity State Update Logic
// ============================================

function updateEntityState(
  state: EntityState,
  deltaTime: number,
  config: WalkingConfig,
  groundConfig: SceneGroundConfig,
  otherPositions: Array<{ x: number; y: number }>,
  audioLevel: number,
  tempoMultiplier: number
): EntityState {
  const { walkableArea } = groundConfig;
  const updated = { ...state, timestamp: Date.now() };

  // Audio reactive: stop walking when making sound
  if (config.audioReactive && audioLevel > (config.audioThreshold || 0.15)) {
    if (updated.isWalking) {
      updated.isWalking = false;
      updated.isSettling = true;
      updated.settlingTimer = config.settlingDuration;
    }
    updated.idleTimer = config.idleDuration[0]; // Reset idle timer
    return updated;
  }

  // Calculate effective walk speed (affected by tempo)
  const effectiveSpeed = config.tempoInfluence
    ? config.walkSpeed * tempoMultiplier
    : config.walkSpeed;

  if (updated.isWalking) {
    const dx = updated.targetX - updated.x;
    const dy = updated.targetY - updated.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1 || updated.walkTimer <= 0) {
      // Arrived or time's up
      updated.x = distance < 1 ? updated.targetX : updated.x;
      updated.y = distance < 1 ? updated.targetY : updated.y;
      updated.x = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, updated.x));
      updated.y = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, updated.y));
      updated.isWalking = false;
      updated.isSettling = true;
      updated.settlingTimer = config.settlingDuration;
    } else {
      // Move toward target
      const moveX = (dx / distance) * effectiveSpeed * deltaTime;
      const moveY = (dy / distance) * effectiveSpeed * deltaTime;
      let newX = updated.x + moveX;
      let newY = updated.y + moveY;

      // Clamp to walkable area
      newX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, newX));
      newY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, newY));

      // Stop if about to enter exclusion zone
      if (config.exclusionZones && isInsideExclusionZone(newX, newY, config.exclusionZones)) {
        updated.isWalking = false;
        updated.isSettling = true;
        updated.settlingTimer = config.settlingDuration;
        return updated;
      }

      // Stop if about to collide
      if (wouldCollide(newX, newY, otherPositions, config.minEntityDistance)) {
        updated.isWalking = false;
        updated.isSettling = true;
        updated.settlingTimer = config.settlingDuration;
        return updated;
      }

      updated.x = newX;
      updated.y = newY;
      updated.walkTimer -= deltaTime;
      updated.facingRight = dx > 0;
    }
  } else if (updated.isSettling) {
    updated.settlingTimer -= deltaTime;
    if (updated.settlingTimer <= 0) {
      updated.isSettling = false;
      updated.idleTimer = config.idleDuration[0] + Math.random() * (config.idleDuration[1] - config.idleDuration[0]);
    }
  } else {
    // Idle state
    updated.idleTimer -= deltaTime;
    if (updated.idleTimer <= 0) {
      const target = generateTargetPosition(
        updated.x,
        updated.y,
        config,
        groundConfig,
        otherPositions
      );

      if (target) {
        updated.targetX = target.x;
        updated.targetY = target.y;
        updated.isWalking = true;
        updated.facingRight = target.x > updated.x;
        updated.walkTimer = config.walkDuration[0] + Math.random() * (config.walkDuration[1] - config.walkDuration[0]);
      } else {
        // Couldn't find valid target, try again soon
        updated.idleTimer = config.idleDuration[0] * 0.5;
      }
    }
  }

  return updated;
}

// ============================================
// Main Walking Behavior Hook
// ============================================

export interface WalkingEntity {
  id: string;
  initialPosition?: { x: number; y: number };
}

export interface WalkingBehaviorResult {
  positions: Map<string, EntityState>;
  getOtherPositions: (excludeId: string) => Array<{ x: number; y: number }>;
}

/**
 * Hook to manage walking behavior for multiple entities.
 * Handles movement, collision detection, exclusion zones, and audio-reactive behavior.
 */
export function useWalkingBehavior(
  entities: WalkingEntity[],
  groundConfig: SceneGroundConfig,
  config: WalkingConfig = DEFAULT_WALKING_CONFIG,
  audioLevels: AudioLevels = new Map(),
  tempoMultiplier: number = 1,
  isVisible: boolean = true
): WalkingBehaviorResult {
  const [positions, setPositions] = useState<Map<string, EntityState>>(new Map());
  const positionsRef = useRef<Map<string, EntityState>>(new Map());

  // Keep refs in sync for animation callback (avoids dependency on frequently-changing values)
  const audioLevelsRef = useRef(audioLevels);
  const tempoMultiplierRef = useRef(tempoMultiplier);
  audioLevelsRef.current = audioLevels;
  tempoMultiplierRef.current = tempoMultiplier;

  // Keep ref in sync for collision detection
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Initialize positions for new entities
  useEffect(() => {
    setPositions((prev) => {
      const next = new Map(prev);
      const existingPositions: Array<{ x: number; y: number }> = [];

      // Collect existing positions for collision avoidance
      prev.forEach((state) => {
        existingPositions.push({ x: state.x, y: state.y });
      });

      // Add new entities
      entities.forEach((entity) => {
        if (!next.has(entity.id)) {
          const pos = entity.initialPosition || generateSpawnPosition(
            config,
            groundConfig,
            existingPositions
          );
          next.set(entity.id, createInitialState(pos.x, pos.y, config));
          existingPositions.push(pos);
        }
      });

      // Remove departed entities
      const entityIds = new Set(entities.map((e) => e.id));
      next.forEach((_, id) => {
        if (!entityIds.has(id)) {
          next.delete(id);
        }
      });

      return next;
    });
  }, [entities, groundConfig, config]);

  // Get other positions for collision detection (callback for external use)
  const getOtherPositions = useCallback(
    (excludeId: string): Array<{ x: number; y: number }> => {
      const result: Array<{ x: number; y: number }> = [];
      positionsRef.current.forEach((state, id) => {
        if (id !== excludeId) {
          result.push({ x: state.x, y: state.y });
        }
      });
      return result;
    },
    []
  );

  // Animation loop - uses refs for frequently-changing values to avoid restarts
  useVisibilityAwareAnimationFrame(
    (deltaTime) => {
      setPositions((prev) => {
        const next = new Map(prev);
        let hasChanges = false;

        next.forEach((state, id) => {
          const otherPositions = getOtherPositions(id);
          // Read from refs to get latest values without causing loop restarts
          const audioLevel = audioLevelsRef.current.get(id) || 0;
          const currentTempoMultiplier = tempoMultiplierRef.current;

          const updated = updateEntityState(
            state,
            deltaTime,
            config,
            groundConfig,
            otherPositions,
            audioLevel,
            currentTempoMultiplier
          );

          // Only update if state changed
          if (
            updated.x !== state.x ||
            updated.y !== state.y ||
            updated.isWalking !== state.isWalking ||
            updated.isSettling !== state.isSettling ||
            updated.facingRight !== state.facingRight
          ) {
            next.set(id, updated);
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });
    },
    isVisible,
    [config, groundConfig, getOtherPositions] // Removed audioLevels and tempoMultiplier - using refs instead
  );

  return { positions, getOtherPositions };
}

/**
 * Simplified hook for a single entity's walking behavior.
 */
export function useSingleEntityWalking(
  entityId: string,
  initialPosition: { x: number; y: number } | undefined,
  groundConfig: SceneGroundConfig,
  config: WalkingConfig = DEFAULT_WALKING_CONFIG,
  otherPositions: Array<{ x: number; y: number }> = [],
  audioLevel: number = 0,
  tempoMultiplier: number = 1,
  isVisible: boolean = true
): EntityState | null {
  const entities = useMemo(
    () => [{ id: entityId, initialPosition }],
    [entityId, initialPosition]
  );

  const audioLevels = useMemo(() => {
    const map = new Map<string, number>();
    map.set(entityId, audioLevel);
    return map;
  }, [entityId, audioLevel]);

  const { positions } = useWalkingBehavior(
    entities,
    groundConfig,
    config,
    audioLevels,
    tempoMultiplier,
    isVisible
  );

  return positions.get(entityId) || null;
}
