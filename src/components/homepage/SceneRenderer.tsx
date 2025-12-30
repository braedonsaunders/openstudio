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

        {/* Palm trees - multiple layers from back to front */}
        {useMemo(() => {
          const palmTrees = [
            // Back row (smaller, distant)
            { x: 5, bottom: 55, scale: 0.4, zIndex: 1, flip: false },
            { x: 15, bottom: 52, scale: 0.35, zIndex: 1, flip: true },
            { x: 85, bottom: 54, scale: 0.38, zIndex: 1, flip: false },
            { x: 95, bottom: 50, scale: 0.42, zIndex: 1, flip: true },
            // Middle row
            { x: 8, bottom: 40, scale: 0.55, zIndex: 2, flip: false },
            { x: 20, bottom: 38, scale: 0.5, zIndex: 2, flip: true },
            { x: 80, bottom: 42, scale: 0.52, zIndex: 2, flip: false },
            { x: 92, bottom: 36, scale: 0.58, zIndex: 2, flip: true },
            // Front row (largest, foreground)
            { x: -3, bottom: 15, scale: 0.9, zIndex: 10, flip: false },
            { x: 12, bottom: 20, scale: 0.75, zIndex: 9, flip: true },
            { x: 88, bottom: 18, scale: 0.8, zIndex: 9, flip: false },
            { x: 103, bottom: 12, scale: 0.95, zIndex: 10, flip: true },
          ];

          const trunkColor = isDark ? '#4a3728' : '#8B4513';
          const trunkHighlight = isDark ? '#5d4037' : '#a0522d';
          const frondDark = isDark ? '#1b4332' : '#228B22';
          const frondMid = isDark ? '#2d6a4f' : '#2E8B57';
          const frondLight = isDark ? '#40916c' : '#3CB371';

          return palmTrees.map((palm, i) => (
            <div
              key={`palm-${i}`}
              className="absolute"
              style={{
                left: `${palm.x}%`,
                bottom: `${palm.bottom}%`,
                transform: `scaleX(${palm.flip ? -1 : 1})`,
                zIndex: palm.zIndex,
              }}
            >
              <svg
                width={120 * palm.scale}
                height={200 * palm.scale}
                viewBox="0 0 120 200"
                style={{ overflow: 'visible' }}
              >
                {/* Trunk with curve and texture */}
                <path
                  d="M55 200 Q52 160 54 120 Q58 80 55 50 Q52 30 58 15"
                  stroke={trunkColor}
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M58 200 Q56 160 57 120 Q60 80 58 50 Q56 32 60 18"
                  stroke={trunkHighlight}
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Trunk rings */}
                {[180, 150, 120, 90, 65, 45].map((y, ri) => (
                  <ellipse
                    key={ri}
                    cx="56"
                    cy={y}
                    rx="7"
                    ry="2"
                    fill="none"
                    stroke={isDark ? '#3d2817' : '#6b4423'}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                ))}
                {/* Coconuts */}
                <circle cx="52" cy="22" r="5" fill={isDark ? '#5d4037' : '#8B4513'} />
                <circle cx="62" cy="20" r="4" fill={isDark ? '#4a3728' : '#a0522d'} />
                <circle cx="56" cy="26" r="4.5" fill={isDark ? '#5d4037' : '#8B4513'} />
                {/* Palm fronds - layered */}
                {/* Back fronds */}
                <path d="M58 15 Q30 -20 -20 10" stroke={frondDark} strokeWidth="3" fill="none" />
                <path d="M58 15 Q80 -25 130 5" stroke={frondDark} strokeWidth="3" fill="none" />
                <path d="M58 15 Q20 -10 -10 30" stroke={frondDark} strokeWidth="2.5" fill="none" />
                <path d="M58 15 Q90 -15 120 25" stroke={frondDark} strokeWidth="2.5" fill="none" />
                {/* Middle fronds */}
                <path d="M58 15 Q25 5 -15 40" stroke={frondMid} strokeWidth="3" fill="none" />
                <path d="M58 15 Q85 0 125 35" stroke={frondMid} strokeWidth="3" fill="none" />
                <path d="M58 15 Q40 -30 10 -15" stroke={frondMid} strokeWidth="2.5" fill="none" />
                <path d="M58 15 Q75 -35 105 -20" stroke={frondMid} strokeWidth="2.5" fill="none" />
                {/* Front fronds */}
                <path d="M58 15 Q35 20 0 55" stroke={frondLight} strokeWidth="3.5" fill="none" />
                <path d="M58 15 Q80 15 115 50" stroke={frondLight} strokeWidth="3.5" fill="none" />
                <path d="M58 15 Q55 -20 58 -40" stroke={frondLight} strokeWidth="3" fill="none" />
                <path d="M58 15 Q30 10 5 45" stroke={frondLight} strokeWidth="2" fill="none" />
                <path d="M58 15 Q85 5 110 40" stroke={frondLight} strokeWidth="2" fill="none" />
                {/* Frond leaf details */}
                {[-20, -10, 0, 10, 20, 30, 40].map((offset, li) => (
                  <g key={`leaf-${li}`}>
                    <path
                      d={`M${30 + offset * 0.5} ${25 + Math.abs(offset) * 0.3} Q${25 + offset * 0.4} ${30 + Math.abs(offset) * 0.2} ${20 + offset * 0.3} ${35}`}
                      stroke={frondLight}
                      strokeWidth="1"
                      fill="none"
                      opacity="0.6"
                    />
                  </g>
                ))}
              </svg>
            </div>
          ));
        }, [isDark])}

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
    // Far back row - distant silhouette trees (smallest, at horizon)
    farBackRow: [
      { x: -5, scale: 0.18, variant: 'pine' as const },
      { x: 0, scale: 0.22, variant: 'oak' as const },
      { x: 5, scale: 0.2, variant: 'pine' as const },
      { x: 10, scale: 0.24, variant: 'birch' as const },
      { x: 15, scale: 0.19, variant: 'pine' as const },
      { x: 20, scale: 0.23, variant: 'oak' as const },
      { x: 25, scale: 0.21, variant: 'pine' as const },
      { x: 30, scale: 0.25, variant: 'birch' as const },
      { x: 35, scale: 0.2, variant: 'pine' as const },
      // Center gap for clearing view
      { x: 65, scale: 0.21, variant: 'pine' as const },
      { x: 70, scale: 0.24, variant: 'birch' as const },
      { x: 75, scale: 0.19, variant: 'pine' as const },
      { x: 80, scale: 0.23, variant: 'oak' as const },
      { x: 85, scale: 0.2, variant: 'pine' as const },
      { x: 90, scale: 0.25, variant: 'birch' as const },
      { x: 95, scale: 0.22, variant: 'pine' as const },
      { x: 100, scale: 0.24, variant: 'oak' as const },
      { x: 105, scale: 0.19, variant: 'pine' as const },
    ],
    // Back row - larger background trees
    backRow: [
      { x: -8, scale: 0.38, variant: 'oak' as const },
      { x: -2, scale: 0.42, variant: 'pine' as const },
      { x: 5, scale: 0.35, variant: 'birch' as const },
      { x: 12, scale: 0.4, variant: 'pine' as const },
      { x: 18, scale: 0.36, variant: 'oak' as const },
      { x: 25, scale: 0.44, variant: 'pine' as const },
      { x: 32, scale: 0.38, variant: 'willow' as const },
      // Gap for clearing center
      { x: 68, scale: 0.36, variant: 'willow' as const },
      { x: 75, scale: 0.42, variant: 'pine' as const },
      { x: 82, scale: 0.38, variant: 'oak' as const },
      { x: 88, scale: 0.4, variant: 'pine' as const },
      { x: 95, scale: 0.35, variant: 'birch' as const },
      { x: 102, scale: 0.44, variant: 'pine' as const },
      { x: 108, scale: 0.4, variant: 'oak' as const },
    ],
    // Middle row - medium trees
    middleRow: [
      { x: -8, scale: 0.55, variant: 'oak' as const, flip: false },
      { x: 0, scale: 0.6, variant: 'pine' as const, flip: false },
      { x: 8, scale: 0.52, variant: 'willow' as const, flip: false },
      { x: 16, scale: 0.58, variant: 'pine' as const, flip: false },
      { x: 24, scale: 0.54, variant: 'birch' as const, flip: false },
      // Gap for clearing
      { x: 76, scale: 0.56, variant: 'birch' as const, flip: true },
      { x: 84, scale: 0.6, variant: 'pine' as const, flip: true },
      { x: 92, scale: 0.54, variant: 'willow' as const, flip: true },
      { x: 100, scale: 0.58, variant: 'pine' as const, flip: true },
      { x: 108, scale: 0.52, variant: 'oak' as const, flip: true },
    ],
    // Front row - largest trees, framing the scene
    frontRow: [
      { x: -10, scale: 0.95, variant: 'oak' as const, flip: false },
      { x: 2, scale: 0.85, variant: 'pine' as const, flip: false },
      { x: 12, scale: 0.78, variant: 'willow' as const, flip: false },
      { x: 22, scale: 0.82, variant: 'pine' as const, flip: false },
      // Gap for clearing
      { x: 78, scale: 0.8, variant: 'pine' as const, flip: true },
      { x: 88, scale: 0.76, variant: 'willow' as const, flip: true },
      { x: 98, scale: 0.88, variant: 'pine' as const, flip: true },
      { x: 110, scale: 0.98, variant: 'oak' as const, flip: true },
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
        {/* Sky gradient - blue for day, sunset/purple for night */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, #0f0a1e 0%, #1a1035 15%, #2d1b4e 30%, #4a2c6a 50%, #6b3d5c 70%, #1a3a2a 100%)'
              : 'linear-gradient(to bottom, #60a5fa 0%, #38bdf8 20%, #7dd3fc 40%, #bae6fd 60%, #e0f2fe 80%, #bbf7d0 100%)',
          }}
        />

        {/* Sun glow (day) */}
        {!isDark && (
          <div
            className="absolute top-[5%] left-1/2 -translate-x-1/2 w-32 h-32 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(253, 224, 71, 0.6) 0%, rgba(251, 191, 36, 0.3) 30%, transparent 70%)',
              boxShadow: '0 0 80px 40px rgba(253, 224, 71, 0.3)',
            }}
          />
        )}

        {/* Sunset glow at horizon (night) */}
        {isDark && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[40%]"
            style={{
              background: 'linear-gradient(to top, rgba(107, 61, 92, 0.5) 0%, rgba(74, 44, 106, 0.3) 50%, transparent 100%)',
            }}
          />
        )}

        {/* Stars visible through canopy gaps (night) */}
        {isDark && <StarField count={40} maxTop={70} />}

        {/* Moon (night) */}
        {isDark && (
          <motion.div
            className="absolute top-[8%] right-[20%] w-10 h-10 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #fef9c3 0%, #fde68a 50%, #fcd34d 100%)',
              boxShadow: '0 0 40px 15px rgba(254, 249, 195, 0.4), 0 0 80px 30px rgba(254, 240, 138, 0.2)',
            }}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        )}

        {/* Light canopy overlay - semi-transparent to show sky */}
        <div
          className={`absolute inset-0 ${isDark ? 'opacity-60' : 'opacity-40'}`}
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 150%, #022c22 0%, #064e3b 30%, transparent 70%)'
              : 'radial-gradient(ellipse at 50% 150%, #15803d 0%, #22c55e 30%, transparent 70%)',
          }}
        />

        {/* Canopy leaf texture - sparse to show more sky */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {useMemo(() => Array.from({ length: 18 }, (_, i) => {
            const x = (i % 6) * 20 + Math.random() * 10;
            const y = Math.floor(i / 6) * 35 + Math.random() * 10;
            return (
              <ellipse
                key={i}
                cx={`${x}%`}
                cy={`${y}%`}
                rx="10%"
                ry="12%"
                fill={isDark ? '#052e16' : '#166534'}
                opacity={0.25 + Math.random() * 0.25}
              />
            );
          }), [isDark])}
        </svg>

        {/* Sun rays through canopy (day) */}
        {!isDark && <SunRays />}

        {/* Far back row trees (distant silhouettes at horizon) */}
        <div className="absolute bottom-0 left-0 right-0 h-[60%]">
          {trees.farBackRow.map((tree, i) => (
            <ForestTree key={`farback-${i}`} x={tree.x} scale={tree.scale} variant={tree.variant} isDark={isDark} />
          ))}
        </div>

        {/* Back row trees (larger, in front of far back) */}
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
// STUDIO SCENE - Professional Recording Studio
// ============================================

// Mixing console component
const MixingConsole = memo(function MixingConsole({ isDark, scale }: { isDark: boolean; scale: number }) {
  const consoleColor = isDark ? '#27272a' : '#3f3f46';
  const faderColor = isDark ? '#52525b' : '#71717a';
  const ledGreen = '#22c55e';
  const ledYellow = '#eab308';
  const ledRed = '#ef4444';

  return (
    <div style={{ transform: `scale(${scale})` }}>
      <svg width="200" height="80" viewBox="0 0 200 80">
        {/* Console body */}
        <rect x="0" y="20" width="200" height="60" rx="4" fill={consoleColor} />
        <rect x="5" y="25" width="190" height="50" rx="2" fill={isDark ? '#1c1c1e' : '#52525b'} />

        {/* Channel strips */}
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={i} transform={`translate(${12 + i * 15}, 30)`}>
            {/* Fader track */}
            <rect x="0" y="0" width="8" height="40" rx="1" fill={isDark ? '#0a0a0a' : '#27272a'} />
            {/* Fader knob */}
            <motion.rect
              x="-1"
              width="10"
              height="8"
              rx="1"
              fill={faderColor}
              animate={{ y: [10 + Math.random() * 15, 5 + Math.random() * 20, 10 + Math.random() * 15] }}
              transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.1 }}
            />
            {/* LED meter */}
            {[0, 1, 2, 3, 4].map((led) => (
              <motion.rect
                key={led}
                x="10"
                y={32 - led * 7}
                width="3"
                height="5"
                rx="0.5"
                fill={led < 3 ? ledGreen : led < 4 ? ledYellow : ledRed}
                animate={{ opacity: [0.2, led < 3 ? 1 : led < 4 ? 0.8 : 0.6, 0.2] }}
                transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.05 + led * 0.05 }}
              />
            ))}
          </g>
        ))}

        {/* Master section */}
        <rect x="185" y="28" width="10" height="44" rx="2" fill={isDark ? '#dc2626' : '#ef4444'} opacity="0.8" />
      </svg>
    </div>
  );
});

// Studio speaker/monitor component
const StudioMonitor = memo(function StudioMonitor({
  x,
  y,
  scale,
  side,
  isDark,
}: {
  x: number;
  y: number;
  scale: number;
  side: 'left' | 'right';
  isDark: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${scale}) ${side === 'right' ? 'scaleX(-1)' : ''}`,
        zIndex: Math.floor(y / 10),
      }}
    >
      <svg width="50" height="80" viewBox="0 0 50 80">
        {/* Speaker cabinet */}
        <rect x="2" y="0" width="46" height="80" rx="3" fill={isDark ? '#18181b' : '#27272a'} />
        <rect x="5" y="3" width="40" height="74" rx="2" fill={isDark ? '#0a0a0a' : '#1c1c1e'} />

        {/* Tweeter */}
        <circle cx="25" cy="18" r="8" fill={isDark ? '#27272a' : '#3f3f46'} />
        <circle cx="25" cy="18" r="5" fill={isDark ? '#52525b' : '#71717a'} />
        <motion.circle
          cx="25"
          cy="18"
          r="3"
          fill={isDark ? '#a1a1aa' : '#d4d4d8'}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.1, repeat: Infinity }}
        />

        {/* Woofer */}
        <circle cx="25" cy="52" r="18" fill={isDark ? '#27272a' : '#3f3f46'} />
        <circle cx="25" cy="52" r="14" fill={isDark ? '#3f3f46' : '#52525b'} />
        <motion.circle
          cx="25"
          cy="52"
          r="10"
          fill={isDark ? '#52525b' : '#71717a'}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.15, repeat: Infinity }}
        />
        <circle cx="25" cy="52" r="4" fill={isDark ? '#71717a' : '#a1a1aa'} />

        {/* Power LED */}
        <motion.circle
          cx="25"
          cy="75"
          r="2"
          fill="#22c55e"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>
    </div>
  );
});

// Stage light / spotlight component
const StageLight = memo(function StageLight({
  x,
  color,
  intensity,
  isDark,
}: {
  x: number;
  color: string;
  intensity: number;
  isDark: boolean;
}) {
  return (
    <div
      className="absolute top-0"
      style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
    >
      {/* Light fixture */}
      <div
        className="w-8 h-6 rounded-b-lg"
        style={{
          background: isDark ? '#27272a' : '#3f3f46',
          boxShadow: `0 4px 20px ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`,
        }}
      />
      {/* Light beam */}
      <motion.div
        className="absolute top-6 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: '40px solid transparent',
          borderRight: '40px solid transparent',
          borderTop: `120px solid ${color}`,
          opacity: isDark ? intensity * 0.4 : intensity * 0.2,
          filter: 'blur(10px)',
        }}
        animate={{
          opacity: isDark ? [intensity * 0.3, intensity * 0.5, intensity * 0.3] : [intensity * 0.15, intensity * 0.25, intensity * 0.15],
        }}
        transition={{ duration: 3 + Math.random() * 2, repeat: Infinity }}
      />
    </div>
  );
});

// Instrument stand (guitar/keyboard)
const InstrumentStand = memo(function InstrumentStand({
  x,
  y,
  type,
  scale,
  isDark,
}: {
  x: number;
  y: number;
  type: 'guitar' | 'keyboard' | 'drums';
  scale: number;
  isDark: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${scale})`,
        zIndex: Math.floor(y / 10),
        opacity: 0.6 + scale * 0.3,
      }}
    >
      {type === 'guitar' && (
        <svg width="30" height="70" viewBox="0 0 30 70">
          {/* Stand */}
          <path d="M15 70 L15 45" stroke={isDark ? '#52525b' : '#71717a'} strokeWidth="2" />
          <path d="M5 70 L15 60 L25 70" stroke={isDark ? '#52525b' : '#71717a'} strokeWidth="2" fill="none" />
          {/* Guitar body */}
          <ellipse cx="15" cy="35" rx="12" ry="8" fill={isDark ? '#92400e' : '#b45309'} />
          <ellipse cx="15" cy="28" rx="10" ry="6" fill={isDark ? '#78350f' : '#92400e'} />
          <circle cx="15" cy="32" r="3" fill={isDark ? '#1c1917' : '#292524'} />
          {/* Neck */}
          <rect x="13" y="5" width="4" height="25" fill={isDark ? '#78350f' : '#92400e'} />
          <rect x="12" y="0" width="6" height="6" rx="1" fill={isDark ? '#52525b' : '#71717a'} />
        </svg>
      )}
      {type === 'keyboard' && (
        <svg width="80" height="40" viewBox="0 0 80 40">
          {/* Stand legs */}
          <path d="M10 40 L15 25" stroke={isDark ? '#52525b' : '#71717a'} strokeWidth="2" />
          <path d="M70 40 L65 25" stroke={isDark ? '#52525b' : '#71717a'} strokeWidth="2" />
          {/* Keyboard body */}
          <rect x="5" y="10" width="70" height="18" rx="2" fill={isDark ? '#18181b' : '#27272a'} />
          {/* White keys */}
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={8 + i * 5} y="14" width="4" height="12" rx="0.5" fill="#fafafa" />
          ))}
          {/* Black keys */}
          {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => (
            <rect key={i} x={11 + i * 5} y="14" width="3" height="7" rx="0.5" fill="#18181b" />
          ))}
        </svg>
      )}
      {type === 'drums' && (
        <svg width="60" height="50" viewBox="0 0 60 50">
          {/* Hi-hat */}
          <ellipse cx="10" cy="15" rx="8" ry="3" fill={isDark ? '#a1a1aa' : '#d4d4d8'} />
          <path d="M10 18 L10 45" stroke={isDark ? '#52525b' : '#71717a'} strokeWidth="1.5" />
          {/* Snare */}
          <ellipse cx="30" cy="35" rx="12" ry="5" fill={isDark ? '#52525b' : '#71717a'} />
          <rect x="18" y="35" width="24" height="10" fill={isDark ? '#dc2626' : '#ef4444'} />
          <ellipse cx="30" cy="45" rx="12" ry="4" fill={isDark ? '#52525b' : '#71717a'} />
          {/* Cymbal */}
          <ellipse cx="50" cy="12" rx="10" ry="4" fill={isDark ? '#fbbf24' : '#fcd34d'} />
          <path d="M50 16 L50 45" stroke={isDark ? '#52525b' : '#71717a'} strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
});

// Vinyl record / turntable
const Turntable = memo(function Turntable({ x, y, scale, isDark }: { x: number; y: number; scale: number; isDark: boolean }) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${scale})`,
        zIndex: Math.floor(y / 10),
      }}
    >
      <svg width="50" height="50" viewBox="0 0 50 50">
        {/* Turntable base */}
        <rect x="0" y="5" width="50" height="40" rx="3" fill={isDark ? '#18181b' : '#27272a'} />
        {/* Platter */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '25px 25px' }}
        >
          <circle cx="25" cy="25" r="18" fill={isDark ? '#0a0a0a' : '#1c1c1e'} />
          {/* Vinyl grooves */}
          {[14, 11, 8, 5].map((r, i) => (
            <circle key={i} cx="25" cy="25" r={r} fill="none" stroke={isDark ? '#27272a' : '#3f3f46'} strokeWidth="0.5" />
          ))}
          {/* Label */}
          <circle cx="25" cy="25" r="5" fill={isDark ? '#dc2626' : '#ef4444'} />
        </motion.g>
        {/* Tonearm */}
        <path d="M42 10 L42 20 L30 28" stroke={isDark ? '#a1a1aa' : '#d4d4d8'} strokeWidth="1.5" fill="none" />
        <circle cx="42" cy="10" r="3" fill={isDark ? '#52525b' : '#71717a'} />
      </svg>
    </motion.div>
  );
});

function StudioScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.studio.ground;

  // Stage light configurations
  const stageLights = useMemo(() => [
    { x: 15, color: '#8b5cf6', intensity: 0.7 },
    { x: 30, color: '#ec4899', intensity: 0.6 },
    { x: 50, color: '#22d3ee', intensity: 0.8 },
    { x: 70, color: '#ec4899', intensity: 0.6 },
    { x: 85, color: '#8b5cf6', intensity: 0.7 },
  ], []);

  // Instruments and equipment
  const instruments = useMemo(() => [
    { x: 12, y: 35, type: 'guitar' as const, scale: 0.5 },
    { x: 88, y: 38, type: 'guitar' as const, scale: 0.55 },
    { x: 15, y: 60, type: 'keyboard' as const, scale: 0.6 },
    { x: 85, y: 65, type: 'drums' as const, scale: 0.65 },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Back wall */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        {/* Wall gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, #0a0a0a 0%, #18181b 30%, #27272a 70%, #3f3f46 100%)'
              : 'linear-gradient(to bottom, #27272a 0%, #3f3f46 30%, #52525b 70%, #71717a 100%)',
          }}
        />

        {/* Acoustic panels - detailed foam pattern */}
        <div className="absolute inset-0 opacity-30">
          {useMemo(() => Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex justify-around" style={{ marginTop: row === 0 ? '5%' : '2%' }}>
              {Array.from({ length: 6 }).map((_, col) => (
                <div
                  key={col}
                  className="rounded"
                  style={{
                    width: '12%',
                    height: 20,
                    background: isDark
                      ? `linear-gradient(135deg, #27272a 25%, #1c1c1e 50%, #27272a 75%)`
                      : `linear-gradient(135deg, #52525b 25%, #3f3f46 50%, #52525b 75%)`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                  }}
                />
              ))}
            </div>
          )), [isDark])}
        </div>

        {/* Neon accent strips */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #22d3ee, #ec4899, #8b5cf6)',
          }}
          animate={{
            boxShadow: [
              '0 0 20px #8b5cf6, 0 0 40px #8b5cf680',
              '0 0 30px #ec4899, 0 0 60px #ec489980',
              '0 0 20px #22d3ee, 0 0 40px #22d3ee80',
              '0 0 30px #ec4899, 0 0 60px #ec489980',
              '0 0 20px #8b5cf6, 0 0 40px #8b5cf680',
            ],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        {/* Large studio monitors on back wall */}
        <StudioMonitor x={12} y={25} scale={0.8} side="left" isDark={isDark} />
        <StudioMonitor x={88} y={25} scale={0.8} side="right" isDark={isDark} />

        {/* LED VU meter display */}
        <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2">
          <div
            className="flex gap-4 p-3 rounded-lg"
            style={{
              background: isDark ? '#0a0a0a' : '#18181b',
              border: `1px solid ${isDark ? '#27272a' : '#3f3f46'}`,
            }}
          >
            {[0, 1].map((ch) => (
              <div key={ch} className="flex gap-1">
                {Array.from({ length: 16 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-8 rounded-sm"
                    style={{
                      background: i < 10 ? '#22c55e' : i < 14 ? '#eab308' : '#ef4444',
                    }}
                    animate={{
                      opacity: [0.2, i < 8 + Math.random() * 6 ? 1 : 0.2, 0.2],
                      scaleY: [0.3, i < 10 ? 1 : 0.6, 0.3],
                    }}
                    transition={{
                      duration: 0.2 + Math.random() * 0.3,
                      repeat: Infinity,
                      delay: ch * 0.1 + i * 0.02,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Stage lights */}
        {stageLights.map((light, i) => (
          <StageLight key={i} {...light} isDark={isDark} />
        ))}
      </div>

      {/* Stage floor */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Polished wood floor */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, #1c1917 0%, #0c0a09 50%, #0a0908 100%)'
              : 'linear-gradient(to bottom, #44403c 0%, #292524 50%, #1c1917 100%)',
          }}
        />

        {/* Floor reflection/shine */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, transparent 30%)',
          }}
        />

        {/* Perspective floor lines */}
        <svg className="absolute inset-0 w-full h-full opacity-15" preserveAspectRatio="none">
          {/* Horizontal planks */}
          {[0.1, 0.22, 0.38, 0.58, 0.82].map((y, i) => (
            <line
              key={`h-${i}`}
              x1="0%"
              x2="100%"
              y1={`${y * 100}%`}
              y2={`${y * 100}%`}
              stroke={isDark ? '#44403c' : '#57534e'}
              strokeWidth="1"
            />
          ))}
          {/* Vertical perspective lines */}
          {[-60, -35, -15, 0, 15, 35, 60].map((offset, i) => (
            <line
              key={`v-${i}`}
              x1="50%"
              y1="0%"
              x2={`${50 + offset}%`}
              y2="100%"
              stroke={isDark ? '#44403c' : '#57534e'}
              strokeWidth="0.5"
            />
          ))}
        </svg>

        {/* Stage edge LED strip */}
        <motion.div
          className="absolute top-0 left-[5%] right-[5%] h-1 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #22d3ee, #ec4899, #8b5cf6)',
          }}
          animate={{
            boxShadow: [
              '0 0 10px #8b5cf6, 0 0 20px #8b5cf680',
              '0 0 15px #22d3ee, 0 0 30px #22d3ee80',
              '0 0 10px #8b5cf6, 0 0 20px #8b5cf680',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Mixing console */}
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2">
          <MixingConsole isDark={isDark} scale={0.8} />
        </div>

        {/* Instruments */}
        {instruments.map((inst, i) => (
          <InstrumentStand key={i} {...inst} isDark={isDark} />
        ))}

        {/* Turntables */}
        <Turntable x={25} y={50} scale={0.6} isDark={isDark} />
        <Turntable x={75} y={52} scale={0.55} isDark={isDark} />

        {/* Cable runs */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M10 70 Q25 65 40 72 Q55 80 70 75 Q85 70 95 72" stroke={isDark ? '#27272a' : '#44403c'} strokeWidth="0.3" fill="none" />
          <path d="M5 80 Q20 75 35 82 Q50 88 65 83 Q80 78 90 80" stroke={isDark ? '#27272a' : '#44403c'} strokeWidth="0.3" fill="none" />
          <path d="M15 85 Q30 82 45 88 Q60 92 75 87" stroke={isDark ? '#dc2626' : '#ef4444'} strokeWidth="0.2" fill="none" opacity="0.5" />
        </svg>

        {/* Smoke/haze effect */}
        {isDark && (
          <>
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)',
              }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 30% 40%, rgba(236, 72, 153, 0.06) 0%, transparent 40%)',
              }}
              animate={{ opacity: [0.2, 0.5, 0.2], x: [0, 20, 0] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
          </>
        )}
      </div>

      {/* Recording indicator */}
      <div
        className={`absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm ${
          isDark ? 'bg-red-950/60 border-red-500/50' : 'bg-red-100/90 border-red-300'
        }`}
      >
        <motion.div
          className="w-2.5 h-2.5 rounded-full bg-red-500"
          animate={{
            opacity: [0.4, 1, 0.4],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className={`text-xs font-bold tracking-wider ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          REC
        </span>
      </div>

      {/* Floating music notes (subtle) */}
      {isDark && useMemo(() => Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`note-${i}`}
          className="absolute text-lg pointer-events-none"
          style={{
            left: `${20 + i * 12}%`,
            bottom: '30%',
            color: ['#8b5cf6', '#ec4899', '#22d3ee'][i % 3],
            opacity: 0.4,
          }}
          animate={{
            y: [0, -50, -100],
            x: [0, (i % 2 === 0 ? 20 : -20), 0],
            opacity: [0, 0.6, 0],
            rotate: [0, (i % 2 === 0 ? 15 : -15), 0],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            delay: i * 1.5,
          }}
        >
          {['♪', '♫', '♬'][i % 3]}
        </motion.div>
      )), [])}
    </div>
  );
}

// ============================================
// SPACE SCENE - Epic Cosmic Observatory
// ============================================

// Detailed planet component
const SpacePlanet = memo(function SpacePlanet({
  x,
  y,
  size,
  colors,
  hasRing,
  ringColor,
  glowColor,
  isDark,
}: {
  x: number;
  y: number;
  size: number;
  colors: string[];
  hasRing?: boolean;
  ringColor?: string;
  glowColor: string;
  isDark: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      {/* Planet glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${glowColor}40 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />
      {/* Planet body */}
      <div
        className="rounded-full relative overflow-hidden"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${colors.join(', ')})`,
          boxShadow: `inset -${size/4}px -${size/4}px ${size/2}px rgba(0,0,0,0.4), 0 0 ${size/2}px ${glowColor}30`,
        }}
      >
        {/* Surface details */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)`,
          }}
        />
        {/* Atmospheric band */}
        <div
          className="absolute w-full opacity-20"
          style={{
            height: size * 0.15,
            top: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
          }}
        />
      </div>
      {/* Ring */}
      {hasRing && (
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: size * 1.8,
            height: size * 0.4,
            transform: 'translate(-50%, -50%) rotateX(75deg)',
            border: `2px solid ${ringColor}`,
            borderRadius: '50%',
            opacity: 0.6,
            boxShadow: `0 0 10px ${ringColor}40`,
          }}
        />
      )}
    </div>
  );
});

// Nebula cloud component
const NebulaCloud = memo(function NebulaCloud({
  x,
  y,
  width,
  height,
  color1,
  color2,
  delay,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color1: string;
  color2: string;
  delay: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
        background: `radial-gradient(ellipse at 50% 50%, ${color1}30 0%, ${color2}15 40%, transparent 70%)`,
        filter: 'blur(20px)',
      }}
      animate={{
        opacity: [0.3, 0.5, 0.3],
        scale: [1, 1.05, 1],
      }}
      transition={{ duration: 8, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
});

// Shooting star component
const ShootingStar = memo(function ShootingStar({ delay }: { delay: number }) {
  const startX = useMemo(() => Math.random() * 60 + 10, []);
  const startY = useMemo(() => Math.random() * 20 + 5, []);

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${startX}%`, top: `${startY}%` }}
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        x: [0, 80, 120],
        y: [0, 40, 60],
      }}
      transition={{
        duration: 1.2,
        delay,
        repeat: Infinity,
        repeatDelay: 15 + Math.random() * 10,
        ease: 'easeOut',
      }}
    >
      <div
        className="relative"
        style={{
          width: 3,
          height: 3,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 0 6px 2px white',
        }}
      >
        <div
          className="absolute top-1/2 right-full -translate-y-1/2"
          style={{
            width: 40,
            height: 2,
            background: 'linear-gradient(to left, white, transparent)',
          }}
        />
      </div>
    </motion.div>
  );
});

// Holographic display panel
const HoloPanel = memo(function HoloPanel({
  x,
  y,
  scale,
  type,
  isDark,
}: {
  x: number;
  y: number;
  scale: number;
  type: 'waveform' | 'grid' | 'circular';
  isDark: boolean;
}) {
  const baseColor = isDark ? '#22d3ee' : '#8b5cf6';

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${scale})`,
        zIndex: Math.floor(y / 10),
      }}
      animate={{ opacity: [0.6, 0.9, 0.6] }}
      transition={{ duration: 3, repeat: Infinity }}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          width: 80,
          height: 60,
          background: `linear-gradient(180deg, ${baseColor}15 0%, transparent 100%)`,
          border: `1px solid ${baseColor}40`,
          boxShadow: `0 0 20px ${baseColor}20, inset 0 0 20px ${baseColor}10`,
        }}
      >
        {type === 'waveform' && (
          <div className="flex items-end justify-around h-full p-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-t"
                style={{ backgroundColor: baseColor }}
                animate={{
                  height: ['30%', `${30 + Math.random() * 60}%`, '30%'],
                }}
                transition={{
                  duration: 0.5 + Math.random() * 0.5,
                  repeat: Infinity,
                  delay: i * 0.05,
                }}
              />
            ))}
          </div>
        )}
        {type === 'grid' && (
          <div className="h-full p-2 flex flex-col justify-around">
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={row} className="flex justify-around">
                {Array.from({ length: 6 }).map((_, col) => (
                  <motion.div
                    key={col}
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: baseColor }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: (row * 6 + col) * 0.1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {type === 'circular' && (
          <div className="h-full flex items-center justify-center">
            {[0, 1, 2].map((ring) => (
              <motion.div
                key={ring}
                className="absolute rounded-full border"
                style={{
                  width: 20 + ring * 15,
                  height: 20 + ring * 15,
                  borderColor: baseColor,
                  opacity: 0.5 - ring * 0.1,
                }}
                animate={{ rotate: [0, ring % 2 === 0 ? 360 : -360] }}
                transition={{ duration: 8 + ring * 2, repeat: Infinity, ease: 'linear' }}
              />
            ))}
            <motion.div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: baseColor }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        )}
      </div>
      {/* Hologram projection lines */}
      <div
        className="absolute -bottom-4 left-1/2 -translate-x-1/2"
        style={{
          width: 40,
          height: 20,
          background: `linear-gradient(to top, ${baseColor}30, transparent)`,
          clipPath: 'polygon(20% 100%, 80% 100%, 100% 0%, 0% 0%)',
        }}
      />
    </motion.div>
  );
});

function SpaceScene({ isDark }: { isDark: boolean }) {
  const config = SCENE_CONFIGS.space.ground;

  // Planet configurations
  const planets = useMemo(() => [
    // Large ringed planet (Saturn-like)
    { x: 78, y: 35, size: 50, colors: ['#f97316', '#ea580c', '#c2410c'], hasRing: true, ringColor: '#fbbf24', glowColor: '#f97316' },
    // Small blue planet
    { x: 15, y: 25, size: 20, colors: ['#3b82f6', '#1d4ed8', '#1e40af'], hasRing: false, glowColor: '#60a5fa' },
    // Purple moon
    { x: 88, y: 55, size: 15, colors: ['#a855f7', '#7c3aed', '#6d28d9'], hasRing: false, glowColor: '#c084fc' },
    // Distant red planet
    { x: 25, y: 50, size: 12, colors: ['#ef4444', '#dc2626', '#991b1b'], hasRing: false, glowColor: '#f87171' },
  ], []);

  // Nebula configurations
  const nebulae = useMemo(() => [
    { x: 5, y: 10, width: 45, height: 50, color1: '#8b5cf6', color2: '#6366f1', delay: 0 },
    { x: 55, y: 5, width: 40, height: 40, color1: '#ec4899', color2: '#f43f5e', delay: 2 },
    { x: 30, y: 40, width: 35, height: 35, color1: '#06b6d4', color2: '#0ea5e9', delay: 4 },
  ], []);

  // Holographic panels
  const holoPanels = useMemo(() => [
    { x: 8, y: 25, scale: 0.5, type: 'waveform' as const },
    { x: 92, y: 28, scale: 0.45, type: 'grid' as const },
    { x: 5, y: 55, scale: 0.7, type: 'circular' as const },
    { x: 95, y: 58, scale: 0.65, type: 'waveform' as const },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep space background */}
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        {/* Base space gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, #000000 0%, #0a0a1a 20%, #1a103d 50%, #2d1f5e 80%, #3d2a7a 100%)'
              : 'linear-gradient(to bottom, #312e81 0%, #4338ca 20%, #6366f1 50%, #818cf8 80%, #a5b4fc 100%)',
          }}
        />

        {/* Dense star field */}
        <StarField count={isDark ? 80 : 40} maxTop={95} />

        {/* Additional twinkling stars layer */}
        {useMemo(() => Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={`twinkle-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 90}%`,
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
              background: ['#ffffff', '#fef08a', '#bfdbfe', '#c4b5fd'][Math.floor(Math.random() * 4)],
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        )), [])}

        {/* Nebula clouds */}
        {nebulae.map((nebula, i) => (
          <NebulaCloud key={`nebula-${i}`} {...nebula} />
        ))}

        {/* Distant galaxy */}
        <motion.div
          className="absolute"
          style={{
            left: '60%',
            top: '15%',
            width: 60,
            height: 30,
            background: isDark
              ? 'radial-gradient(ellipse, rgba(167, 139, 250, 0.4) 0%, rgba(139, 92, 246, 0.2) 30%, transparent 70%)'
              : 'radial-gradient(ellipse, rgba(251, 191, 36, 0.5) 0%, rgba(245, 158, 11, 0.3) 30%, transparent 70%)',
            transform: 'rotate(-20deg)',
            filter: 'blur(3px)',
          }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 5, repeat: Infinity }}
        />

        {/* Planets */}
        {planets.map((planet, i) => (
          <SpacePlanet key={`planet-${i}`} {...planet} isDark={isDark} />
        ))}

        {/* Shooting stars */}
        <ShootingStar delay={3} />
        <ShootingStar delay={8} />
        <ShootingStar delay={15} />
        <ShootingStar delay={22} />

        {/* Asteroid belt (distant) */}
        {useMemo(() => Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`asteroid-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${35 + i * 3}%`,
              top: `${65 + Math.sin(i) * 8}%`,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 2,
              background: isDark ? '#64748b' : '#94a3b8',
              opacity: 0.4 + Math.random() * 0.3,
            }}
            animate={{ x: [0, -10, 0] }}
            transition={{ duration: 20 + i * 2, repeat: Infinity, ease: 'linear' }}
          />
        )), [isDark])}
      </div>

      {/* Futuristic platform */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        {/* Platform base */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, #1e1b4b 0%, #0f172a 30%, #020617 100%)'
              : 'linear-gradient(to bottom, #6366f1 0%, #4f46e5 30%, #3730a3 100%)',
          }}
        />

        {/* Hexagonal grid pattern */}
        <div
          className="absolute inset-0"
          style={{
            opacity: isDark ? 0.15 : 0.1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath fill='${isDark ? '%236366f1' : '%23a5b4fc'}' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Circuit line patterns */}
        <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
          {useMemo(() => Array.from({ length: 8 }).map((_, i) => (
            <motion.path
              key={`circuit-${i}`}
              d={`M${10 + i * 12}% 0% L${10 + i * 12}% ${30 + Math.random() * 20}% L${15 + i * 12}% ${35 + Math.random() * 20}% L${15 + i * 12}% 100%`}
              stroke={isDark ? '#6366f1' : '#a5b4fc'}
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 1, 0] }}
              transition={{ duration: 4, delay: i * 0.5, repeat: Infinity }}
            />
          )), [isDark])}
        </svg>

        {/* Central energy core */}
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2">
          {/* Core rings */}
          {[0, 1, 2, 3].map((ring) => (
            <motion.div
              key={`core-ring-${ring}`}
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                width: 100 + ring * 50,
                height: 12 + ring * 4,
                top: -ring * 3,
                border: `2px solid ${isDark ? '#8b5cf6' : '#a5b4fc'}`,
                opacity: 0.3 - ring * 0.05,
                boxShadow: `0 0 15px ${isDark ? '#8b5cf6' : '#a5b4fc'}40`,
              }}
              animate={{
                boxShadow: [
                  `0 0 15px ${isDark ? '#8b5cf6' : '#a5b4fc'}40`,
                  `0 0 30px ${isDark ? '#8b5cf6' : '#a5b4fc'}60`,
                  `0 0 15px ${isDark ? '#8b5cf6' : '#a5b4fc'}40`,
                ],
              }}
              transition={{ duration: 2 + ring * 0.5, repeat: Infinity, delay: ring * 0.2 }}
            />
          ))}
          {/* Core center */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full"
            style={{
              top: 2,
              background: isDark ? '#22d3ee' : '#fbbf24',
              boxShadow: `0 0 20px 10px ${isDark ? '#22d3ee' : '#fbbf24'}50`,
            }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>

        {/* Holographic panels */}
        {holoPanels.map((panel, i) => (
          <HoloPanel key={`holo-${i}`} {...panel} isDark={isDark} />
        ))}

        {/* Platform edge glow */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${isDark ? '#22d3ee' : '#fbbf24'} 20%, ${isDark ? '#8b5cf6' : '#a855f7'} 50%, ${isDark ? '#22d3ee' : '#fbbf24'} 80%, transparent)`,
          }}
          animate={{
            boxShadow: [
              `0 0 20px ${isDark ? '#22d3ee' : '#fbbf24'}60`,
              `0 0 40px ${isDark ? '#8b5cf6' : '#a855f7'}80`,
              `0 0 20px ${isDark ? '#22d3ee' : '#fbbf24'}60`,
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Floor light strips */}
        {useMemo(() => [20, 40, 60, 80].map((x, i) => (
          <motion.div
            key={`strip-${i}`}
            className="absolute"
            style={{
              left: `${x}%`,
              top: '30%',
              width: 2,
              height: '60%',
              background: `linear-gradient(to bottom, ${isDark ? '#8b5cf6' : '#a5b4fc'}40, transparent)`,
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
          />
        )), [isDark])}

        {/* Floating data particles */}
        {useMemo(() => Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={`data-${i}`}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${15 + Math.random() * 70}%`,
              bottom: `${10 + Math.random() * 40}%`,
              background: isDark ? '#22d3ee' : '#fbbf24',
              boxShadow: `0 0 4px ${isDark ? '#22d3ee' : '#fbbf24'}`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: Math.random() * 3,
              repeat: Infinity,
            }}
          />
        )), [isDark])}
      </div>

      {/* Ambient space particles */}
      <Particles color={isDark ? '#a5b4fc' : '#fcd34d'} count={15} />

      {/* Aurora effect at horizon */}
      {isDark && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: `${config.horizonY - 10}%`,
            height: '20%',
            background: 'linear-gradient(to top, transparent, rgba(34, 211, 238, 0.1), rgba(139, 92, 246, 0.1), transparent)',
            filter: 'blur(10px)',
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      )}
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
