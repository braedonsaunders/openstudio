'use client';

import { memo, useMemo, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { SceneGroundConfig } from './scene-config';
import { calculateAvatarScale, calculateAvatarZIndex, KEY_COLORS } from './scene-config';
import type { EntityState, IdleAnimation, MusicalContext, WalkingConfig } from './types';
import { IDLE_ANIMATIONS, selectIdleAnimation, getEnergyLevel } from './types';
import { useBeatBob, useHeadNod, useAudioGlow } from './hooks/useMusicalBehavior';
import type { WorldPosition } from '@/stores/room-store';

// ============================================
// Types
// ============================================

export interface WalkingEntityProps {
  // Entity identification
  id: string;
  name?: string;

  // Position state (from walking behavior hook or synced position)
  state: EntityState | WorldPosition;

  // Scene configuration
  groundConfig: SceneGroundConfig;

  // Container dimensions (for percentage to pixel conversion)
  containerWidth: number;
  containerHeight: number;

  // Visual configuration
  baseSize?: number;
  idleAnimation?: IdleAnimation;

  // Avatar rendering
  children?: React.ReactNode;           // Custom avatar content
  avatarUrl?: string | null;            // Full body image URL
  fallbackInitial?: string;             // Fallback letter

  // Musical context (optional - for DAW integration)
  musicalContext?: MusicalContext;
  audioLevel?: number;
  audioLevels?: Map<string, number>;    // All users' audio levels (for energy)

  // Visual enhancements
  showName?: boolean;
  showGlow?: boolean;
  glowColor?: string;
  isCurrentUser?: boolean;
  isRemote?: boolean;                   // True if this is a synced remote user

  // Interactivity
  onClick?: () => void;
  className?: string;
}

// ============================================
// Walking Entity Component
// ============================================

export const WalkingEntity = memo(function WalkingEntity({
  id,
  name,
  state,
  groundConfig,
  containerWidth,
  containerHeight,
  baseSize = 100,
  idleAnimation = 'bounce',
  children,
  avatarUrl,
  fallbackInitial,
  musicalContext,
  audioLevel = 0,
  audioLevels,
  showName = true,
  showGlow = true,
  glowColor,
  isCurrentUser = false,
  isRemote = false,
  onClick,
  className,
}: WalkingEntityProps) {
  // ============================================
  // Position Animation
  // ============================================

  // Convert percentage to pixels
  const pixelX = (state.x / 100) * containerWidth;
  const pixelY = (state.y / 100) * containerHeight;

  // Spring configuration (faster for local, smoother for remote interpolation)
  const springConfig = isRemote
    ? { stiffness: 60, damping: 15 }   // Smoother for network interpolation
    : { stiffness: 120, damping: 20 }; // Snappier for local

  // Position springs
  const targetX = useMotionValue(pixelX);
  const targetY = useMotionValue(pixelY);
  const springX = useSpring(targetX, springConfig);
  const springY = useSpring(targetY, springConfig);

  // Update position targets
  useEffect(() => {
    targetX.set(pixelX);
    targetY.set(pixelY);
  }, [pixelX, pixelY, targetX, targetY]);

  // ============================================
  // Scale & Depth Calculation
  // ============================================

  const scale = useMemo(
    () => calculateAvatarScale(state.y, groundConfig),
    [state.y, groundConfig]
  );

  const zIndex = useMemo(
    () => calculateAvatarZIndex(state.y, groundConfig),
    [state.y, groundConfig]
  );

  // ============================================
  // Musical Enhancements
  // ============================================

  const isPlaying = musicalContext?.isPlaying ?? false;
  const tempo = musicalContext?.tempo ?? 120;
  const beat = musicalContext?.beat ?? 1;
  const musicalKey = musicalContext?.musicalKey;

  // Beat-synced bobbing (subtle when walking, more when idle and music playing)
  const beatBobIntensity = state.isWalking ? 1 : 2;
  const beatBob = useBeatBob(
    musicalContext?.beat ?? 0,
    beatBobIntensity,
    isPlaying && !state.isWalking
  );

  // Head nod on downbeat
  const headNod = useHeadNod(beat, isPlaying, 2);

  // Audio-reactive glow
  const glowIntensity = useAudioGlow(audioLevel, 0.15, 0.05, true);

  // Determine effective idle animation based on room energy
  const energyLevel = useMemo(
    () => audioLevels ? getEnergyLevel(audioLevels) : 'quiet',
    [audioLevels]
  );

  const effectiveIdleAnimation = useMemo(
    () => selectIdleAnimation(idleAnimation, energyLevel),
    [idleAnimation, energyLevel]
  );

  // Get idle animation config
  const idleConfig = IDLE_ANIMATIONS[effectiveIdleAnimation];

  // Determine glow color (prefer prop, then key color, then default)
  const effectiveGlowColor = useMemo(() => {
    if (glowColor) return glowColor;
    if (musicalKey && KEY_COLORS[musicalKey]) return KEY_COLORS[musicalKey];
    return '#a855f7'; // Default purple
  }, [glowColor, musicalKey]);

  // ============================================
  // Bounce & Wobble Animation
  // ============================================

  const bouncePhaseRef = useRef(0);
  const targetBounce = useMotionValue(0);
  const targetRotate = useMotionValue(0);
  const springBounce = useSpring(targetBounce, { stiffness: 400, damping: 30 });
  const springRotate = useSpring(targetRotate, { stiffness: 400, damping: 30 });

  // Animation loop for bounce/wobble
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (state.isWalking) {
        // Walking: fast subtle bounce
        bouncePhaseRef.current += deltaTime * 0.015;
        const bounce = Math.sin(bouncePhaseRef.current) * -3;
        const wobble = Math.sin(bouncePhaseRef.current) * 0.5;
        targetBounce.set(bounce);
        targetRotate.set(wobble + headNod);
      } else {
        // Idle: use idle animation or beat-synced bob
        if (isPlaying && beatBob !== 0) {
          // Beat-synced bob
          targetBounce.set(beatBob);
          targetRotate.set(headNod);
        } else {
          // Standard idle animation
          const duration = idleConfig.transition.duration || 1.2;
          bouncePhaseRef.current += deltaTime * (0.001 / (duration / 2));

          if (idleConfig.animate.y) {
            const yValues = Array.isArray(idleConfig.animate.y) ? idleConfig.animate.y : [0];
            const maxY = Math.min(...yValues);
            targetBounce.set(Math.sin(bouncePhaseRef.current) * Math.abs(maxY));
          } else {
            targetBounce.set(0);
          }

          if (idleConfig.animate.rotate) {
            const rotValues = Array.isArray(idleConfig.animate.rotate) ? idleConfig.animate.rotate : [0];
            const maxRot = Math.max(...rotValues.map(Math.abs));
            targetRotate.set(Math.sin(bouncePhaseRef.current) * maxRot + headNod);
          } else {
            targetRotate.set(headNod);
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [state.isWalking, isPlaying, beatBob, headNod, idleConfig, targetBounce, targetRotate]);

  // ============================================
  // Shadow Calculation
  // ============================================

  const shadowWidth = baseSize * scale * 0.6;
  const shadowHeight = baseSize * scale * 0.15;

  // ============================================
  // Render
  // ============================================

  return (
    <motion.div
      className={`absolute pointer-events-auto ${className || ''}`}
      style={{
        left: springX,
        top: springY,
        zIndex,
        transform: 'translate(-50%, -100%)', // Anchor at bottom center
        willChange: 'transform',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {/* Ground shadow */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          bottom: -shadowHeight * 0.3,
          width: shadowWidth,
          height: shadowHeight,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, transparent 70%)',
          filter: `blur(${Math.max(2, 4 * scale)}px)`,
        }}
      />

      {/* Avatar container */}
      <motion.div
        style={{
          width: baseSize * scale,
          height: baseSize * scale,
          transform: `scaleX(${state.facingRight ? 1 : -1})`,
          y: springBounce,
          rotate: springRotate,
          transformOrigin: 'bottom center',
        }}
      >
        {/* Audio glow effect */}
        {showGlow && audioLevel > 0.1 && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${effectiveGlowColor}40 0%, transparent 70%)`,
              transform: 'scale(1.5)',
              opacity: 0.3 + glowIntensity * 0.4,
              filter: 'blur(8px)',
            }}
          />
        )}

        {/* Custom children (avatar component) */}
        {children ? (
          <div className="w-full h-full">{children}</div>
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name || 'Character'}
            className="w-full h-full object-contain"
            style={{
              filter: `drop-shadow(0 ${2 * scale}px ${4 * scale}px rgba(0,0,0,0.15))`,
            }}
          />
        ) : (
          // Fallback placeholder
          <div
            className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold"
            style={{ fontSize: 20 * scale }}
          >
            {fallbackInitial || (name ? name.charAt(0) : '?')}
          </div>
        )}
      </motion.div>

      {/* Name label */}
      {showName && name && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs whitespace-nowrap pointer-events-none"
          style={{
            fontSize: Math.max(9, 11 * scale),
            transform: `translateX(-50%) scaleX(${state.facingRight ? 1 : -1})`,
          }}
        >
          {name}
          {isCurrentUser && <span className="text-indigo-400 ml-1">(you)</span>}
        </div>
      )}

      {/* Walking dust particles (optional enhancement) */}
      {state.isWalking && scale > 0.6 && (
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
          animate={{ opacity: [0, 0.3, 0], scale: [0.5, 1, 1.5], y: [0, -5, -10] }}
          transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 0.2 }}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.3)',
          }}
        />
      )}
    </motion.div>
  );
});

// ============================================
// Utility Component: Remote Entity Wrapper
// ============================================

/**
 * Wrapper for rendering remote (synced) entities with interpolation.
 */
export interface RemoteEntityProps extends Omit<WalkingEntityProps, 'state'> {
  position: WorldPosition;
}

export const RemoteEntity = memo(function RemoteEntity({
  position,
  ...props
}: RemoteEntityProps) {
  // Convert WorldPosition to EntityState-like structure
  const state: EntityState = {
    x: position.x,
    y: position.y,
    targetX: position.targetX ?? position.x,
    targetY: position.targetY ?? position.y,
    facingRight: position.facingRight,
    isWalking: position.isWalking,
    isSettling: false,
    walkTimer: 0,
    idleTimer: 0,
    settlingTimer: 0,
    timestamp: position.timestamp,
  };

  return <WalkingEntity state={state} isRemote {...props} />;
});
