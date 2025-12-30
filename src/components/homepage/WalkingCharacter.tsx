'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
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
  initialPosition?: { x: number; y: number }; // For distributed spawning
  onPositionUpdate?: (id: string, x: number, y: number) => void;
  getOtherPositions?: (excludeId: string) => Array<{ x: number; y: number }>;
}

// Minimum distance between characters (in percentage units)
const MIN_CHARACTER_DISTANCE = 8;

// Check if a position would collide with any other character
function wouldCollide(
  x: number,
  y: number,
  otherPositions: Array<{ x: number; y: number }>
): boolean {
  for (const other of otherPositions) {
    const dx = x - other.x;
    const dy = y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < MIN_CHARACTER_DISTANCE) {
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
  maxAttempts: number = 8
): { x: number; y: number } {
  // If no collision at base position, use it
  if (!wouldCollide(baseX, baseY, otherPositions)) {
    return { x: baseX, y: baseY };
  }

  // Try different directions to find a non-colliding spot
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = (attempt / maxAttempts) * Math.PI * 2;
    const distance = MIN_CHARACTER_DISTANCE + Math.random() * 5;
    const newX = baseX + Math.cos(angle) * distance;
    const newY = baseY + Math.sin(angle) * distance;

    // Clamp to walkable area
    const clampedX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, newX));
    const clampedY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, newY));

    if (!wouldCollide(clampedX, clampedY, otherPositions)) {
      return { x: clampedX, y: clampedY };
    }
  }

  // If all attempts fail, return the base position anyway
  return { x: baseX, y: baseY };
}

interface CharacterState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  isWalking: boolean;
  isSettling: boolean; // Brief transition state between walking and idle
  facingRight: boolean;
  walkTimer: number;
  idleTimer: number;
  settlingTimer: number;
}

// Slow, casual lobby movement - characters meander around
const WALK_SPEED = 0.005; // Very slow strolling pace
const IDLE_DURATION_MIN = 3000; // Longer idles - characters hang around
const IDLE_DURATION_MAX = 7000; // Can stand still quite a while
const WALK_DURATION_MIN = 2000; // Short walks between stops
const WALK_DURATION_MAX = 4000; // Not too long walks
const SETTLING_DURATION = 300; // Pause to let spring animation settle

// Content card exclusion zone - characters walk AROUND this, never through it
// The card is centered (max-w-2xl = ~672px), positioned in the upper-middle area
const CONTENT_CARD_ZONE = {
  minX: 18, // Left edge of card (percentage)
  maxX: 82, // Right edge of card (percentage)
  minY: 15, // Top edge of card (percentage)
  maxY: 58, // Bottom edge of card (percentage)
};

// Check if a point is inside the content card exclusion zone
function isInsideCardZone(x: number, y: number): boolean {
  return (
    x >= CONTENT_CARD_ZONE.minX &&
    x <= CONTENT_CARD_ZONE.maxX &&
    y >= CONTENT_CARD_ZONE.minY &&
    y <= CONTENT_CARD_ZONE.maxY
  );
}

// Check if a line segment from (x1,y1) to (x2,y2) crosses the card zone
function pathCrossesCardZone(x1: number, y1: number, x2: number, y2: number): boolean {
  // Check if either endpoint is inside the card
  if (isInsideCardZone(x1, y1) || isInsideCardZone(x2, y2)) {
    return true;
  }

  // Check if the path crosses the card zone (simplified line-box intersection)
  // Sample points along the path
  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (isInsideCardZone(px, py)) {
      return true;
    }
  }
  return false;
}

// Get a valid position that avoids the content card
function getValidPosition(
  baseX: number,
  baseY: number,
  walkableArea: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  // Clamp to walkable area
  let x = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, baseX));
  let y = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, baseY));

  // If inside the card zone, push to nearest edge
  if (isInsideCardZone(x, y)) {
    // Find nearest edge to push to
    const distToLeft = x - CONTENT_CARD_ZONE.minX;
    const distToRight = CONTENT_CARD_ZONE.maxX - x;
    const distToTop = y - CONTENT_CARD_ZONE.minY;
    const distToBottom = CONTENT_CARD_ZONE.maxY - y;

    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) {
      x = CONTENT_CARD_ZONE.minX - 3;
    } else if (minDist === distToRight) {
      x = CONTENT_CARD_ZONE.maxX + 3;
    } else if (minDist === distToTop) {
      y = CONTENT_CARD_ZONE.minY - 3;
    } else {
      y = CONTENT_CARD_ZONE.maxY + 3;
    }

    // Re-clamp to walkable area
    x = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, x));
    y = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, y));
  }

  return { x, y };
}

// Generate a position in the bottom 30% of the screen ONLY
function getBiasedPosition(
  walkableArea: { minX: number; maxX: number; minY: number; maxY: number }
): { x: number; y: number } {
  // ONLY spawn in bottom 30% of screen - Y >= 70
  const SPAWN_MIN_Y = 70;

  const x = walkableArea.minX + 5 + Math.random() * (walkableArea.maxX - walkableArea.minX - 10);
  const y = SPAWN_MIN_Y + Math.random() * (walkableArea.maxY - SPAWN_MIN_Y - 3);

  return { x, y };
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
  initialPosition,
  onPositionUpdate,
  getOtherPositions,
}: WalkingCharacterProps) {
  const [state, setState] = useState<CharacterState>(() => {
    // Use provided initial position or fall back to biased random position
    const initial = initialPosition || getBiasedPosition(groundConfig.walkableArea);
    return {
      x: initial.x,
      y: initial.y,
      targetX: initial.x,
      targetY: initial.y,
      isWalking: false,
      isSettling: false,
      facingRight: Math.random() > 0.5,
      walkTimer: 0,
      idleTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
      settlingTimer: 0,
    };
  });

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Use motion values with springs for smooth animation transitions
  const targetBounceY = useMotionValue(0);
  const targetRotate = useMotionValue(0);
  const springBounceY = useSpring(targetBounceY, { stiffness: 400, damping: 30 });
  const springRotate = useSpring(targetRotate, { stiffness: 400, damping: 30 });

  // Motion values for position - springs smooth out the movement
  const initialPixelX = ((initialPosition?.x ?? state.x) / 100) * containerWidth;
  const initialPixelY = ((initialPosition?.y ?? state.y) / 100) * containerHeight;
  const targetPosX = useMotionValue(initialPixelX);
  const targetPosY = useMotionValue(initialPixelY);
  const springPosX = useSpring(targetPosX, { stiffness: 120, damping: 20 });
  const springPosY = useSpring(targetPosY, { stiffness: 120, damping: 20 });

  // Track bounce animation phase
  const bouncePhaseRef = useRef(0);

  // Get idle animation config
  const idleConfig = idleAnimations[character.idleAnimation];

  // Combined animation loop for movement AND bounce animation
  useEffect(() => {
    const animate = (currentTime: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Update bounce animation based on current state
      if (state.isWalking) {
        // Walking bounce: fast, subtle
        bouncePhaseRef.current += deltaTime * 0.015; // ~400ms cycle
        const bounce = Math.sin(bouncePhaseRef.current) * -2;
        const wobble = Math.sin(bouncePhaseRef.current) * 0.5;
        targetBounceY.set(bounce);
        targetRotate.set(wobble);
      } else if (state.isSettling) {
        // Settling: spring back to neutral (springs handle this automatically)
        targetBounceY.set(0);
        targetRotate.set(0);
      } else {
        // Idle animation based on character type
        const idleSpeed = (idleConfig.transition.duration as number) || 1.2;
        bouncePhaseRef.current += deltaTime * (0.001 / (idleSpeed / 2));

        const animateProps = idleConfig.animate;
        if (animateProps.y) {
          const yRange = Array.isArray(animateProps.y) ? animateProps.y : [0];
          const maxY = Math.min(...yRange); // Most negative value
          targetBounceY.set(Math.sin(bouncePhaseRef.current) * Math.abs(maxY));
        } else {
          targetBounceY.set(0);
        }
        if (animateProps.rotate) {
          const rotRange = Array.isArray(animateProps.rotate) ? animateProps.rotate : [0];
          const maxRot = Math.max(...rotRange.map(Math.abs));
          targetRotate.set(Math.sin(bouncePhaseRef.current) * maxRot);
        } else {
          targetRotate.set(0);
        }
      }

      // Update position spring targets
      const pixelX = (state.x / 100) * containerWidth;
      const pixelY = (state.y / 100) * containerHeight;
      targetPosX.set(pixelX);
      targetPosY.set(pixelY);

      // Update position state
      setState(prev => {
        const walkSpeed = WALK_SPEED * character.walkSpeed;

        if (prev.isWalking) {
          const dx = prev.targetX - prev.x;
          const dy = prev.targetY - prev.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 1 || prev.walkTimer <= 0) {
            const { walkableArea } = groundConfig;
            const finalX = distance < 1 ? prev.targetX : prev.x;
            const finalY = distance < 1 ? prev.targetY : prev.y;
            return {
              ...prev,
              x: Math.max(walkableArea.minX, Math.min(walkableArea.maxX, finalX)),
              y: Math.max(walkableArea.minY, Math.min(walkableArea.maxY, finalY)),
              isWalking: false,
              isSettling: true,
              settlingTimer: SETTLING_DURATION,
            };
          }

          const moveX = (dx / distance) * walkSpeed * deltaTime;
          const moveY = (dy / distance) * walkSpeed * deltaTime;
          const { walkableArea } = groundConfig;
          let newX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, prev.x + moveX));
          let newY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, prev.y + moveY));

          // Stop if about to enter the content card zone
          if (isInsideCardZone(newX, newY)) {
            return {
              ...prev,
              isWalking: false,
              isSettling: true,
              settlingTimer: SETTLING_DURATION,
            };
          }

          const otherPositions = getOtherPositions?.(character.id) ?? [];
          if (wouldCollide(newX, newY, otherPositions)) {
            return {
              ...prev,
              isWalking: false,
              isSettling: true,
              settlingTimer: SETTLING_DURATION,
            };
          }

          return {
            ...prev,
            x: newX,
            y: newY,
            walkTimer: prev.walkTimer - deltaTime,
            facingRight: dx > 0,
          };
        } else if (prev.isSettling) {
          if (prev.settlingTimer <= 0) {
            return {
              ...prev,
              isSettling: false,
              idleTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
            };
          }
          return {
            ...prev,
            settlingTimer: prev.settlingTimer - deltaTime,
          };
        } else {
          if (prev.idleTimer <= 0) {
            const { walkableArea } = groundConfig;
            const maxStepX = 12;
            const maxStepY = 10;
            const otherPositions = getOtherPositions?.(character.id) ?? [];

            // Try multiple times to find a valid target that doesn't cross the card
            let bestTarget: { x: number; y: number } | null = null;
            for (let attempt = 0; attempt < 8; attempt++) {
              const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
              const offsetY = (Math.random() - 0.3) * 2 * maxStepY;
              const baseX = prev.x + offsetX;
              const baseY = prev.y + offsetY;

              const validPos = getValidPosition(baseX, baseY, walkableArea);
              const nonCollidingPos = findNonCollidingPosition(
                validPos.x,
                validPos.y,
                otherPositions,
                walkableArea
              );

              // Check if this path would cross the card zone
              if (!pathCrossesCardZone(prev.x, prev.y, nonCollidingPos.x, nonCollidingPos.y)) {
                bestTarget = nonCollidingPos;
                break;
              }
            }

            // If no valid path found, stay idle a bit longer
            if (!bestTarget) {
              return {
                ...prev,
                idleTimer: IDLE_DURATION_MIN * 0.5, // Try again soon
              };
            }

            return {
              ...prev,
              targetX: bestTarget.x,
              targetY: bestTarget.y,
              isWalking: true,
              isSettling: false,
              facingRight: bestTarget.x > prev.x,
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
  }, [character.walkSpeed, groundConfig, getOtherPositions, state.isWalking, state.isSettling, state.x, state.y, containerWidth, containerHeight, targetBounceY, targetRotate, targetPosX, targetPosY, idleConfig]);

  // Report position updates to parent for collision tracking
  useEffect(() => {
    onPositionUpdate?.(character.id, state.x, state.y);
  }, [character.id, state.x, state.y, onPositionUpdate]);

  // Calculate scale based on Y position
  const scale = calculateAvatarScale(state.y, groundConfig);
  const zIndex = calculateAvatarZIndex(state.y, groundConfig);

  // Base size for avatar (will be scaled) - larger for lobby presence
  const baseSize = 120;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: springPosX,
        top: springPosY,
        zIndex,
        transform: `translate(-50%, -100%)`, // Anchor at bottom center
      }}
    >
      <motion.div
        style={{
          width: baseSize * scale,
          height: baseSize * scale,
          transform: `scaleX(${state.facingRight ? 1 : -1})`,
          y: springBounceY,
          rotate: springRotate,
        }}
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
