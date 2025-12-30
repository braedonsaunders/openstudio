'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RoomExitAnimationProps {
  isExiting: boolean;
  onAnimationComplete: () => void;
  children: React.ReactNode;
}

// Lightweight ribbon config
interface AuroraRibbon {
  id: number;
  top: string;
  duration: number;
  delay: number;
  color: string;
}

// Sparkle config
interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

export function RoomExitAnimation({ isExiting, onAnimationComplete, children }: RoomExitAnimationProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  // Generate ribbons - CSS animated, no per-frame updates
  const ribbons = useMemo<AuroraRibbon[]>(() => {
    const colors = ['#818cf8', '#6366f1', '#a78bfa', '#8b5cf6'];
    return Array.from({ length: 4 }, (_, i) => ({
      id: i,
      top: `${20 + i * 18}%`,
      duration: 2.5 + i * 0.3,
      delay: i * 0.1,
      color: colors[i],
    }));
  }, []);

  // Minimal sparkles
  const sparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: 10 + (i % 4) * 25 + Math.random() * 15,
      y: 15 + Math.floor(i / 4) * 22 + Math.random() * 10,
      size: 2 + Math.random() * 2,
      delay: 0.2 + i * 0.05,
    }));
  }, []);

  useEffect(() => {
    if (isExiting) {
      setShowOverlay(true);
    }
  }, [isExiting]);

  const handleMainAnimationComplete = useCallback(() => {
    setTimeout(() => {
      onAnimationComplete();
    }, 600);
  }, [onAnimationComplete]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnimatePresence mode="wait" onExitComplete={handleMainAnimationComplete}>
        {!isExiting ? (
          <motion.div
            key="daw-content"
            className="h-full w-full"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 0.99,
              filter: 'blur(4px)',
            }}
            transition={{
              duration: 0.5,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Lightweight Aurora Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Subtle semi-transparent backdrop */}
            <motion.div
              className="absolute inset-0 bg-[var(--background)]/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />

            {/* CSS-animated aurora ribbons */}
            {ribbons.map((ribbon) => (
              <motion.div
                key={ribbon.id}
                className="absolute left-0 right-0 h-px"
                style={{ top: ribbon.top }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{
                  duration: 0.8,
                  delay: ribbon.delay,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                {/* Main ribbon with CSS animation */}
                <div
                  className="absolute inset-0 animate-aurora-flow"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${ribbon.color}40 30%, ${ribbon.color}60 50%, ${ribbon.color}40 70%, transparent 100%)`,
                    animationDuration: `${ribbon.duration}s`,
                    animationDelay: `${ribbon.delay}s`,
                  }}
                />
                {/* Glow layer */}
                <div
                  className="absolute inset-0 h-4 -top-2 blur-md animate-aurora-flow"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${ribbon.color}20 30%, ${ribbon.color}30 50%, ${ribbon.color}20 70%, transparent 100%)`,
                    animationDuration: `${ribbon.duration}s`,
                    animationDelay: `${ribbon.delay + 0.1}s`,
                  }}
                />
              </motion.div>
            ))}

            {/* Floating sparkles */}
            {sparkles.map((sparkle) => (
              <motion.div
                key={sparkle.id}
                className="absolute rounded-full bg-[var(--accent)]"
                style={{
                  left: `${sparkle.x}%`,
                  top: `${sparkle.y}%`,
                  width: sparkle.size,
                  height: sparkle.size,
                  boxShadow: `0 0 ${sparkle.size * 3}px var(--accent)`,
                }}
                initial={{ opacity: 0, scale: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0.5],
                  y: -30,
                }}
                transition={{
                  duration: 1.2,
                  delay: sparkle.delay,
                  ease: 'easeOut',
                  opacity: { times: [0, 0.3, 1] },
                }}
              />
            ))}

            {/* Subtle center text */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <motion.p
                className="text-xl font-light tracking-wider text-[var(--foreground)]/70"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Until next time...
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inject keyframes for CSS-based ribbon animation */}
      <style jsx global>{`
        @keyframes aurora-flow {
          0%, 100% {
            transform: translateX(-5%) scaleX(1);
            opacity: 0.6;
          }
          50% {
            transform: translateX(5%) scaleX(1.1);
            opacity: 1;
          }
        }
        .animate-aurora-flow {
          animation: aurora-flow ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
