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
  colorLight: string;
  colorDark: string;
}

// Sparkle config
interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  colorLight: string;
  colorDark: string;
}

// Floating shape config
interface FloatingShape {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  rotation: number;
  shape: 'circle' | 'star' | 'heart' | 'diamond';
  colorLight: string;
  colorDark: string;
}

export function RoomExitAnimation({ isExiting, onAnimationComplete, children }: RoomExitAnimationProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  // Fun rainbow palette that works in both modes
  const colorPalette = useMemo(() => ({
    light: ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#a78bfa', '#f472b6'],
    dark: ['#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'],
  }), []);

  // Generate ribbons - CSS animated, no per-frame updates
  const ribbons = useMemo<AuroraRibbon[]>(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      top: `${12 + i * 14}%`,
      duration: 2 + i * 0.2,
      delay: i * 0.08,
      colorLight: colorPalette.light[i % colorPalette.light.length],
      colorDark: colorPalette.dark[i % colorPalette.dark.length],
    }));
  }, [colorPalette]);

  // Colorful sparkles
  const sparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: 5 + (i % 6) * 16 + Math.random() * 10,
      y: 10 + Math.floor(i / 6) * 22 + Math.random() * 10,
      size: 3 + Math.random() * 3,
      delay: 0.15 + i * 0.04,
      colorLight: colorPalette.light[i % colorPalette.light.length],
      colorDark: colorPalette.dark[i % colorPalette.dark.length],
    }));
  }, [colorPalette]);

  // Floating shapes for extra whimsy
  const floatingShapes = useMemo<FloatingShape[]>(() => {
    const shapes: FloatingShape['shape'][] = ['circle', 'star', 'heart', 'diamond'];
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 8 + (i % 4) * 24 + Math.random() * 12,
      y: 20 + Math.floor(i / 4) * 28 + Math.random() * 15,
      size: 12 + Math.random() * 10,
      delay: 0.3 + i * 0.06,
      rotation: Math.random() * 360,
      shape: shapes[i % shapes.length],
      colorLight: colorPalette.light[i % colorPalette.light.length],
      colorDark: colorPalette.dark[i % colorPalette.dark.length],
    }));
  }, [colorPalette]);

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

      {/* Fun Colorful Aurora Overlay */}
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
              className="absolute inset-0 bg-[var(--background)]/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />

            {/* CSS-animated rainbow ribbons */}
            {ribbons.map((ribbon) => (
              <motion.div
                key={ribbon.id}
                className="absolute left-0 right-0 h-1 rounded-full"
                style={{ top: ribbon.top }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{
                  duration: 0.6,
                  delay: ribbon.delay,
                  ease: [0.34, 1.56, 0.64, 1], // Bouncy easing
                }}
              >
                {/* Main ribbon with CSS animation - uses CSS variables for theme */}
                <div
                  className="absolute inset-0 animate-aurora-wave rounded-full ribbon-main"
                  style={{
                    '--ribbon-color-light': ribbon.colorLight,
                    '--ribbon-color-dark': ribbon.colorDark,
                    animationDuration: `${ribbon.duration}s`,
                    animationDelay: `${ribbon.delay}s`,
                  } as React.CSSProperties}
                />
                {/* Glow layer */}
                <div
                  className="absolute inset-0 h-6 -top-2 blur-lg animate-aurora-wave ribbon-glow"
                  style={{
                    '--ribbon-color-light': ribbon.colorLight,
                    '--ribbon-color-dark': ribbon.colorDark,
                    animationDuration: `${ribbon.duration}s`,
                    animationDelay: `${ribbon.delay + 0.05}s`,
                  } as React.CSSProperties}
                />
              </motion.div>
            ))}

            {/* Colorful floating sparkles */}
            {sparkles.map((sparkle) => (
              <motion.div
                key={sparkle.id}
                className="absolute rounded-full sparkle-dot"
                style={{
                  left: `${sparkle.x}%`,
                  top: `${sparkle.y}%`,
                  width: sparkle.size,
                  height: sparkle.size,
                  '--sparkle-color-light': sparkle.colorLight,
                  '--sparkle-color-dark': sparkle.colorDark,
                } as React.CSSProperties}
                initial={{ opacity: 0, scale: 0, y: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.2, 0.3],
                  y: -50,
                  rotate: 180,
                }}
                transition={{
                  duration: 1.5,
                  delay: sparkle.delay,
                  ease: 'easeOut',
                  opacity: { times: [0, 0.25, 1] },
                }}
              />
            ))}

            {/* Floating whimsical shapes */}
            {floatingShapes.map((shape) => (
              <motion.div
                key={`shape-${shape.id}`}
                className="absolute floating-shape"
                style={{
                  left: `${shape.x}%`,
                  top: `${shape.y}%`,
                  '--shape-color-light': shape.colorLight,
                  '--shape-color-dark': shape.colorDark,
                } as React.CSSProperties}
                initial={{ opacity: 0, scale: 0, rotate: shape.rotation }}
                animate={{
                  opacity: [0, 0.7, 0],
                  scale: [0, 1, 0.5],
                  rotate: shape.rotation + 180,
                  y: -40,
                }}
                transition={{
                  duration: 2,
                  delay: shape.delay,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
              >
                {shape.shape === 'circle' && (
                  <div
                    className="rounded-full shape-fill"
                    style={{ width: shape.size, height: shape.size }}
                  />
                )}
                {shape.shape === 'star' && (
                  <svg width={shape.size} height={shape.size} viewBox="0 0 24 24" className="shape-fill-svg">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
                {shape.shape === 'heart' && (
                  <svg width={shape.size} height={shape.size} viewBox="0 0 24 24" className="shape-fill-svg">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                )}
                {shape.shape === 'diamond' && (
                  <svg width={shape.size} height={shape.size} viewBox="0 0 24 24" className="shape-fill-svg">
                    <path d="M12 2L2 12l10 10 10-10L12 2z" />
                  </svg>
                )}
              </motion.div>
            ))}

            {/* Fun bouncy center text with waving hand */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center flex-col gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {/* Waving hand */}
              <motion.span
                className="text-4xl"
                animate={{
                  rotate: [0, 14, -8, 14, -4, 10, 0],
                  scale: [1, 1.1, 1, 1.1, 1, 1.05, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: 'easeInOut'
                }}
                style={{ originX: 0.7, originY: 0.7 }}
              >
                👋
              </motion.span>

              {/* Animated text with letter-by-letter color */}
              <motion.div className="flex items-center gap-0.5">
                {'Until next time'.split('').map((letter, i) => (
                  <motion.span
                    key={i}
                    className="text-xl font-medium tracking-wide exit-text-letter"
                    style={{
                      '--letter-color-light': colorPalette.light[i % colorPalette.light.length],
                      '--letter-color-dark': colorPalette.dark[i % colorPalette.dark.length],
                    } as React.CSSProperties}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                      opacity: 1,
                      y: [0, -3, 0],
                    }}
                    transition={{
                      opacity: { delay: 0.3 + i * 0.03, duration: 0.3 },
                      y: {
                        delay: 0.5 + i * 0.05,
                        duration: 0.6,
                        repeat: Infinity,
                        repeatDelay: 1.5,
                        ease: 'easeInOut'
                      },
                    }}
                  >
                    {letter === ' ' ? '\u00A0' : letter}
                  </motion.span>
                ))}
                <motion.span
                  className="text-xl font-medium text-[var(--foreground)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ delay: 0.8, duration: 1.5, repeat: Infinity }}
                >
                  ...
                </motion.span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inject keyframes for CSS-based ribbon animation with theme support */}
      <style jsx global>{`
        @keyframes aurora-wave {
          0%, 100% {
            transform: translateX(-8%) scaleX(1) scaleY(1);
            opacity: 0.7;
          }
          25% {
            transform: translateX(4%) scaleX(1.15) scaleY(1.3);
            opacity: 1;
          }
          50% {
            transform: translateX(8%) scaleX(1.05) scaleY(0.8);
            opacity: 0.9;
          }
          75% {
            transform: translateX(-4%) scaleX(1.2) scaleY(1.2);
            opacity: 1;
          }
        }
        .animate-aurora-wave {
          animation: aurora-wave ease-in-out infinite;
        }

        /* Theme-aware ribbon colors */
        .ribbon-main {
          background: linear-gradient(90deg,
            transparent 0%,
            var(--ribbon-color-light) 20%,
            var(--ribbon-color-light) 50%,
            var(--ribbon-color-light) 80%,
            transparent 100%
          );
          opacity: 0.6;
        }
        .ribbon-glow {
          background: linear-gradient(90deg,
            transparent 0%,
            var(--ribbon-color-light) 30%,
            var(--ribbon-color-light) 70%,
            transparent 100%
          );
          opacity: 0.3;
        }
        :root.dark .ribbon-main,
        .dark .ribbon-main {
          background: linear-gradient(90deg,
            transparent 0%,
            var(--ribbon-color-dark) 20%,
            var(--ribbon-color-dark) 50%,
            var(--ribbon-color-dark) 80%,
            transparent 100%
          );
          opacity: 0.7;
        }
        :root.dark .ribbon-glow,
        .dark .ribbon-glow {
          background: linear-gradient(90deg,
            transparent 0%,
            var(--ribbon-color-dark) 30%,
            var(--ribbon-color-dark) 70%,
            transparent 100%
          );
          opacity: 0.4;
        }

        /* Theme-aware sparkle colors */
        .sparkle-dot {
          background-color: var(--sparkle-color-light);
          box-shadow: 0 0 8px var(--sparkle-color-light), 0 0 16px var(--sparkle-color-light);
        }
        :root.dark .sparkle-dot,
        .dark .sparkle-dot {
          background-color: var(--sparkle-color-dark);
          box-shadow: 0 0 10px var(--sparkle-color-dark), 0 0 20px var(--sparkle-color-dark);
        }

        /* Theme-aware shape colors */
        .shape-fill {
          background-color: var(--shape-color-light);
          box-shadow: 0 0 12px var(--shape-color-light);
        }
        .shape-fill-svg {
          fill: var(--shape-color-light);
          filter: drop-shadow(0 0 6px var(--shape-color-light));
        }
        :root.dark .shape-fill,
        .dark .shape-fill {
          background-color: var(--shape-color-dark);
          box-shadow: 0 0 15px var(--shape-color-dark);
        }
        :root.dark .shape-fill-svg,
        .dark .shape-fill-svg {
          fill: var(--shape-color-dark);
          filter: drop-shadow(0 0 8px var(--shape-color-dark));
        }

        /* Theme-aware text letter colors */
        .exit-text-letter {
          color: var(--letter-color-light);
          text-shadow: 0 0 8px var(--letter-color-light);
        }
        :root.dark .exit-text-letter,
        .dark .exit-text-letter {
          color: var(--letter-color-dark);
          text-shadow: 0 0 12px var(--letter-color-dark);
        }
      `}</style>
    </div>
  );
}
