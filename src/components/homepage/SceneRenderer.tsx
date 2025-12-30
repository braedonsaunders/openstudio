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
// FOREST SCENE - Magical Enchanted Forest Clearing
// ============================================

// Realistic tree component with trunk, branches, and layered foliage
const ForestTree = memo(function ForestTree({
  x,
  scale,
  variant,
  isDark,
  flip = false,
}: {
  x: number;
  scale: number;
  variant: 'oak' | 'pine' | 'birch' | 'willow';
  isDark: boolean;
  flip?: boolean;
}) {
  const baseHeight = variant === 'pine' ? 180 : variant === 'willow' ? 160 : 150;
  const height = baseHeight * scale;
  const width = (variant === 'pine' ? 80 : variant === 'willow' ? 120 : 100) * scale;

  // Color palettes for day/night
  const colors = isDark ? {
    trunk: '#1a0f0a',
    trunkLight: '#2d1f15',
    foliage1: '#052e16',
    foliage2: '#064e3b',
    foliage3: '#065f46',
    highlight: '#0d9488',
  } : {
    trunk: '#5d4037',
    trunkLight: '#795548',
    foliage1: '#166534',
    foliage2: '#15803d',
    foliage3: '#22c55e',
    highlight: '#86efac',
  };

  const renderTree = () => {
    switch (variant) {
      case 'pine':
        return (
          <svg width={width} height={height} viewBox="0 0 80 180" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
            {/* Trunk */}
            <path d="M36 180 L36 100 Q40 95 44 100 L44 180" fill={colors.trunk} />
            <path d="M38 180 L38 105 Q40 102 42 105 L42 180" fill={colors.trunkLight} />
            {/* Pine layers */}
            <path d="M40 10 L10 70 L25 65 L5 100 L20 95 L0 130 L40 110 L80 130 L60 95 L75 100 L55 65 L70 70 Z" fill={colors.foliage1} />
            <path d="M40 15 L18 65 L28 62 L12 92 L25 88 L10 118 L40 102 L70 118 L55 88 L68 92 L52 62 L62 65 Z" fill={colors.foliage2} />
            <path d="M40 25 L28 58 L35 56 L22 82 L32 78 L20 105 L40 92 L60 105 L48 78 L58 82 L45 56 L52 58 Z" fill={colors.foliage3} />
            {/* Highlight */}
            <path d="M40 30 L32 52 L38 50 L30 72 L36 70 L28 90 L40 82 L52 90 L44 70 L50 72 L42 50 L48 52 Z" fill={colors.highlight} opacity="0.3" />
          </svg>
        );
      case 'birch':
        return (
          <svg width={width} height={height} viewBox="0 0 100 150" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
            {/* Birch trunk with markings */}
            <path d="M45 150 L45 40 Q50 35 55 40 L55 150" fill={isDark ? '#374151' : '#f5f5f4'} />
            <path d="M46 150 L46 45 Q50 42 54 45 L54 150" fill={isDark ? '#4b5563' : '#fafaf9'} />
            {/* Birch bark markings */}
            {[50, 70, 95, 115, 135].map((y, i) => (
              <ellipse key={i} cx={50 + (i % 2) * 3} cy={y} rx={4} ry={2} fill={isDark ? '#1f2937' : '#292524'} opacity="0.6" />
            ))}
            {/* Foliage clusters */}
            <ellipse cx="35" cy="35" rx="25" ry="20" fill={colors.foliage2} />
            <ellipse cx="60" cy="30" rx="28" ry="22" fill={colors.foliage1} />
            <ellipse cx="50" cy="22" rx="22" ry="18" fill={colors.foliage3} />
            <ellipse cx="70" cy="40" rx="20" ry="16" fill={colors.foliage2} />
            <ellipse cx="30" cy="45" rx="18" ry="14" fill={colors.foliage1} />
            {/* Highlights */}
            <ellipse cx="50" cy="20" rx="12" ry="10" fill={colors.highlight} opacity="0.25" />
          </svg>
        );
      case 'willow':
        return (
          <svg width={width} height={height} viewBox="0 0 120 160" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
            {/* Trunk */}
            <path d="M55 160 L50 80 Q60 60 60 40 Q58 60 70 80 L65 160" fill={colors.trunk} />
            <path d="M57 160 L53 85 Q60 68 60 50 Q58 68 67 85 L63 160" fill={colors.trunkLight} />
            {/* Main canopy */}
            <ellipse cx="60" cy="35" rx="45" ry="30" fill={colors.foliage1} />
            <ellipse cx="60" cy="30" rx="38" ry="25" fill={colors.foliage2} />
            {/* Drooping branches */}
            {[20, 40, 60, 80, 100].map((bx, i) => (
              <path
                key={i}
                d={`M${bx} 45 Q${bx + (i % 2 ? 5 : -5)} 80 ${bx + (i % 2 ? 10 : -10)} 120`}
                stroke={colors.foliage3}
                strokeWidth="8"
                fill="none"
                opacity="0.8"
              />
            ))}
            {/* Leaf clusters on branches */}
            {[18, 42, 62, 82, 102].map((bx, i) => (
              <g key={i}>
                <ellipse cx={bx + (i % 2 ? 8 : -8)} cy={90 + i * 5} rx="12" ry="8" fill={colors.foliage2} opacity="0.7" />
                <ellipse cx={bx + (i % 2 ? 12 : -12)} cy={110 + i * 3} rx="10" ry="6" fill={colors.foliage3} opacity="0.6" />
              </g>
            ))}
          </svg>
        );
      default: // oak
        return (
          <svg width={width} height={height} viewBox="0 0 100 150" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
            {/* Main trunk */}
            <path d="M42 150 L40 90 Q35 70 38 50 Q42 45 50 45 Q58 45 62 50 Q65 70 60 90 L58 150" fill={colors.trunk} />
            {/* Trunk texture */}
            <path d="M44 150 L43 95 Q40 75 42 55 Q46 50 50 50 Q54 50 58 55 Q60 75 57 95 L56 150" fill={colors.trunkLight} />
            {/* Branches */}
            <path d="M42 70 Q30 60 20 55" stroke={colors.trunk} strokeWidth="6" fill="none" />
            <path d="M58 65 Q70 55 82 50" stroke={colors.trunk} strokeWidth="5" fill="none" />
            <path d="M45 55 Q35 45 30 35" stroke={colors.trunk} strokeWidth="4" fill="none" />
            <path d="M55 52 Q62 42 72 35" stroke={colors.trunk} strokeWidth="4" fill="none" />
            {/* Foliage clusters */}
            <ellipse cx="20" cy="45" rx="22" ry="18" fill={colors.foliage1} />
            <ellipse cx="80" cy="40" rx="20" ry="16" fill={colors.foliage1} />
            <ellipse cx="30" cy="28" rx="18" ry="15" fill={colors.foliage2} />
            <ellipse cx="70" cy="25" rx="20" ry="16" fill={colors.foliage2} />
            <ellipse cx="50" cy="20" rx="30" ry="22" fill={colors.foliage1} />
            <ellipse cx="50" cy="15" rx="25" ry="18" fill={colors.foliage2} />
            <ellipse cx="40" cy="35" rx="22" ry="18" fill={colors.foliage3} />
            <ellipse cx="60" cy="32" rx="24" ry="20" fill={colors.foliage2} />
            <ellipse cx="50" cy="25" rx="20" ry="16" fill={colors.foliage3} />
            {/* Highlights */}
            <ellipse cx="45" cy="18" rx="12" ry="10" fill={colors.highlight} opacity="0.2" />
            <ellipse cx="65" cy="28" rx="10" ry="8" fill={colors.highlight} opacity="0.15" />
          </svg>
        );
    }
  };

  return (
    <div
      className="absolute bottom-0"
      style={{
        left: `${x}%`,
        transform: 'translateX(-50%)',
        zIndex: Math.floor((1 - scale) * 10),
      }}
    >
      {renderTree()}
    </div>
  );
});

// Magical floating particles for the forest
const MagicalParticles = memo(function MagicalParticles({ isDark }: { isDark: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: isDark ? 40 : 25 }, (_, i) => ({
      id: i,
      left: 15 + Math.random() * 70,
      top: 20 + Math.random() * 60,
      size: isDark ? Math.random() * 4 + 2 : Math.random() * 3 + 1,
      duration: 4 + Math.random() * 6,
      delay: Math.random() * 8,
      color: isDark
        ? ['#fef08a', '#a5f3fc', '#c4b5fd', '#fbcfe8', '#bef264'][Math.floor(Math.random() * 5)]
        : ['#fef9c3', '#d9f99d', '#bbf7d0', '#a7f3d0'][Math.floor(Math.random() * 4)],
    })), [isDark]);

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: isDark ? `0 0 ${p.size * 3}px ${p.color}` : `0 0 ${p.size}px ${p.color}`,
          }}
          animate={{
            opacity: [0, isDark ? 0.9 : 0.6, 0],
            scale: [0.3, 1.2, 0.3],
            y: [0, -30 - Math.random() * 40, -60],
            x: [0, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 60],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </>
  );
});

// Sun rays through canopy
const SunRays = memo(function SunRays() {
  const rays = useMemo(() => [
    { x: 20, width: 60, skew: -15, delay: 0 },
    { x: 35, width: 80, skew: -8, delay: 0.5 },
    { x: 50, width: 100, skew: 0, delay: 1 },
    { x: 65, width: 70, skew: 8, delay: 1.5 },
    { x: 80, width: 50, skew: 15, delay: 2 },
  ], []);

  return (
    <>
      {rays.map((ray, i) => (
        <motion.div
          key={i}
          className="absolute top-0 pointer-events-none"
          style={{
            left: `${ray.x}%`,
            width: ray.width,
            height: '100%',
            background: 'linear-gradient(180deg, rgba(255, 251, 235, 0.5) 0%, rgba(254, 249, 195, 0.3) 30%, transparent 70%)',
            transform: `translateX(-50%) skewX(${ray.skew}deg)`,
          }}
          animate={{
            opacity: [0.15, 0.4, 0.15],
            scaleX: [0.9, 1.1, 0.9],
          }}
          transition={{
            duration: 5,
            delay: ray.delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}
    </>
  );
});

// Glowing mushroom cluster
const MushroomCluster = memo(function MushroomCluster({
  x,
  y,
  scale,
  isDark
}: {
  x: number;
  y: number;
  scale: number;
  isDark: boolean;
}) {
  const mushrooms = useMemo(() => [
    { offsetX: 0, offsetY: 0, size: 1, hue: 280 },
    { offsetX: -12, offsetY: 5, size: 0.7, hue: 320 },
    { offsetX: 10, offsetY: 3, size: 0.8, hue: 200 },
  ], []);

  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${scale})`,
        zIndex: Math.floor(y / 10),
      }}
    >
      {mushrooms.map((m, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: m.offsetX,
            top: m.offsetY,
            transform: `scale(${m.size})`,
          }}
        >
          {/* Stem */}
          <div
            className="w-3 h-6 mx-auto rounded-b-lg"
            style={{
              background: isDark
                ? 'linear-gradient(to right, #fef3c7, #fde68a, #fef3c7)'
                : 'linear-gradient(to right, #fefce8, #fef9c3, #fefce8)',
              opacity: isDark ? 0.9 : 0.7,
            }}
          />
          {/* Cap */}
          <motion.div
            className="w-10 h-5 -mt-2 rounded-t-full mx-auto"
            style={{
              background: `radial-gradient(ellipse at 50% 80%, hsl(${m.hue}, 80%, ${isDark ? '45%' : '55%'}), hsl(${m.hue}, 70%, ${isDark ? '30%' : '40%'}))`,
              boxShadow: isDark
                ? `0 0 15px 5px hsla(${m.hue}, 80%, 50%, 0.5), inset 0 -2px 4px hsla(${m.hue}, 60%, 60%, 0.3)`
                : 'none',
            }}
            animate={isDark ? {
              boxShadow: [
                `0 0 15px 5px hsla(${m.hue}, 80%, 50%, 0.4)`,
                `0 0 25px 8px hsla(${m.hue}, 80%, 60%, 0.6)`,
                `0 0 15px 5px hsla(${m.hue}, 80%, 50%, 0.4)`,
              ]
            } : {}}
            transition={{ duration: 2 + i * 0.5, repeat: Infinity }}
          />
          {/* Cap spots */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            <div className="w-1.5 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/30" />
          </div>
        </div>
      ))}
    </div>
  );
});

// Forest floor details - ferns, flowers, grass patches
const ForestFloorDetails = memo(function ForestFloorDetails({ isDark }: { isDark: boolean }) {
  const elements = useMemo(() => ({
    ferns: [
      { x: 12, y: 25, scale: 0.5, flip: false },
      { x: 88, y: 22, scale: 0.45, flip: true },
      { x: 8, y: 55, scale: 0.7, flip: false },
      { x: 92, y: 58, scale: 0.65, flip: true },
      { x: 5, y: 78, scale: 0.9, flip: false },
      { x: 95, y: 82, scale: 0.85, flip: true },
    ],
    flowers: [
      { x: 22, y: 40, color: '#f472b6', scale: 0.6 },
      { x: 78, y: 38, color: '#a78bfa', scale: 0.55 },
      { x: 18, y: 65, color: '#fbbf24', scale: 0.75 },
      { x: 82, y: 68, color: '#f472b6', scale: 0.7 },
      { x: 25, y: 85, color: '#60a5fa', scale: 0.9 },
      { x: 75, y: 88, color: '#a78bfa', scale: 0.85 },
    ],
    grassPatches: [
      { x: 15, y: 30, scale: 0.5 },
      { x: 85, y: 28, scale: 0.45 },
      { x: 10, y: 50, scale: 0.65 },
      { x: 90, y: 52, scale: 0.6 },
      { x: 20, y: 75, scale: 0.8 },
      { x: 80, y: 78, scale: 0.75 },
    ],
  }), []);

  const fernColor = isDark ? '#065f46' : '#16a34a';
  const fernColorLight = isDark ? '#059669' : '#22c55e';
  const grassColor = isDark ? '#047857' : '#22c55e';

  return (
    <>
      {/* Ferns */}
      {elements.ferns.map((fern, i) => (
        <svg
          key={`fern-${i}`}
          className="absolute"
          style={{
            left: `${fern.x}%`,
            top: `${fern.y}%`,
            transform: `scale(${fern.scale}) ${fern.flip ? 'scaleX(-1)' : ''}`,
            opacity: 0.4 + fern.scale * 0.5,
            zIndex: Math.floor(fern.y / 10),
          }}
          width="40" height="35" viewBox="0 0 40 35"
        >
          {/* Fern fronds */}
          <path d="M20 35 Q18 25 15 20 Q10 22 5 20 Q12 18 15 15 Q10 12 8 8 Q15 12 18 12 Q16 8 18 2 Q20 10 22 12 Q25 12 32 8 Q30 12 25 15 Q28 18 35 20 Q30 22 25 20 Q22 25 20 35"
            fill={fernColor} />
          <path d="M20 35 Q19 26 17 21 Q14 22 10 21 Q15 19 17 17 Q14 15 12 12 Q17 14 19 14 Q18 10 19 5 Q20 12 21 14 Q23 14 28 12 Q26 15 23 17 Q25 19 30 21 Q26 22 23 21 Q21 26 20 35"
            fill={fernColorLight} opacity="0.7" />
        </svg>
      ))}

      {/* Wildflowers */}
      {elements.flowers.map((flower, i) => (
        <motion.div
          key={`flower-${i}`}
          className="absolute"
          style={{
            left: `${flower.x}%`,
            top: `${flower.y}%`,
            transform: `scale(${flower.scale})`,
            zIndex: Math.floor(flower.y / 10),
          }}
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity }}
        >
          <svg width="16" height="24" viewBox="0 0 16 24">
            {/* Stem */}
            <path d="M8 24 Q7 18 8 12" stroke={grassColor} strokeWidth="1.5" fill="none" />
            {/* Leaves */}
            <path d="M8 18 Q4 16 3 18 Q5 17 8 18" fill={grassColor} />
            <path d="M8 20 Q12 18 13 20 Q11 19 8 20" fill={grassColor} />
            {/* Petals */}
            <circle cx="8" cy="8" r="5" fill={flower.color} opacity={isDark ? 0.6 : 0.8} />
            <circle cx="8" cy="8" r="3" fill={flower.color} />
            {/* Center */}
            <circle cx="8" cy="8" r="1.5" fill={isDark ? '#fef08a' : '#fbbf24'} />
          </svg>
        </motion.div>
      ))}

      {/* Grass patches */}
      {elements.grassPatches.map((patch, i) => (
        <motion.svg
          key={`grass-${i}`}
          className="absolute"
          style={{
            left: `${patch.x}%`,
            top: `${patch.y}%`,
            transform: `scale(${patch.scale})`,
            opacity: 0.5 + patch.scale * 0.4,
            zIndex: Math.floor(patch.y / 10),
          }}
          width="30" height="25" viewBox="0 0 30 25"
          animate={{ scaleX: [1, 1.02, 0.98, 1] }}
          transition={{ duration: 4 + i, repeat: Infinity }}
        >
          <path d="M3 25 Q4 15 6 8 Q5 16 3 25" fill={grassColor} />
          <path d="M8 25 Q10 12 11 3 Q10 14 8 25" fill={fernColorLight} />
          <path d="M13 25 Q14 14 16 6 Q15 15 13 25" fill={grassColor} />
          <path d="M18 25 Q20 10 22 2 Q20 12 18 25" fill={fernColorLight} />
          <path d="M23 25 Q24 15 27 7 Q25 16 23 25" fill={grassColor} />
        </motion.svg>
      ))}
    </>
  );
});

function ForestScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.forest.ground;

  // Tree configurations for the forest surrounding the clearing
  const trees = useMemo(() => ({
    // Back row - smallest, furthest trees (at horizon)
    backRow: [
      { x: 2, scale: 0.25, variant: 'pine' as const },
      { x: 8, scale: 0.28, variant: 'oak' as const },
      { x: 14, scale: 0.22, variant: 'birch' as const },
      { x: 20, scale: 0.26, variant: 'pine' as const },
      // Gap for clearing center
      { x: 80, scale: 0.24, variant: 'pine' as const },
      { x: 86, scale: 0.27, variant: 'oak' as const },
      { x: 92, scale: 0.23, variant: 'birch' as const },
      { x: 98, scale: 0.25, variant: 'pine' as const },
    ],
    // Middle row - medium trees
    middleRow: [
      { x: -2, scale: 0.45, variant: 'oak' as const, flip: false },
      { x: 6, scale: 0.5, variant: 'willow' as const, flip: false },
      { x: 15, scale: 0.42, variant: 'pine' as const, flip: false },
      { x: 22, scale: 0.48, variant: 'birch' as const, flip: false },
      // Gap for clearing
      { x: 78, scale: 0.46, variant: 'birch' as const, flip: true },
      { x: 85, scale: 0.44, variant: 'pine' as const, flip: true },
      { x: 94, scale: 0.52, variant: 'willow' as const, flip: true },
      { x: 102, scale: 0.47, variant: 'oak' as const, flip: true },
    ],
    // Front row - largest trees, framing the scene
    frontRow: [
      { x: -5, scale: 0.85, variant: 'oak' as const, flip: false },
      { x: 8, scale: 0.75, variant: 'pine' as const, flip: false },
      { x: 18, scale: 0.7, variant: 'willow' as const, flip: false },
      // Gap for clearing
      { x: 82, scale: 0.72, variant: 'willow' as const, flip: true },
      { x: 92, scale: 0.78, variant: 'pine' as const, flip: true },
      { x: 105, scale: 0.88, variant: 'oak' as const, flip: true },
    ],
  }), []);

  // Mushroom cluster positions
  const mushroomClusters = useMemo(() => [
    { x: 10, y: 35, scale: 0.5 },
    { x: 90, y: 32, scale: 0.45 },
    { x: 8, y: 60, scale: 0.7 },
    { x: 92, y: 62, scale: 0.65 },
    { x: 15, y: 80, scale: 0.85 },
    { x: 85, y: 82, scale: 0.8 },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky/Canopy backdrop */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        {/* Sky gradient - visible through canopy gaps */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-slate-950 via-indigo-950 to-emerald-950'
            : 'bg-gradient-to-b from-sky-300 via-emerald-200 to-emerald-300'
        }`} />

        {/* Dense canopy layer */}
        <div
          className={`absolute inset-0 ${isDark ? 'opacity-90' : 'opacity-70'}`}
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 120%, #022c22 0%, #064e3b 40%, #0f766e 100%)'
              : 'radial-gradient(ellipse at 50% 120%, #15803d 0%, #22c55e 40%, #4ade80 100%)',
          }}
        />

        {/* Canopy leaf texture */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {useMemo(() => Array.from({ length: 25 }, (_, i) => {
            const x = (i % 5) * 25 + Math.random() * 15;
            const y = Math.floor(i / 5) * 25 + Math.random() * 15;
            return (
              <ellipse
                key={i}
                cx={`${x}%`}
                cy={`${y}%`}
                rx="12%"
                ry="15%"
                fill={isDark ? '#052e16' : '#166534'}
                opacity={0.3 + Math.random() * 0.3}
              />
            );
          }), [isDark])}
        </svg>

        {/* Stars visible through canopy gaps (night) */}
        {isDark && <StarField count={30} maxTop={90} />}

        {/* Moon glow through trees (night) */}
        {isDark && (
          <motion.div
            className="absolute top-[15%] right-[25%] w-16 h-16 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(226, 232, 240, 0.3) 0%, transparent 70%)',
              boxShadow: '0 0 60px 30px rgba(226, 232, 240, 0.15)',
            }}
            animate={{ opacity: [0.5, 0.7, 0.5] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        )}

        {/* Sun rays through canopy (day) */}
        {!isDark && <SunRays />}

        {/* Back row trees (at horizon) */}
        <div className="absolute bottom-0 left-0 right-0 h-[80%]">
          {trees.backRow.map((tree, i) => (
            <ForestTree key={`back-${i}`} x={tree.x} scale={tree.scale} variant={tree.variant} isDark={isDark} />
          ))}
        </div>
      </div>

      {/* Forest floor - the magical clearing */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Base ground with moss gradient */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-emerald-950 via-green-950 to-slate-950'
            : 'bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600'
        }`} />

        {/* Clearing spotlight effect - lighter center */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 30%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)'
              : 'radial-gradient(ellipse at 50% 30%, rgba(254, 249, 195, 0.4) 0%, transparent 50%)',
          }}
        />

        {/* Ground texture - moss and grass */}
        <div
          className={`absolute inset-0 ${isDark ? 'opacity-15' : 'opacity-20'}`}
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, ${isDark ? '#22c55e' : '#16a34a'} 1px, transparent 1px),
              radial-gradient(circle at 80% 60%, ${isDark ? '#22c55e' : '#16a34a'} 1px, transparent 1px),
              radial-gradient(circle at 40% 80%, ${isDark ? '#22c55e' : '#16a34a'} 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px, 80px 80px, 50px 50px',
          }}
        />

        {/* Fallen leaves scattered on ground */}
        {useMemo(() => Array.from({ length: 15 }, (_, i) => (
          <motion.div
            key={`leaf-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${20 + Math.random() * 60}%`,
              width: 4 + Math.random() * 4,
              height: 3 + Math.random() * 3,
              background: isDark
                ? ['#713f12', '#854d0e', '#92400e'][Math.floor(Math.random() * 3)]
                : ['#ca8a04', '#eab308', '#facc15'][Math.floor(Math.random() * 3)],
              opacity: 0.3 + Math.random() * 0.3,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 8 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 5 }}
          />
        )), [isDark])}

        {/* Middle row trees */}
        {trees.middleRow.map((tree, i) => (
          <ForestTree
            key={`mid-${i}`}
            x={tree.x}
            scale={tree.scale}
            variant={tree.variant}
            isDark={isDark}
            flip={tree.flip}
          />
        ))}

        {/* Forest floor details - ferns, flowers, grass */}
        <ForestFloorDetails isDark={isDark} />

        {/* Glowing mushroom clusters */}
        {mushroomClusters.map((cluster, i) => (
          <MushroomCluster
            key={`mushroom-${i}`}
            x={cluster.x}
            y={cluster.y}
            scale={cluster.scale}
            isDark={isDark}
          />
        ))}

        {/* Front row trees - framing the scene */}
        {trees.frontRow.map((tree, i) => (
          <ForestTree
            key={`front-${i}`}
            x={tree.x}
            scale={tree.scale}
            variant={tree.variant}
            isDark={isDark}
            flip={tree.flip}
          />
        ))}

        {/* Deer in the clearing (day) */}
        {!isDark && (
          <motion.div
            className="absolute"
            style={{
              top: '35%',
              left: '60%',
              zIndex: 5,
            }}
            animate={{ x: [-10, 10, -10], y: [0, -3, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
          >
            <svg width="50" height="45" viewBox="0 0 50 45">
              {/* Body */}
              <ellipse cx="25" cy="30" rx="15" ry="10" fill="#a16207" />
              {/* Neck */}
              <path d="M32 25 Q38 15 35 8" stroke="#a16207" strokeWidth="6" fill="none" />
              {/* Head */}
              <ellipse cx="35" cy="8" rx="6" ry="5" fill="#ca8a04" />
              {/* Ear */}
              <ellipse cx="38" cy="4" rx="2" ry="4" fill="#ca8a04" />
              {/* Eye */}
              <circle cx="33" cy="7" r="1" fill="#1c1917" />
              {/* Legs */}
              <path d="M15 38 L15 45" stroke="#854d0e" strokeWidth="2" />
              <path d="M20 38 L20 45" stroke="#854d0e" strokeWidth="2" />
              <path d="M30 38 L30 45" stroke="#854d0e" strokeWidth="2" />
              <path d="M35 38 L35 45" stroke="#854d0e" strokeWidth="2" />
              {/* Tail */}
              <ellipse cx="10" cy="28" rx="3" ry="2" fill="#fef3c7" />
            </svg>
          </motion.div>
        )}

        {/* Fox in the clearing (night) */}
        {isDark && (
          <motion.div
            className="absolute"
            style={{
              top: '45%',
              left: '35%',
              zIndex: 5,
            }}
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <svg width="40" height="30" viewBox="0 0 40 30">
              {/* Body */}
              <ellipse cx="20" cy="22" rx="12" ry="7" fill="#ea580c" />
              {/* Tail */}
              <path d="M8 22 Q2 18 0 22 Q2 24 8 22" fill="#ea580c" />
              <path d="M2 22 Q1 21 0 22 Q1 23 2 22" fill="#fef3c7" />
              {/* Head */}
              <ellipse cx="30" cy="18" rx="7" ry="6" fill="#f97316" />
              {/* Snout */}
              <ellipse cx="36" cy="20" rx="4" ry="3" fill="#fef3c7" />
              <circle cx="38" cy="19" r="1" fill="#1c1917" />
              {/* Ears */}
              <path d="M26 12 L24 6 L28 10 Z" fill="#f97316" />
              <path d="M32 12 L34 6 L30 10 Z" fill="#f97316" />
              <path d="M26 11 L25 8 L27 10 Z" fill="#1c1917" />
              <path d="M32 11 L33 8 L31 10 Z" fill="#1c1917" />
              {/* Eyes */}
              <ellipse cx="28" cy="17" rx="1.5" ry="2" fill="#fef08a">
                <animate attributeName="ry" values="2;0.5;2" dur="4s" repeatCount="indefinite" />
              </ellipse>
              {/* Legs */}
              <path d="M14 28 L14 30" stroke="#c2410c" strokeWidth="2" />
              <path d="M26 28 L26 30" stroke="#c2410c" strokeWidth="2" />
            </svg>
          </motion.div>
        )}

        {/* Owl in tree (night) */}
        {isDark && (
          <motion.div
            className="absolute"
            style={{ top: '15%', left: '12%', zIndex: 20 }}
            animate={{ rotate: [-5, 5, -5], y: [0, -2, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            <svg width="28" height="35" viewBox="0 0 28 35">
              {/* Body */}
              <ellipse cx="14" cy="24" rx="10" ry="11" fill="#78716c" />
              {/* Chest */}
              <ellipse cx="14" cy="26" rx="6" ry="8" fill="#a8a29e" />
              {/* Chest pattern */}
              <path d="M11 22 L14 24 L17 22" stroke="#57534e" strokeWidth="0.5" fill="none" />
              <path d="M10 25 L14 27 L18 25" stroke="#57534e" strokeWidth="0.5" fill="none" />
              <path d="M11 28 L14 30 L17 28" stroke="#57534e" strokeWidth="0.5" fill="none" />
              {/* Head */}
              <ellipse cx="14" cy="10" rx="9" ry="8" fill="#78716c" />
              {/* Ear tufts */}
              <path d="M6 5 L4 0 L8 4 Z" fill="#57534e" />
              <path d="M22 5 L24 0 L20 4 Z" fill="#57534e" />
              {/* Face disc */}
              <ellipse cx="14" cy="11" rx="7" ry="6" fill="#d6d3d1" />
              {/* Eyes */}
              <circle cx="10" cy="10" r="3" fill="#1c1917" />
              <circle cx="18" cy="10" r="3" fill="#1c1917" />
              <motion.circle
                cx="10" cy="10" r="2"
                fill="#fef08a"
                animate={{ r: [2, 2.5, 2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <motion.circle
                cx="18" cy="10" r="2"
                fill="#fef08a"
                animate={{ r: [2, 2.5, 2] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              />
              <circle cx="10" cy="10" r="1" fill="#1c1917" />
              <circle cx="18" cy="10" r="1" fill="#1c1917" />
              {/* Beak */}
              <path d="M14 12 L12 15 L14 14 L16 15 Z" fill="#f59e0b" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Magical particles floating throughout */}
      <MagicalParticles isDark={isDark} />

      {/* Butterflies (day) */}
      {!isDark && useMemo(() => Array.from({ length: 5 }, (_, i) => (
        <motion.div
          key={`butterfly-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + (i % 3) * 15}%`,
            zIndex: 30,
          }}
          animate={{
            x: [0, 40, -20, 30, 0],
            y: [0, -30, 20, -10, 0],
            rotate: [0, 10, -10, 5, 0],
          }}
          transition={{ duration: 12 + i * 2, repeat: Infinity, delay: i * 1.5 }}
        >
          <svg width="20" height="16" viewBox="0 0 20 16">
            <motion.g
              animate={{ scaleY: [1, 0.3, 1] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            >
              {/* Left wing */}
              <ellipse cx="6" cy="8" rx="5" ry="6" fill={['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24'][i % 5]} opacity="0.8" />
              {/* Right wing */}
              <ellipse cx="14" cy="8" rx="5" ry="6" fill={['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24'][i % 5]} opacity="0.8" />
            </motion.g>
            {/* Body */}
            <ellipse cx="10" cy="8" rx="1" ry="5" fill="#1c1917" />
          </svg>
        </motion.div>
      )), [])}

      {/* Mystical fog near ground (night) */}
      {isDark && (
        <>
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[25%] pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(16, 185, 129, 0.15) 0%, transparent 100%)',
            }}
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-[5%] left-[10%] w-[30%] h-[15%] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, rgba(167, 139, 250, 0.2) 0%, transparent 70%)',
            }}
            animate={{ x: [0, 20, 0], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 12, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-[8%] right-[15%] w-[25%] h-[12%] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.15) 0%, transparent 70%)',
            }}
            animate={{ x: [0, -15, 0], opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 10, repeat: Infinity, delay: 3 }}
          />
        </>
      )}
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
    const MIN_SPAWN_DISTANCE = 12;

    // ONLY spawn in bottom 15% of screen - no exceptions
    const SPAWN_MIN_Y = 85;

    // Create spawn points ONLY in bottom 15% of screen
    const spawnPoints: Array<{ x: number; y: number }> = [];
    const spacing = 8;

    for (let x = walkableArea.minX + 5; x <= walkableArea.maxX - 5; x += spacing) {
      for (let y = SPAWN_MIN_Y; y <= walkableArea.maxY - 3; y += spacing) {
        spawnPoints.push({ x, y });
      }
    }

    // Sort to spread characters across the bottom
    spawnPoints.sort((a, b) => {
      // Spread from center outward
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

      // Fallback: use bottom corner if no non-overlapping found
      if (!bestPoint) {
        bestPoint = { x: walkableArea.minX + 10 + (index * 15) % 80, y: SPAWN_MIN_Y + 5 };
      }

      positions.set(character.id, { x: bestPoint.x, y: bestPoint.y });
      placedPositions.push({ x: bestPoint.x, y: bestPoint.y });
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
