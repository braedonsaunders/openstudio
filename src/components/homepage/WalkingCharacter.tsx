'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  SceneGroundConfig,
  calculateAvatarScale,
  calculateAvatarZIndex,
  getRandomWalkablePosition,
} from './scene-config';
import type { HomepageCharacter, IdleAnimation } from '@/types/avatar';

interface WalkingCharacterProps {
  character: HomepageCharacter;
  groundConfig: SceneGroundConfig;
  containerWidth: number;
  containerHeight: number;
}

interface CharacterState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isWalking: boolean;
  facingRight: boolean;
  walkTimer: number;
  idleTimer: number;
}

// Slow, casual lobby movement - characters meander around
const WALK_SPEED = 0.005; // Very slow strolling pace
const IDLE_DURATION_MIN = 3000; // Longer idles - characters hang around
const IDLE_DURATION_MAX = 7000; // Can stand still quite a while
const WALK_DURATION_MIN = 2000; // Short walks between stops
const WALK_DURATION_MAX = 4000; // Not too long walks

// Center UI exclusion zone (percentage of screen) - characters avoid this area
// This is where the main "Play Together" UI panel sits
const UI_EXCLUSION_ZONE = {
  minX: 20, // Left boundary
  maxX: 80, // Right boundary
  minY: 15, // Top boundary (in ground-relative %)
  maxY: 55, // Bottom boundary (in ground-relative %)
};

// Check if a position is inside the UI exclusion zone
function isInExclusionZone(x: number, y: number): boolean {
  return (
    x >= UI_EXCLUSION_ZONE.minX &&
    x <= UI_EXCLUSION_ZONE.maxX &&
    y >= UI_EXCLUSION_ZONE.minY &&
    y <= UI_EXCLUSION_ZONE.maxY
  );
}

// Get a valid position that avoids the UI zone, biased towards the bottom
function getValidPosition(
  baseX: number,
  baseY: number,
  walkableArea: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  let x = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, baseX));
  let y = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, baseY));

  // If in exclusion zone, push to sides or bottom
  if (isInExclusionZone(x, y)) {
    // Decide: go left, right, or below
    const goLeft = x < 50;
    const goBelow = y > (UI_EXCLUSION_ZONE.minY + UI_EXCLUSION_ZONE.maxY) / 2;

    if (goBelow) {
      // Push below the UI
      y = UI_EXCLUSION_ZONE.maxY + 5 + Math.random() * 20;
    } else if (goLeft) {
      // Push to left side
      x = UI_EXCLUSION_ZONE.minX - 5 - Math.random() * 10;
    } else {
      // Push to right side
      x = UI_EXCLUSION_ZONE.maxX + 5 + Math.random() * 10;
    }

    // Re-clamp to walkable area
    x = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, x));
    y = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, y));
  }

  return { x, y };
}

// Generate a position biased towards the bottom of the walkable area
function getBiasedPosition(
  walkableArea: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  // 70% chance to be in bottom half, 30% chance to be anywhere
  const biasToBottom = Math.random() < 0.7;

  let x: number;
  let y: number;

  if (biasToBottom) {
    // Bottom 40% of walkable area
    const bottomStart = walkableArea.minY + (walkableArea.maxY - walkableArea.minY) * 0.6;
    x = walkableArea.minX + Math.random() * (walkableArea.maxX - walkableArea.minX);
    y = bottomStart + Math.random() * (walkableArea.maxY - bottomStart);
  } else {
    // Anywhere in walkable area
    x = walkableArea.minX + Math.random() * (walkableArea.maxX - walkableArea.minX);
    y = walkableArea.minY + Math.random() * (walkableArea.maxY - walkableArea.minY);
  }

  return getValidPosition(x, y, walkableArea);
}

// Idle animation variants
const idleAnimations: Record<IdleAnimation, {
  animate: Record<string, number | number[]>;
  transition: Record<string, unknown>;
}> = {
  bounce: {
    animate: { y: [0, -4, 0] },
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  sway: {
    animate: { rotate: [-2, 2, -2] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  still: {
    animate: {},
    transition: {},
  },
  dance: {
    animate: { y: [0, -6, 0], rotate: [-3, 3, -3] },
    transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const WalkingCharacter = memo(function WalkingCharacter({
  character,
  groundConfig,
  containerWidth,
  containerHeight,
}: WalkingCharacterProps) {
  const [state, setState] = useState<CharacterState>(() => {
    // Start with a biased position (towards bottom, avoiding UI)
    const initial = getBiasedPosition(groundConfig.walkableArea);
    return {
      x: initial.x,
      y: initial.y,
      targetX: initial.x,
      targetY: initial.y,
      isWalking: false,
      facingRight: Math.random() > 0.5,
      walkTimer: 0,
      idleTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
    };
  });

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Start walking to a new target - short distances for casual strolling
  const startWalking = useCallback(() => {
    setState(prev => {
      // Pick a nearby target, biased towards bottom and avoiding UI
      const { walkableArea } = groundConfig;
      const maxStepX = 12; // Maximum 12% of screen width per walk
      const maxStepY = 10; // Maximum 10% of screen height per walk

      // Random offset within step range, with slight bias towards bottom
      const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
      const offsetY = (Math.random() - 0.3) * 2 * maxStepY; // Bias downward

      // Calculate base target
      const baseX = prev.x + offsetX;
      const baseY = prev.y + offsetY;

      // Get valid position that avoids UI zone
      const validPos = getValidPosition(baseX, baseY, walkableArea);

      return {
        ...prev,
        targetX: validPos.x,
        targetY: validPos.y,
        isWalking: true,
        facingRight: validPos.x > prev.x,
        walkTimer: WALK_DURATION_MIN + Math.random() * (WALK_DURATION_MAX - WALK_DURATION_MIN),
      };
    });
  }, [groundConfig]);

  // Stop walking and start idle
  const stopWalking = useCallback(() => {
    setState(prev => ({
      ...prev,
      isWalking: false,
      idleTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
    }));
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      setState(prev => {
        const walkSpeed = WALK_SPEED * character.walkSpeed;

        if (prev.isWalking) {
          // Move towards target
          const dx = prev.targetX - prev.x;
          const dy = prev.targetY - prev.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 1 || prev.walkTimer <= 0) {
            // Reached target or timer expired - clamp final position to bounds
            const { walkableArea } = groundConfig;
            const finalX = distance < 1 ? prev.targetX : prev.x;
            const finalY = distance < 1 ? prev.targetY : prev.y;
            return {
              ...prev,
              x: Math.max(walkableArea.minX, Math.min(walkableArea.maxX, finalX)),
              y: Math.max(walkableArea.minY, Math.min(walkableArea.maxY, finalY)),
              isWalking: false,
              idleTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
            };
          }

          // Normalize direction and move
          const moveX = (dx / distance) * walkSpeed * deltaTime;
          const moveY = (dy / distance) * walkSpeed * deltaTime;

          // Calculate new position and clamp to walkable area
          const { walkableArea } = groundConfig;
          const newX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, prev.x + moveX));
          const newY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, prev.y + moveY));

          return {
            ...prev,
            x: newX,
            y: newY,
            walkTimer: prev.walkTimer - deltaTime,
            facingRight: dx > 0,
          };
        } else {
          // Idle - count down timer
          if (prev.idleTimer <= 0) {
            // Start walking to a nearby position (casual strolling, biased bottom)
            const { walkableArea } = groundConfig;
            const maxStepX = 12;
            const maxStepY = 10;
            const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
            const offsetY = (Math.random() - 0.3) * 2 * maxStepY; // Bias downward
            const baseX = prev.x + offsetX;
            const baseY = prev.y + offsetY;

            // Get valid position that avoids UI zone
            const validPos = getValidPosition(baseX, baseY, walkableArea);

            return {
              ...prev,
              targetX: validPos.x,
              targetY: validPos.y,
              isWalking: true,
              facingRight: validPos.x > prev.x,
              walkTimer: WALK_DURATION_MIN + Math.random() * (WALK_DURATION_MAX - WALK_DURATION_MIN),
            };
          }

          return {
            ...prev,
            idleTimer: prev.idleTimer - deltaTime,
          };
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [character.walkSpeed, groundConfig]);

  // Calculate scale based on Y position
  const scale = calculateAvatarScale(state.y, groundConfig);
  const zIndex = calculateAvatarZIndex(state.y, groundConfig);

  // Convert percentage to pixels
  const pixelX = (state.x / 100) * containerWidth;
  const pixelY = (state.y / 100) * containerHeight;

  // Base size for avatar (will be scaled) - larger for lobby presence
  const baseSize = 120;

  // Get idle animation config
  const idleConfig = idleAnimations[character.idleAnimation];

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: pixelX,
        top: pixelY,
        zIndex,
        transform: `translate(-50%, -100%)`, // Anchor at bottom center
      }}
      animate={{
        x: 0,
        y: 0,
      }}
    >
      <motion.div
        style={{
          width: baseSize * scale,
          height: baseSize * scale,
          transform: `scaleX(${state.facingRight ? 1 : -1})`,
        }}
        animate={!state.isWalking ? idleConfig.animate : { y: [0, -1.5, 0], rotate: [-0.5, 0.5, -0.5] }}
        transition={!state.isWalking ? idleConfig.transition : { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Character Image */}
        {character.fullBodyUrl ? (
          <img
            src={character.fullBodyUrl}
            alt={character.name}
            className="w-full h-full object-contain drop-shadow-lg"
            style={{
              filter: `drop-shadow(0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,0.3))`,
            }}
          />
        ) : (
          // Fallback placeholder
          <div
            className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold"
            style={{ fontSize: 20 * scale }}
          >
            {character.name.charAt(0)}
          </div>
        )}

        {/* Walking indicator (subtle foot movement) */}
        {state.isWalking && (
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1"
            animate={{ scaleX: [1, 1.2, 1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Name label (optional, shows on hover) */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ fontSize: Math.max(10, 12 * scale) }}
      >
        {character.name}
      </div>
    </motion.div>
  );
});
