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
const WALK_SPEED = 0.008; // Much slower base speed for casual strolling
const IDLE_DURATION_MIN = 1500; // Short idles - just pausing to look around
const IDLE_DURATION_MAX = 4000; // Longer idles occasionally
const WALK_DURATION_MIN = 2000; // Short walks between stops
const WALK_DURATION_MAX = 5000; // Longer walks occasionally

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
    const initial = getRandomWalkablePosition(groundConfig);
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
      // Pick a nearby target instead of anywhere in the walkable area
      const { walkableArea } = groundConfig;
      const maxStepX = 15; // Maximum 15% of screen width per walk
      const maxStepY = 12; // Maximum 12% of screen height per walk

      // Random offset within step range
      const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
      const offsetY = (Math.random() - 0.5) * 2 * maxStepY;

      // Calculate new target, clamped to walkable area
      const newX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, prev.x + offsetX));
      const newY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, prev.y + offsetY));

      return {
        ...prev,
        targetX: newX,
        targetY: newY,
        isWalking: true,
        facingRight: newX > prev.x,
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
            // Reached target or timer expired
            return {
              ...prev,
              x: distance < 1 ? prev.targetX : prev.x,
              y: distance < 1 ? prev.targetY : prev.y,
              isWalking: false,
              idleTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
            };
          }

          // Normalize direction and move
          const moveX = (dx / distance) * walkSpeed * deltaTime;
          const moveY = (dy / distance) * walkSpeed * deltaTime;

          return {
            ...prev,
            x: prev.x + moveX,
            y: prev.y + moveY,
            walkTimer: prev.walkTimer - deltaTime,
            facingRight: dx > 0,
          };
        } else {
          // Idle - count down timer
          if (prev.idleTimer <= 0) {
            // Start walking to a nearby position (casual strolling)
            const { walkableArea } = groundConfig;
            const maxStepX = 15;
            const maxStepY = 12;
            const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
            const offsetY = (Math.random() - 0.5) * 2 * maxStepY;
            const newX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, prev.x + offsetX));
            const newY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, prev.y + offsetY));

            return {
              ...prev,
              targetX: newX,
              targetY: newY,
              isWalking: true,
              facingRight: newX > prev.x,
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

  // Base size for avatar (will be scaled)
  const baseSize = 80;

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
