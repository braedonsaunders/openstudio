'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RoomExitAnimationProps {
  isExiting: boolean;
  onAnimationComplete: () => void;
  children: React.ReactNode;
}

// Aurora ribbon configuration
interface AuroraRibbon {
  id: number;
  yOffset: number;
  amplitude: number;
  frequency: number;
  speed: number;
  delay: number;
  thickness: number;
  blur: number;
  gradientColors: string[];
  opacity: number;
}

// Sparkle particle configuration
interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  driftX: number;
  driftY: number;
}

// Aurora color palettes - teal → violet → gold transitions
const auroraGradients = [
  ['#06b6d4', '#8b5cf6', '#a855f7'], // cyan → violet → purple
  ['#14b8a6', '#a78bfa', '#f472b6'], // teal → violet → pink
  ['#22d3ee', '#c084fc', '#fbbf24'], // cyan → purple → amber
  ['#2dd4bf', '#818cf8', '#e879f9'], // teal → indigo → fuchsia
  ['#67e8f9', '#a78bfa', '#fcd34d'], // light cyan → violet → yellow
  ['#5eead4', '#c4b5fd', '#fb923c'], // teal → lavender → orange
];

// Generate SVG path for a sine wave ribbon
function generateWavePath(
  width: number,
  yOffset: number,
  amplitude: number,
  frequency: number,
  phase: number
): string {
  const points: string[] = [];
  const segments = 100;

  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const y = yOffset + Math.sin((i / segments) * Math.PI * frequency + phase) * amplitude;
    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }

  return points.join(' ');
}

export function RoomExitAnimation({ isExiting, onAnimationComplete, children }: RoomExitAnimationProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [phase, setPhase] = useState(0);

  // Generate aurora ribbons
  const ribbons = useMemo<AuroraRibbon[]>(() => {
    const generated: AuroraRibbon[] = [];
    const ribbonCount = 8;

    for (let i = 0; i < ribbonCount; i++) {
      generated.push({
        id: i,
        yOffset: 20 + (i * 10) + Math.random() * 15,
        amplitude: 15 + Math.random() * 25,
        frequency: 1.5 + Math.random() * 2,
        speed: 0.8 + Math.random() * 0.6,
        delay: i * 0.08,
        thickness: 3 + Math.random() * 4,
        blur: 8 + Math.random() * 12,
        gradientColors: auroraGradients[i % auroraGradients.length],
        opacity: 0.6 + Math.random() * 0.3,
      });
    }
    return generated;
  }, []);

  // Generate sparkle particles
  const sparkles = useMemo<SparkleParticle[]>(() => {
    const generated: SparkleParticle[] = [];
    const sparkleCount = 60;
    const colors = ['#fff', '#a5f3fc', '#c4b5fd', '#fde68a', '#f9a8d4', '#67e8f9'];

    for (let i = 0; i < sparkleCount; i++) {
      generated.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 1.2,
        duration: 1 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        driftX: (Math.random() - 0.5) * 100,
        driftY: (Math.random() - 0.5) * 80,
      });
    }
    return generated;
  }, []);

  // Animate wave phase
  useEffect(() => {
    if (!showOverlay) return;

    let animationFrame: number;
    let startTime: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      setPhase(elapsed * 2);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [showOverlay]);

  // Trigger overlay when exiting
  useEffect(() => {
    if (isExiting) {
      setShowOverlay(true);
    }
  }, [isExiting]);

  const handleMainAnimationComplete = useCallback(() => {
    setTimeout(() => {
      onAnimationComplete();
    }, 800);
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
              scale: 0.98,
              filter: 'blur(8px) saturate(1.2)',
            }}
            transition={{
              duration: 0.8,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Aurora Wave Cascade Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Deep background with radial gradient */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 100%, rgba(20, 10, 30, 0.95) 0%, rgba(5, 5, 15, 0.98) 100%)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />

            {/* Aurora glow backdrop */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0.6, 0.4] }}
              transition={{ duration: 3, times: [0, 0.3, 0.6, 1] }}
              style={{
                background: `
                  radial-gradient(ellipse 120% 60% at 30% 20%, rgba(6, 182, 212, 0.15) 0%, transparent 60%),
                  radial-gradient(ellipse 100% 50% at 70% 30%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
                  radial-gradient(ellipse 80% 40% at 50% 60%, rgba(251, 191, 36, 0.08) 0%, transparent 40%)
                `,
              }}
            />

            {/* SVG Aurora Ribbons */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                {ribbons.map((ribbon) => (
                  <linearGradient
                    key={`gradient-${ribbon.id}`}
                    id={`aurora-gradient-${ribbon.id}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={ribbon.gradientColors[0]} stopOpacity="0" />
                    <stop offset="20%" stopColor={ribbon.gradientColors[0]} stopOpacity="1" />
                    <stop offset="50%" stopColor={ribbon.gradientColors[1]} stopOpacity="1" />
                    <stop offset="80%" stopColor={ribbon.gradientColors[2]} stopOpacity="1" />
                    <stop offset="100%" stopColor={ribbon.gradientColors[2]} stopOpacity="0" />
                  </linearGradient>
                ))}

                {/* Glow filters */}
                {ribbons.map((ribbon) => (
                  <filter
                    key={`filter-${ribbon.id}`}
                    id={`aurora-glow-${ribbon.id}`}
                    x="-50%"
                    y="-100%"
                    width="200%"
                    height="300%"
                  >
                    <feGaussianBlur stdDeviation={ribbon.blur / 10} result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                ))}
              </defs>

              {/* Render aurora ribbons with animation */}
              {ribbons.map((ribbon) => (
                <motion.g
                  key={ribbon.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: ribbon.opacity, x: 0 }}
                  transition={{
                    duration: 1.2,
                    delay: ribbon.delay,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  {/* Main ribbon stroke */}
                  <motion.path
                    d={generateWavePath(100, ribbon.yOffset, ribbon.amplitude, ribbon.frequency, phase * ribbon.speed)}
                    fill="none"
                    stroke={`url(#aurora-gradient-${ribbon.id})`}
                    strokeWidth={ribbon.thickness}
                    strokeLinecap="round"
                    filter={`url(#aurora-glow-${ribbon.id})`}
                    style={{ mixBlendMode: 'screen' }}
                  />

                  {/* Secondary glow layer */}
                  <motion.path
                    d={generateWavePath(100, ribbon.yOffset, ribbon.amplitude, ribbon.frequency, phase * ribbon.speed)}
                    fill="none"
                    stroke={`url(#aurora-gradient-${ribbon.id})`}
                    strokeWidth={ribbon.thickness * 2.5}
                    strokeLinecap="round"
                    opacity={0.3}
                    style={{ mixBlendMode: 'screen' }}
                  />
                </motion.g>
              ))}
            </svg>

            {/* Floating sparkle particles */}
            {sparkles.map((sparkle) => (
              <motion.div
                key={sparkle.id}
                className="absolute rounded-full"
                style={{
                  left: `${sparkle.x}%`,
                  top: `${sparkle.y}%`,
                  width: sparkle.size,
                  height: sparkle.size,
                  backgroundColor: sparkle.color,
                  boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.color}, 0 0 ${sparkle.size * 4}px ${sparkle.color}`,
                }}
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: 0,
                  y: 0,
                }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1, 1.2, 0],
                  x: sparkle.driftX,
                  y: sparkle.driftY,
                }}
                transition={{
                  duration: sparkle.duration,
                  delay: sparkle.delay,
                  ease: 'easeOut',
                  opacity: { times: [0, 0.2, 0.7, 1] },
                }}
              />
            ))}

            {/* Horizontal light streaks */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`streak-${i}`}
                className="absolute h-px"
                style={{
                  top: `${15 + i * 15}%`,
                  left: 0,
                  right: 0,
                  background: `linear-gradient(90deg,
                    transparent 0%,
                    ${['#22d3ee', '#a78bfa', '#fbbf24'][i % 3]}40 20%,
                    ${['#22d3ee', '#a78bfa', '#fbbf24'][i % 3]}80 50%,
                    ${['#22d3ee', '#a78bfa', '#fbbf24'][i % 3]}40 80%,
                    transparent 100%
                  )`,
                  boxShadow: `0 0 20px ${['#22d3ee', '#a78bfa', '#fbbf24'][i % 3]}60`,
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{
                  scaleX: [0, 1.2, 1],
                  opacity: [0, 0.8, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.3 + i * 0.12,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
            ))}

            {/* Central message with aurora glow */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <motion.div
                className="relative text-center"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Glowing backdrop for text */}
                <motion.div
                  className="absolute inset-0 -z-10 blur-3xl"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
                  }}
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                <motion.p
                  className="text-2xl md:text-3xl font-light tracking-widest"
                  style={{
                    background: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 50%, #fcd34d 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 40px rgba(167, 139, 250, 0.5)',
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  Until next time...
                </motion.p>

                {/* Animated underline */}
                <motion.div
                  className="mt-4 mx-auto h-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, #22d3ee, #a78bfa, #fbbf24, transparent)',
                  }}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '80%', opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                />
              </motion.div>
            </motion.div>

            {/* Edge vignette for depth */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 150px 50px rgba(0, 0, 0, 0.6)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
