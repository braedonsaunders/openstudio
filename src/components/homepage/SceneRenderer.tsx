'use client';

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SCENE_CONFIGS } from './scene-config';
import { SceneSelector } from './SceneSelector';
import { WalkingCharacter } from './WalkingCharacter';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { HomepageCharacter, HomepageSceneType } from '@/types/avatar';

interface SceneRendererProps {
  scene?: HomepageSceneType;
  onSceneChange?: (scene: HomepageSceneType) => void;
  showSceneSelector?: boolean;
  className?: string;
}

// Memoized star field for performance
const StarField = memo(function StarField({ count = 50, maxTop = 40 }: { count?: number; maxTop?: number }) {
  const stars = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * maxTop,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 2,
    })), [count, maxTop]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: star.duration, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
});

// Animated clouds
const CloudLayer = memo(function CloudLayer({ isDark }: { isDark: boolean }) {
  const clouds = useMemo(() => [
    { width: 120, height: 40, top: 8, duration: 80, delay: 0 },
    { width: 100, height: 35, top: 5, duration: 100, delay: -30 },
    { width: 140, height: 50, top: 12, duration: 70, delay: -50 },
    { width: 90, height: 30, top: 3, duration: 90, delay: -20 },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {clouds.map((cloud, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: `${cloud.top}%` }}
          initial={{ x: '-20%' }}
          animate={{ x: '120vw' }}
          transition={{ duration: cloud.duration, delay: cloud.delay, repeat: Infinity, ease: 'linear' }}
        >
          <svg width={cloud.width} height={cloud.height} viewBox="0 0 120 50">
            <ellipse cx="60" cy="35" rx="50" ry="15" fill={isDark ? 'rgba(100,116,139,0.3)' : 'rgba(255,255,255,0.9)'} />
            <ellipse cx="35" cy="28" rx="30" ry="20" fill={isDark ? 'rgba(100,116,139,0.4)' : 'rgba(255,255,255,0.95)'} />
            <ellipse cx="85" cy="30" rx="28" ry="18" fill={isDark ? 'rgba(100,116,139,0.35)' : 'rgba(255,255,255,0.9)'} />
            <ellipse cx="55" cy="20" rx="25" ry="18" fill={isDark ? 'rgba(100,116,139,0.45)' : 'white'} />
          </svg>
        </motion.div>
      ))}
    </div>
  );
});

// Fireflies/Particles
const Particles = memo(function Particles({ color = '#fbbf24', count = 20 }: { color?: string; count?: number }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: 10 + Math.random() * 80,
      top: 30 + Math.random() * 50,
      size: Math.random() * 4 + 2,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 5,
    })), [count]);

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: color,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
            x: [0, Math.random() * 30 - 15, 0],
            y: [0, Math.random() * -30, 0],
          }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
});

// ============================================
// BEACH SCENE - Day & Night (Ground-dominant pseudo-3D)
// ============================================
function BeachScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.beach.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky - compact at top */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-orange-400 via-pink-500 to-purple-600'
            : 'bg-gradient-to-b from-sky-300 via-cyan-200 to-blue-300'
        }`} />

        {/* Sun/Moon at horizon */}
        <motion.div
          className={`absolute bottom-[15%] left-1/2 -translate-x-1/2 w-14 h-14 rounded-full ${
            isDark
              ? 'bg-gradient-to-b from-yellow-300 to-orange-500'
              : 'bg-gradient-to-b from-yellow-200 to-yellow-400'
          }`}
          style={{
            boxShadow: isDark
              ? '0 0 40px 15px rgba(255, 180, 100, 0.5)'
              : '0 0 50px 20px rgba(255, 220, 100, 0.6)',
          }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        {/* Ocean strip at horizon */}
        <div className={`absolute bottom-0 left-0 right-0 h-[30%] ${
          isDark
            ? 'bg-gradient-to-b from-purple-700 via-blue-700 to-cyan-600'
            : 'bg-gradient-to-b from-blue-400 via-cyan-400 to-cyan-300'
        }`} />

        {/* Waves at waterline */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[20%]" viewBox="0 0 1440 50" preserveAspectRatio="none">
          <motion.path
            d="M0 25 Q90 15 180 25 Q270 35 360 25 Q450 15 540 25 Q630 35 720 25 Q810 15 900 25 Q990 35 1080 25 Q1170 15 1260 25 Q1350 35 1440 25 L1440 50 L0 50 Z"
            fill={isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(34, 211, 238, 0.5)'}
            animate={{ d: [
              'M0 25 Q90 15 180 25 Q270 35 360 25 Q450 15 540 25 Q630 35 720 25 Q810 15 900 25 Q990 35 1080 25 Q1170 15 1260 25 Q1350 35 1440 25 L1440 50 L0 50 Z',
              'M0 25 Q90 35 180 25 Q270 15 360 25 Q450 35 540 25 Q630 15 720 25 Q810 35 900 25 Q990 15 1080 25 Q1170 35 1260 25 Q1350 15 1440 25 L1440 50 L0 50 Z',
            ] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </div>

      {/* Sandy beach - large walkable area */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Sand gradient with perspective */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-amber-500 via-amber-400 to-amber-300'
            : 'bg-gradient-to-b from-amber-300 via-amber-200 to-amber-100'
        }`} />

        {/* Wet sand near water */}
        <div className={`absolute top-0 left-0 right-0 h-[12%] ${isDark ? 'bg-amber-600/40' : 'bg-amber-400/30'}`} />

        {/* Beach items at different depths */}
        {useMemo(() => [
          { x: 8, y: 8, type: 'shell', scale: 0.4 },
          { x: 92, y: 12, type: 'shell', scale: 0.45 },
          { x: 18, y: 35, type: 'towel', scale: 0.55 },
          { x: 78, y: 40, type: 'umbrella', scale: 0.6 },
          { x: 12, y: 65, type: 'bucket', scale: 0.75 },
          { x: 88, y: 70, type: 'shell', scale: 0.8 },
        ].map((item, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `scale(${item.scale})`,
              opacity: 0.5 + item.scale * 0.4,
            }}
          >
            {item.type === 'shell' && <div className="w-4 h-3 rounded-full bg-pink-200/70" />}
            {item.type === 'towel' && <div className="w-16 h-8 rounded bg-red-400/60" />}
            {item.type === 'umbrella' && (
              <div className="relative">
                <div className="w-20 h-10 rounded-t-full bg-yellow-400/70" />
                <div className="absolute top-8 left-1/2 w-1 h-8 bg-amber-800/60" />
              </div>
            )}
            {item.type === 'bucket' && <div className="w-6 h-5 rounded-b bg-blue-400/60" />}
          </div>
        )), [])}

        {/* Palm trees at back corners */}
        <svg className="absolute top-[5%] left-[3%]" width="50" height="80" viewBox="0 0 80 160" style={{ opacity: 0.7 }}>
          <path d="M38 160 Q40 120 42 80 Q44 40 42 20" stroke={isDark ? '#5d4037' : '#8B4513'} strokeWidth="8" fill="none" />
          <path d="M42 25 Q25 15 8 30" stroke={isDark ? '#1b5e20' : '#228B22'} strokeWidth="3" fill="none" />
          <path d="M42 25 Q55 10 75 25" stroke={isDark ? '#1b5e20' : '#228B22'} strokeWidth="3" fill="none" />
          <path d="M42 22 Q30 5 15 15" stroke={isDark ? '#2e7d32' : '#2E8B57'} strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute top-[8%] right-[5%]" width="45" height="70" viewBox="0 0 80 160" style={{ opacity: 0.6 }}>
          <path d="M38 160 Q40 120 42 80 Q44 40 42 20" stroke={isDark ? '#5d4037' : '#8B4513'} strokeWidth="8" fill="none" />
          <path d="M42 25 Q25 15 8 30" stroke={isDark ? '#1b5e20' : '#228B22'} strokeWidth="3" fill="none" />
          <path d="M42 25 Q55 10 75 25" stroke={isDark ? '#1b5e20' : '#228B22'} strokeWidth="3" fill="none" />
        </svg>

        {/* Footprints at various depths */}
        {useMemo(() => Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="absolute opacity-20"
            style={{ left: `${30 + i * 8}%`, top: `${45 + (i % 2) * 3}%` }}
          >
            <div className={`w-2 h-3 rounded-full ${isDark ? 'bg-amber-700' : 'bg-amber-500'}`} />
          </div>
        )), [isDark])}

        {/* Seagulls */}
        {!isDark && useMemo(() => [
          { x: 20, y: -15, scale: 0.6 },
          { x: 70, y: -20, scale: 0.5 },
        ].map((bird, i) => (
          <motion.svg
            key={i}
            className="absolute"
            style={{ left: `${bird.x}%`, top: `${bird.y}%`, transform: `scale(${bird.scale})` }}
            width="20" height="10" viewBox="0 0 20 10"
            animate={{ y: [0, -5, 0], x: [0, 10, 0] }}
            transition={{ duration: 8 + i * 2, repeat: Infinity }}
          >
            <path d="M0 5 Q5 0 10 5 Q15 0 20 5" stroke="#64748b" strokeWidth="2" fill="none" />
          </motion.svg>
        )), [])}
      </div>

      {/* Fireflies (night) */}
      {isDark && <Particles color="#fef08a" count={12} />}
    </div>
  );
}

// ============================================
// CAMPFIRE SCENE - Day & Night (Ground-dominant pseudo-3D)
// ============================================
function CampfireScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.campfire.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky - compact at top */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-indigo-950 via-purple-900 to-violet-800'
            : 'bg-gradient-to-b from-amber-200 via-orange-300 to-rose-400'
        }`} />

        {/* Stars (dark mode) */}
        {isDark && <StarField count={25} />}

        {/* Moon/Sun */}
        <motion.div
          className={`absolute top-[20%] left-[15%] w-10 h-10 rounded-full ${
            isDark
              ? 'bg-gradient-to-br from-gray-100 to-gray-300'
              : 'bg-gradient-to-br from-yellow-300 to-orange-400'
          }`}
          style={{
            boxShadow: isDark
              ? '0 0 30px 10px rgba(255, 255, 255, 0.15)'
              : '0 0 40px 15px rgba(255, 180, 100, 0.4)',
          }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        {/* Distant treeline silhouette at horizon */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[50%]" viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path
            d="M0 100 L0 60 Q50 30 100 50 Q150 20 200 45 Q250 15 300 40 Q350 25 400 55 Q450 20 500 45 Q550 30 600 50 Q650 15 700 40 Q750 25 800 55 Q850 20 900 45 Q950 30 1000 50 Q1050 15 1100 40 Q1150 25 1200 55 Q1250 20 1300 45 Q1350 30 1400 50 L1440 60 L1440 100 Z"
            fill={isDark ? 'rgba(15, 10, 40, 0.9)' : 'rgba(60, 40, 30, 0.6)'}
          />
        </svg>
      </div>

      {/* Ground surface - large walkable area */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Base ground gradient */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-violet-900/90 via-indigo-950 to-slate-950'
            : 'bg-gradient-to-b from-amber-600/70 via-amber-700/80 to-amber-800/90'
        }`} />

        {/* Ground texture overlay */}
        <div className={`absolute inset-0 ${isDark ? 'opacity-5' : 'opacity-8'}`}
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, ${isDark ? 'rgba(139,92,246,0.3)' : 'rgba(180,120,60,0.4)'} 0%, transparent 50%)`,
          }}
        />

        {/* Scattered rocks at different depths */}
        {useMemo(() => [
          { x: 8, y: 15, size: 12, opacity: 0.3 },
          { x: 92, y: 20, size: 10, opacity: 0.35 },
          { x: 15, y: 55, size: 18, opacity: 0.5 },
          { x: 85, y: 60, size: 16, opacity: 0.5 },
          { x: 5, y: 80, size: 24, opacity: 0.6 },
          { x: 95, y: 85, size: 20, opacity: 0.55 },
        ].map((rock, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${isDark ? 'bg-slate-700' : 'bg-stone-500'}`}
            style={{
              left: `${rock.x}%`,
              top: `${rock.y}%`,
              width: rock.size,
              height: rock.size * 0.6,
              opacity: rock.opacity,
            }}
          />
        )), [isDark])}

        {/* Grass tufts at various depths */}
        {useMemo(() => [
          { x: 12, y: 25, scale: 0.5 },
          { x: 88, y: 30, scale: 0.55 },
          { x: 20, y: 50, scale: 0.7 },
          { x: 80, y: 55, scale: 0.75 },
          { x: 8, y: 75, scale: 0.9 },
          { x: 92, y: 80, scale: 0.85 },
        ].map((grass, i) => (
          <svg
            key={i}
            className="absolute"
            style={{
              left: `${grass.x}%`,
              top: `${grass.y}%`,
              transform: `scale(${grass.scale})`,
              opacity: 0.4 + grass.scale * 0.3,
            }}
            width="30" height="20" viewBox="0 0 30 20"
          >
            <path d="M5 20 Q6 10 8 5 Q7 12 5 20" fill={isDark ? '#4ade80' : '#65a30d'} />
            <path d="M12 20 Q14 8 15 2 Q14 10 12 20" fill={isDark ? '#22c55e' : '#84cc16'} />
            <path d="M20 20 Q22 12 25 8 Q23 14 20 20" fill={isDark ? '#4ade80' : '#65a30d'} />
          </svg>
        )), [isDark])}

        {/* Campfire - positioned at bottom, below content card */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '65%' }}>
          <svg width="100" height="80" viewBox="0 0 120 100">
            {/* Log base */}
            <rect x="25" y="75" width="70" height="12" rx="6" fill="#78350f" transform="rotate(-6 60 80)" />
            <rect x="25" y="75" width="70" height="12" rx="6" fill="#92400e" transform="rotate(6 60 80)" />
            {/* Fire glow */}
            <motion.ellipse
              cx="60" cy="70" rx="35" ry="20"
              fill={isDark ? '#f97316' : '#fbbf24'}
              opacity={0.25}
              animate={{ opacity: [0.2, 0.35, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {/* Flames */}
            <motion.g
              style={{ transformOrigin: '60px 75px' }}
              animate={{ scaleY: [1, 1.05, 0.95, 1], scaleX: [1, 0.98, 1.02, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <ellipse cx="60" cy="50" rx="14" ry="28" fill="url(#flameGrad)" />
              <ellipse cx="48" cy="56" rx="8" ry="18" fill="url(#flameGrad2)" />
              <ellipse cx="72" cy="56" rx="8" ry="18" fill="url(#flameGrad2)" />
            </motion.g>
            <defs>
              <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>
              <linearGradient id="flameGrad2" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#fcd34d" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Sitting logs around campfire */}
        {useMemo(() => [
          { x: 30, y: 72, rotation: -15, scale: 0.7 },
          { x: 62, y: 75, rotation: 20, scale: 0.65 },
        ].map((log, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${log.x}%`,
              top: `${log.y}%`,
              transform: `rotate(${log.rotation}deg) scale(${log.scale})`,
            }}
          >
            <div className={`w-16 h-5 rounded-full ${isDark ? 'bg-amber-900' : 'bg-amber-800'}`} />
          </div>
        )), [isDark])}
      </div>

      {/* Fireflies/Particles floating over ground */}
      {isDark && <Particles color="#fef08a" count={15} />}
      {!isDark && useMemo(() => [0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute text-xl"
          style={{ left: `${20 + i * 25}%`, top: `${40 + i * 5}%` }}
          animate={{ x: [0, 30, -20, 0], y: [0, -20, 10, 0] }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, delay: i }}
        >
          🦋
        </motion.div>
      )), [])}
    </div>
  );
}

// ============================================
// FOREST SCENE - Day & Night (Ground-dominant pseudo-3D)
// ============================================
function ForestScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.forest.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Forest canopy at horizon */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-emerald-950 via-green-900 to-emerald-800'
            : 'bg-gradient-to-b from-emerald-400 via-green-300 to-emerald-300'
        }`} />

        {/* Light rays through canopy (day) */}
        {!isDark && useMemo(() => Array.from({ length: 5 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * 18}%`,
              top: 0,
              width: 30 + i * 5,
              height: '100%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 80%)',
              transform: `skewX(${-10 + i * 5}deg)`,
            }}
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
          />
        )), [])}

        {/* Stars (night) */}
        {isDark && <StarField count={20} />}

        {/* Distant tree silhouettes at horizon */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[70%]" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <g fill={isDark ? 'rgba(5, 46, 22, 0.9)' : 'rgba(22, 101, 52, 0.6)'}>
            {useMemo(() => [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400].map((x, i) => (
              <path key={i} d={`M${x + 40} 200 L${x + 40} ${140 - (i % 3) * 20} L${x + 20} ${170 - (i % 3) * 15} L${x + 60} ${170 - (i % 3) * 15} Z`} />
            )), [])}
          </g>
        </svg>
      </div>

      {/* Forest floor - large magical glade */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Ground gradient with moss/grass feel */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-emerald-900 via-green-950 to-emerald-950'
            : 'bg-gradient-to-b from-emerald-300 via-green-400 to-emerald-500'
        }`} />

        {/* Grass texture hints */}
        <div
          className={`absolute inset-0 ${isDark ? 'opacity-10' : 'opacity-15'}`}
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 8px, ${isDark ? '#22c55e' : '#16a34a'} 8px, ${isDark ? '#22c55e' : '#16a34a'} 9px)`,
          }}
        />

        {/* Glowing mushrooms at different depths */}
        {useMemo(() => [
          { x: 8, y: 20, scale: 0.4, hue: 280 },
          { x: 92, y: 25, scale: 0.45, hue: 200 },
          { x: 15, y: 50, scale: 0.6, hue: 320 },
          { x: 85, y: 55, scale: 0.65, hue: 180 },
          { x: 5, y: 75, scale: 0.8, hue: 260 },
          { x: 95, y: 80, scale: 0.75, hue: 220 },
        ].map((shroom, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${shroom.x}%`,
              top: `${shroom.y}%`,
              transform: `scale(${shroom.scale})`,
            }}
          >
            {/* Stem */}
            <div className="w-2 h-4 mx-auto rounded-b bg-amber-100/60" />
            {/* Cap */}
            <motion.div
              className="w-6 h-3 -mt-1 rounded-t-full"
              style={{
                backgroundColor: `hsl(${shroom.hue}, 70%, ${isDark ? '50%' : '60%'})`,
                boxShadow: isDark ? `0 0 8px hsl(${shroom.hue}, 70%, 50%)` : 'none',
              }}
              animate={isDark ? { boxShadow: [`0 0 8px hsl(${shroom.hue}, 70%, 50%)`, `0 0 15px hsl(${shroom.hue}, 70%, 60%)`, `0 0 8px hsl(${shroom.hue}, 70%, 50%)`] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        )), [isDark])}

        {/* Flowers/plants at various depths */}
        {useMemo(() => [
          { x: 20, y: 35, scale: 0.5 },
          { x: 80, y: 40, scale: 0.55 },
          { x: 25, y: 65, scale: 0.75 },
          { x: 75, y: 70, scale: 0.8 },
        ].map((plant, i) => (
          <svg
            key={i}
            className="absolute"
            style={{
              left: `${plant.x}%`,
              top: `${plant.y}%`,
              transform: `scale(${plant.scale})`,
              opacity: 0.5 + plant.scale * 0.3,
            }}
            width="20" height="16" viewBox="0 0 20 16"
          >
            <path d="M10 16 L10 8" stroke={isDark ? '#22c55e' : '#16a34a'} strokeWidth="1.5" />
            <circle cx="10" cy="5" r="4" fill={i % 2 === 0 ? '#f472b6' : '#a78bfa'} opacity="0.7" />
          </svg>
        )), [isDark])}

        {/* Deer (day) */}
        {!isDark && (
          <motion.div
            className="absolute text-3xl"
            style={{ top: '45%', right: '25%', transform: 'scale(0.7)' }}
            animate={{ x: [-5, 5, -5] }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            🦌
          </motion.div>
        )}

        {/* Owl (night) */}
        {isDark && (
          <motion.div
            className="absolute text-2xl"
            style={{ top: '15%', left: '20%', transform: 'scale(0.6)' }}
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            🦉
          </motion.div>
        )}
      </div>

      {/* Fireflies floating everywhere */}
      {isDark && <Particles color="#fef08a" count={18} />}
      {!isDark && useMemo(() => [0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute text-lg"
          style={{ left: `${15 + i * 20}%`, top: `${35 + (i % 2) * 10}%` }}
          animate={{ x: [0, 30, -15, 0], y: [0, -20, 10, 0] }}
          transition={{ duration: 7 + i, repeat: Infinity, delay: i * 0.8 }}
        >
          🦋
        </motion.div>
      )), [])}
    </div>
  );
}

// ============================================
// STUDIO SCENE - Day & Night (Ground-dominant pseudo-3D)
// ============================================
function StudioScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.studio.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Stage back wall */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-700'
            : 'bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500'
        }`} />

        {/* Acoustic panel pattern on back wall */}
        <div className={`absolute inset-0 ${isDark ? 'opacity-10' : 'opacity-8'}`} style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 25px, ${isDark ? '#3f3f46' : '#94a3b8'} 25px, ${isDark ? '#3f3f46' : '#94a3b8'} 27px)`,
        }} />

        {/* LED strip at top */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6)` }}
          animate={{ boxShadow: ['0 0 10px #8b5cf6', '0 0 20px #ec4899', '0 0 10px #8b5cf6'] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Stage monitors at back */}
        {[-1, 1].map((side) => (
          <div
            key={side}
            className={`absolute bottom-[10%] w-8 h-14 rounded border flex flex-col items-center justify-center gap-1 ${
              isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-slate-600 border-slate-500'
            }`}
            style={{ [side < 0 ? 'left' : 'right']: '15%' }}
          >
            <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-slate-500'}`} />
            <div className={`w-5 h-5 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-slate-500'}`} />
          </div>
        ))}

        {/* VU meters on back wall */}
        <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 flex gap-3">
          {[0, 1].map((ch) => (
            <div key={ch} className="flex gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-2 rounded-sm"
                  style={{
                    backgroundColor: '#27272a',
                  }}
                  animate={{ backgroundColor: i < 5 ? ['#27272a', '#22c55e', '#27272a'] : i < 7 ? ['#27272a', '#eab308', '#27272a'] : ['#27272a', '#ef4444', '#27272a'] }}
                  transition={{ duration: 0.3, repeat: Infinity, delay: (ch * 8 + i) * 0.05 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Stage floor - large performance area */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Stage floor with perspective */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900'
            : 'bg-gradient-to-b from-slate-400 via-slate-500 to-slate-600'
        }`} />

        {/* Floor plank lines */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {[0.08, 0.18, 0.32, 0.50, 0.72].map((y, i) => (
            <line
              key={`h-${i}`}
              x1="0%"
              x2="100%"
              y1={`${y * 100}%`}
              y2={`${y * 100}%`}
              stroke={isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)'}
              strokeWidth="1"
            />
          ))}
          {[-45, -25, -10, 0, 10, 25, 45].map((offset, i) => (
            <line
              key={`v-${i}`}
              x1="50%"
              y1="0%"
              x2={`${50 + offset}%`}
              y2="100%"
              stroke={isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)'}
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Stage edge lights */}
        <div className="absolute top-0 left-0 right-0 h-1 flex justify-around px-[10%]">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? '#8b5cf6' : '#fbbf24',
              }}
              animate={{ boxShadow: [`0 0 6px ${i % 2 === 0 ? '#8b5cf6' : '#fbbf24'}`, `0 0 12px ${i % 2 === 0 ? '#8b5cf6' : '#fbbf24'}`, `0 0 6px ${i % 2 === 0 ? '#8b5cf6' : '#fbbf24'}`] }}
              transition={{ duration: 2 + (i % 3) * 0.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        {/* Mic stands at different depths */}
        {useMemo(() => [
          { x: 25, y: 30, scale: 0.5 },
          { x: 75, y: 35, scale: 0.55 },
        ].map((stand, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${stand.x}%`,
              top: `${stand.y}%`,
              transform: `scale(${stand.scale})`,
              opacity: 0.4,
            }}
          >
            <div className={`w-1 h-16 ${isDark ? 'bg-zinc-600' : 'bg-slate-500'}`} />
            <div className={`w-4 h-3 -mt-1 -ml-1.5 rounded ${isDark ? 'bg-zinc-500' : 'bg-slate-400'}`} />
          </div>
        )), [isDark])}

        {/* Cable runs on floor */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M10 60 Q30 55 50 65 Q70 75 90 70" stroke={isDark ? '#52525b' : '#64748b'} strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      {/* Recording light */}
      <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full border ${
        isDark ? 'bg-red-900/40 border-red-500/40' : 'bg-red-100 border-red-300'
      }`}>
        <motion.div
          className="w-2 h-2 rounded-full bg-red-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className={`text-[10px] font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>LIVE</span>
      </div>
    </div>
  );
}

// ============================================
// SPACE SCENE - Day (nebula) & Night (deep space) (Ground-dominant pseudo-3D)
// ============================================
function SpaceScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.space.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep space background */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-black via-indigo-950 to-purple-900'
            : 'bg-gradient-to-b from-indigo-300 via-purple-200 to-pink-300'
        }`} />

        <StarField count={isDark ? 50 : 15} />

        {/* Nebula clouds */}
        <motion.div
          className={`absolute top-[10%] left-[5%] w-[40%] h-[60%] ${isDark ? 'opacity-20' : 'opacity-30'}`}
          style={{ background: `radial-gradient(ellipse at 40% 40%, #8b5cf650 0%, transparent 60%)` }}
          animate={{ opacity: isDark ? [0.15, 0.25, 0.15] : [0.25, 0.35, 0.25] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        {/* Planet at horizon */}
        <div className="absolute bottom-[5%] right-[12%]">
          <div
            className={`w-10 h-10 rounded-full ${
              isDark
                ? 'bg-gradient-to-br from-orange-400 via-red-500 to-purple-700'
                : 'bg-gradient-to-br from-pink-300 via-purple-400 to-indigo-400'
            }`}
            style={{ boxShadow: isDark ? '0 0 20px 5px rgba(249, 115, 22, 0.2)' : '0 0 20px 5px rgba(167, 139, 250, 0.3)' }}
          />
          {/* Planet ring */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-3 rounded-full border opacity-40"
            style={{ borderColor: isDark ? '#f97316' : '#a78bfa', transform: 'translate(-50%, -50%) rotateX(70deg)' }}
          />
        </div>
      </div>

      {/* Platform surface - floating in space */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Platform base with glow */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-slate-800 via-slate-900 to-black'
            : 'bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500'
        }`} />

        {/* Hexagonal grid pattern */}
        <div
          className={`absolute inset-0 ${isDark ? 'opacity-15' : 'opacity-10'}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='${isDark ? '%2364748b' : '%2394a3b8'}' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Energy rings at platform center */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[60%]">
          {[0, 1, 2].map((ring) => (
            <motion.div
              key={ring}
              className="absolute left-1/2 -translate-x-1/2 rounded-full border-2"
              style={{
                width: `${100 + ring * 40}%`,
                height: 20 + ring * 8,
                top: -ring * 5,
                borderColor: '#8b5cf6',
                opacity: 0.2 - ring * 0.05,
              }}
              animate={{ boxShadow: ['0 0 10px #8b5cf6', '0 0 20px #8b5cf6', '0 0 10px #8b5cf6'] }}
              transition={{ duration: 3 + ring, repeat: Infinity, delay: ring * 0.3 }}
            />
          ))}
        </div>

        {/* Holographic data displays at different depths */}
        {useMemo(() => [
          { x: 10, y: 25, scale: 0.5 },
          { x: 88, y: 30, scale: 0.55 },
        ].map((holo, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${holo.x}%`,
              top: `${holo.y}%`,
              transform: `scale(${holo.scale})`,
            }}
          >
            <div
              className="w-16 h-12 rounded border"
              style={{
                borderColor: '#8b5cf660',
                background: 'linear-gradient(180deg, #8b5cf620 0%, transparent 100%)',
              }}
            >
              {/* Fake waveform lines */}
              <div className="flex items-end justify-around h-full p-1">
                {[0.3, 0.6, 0.8, 0.5, 0.7, 0.4].map((h, j) => (
                  <motion.div
                    key={j}
                    className="w-1 rounded-t"
                    style={{
                      height: `${h * 100}%`,
                      backgroundColor: '#8b5cf6',
                      opacity: 0.6,
                    }}
                    animate={{ height: [`${h * 100}%`, `${h * 60}%`, `${h * 100}%`] }}
                    transition={{ duration: 1.5 + j * 0.2, repeat: Infinity, delay: j * 0.1 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )), [])}

        {/* Platform edge lights */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: 'linear-gradient(90deg, transparent 5%, #8b5cf6 20%, #22d3ee 50%, #8b5cf6 80%, transparent 95%)',
            opacity: 0.4,
          }}
          animate={{ boxShadow: ['0 0 15px #8b5cf6', '0 0 25px #22d3ee', '0 0 15px #8b5cf6'] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      {/* Floating particles */}
      <Particles color={isDark ? '#a5b4fc' : '#fcd34d'} count={12} />

      {/* Shooting stars */}
      {useMemo(() => [0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: `${15 + i * 40}%`, top: '5%' }}
          animate={{
            x: [0, 100, 150],
            y: [0, 50, 80],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: 5 + i * 10,
            repeat: Infinity,
            repeatDelay: 20,
          }}
        >
          <div className="w-8 h-0.5 bg-gradient-to-l from-white to-transparent -translate-x-8" />
        </motion.div>
      )), [])}
    </div>
  );
}

// ============================================
// ROOFTOP SCENE - Day & Night (Ground-dominant pseudo-3D)
// ============================================
function RooftopScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.rooftop.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* City skyline background */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-violet-900'
            : 'bg-gradient-to-b from-sky-400 via-sky-300 to-orange-200'
        }`} />

        {/* Stars (night) */}
        {isDark && <StarField count={20} />}

        {/* Sun/Moon */}
        <motion.div
          className={`absolute top-[20%] right-[15%] w-8 h-8 rounded-full ${
            isDark
              ? 'bg-gradient-to-br from-gray-100 to-gray-300'
              : 'bg-gradient-to-br from-yellow-200 to-orange-400'
          }`}
          style={{
            boxShadow: isDark
              ? '0 0 25px 8px rgba(255, 255, 255, 0.15)'
              : '0 0 35px 12px rgba(255, 180, 100, 0.4)',
          }}
        />

        {/* City skyline silhouette at horizon */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[70%]" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="buildingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isDark ? '#1e293b' : '#64748b'} />
              <stop offset="100%" stopColor={isDark ? '#0f172a' : '#334155'} />
            </linearGradient>
          </defs>
          {/* Skyline path */}
          <path
            d="M0 200 L0 160 L60 160 L60 120 L100 120 L100 80 L130 80 L130 140 L180 140 L180 100 L220 100 L220 60 L260 60 L260 130 L310 130 L310 90 L350 90 L350 150 L400 150 L400 70 L440 70 L440 110 L490 110 L490 50 L540 50 L540 120 L590 120 L590 80 L640 80 L640 140 L700 140 L700 60 L750 60 L750 100 L800 100 L800 130 L860 130 L860 70 L910 70 L910 110 L960 110 L960 50 L1010 50 L1010 90 L1060 90 L1060 130 L1110 130 L1110 80 L1160 80 L1160 140 L1210 140 L1210 100 L1270 100 L1270 60 L1320 60 L1320 120 L1370 120 L1370 80 L1420 80 L1420 160 L1440 160 L1440 200 Z"
            fill="url(#buildingGrad)"
          />
          {/* Windows - rows of lit squares */}
          {isDark && useMemo(() => Array.from({ length: 80 }).map((_, i) => (
            <motion.rect
              key={i}
              x={50 + (i % 20) * 70 + Math.random() * 30}
              y={70 + Math.floor(i / 20) * 30 + Math.random() * 20}
              width="4"
              height="6"
              fill="#fef08a"
              opacity={Math.random() > 0.4 ? 0.8 : 0.2}
              animate={{ opacity: Math.random() > 0.7 ? [0.3, 0.9, 0.3] : undefined }}
              transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
            />
          )), [])}
        </svg>
      </div>

      {/* Rooftop surface - walkable area */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Rooftop floor */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-stone-700 via-stone-800 to-stone-900'
            : 'bg-gradient-to-b from-stone-400 via-stone-500 to-stone-600'
        }`} />

        {/* Rooftop tiles/texture */}
        <div
          className={`absolute inset-0 ${isDark ? 'opacity-8' : 'opacity-10'}`}
          style={{
            backgroundImage: `linear-gradient(90deg, ${isDark ? '#57534e' : '#78716c'} 1px, transparent 1px), linear-gradient(180deg, ${isDark ? '#57534e' : '#78716c'} 1px, transparent 1px)`,
            backgroundSize: '40px 30px',
          }}
        />

        {/* AC units at different depths */}
        {useMemo(() => [
          { x: 8, y: 15, scale: 0.4, width: 30 },
          { x: 88, y: 20, scale: 0.45, width: 25 },
          { x: 85, y: 55, scale: 0.6, width: 35 },
        ].map((ac, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${ac.x}%`,
              top: `${ac.y}%`,
              transform: `scale(${ac.scale})`,
            }}
          >
            <div
              className={`h-8 rounded ${isDark ? 'bg-zinc-600' : 'bg-zinc-400'}`}
              style={{ width: ac.width }}
            >
              <motion.div
                className={`w-2/3 h-1 mx-auto mt-1 rounded ${isDark ? 'bg-zinc-500' : 'bg-zinc-300'}`}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>
        )), [isDark])}

        {/* Antenna/pole at back */}
        <div
          className="absolute"
          style={{ left: '50%', top: '8%', transform: 'translateX(-50%)' }}
        >
          <div className={`w-1 h-14 ${isDark ? 'bg-zinc-600' : 'bg-zinc-500'}`} />
          <motion.div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>

        {/* Pipes running across roof */}
        <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M5 30 L45 25 L50 35 L95 30" stroke={isDark ? '#78716c' : '#a8a29e'} strokeWidth="0.8" fill="none" />
          <path d="M10 70 L90 65" stroke={isDark ? '#78716c' : '#a8a29e'} strokeWidth="0.5" fill="none" />
        </svg>

        {/* Puddles (rain remnants) */}
        {!isDark && useMemo(() => [
          { x: 25, y: 60, w: 30, h: 8 },
          { x: 65, y: 75, w: 20, h: 6 },
        ].map((puddle, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-sky-400/15"
            style={{
              left: `${puddle.x}%`,
              top: `${puddle.y}%`,
              width: puddle.w,
              height: puddle.h,
            }}
            animate={{ opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 4, repeat: Infinity, delay: i }}
          />
        )), [])}
      </div>

      {/* Neon signs floating above skyline (night) */}
      {isDark && useMemo(() => [
        { x: 15, y: 18, text: '♪', color: '#ec4899' },
        { x: 80, y: 22, text: '♫', color: '#22d3ee' },
      ].map((sign, i) => (
        <motion.div
          key={i}
          className="absolute text-lg font-bold"
          style={{
            left: `${sign.x}%`,
            top: `${sign.y}%`,
            color: sign.color,
            textShadow: `0 0 10px ${sign.color}, 0 0 20px ${sign.color}`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2 + i, repeat: Infinity }}
        >
          {sign.text}
        </motion.div>
      )), [])}

      {/* City glow (night) */}
      {isDark && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: `${config.horizonY - 5}%`,
            height: '15%',
            background: 'linear-gradient(to top, rgba(251, 191, 36, 0.08), transparent)',
          }}
        />
      )}
    </div>
  );
}

// ============================================
// SCENE COMPONENT WRAPPER - Handles day/night
// ============================================
const SCENE_COMPONENTS: Record<HomepageSceneType, React.FC<{ isDark: boolean }>> = {
  campfire: CampfireScene,
  beach: BeachScene,
  studio: StudioScene,
  forest: ForestScene,
  space: SpaceScene,
  rooftop: RooftopScene,
};

// Day/Night backdrops for each scene
const SCENE_BACKDROPS: Record<HomepageSceneType, { day: string; night: string }> = {
  beach: {
    day: 'linear-gradient(to bottom, #7dd3fc 0%, #bae6fd 30%, #fef3c7 70%, #fed7aa 100%)',
    night: 'linear-gradient(to bottom, #0f172a 0%, #1e1b4b 30%, #312e81 60%, #4c1d95 100%)',
  },
  campfire: {
    day: 'linear-gradient(to bottom, #93c5fd 0%, #bfdbfe 40%, #dbeafe 100%)',
    night: 'linear-gradient(to bottom, #020617 0%, #0f172a 30%, #1e1b4b 70%, #581c87 100%)',
  },
  forest: {
    day: 'linear-gradient(to bottom, #86efac 0%, #bbf7d0 20%, #dcfce7 50%, #fef9c3 100%)',
    night: 'linear-gradient(to bottom, #022c22 0%, #064e3b 30%, #065f46 60%, #047857 100%)',
  },
  studio: {
    day: 'linear-gradient(to bottom, #1e293b 0%, #334155 50%, #475569 100%)',
    night: 'linear-gradient(to bottom, #020617 0%, #0f172a 40%, #1e1b4b 100%)',
  },
  space: {
    day: 'linear-gradient(to bottom, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #7c3aed 100%)',
    night: 'linear-gradient(to bottom, #000000 0%, #0a0a0a 30%, #0f172a 100%)',
  },
  rooftop: {
    day: 'linear-gradient(to bottom, #7dd3fc 0%, #bae6fd 30%, #e0f2fe 60%, #f0f9ff 100%)',
    night: 'linear-gradient(to bottom, #0c0a09 0%, #1c1917 30%, #292524 60%, #44403c 100%)',
  },
};

const SCENE_GROUNDS: Record<HomepageSceneType, { day: string; night: string }> = {
  beach: {
    day: 'linear-gradient(to bottom, #fcd34d 0%, #f59e0b 50%, #d97706 100%)',
    night: 'linear-gradient(to bottom, #78350f 0%, #451a03 50%, #1c0a00 100%)',
  },
  campfire: {
    day: 'linear-gradient(to bottom, #84cc16 0%, #65a30d 50%, #4d7c0f 100%)',
    night: 'linear-gradient(to bottom, #365314 0%, #1a2e05 50%, #0f1a02 100%)',
  },
  forest: {
    day: 'linear-gradient(to bottom, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
    night: 'linear-gradient(to bottom, #14532d 0%, #052e16 50%, #022c22 100%)',
  },
  studio: {
    day: 'linear-gradient(to bottom, #27272a 0%, #18181b 50%, #09090b 100%)',
    night: 'linear-gradient(to bottom, #18181b 0%, #0a0a0a 50%, #000000 100%)',
  },
  space: {
    day: 'linear-gradient(to bottom, #3f3f46 0%, #27272a 50%, #18181b 100%)',
    night: 'linear-gradient(to bottom, #27272a 0%, #18181b 50%, #09090b 100%)',
  },
  rooftop: {
    day: 'linear-gradient(to bottom, #78716c 0%, #57534e 50%, #44403c 100%)',
    night: 'linear-gradient(to bottom, #44403c 0%, #292524 50%, #1c1917 100%)',
  },
};

// Scene order for determining slide direction
const SCENE_ORDER: HomepageSceneType[] = ['beach', 'campfire', 'forest', 'studio', 'space', 'rooftop'];

export function SceneRenderer({
  scene,
  onSceneChange,
  showSceneSelector = true,
  className = '',
}: SceneRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [internalScene, setInternalScene] = useState<HomepageSceneType>('beach');
  const currentScene = scene ?? internalScene;
  const [characters, setCharacters] = useState<HomepageCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Shared position registry for collision avoidance
  const characterPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Callback for characters to update their position
  const updateCharacterPosition = useCallback((id: string, x: number, y: number) => {
    characterPositionsRef.current.set(id, { x, y });
  }, []);

  // Callback to get other characters' positions for collision avoidance
  const getOtherCharacterPositions = useCallback((excludeId: string) => {
    const positions: Array<{ x: number; y: number }> = [];
    characterPositionsRef.current.forEach((pos, id) => {
      if (id !== excludeId) {
        positions.push(pos);
      }
    });
    return positions;
  }, []);

  // Track previous values using refs - updated synchronously
  const prevSceneRef = useRef<HomepageSceneType>(currentScene);
  const prevThemeRef = useRef<boolean>(isDark);

  // Calculate transition info synchronously during render (before refs update)
  const transitionInfo = useMemo(() => {
    const prevScene = prevSceneRef.current;
    const prevTheme = prevThemeRef.current;
    const sceneChanged = prevScene !== currentScene;
    const themeChanged = prevTheme !== isDark;

    if (sceneChanged) {
      const prevIndex = SCENE_ORDER.indexOf(prevScene);
      const currentIndex = SCENE_ORDER.indexOf(currentScene);
      return {
        type: 'scene' as const,
        direction: currentIndex > prevIndex ? 1 : -1,
      };
    } else if (themeChanged) {
      return {
        type: 'theme' as const,
        direction: isDark ? 1 : -1,
      };
    }
    return { type: 'initial' as const, direction: 1 };
  }, [currentScene, isDark]);

  // Update refs AFTER render via useEffect
  useEffect(() => {
    prevSceneRef.current = currentScene;
    prevThemeRef.current = isDark;
  }, [currentScene, isDark]);

  useEffect(() => {
    async function loadCharacters() {
      try {
        const res = await fetch(`/api/homepage/characters?scene=${currentScene}`);
        if (res.ok) {
          const data = await res.json();
          setCharacters(data);
        }
      } catch (error) {
        console.error('Failed to load characters:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadCharacters();
  }, [currentScene]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleSceneChange = (newScene: HomepageSceneType) => {
    setInternalScene(newScene);
    onSceneChange?.(newScene);
  };

  const sceneConfig = SCENE_CONFIGS[currentScene];
  const SceneComponent = SCENE_COMPONENTS[currentScene];
  const backdrop = isDark ? SCENE_BACKDROPS[currentScene].night : SCENE_BACKDROPS[currentScene].day;
  const ground = isDark ? SCENE_GROUNDS[currentScene].night : SCENE_GROUNDS[currentScene].day;

  // Calculate evenly distributed initial positions for characters
  const characterInitialPositions = useMemo(() => {
    if (characters.length === 0) return new Map<string, { x: number; y: number }>();

    const { walkableArea } = sceneConfig.ground;
    const positions = new Map<string, { x: number; y: number }>();
    const placedPositions: Array<{ x: number; y: number }> = [];

    // Minimum distance between characters
    const MIN_SPAWN_DISTANCE = 15;

    // Content card exclusion zone - must match WalkingCharacter.tsx
    const CONTENT_CARD_ZONE = {
      minX: 18,
      maxX: 82,
      minY: 15,
      maxY: 58,
    };

    // Check if point is inside card zone
    const isInsideCardZone = (x: number, y: number) =>
      x >= CONTENT_CARD_ZONE.minX && x <= CONTENT_CARD_ZONE.maxX &&
      y >= CONTENT_CARD_ZONE.minY && y <= CONTENT_CARD_ZONE.maxY;

    // Create spawn points in all valid zones around the card
    const spawnPoints: Array<{ x: number; y: number; priority: number }> = [];
    const spacing = 8;

    // Generate points across walkable area, filtering out card zone
    for (let x = walkableArea.minX + 3; x <= walkableArea.maxX - 3; x += spacing) {
      for (let y = walkableArea.minY + 3; y <= walkableArea.maxY - 3; y += spacing) {
        if (!isInsideCardZone(x, y)) {
          // Priority: bottom area is highest, sides are medium, top is lower
          let priority = 0;
          if (y > CONTENT_CARD_ZONE.maxY) {
            priority = 3; // Bottom zone - most preferred
          } else if (x < CONTENT_CARD_ZONE.minX || x > CONTENT_CARD_ZONE.maxX) {
            priority = 2; // Side zones
          } else if (y < CONTENT_CARD_ZONE.minY) {
            priority = 1; // Top zone
          }
          spawnPoints.push({ x, y, priority });
        }
      }
    }

    // Sort by priority (higher first), then by Y position (bottom first for same priority)
    spawnPoints.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
      return Math.abs(a.x - 50) - Math.abs(b.x - 50);
    });

    // Assign each character to a spawn point, ensuring minimum distance
    characters.forEach((character, index) => {
      let bestPoint: { x: number; y: number } | null = null;

      // Try to find a point that doesn't overlap with already placed characters
      for (const point of spawnPoints) {
        const isFarEnough = placedPositions.every(placed => {
          const dx = point.x - placed.x;
          const dy = point.y - placed.y;
          return Math.sqrt(dx * dx + dy * dy) >= MIN_SPAWN_DISTANCE;
        });

        if (isFarEnough) {
          bestPoint = point;
          break;
        }
      }

      // Fallback: use evenly distributed point if no non-overlapping found
      if (!bestPoint) {
        bestPoint = spawnPoints[index % spawnPoints.length] || { x: walkableArea.minX + 10, y: walkableArea.maxY - 10 };
      }

      // Add slight variation for natural look (deterministic based on index)
      const offsetX = ((index * 7) % 5) - 2;
      const offsetY = ((index * 11) % 5) - 2;

      let finalX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, bestPoint.x + offsetX));
      let finalY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, bestPoint.y + offsetY));

      // Ensure final position is not in card zone
      if (isInsideCardZone(finalX, finalY)) {
        finalX = bestPoint.x;
        finalY = bestPoint.y;
      }

      positions.set(character.id, { x: finalX, y: finalY });
      placedPositions.push({ x: finalX, y: finalY });
    });

    return positions;
  }, [characters, sceneConfig.ground]);

  // Dynamic variants based on transition type - computed synchronously
  const sceneVariants = useMemo(() => {
    const { type, direction } = transitionInfo;

    if (type === 'initial') {
      return {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1, x: 0, y: 0 },
        exit: { opacity: 0, scale: 0.95 },
      };
    }
    if (type === 'scene') {
      // Horizontal slide - scenes are laid out left to right
      return {
        initial: { opacity: 0, x: `${direction * 100}%` },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: `${-direction * 100}%` },
      };
    }
    // Vertical slide for theme changes
    // Night: slides down from top, Day: slides up from bottom
    return {
      initial: { opacity: 0, y: isDark ? '-60%' : '60%' },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: isDark ? '60%' : '-60%' },
    };
  }, [transitionInfo, isDark]);

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Backdrop/Sky - crossfade with color shift */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`backdrop-${currentScene}-${isDark}`}
          className="absolute inset-0"
          style={{ background: backdrop }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* Ground plane - slides with content */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`ground-${currentScene}-${isDark}`}
          className="absolute left-0 right-0 bottom-0"
          style={{ background: ground, top: `${sceneConfig.ground.horizonY}%` }}
          initial={{
            opacity: 0,
            x: transitionInfo.type === 'scene' ? `${transitionInfo.direction * 30}%` : 0,
            y: transitionInfo.type === 'theme' ? (isDark ? '-20%' : '20%') : 0,
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{
            opacity: 0,
            x: transitionInfo.type === 'scene' ? `${-transitionInfo.direction * 30}%` : 0,
            y: transitionInfo.type === 'theme' ? (isDark ? '20%' : '-20%') : 0,
          }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        />
      </AnimatePresence>

      {/* Scene decorations - main animated content */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={`${currentScene}-${isDark}`}
          variants={sceneVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1],
            opacity: { duration: 0.25 },
          }}
          className="absolute inset-0"
        >
          <SceneComponent isDark={isDark} />
        </motion.div>
      </AnimatePresence>

      {/* Walking Characters */}
      <AnimatePresence>
        {containerSize.width > 0 && characters.map((character) => (
          <WalkingCharacter
            key={character.id}
            character={character}
            groundConfig={sceneConfig.ground}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            initialPosition={characterInitialPositions.get(character.id)}
            onPositionUpdate={updateCharacterPosition}
            getOtherPositions={getOtherCharacterPositions}
          />
        ))}
      </AnimatePresence>

      {/* Scene Selector */}
      {showSceneSelector && (
        <div className="absolute bottom-20 left-4 z-50">
          <SceneSelector currentScene={currentScene} onSceneChange={handleSceneChange} />
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin w-8 h-8 border-2 border-white/30 border-t-white rounded-full" />
        </div>
      )}
    </div>
  );
}
