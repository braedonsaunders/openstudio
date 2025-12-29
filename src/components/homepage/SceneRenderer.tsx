'use client';

import { useState, useEffect, useRef, useMemo, memo } from 'react';
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
// BEACH SCENE - Day & Night
// ============================================
function BeachScene({ isDark }: { isDark: boolean }) {
  return (
    <>
      {/* Sky gradient is handled by backdrop */}

      {/* Celestial body - Sun or Moon */}
      <motion.div
        className="absolute"
        style={{ right: '15%', top: '8%' }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {isDark ? (
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300"
              style={{ boxShadow: '0 0 60px 20px rgba(255,255,255,0.15)' }} />
            <div className="absolute top-3 left-4 w-3 h-3 rounded-full bg-gray-300/50" />
            <div className="absolute top-7 left-8 w-2 h-2 rounded-full bg-gray-300/40" />
          </div>
        ) : (
          <motion.div
            className="w-24 h-24 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #fff9c4, #ffeb3b, #ff9800)',
              boxShadow: '0 0 80px 30px rgba(255,183,77,0.4), 0 0 120px 60px rgba(255,152,0,0.2)',
            }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Stars (night only) */}
      {isDark && <StarField count={60} maxTop={35} />}

      {/* Clouds */}
      {!isDark && <CloudLayer isDark={isDark} />}

      {/* Ocean with multiple wave layers */}
      <div className="absolute bottom-[30%] left-0 right-0 h-[40%] overflow-hidden">
        {/* Deep water */}
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-blue-900/80 to-slate-900/90' : 'bg-gradient-to-b from-cyan-400/60 to-blue-500/70'}`} />

        {/* Wave layers */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-0 w-[200%] h-full"
            style={{ bottom: `${i * 8}%` }}
            animate={{ x: i % 2 === 0 ? [0, '-50%'] : ['-50%', 0] }}
            transition={{ duration: 8 + i * 3, repeat: Infinity, ease: 'linear' }}
          >
            <svg viewBox="0 0 1200 100" className="w-full h-8" preserveAspectRatio="none">
              <path
                d={`M0 ${50 + i * 5} Q150 ${20 + i * 10} 300 ${50 + i * 5} Q450 ${80 - i * 5} 600 ${50 + i * 5} Q750 ${20 + i * 10} 900 ${50 + i * 5} Q1050 ${80 - i * 5} 1200 ${50 + i * 5} L1200 100 L0 100 Z`}
                fill={isDark
                  ? `rgba(30, 58, 138, ${0.4 - i * 0.1})`
                  : `rgba(6, 182, 212, ${0.5 - i * 0.1})`
                }
              />
            </svg>
          </motion.div>
        ))}

        {/* Sun/Moon reflection on water */}
        <motion.div
          className="absolute left-[60%] top-0 w-20 h-full"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)'
              : 'linear-gradient(to bottom, rgba(255,215,0,0.3), transparent)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      {/* Palm trees */}
      {[
        { left: '3%', scale: 1, flip: false },
        { left: '8%', scale: 0.7, flip: false },
        { left: '88%', scale: 0.9, flip: true },
      ].map((palm, i) => (
        <motion.div
          key={i}
          className="absolute bottom-[28%]"
          style={{ left: palm.left, transform: `scaleX(${palm.flip ? -1 : 1})` }}
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
        >
          <svg width={100 * palm.scale} height={160 * palm.scale} viewBox="0 0 100 160">
            {/* Trunk */}
            <path d="M50 160 Q48 120 52 80 Q50 60 50 40" stroke={isDark ? '#4a3728' : '#8B4513'} strokeWidth="8" fill="none" />
            {/* Fronds */}
            {[-40, -20, 0, 20, 40].map((angle, j) => (
              <motion.ellipse
                key={j}
                cx="50" cy="35"
                rx="35" ry="8"
                fill={isDark ? '#1e4620' : '#228B22'}
                style={{ transformOrigin: '50px 35px', transform: `rotate(${angle}deg)` }}
                animate={{ rotate: [angle - 3, angle + 3, angle - 3] }}
                transition={{ duration: 3, repeat: Infinity, delay: j * 0.2 }}
              />
            ))}
            {/* Coconuts */}
            <circle cx="48" cy="50" r="4" fill={isDark ? '#3d2914' : '#8B4513'} />
            <circle cx="55" cy="48" r="3" fill={isDark ? '#3d2914' : '#8B4513'} />
          </svg>
        </motion.div>
      ))}

      {/* Beach details - shells, starfish */}
      <div className="absolute bottom-[5%] left-0 right-0 flex justify-around opacity-60 pointer-events-none">
        {['🐚', '⭐', '🐚', '🦀', '🐚'].map((emoji, i) => (
          <span key={i} className="text-lg" style={{ opacity: 0.5 + Math.random() * 0.5 }}>{emoji}</span>
        ))}
      </div>

      {/* Seagulls (day only) */}
      {!isDark && (
        <div className="absolute top-[15%] left-0 right-0 pointer-events-none">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ left: `${20 + i * 25}%`, top: `${i * 5}%` }}
              animate={{ x: [0, 100, 200], y: [0, -10, 5] }}
              transition={{ duration: 15 + i * 5, repeat: Infinity, delay: i * 3 }}
            >
              <svg width="24" height="12" viewBox="0 0 24 12">
                <motion.path
                  d="M0 6 Q6 0 12 6 Q18 0 24 6"
                  stroke="#374151"
                  strokeWidth="2"
                  fill="none"
                  animate={{ d: ['M0 6 Q6 0 12 6 Q18 0 24 6', 'M0 6 Q6 3 12 6 Q18 3 24 6'] }}
                  transition={{ duration: 0.3, repeat: Infinity, repeatType: 'reverse' }}
                />
              </svg>
            </motion.div>
          ))}
        </div>
      )}

      {/* Fireflies (night only) */}
      {isDark && <Particles color="#fef08a" count={15} />}
    </>
  );
}

// ============================================
// CAMPFIRE SCENE - Day & Night
// ============================================
function CampfireScene({ isDark }: { isDark: boolean }) {
  return (
    <>
      {/* Celestial body */}
      {isDark ? (
        <>
          <StarField count={80} maxTop={40} />
          <motion.div
            className="absolute top-[8%] left-[15%] w-14 h-14 rounded-full"
            style={{
              background: 'radial-gradient(circle at 40% 40%, #fefce8, #fef9c3, #d4d4d4)',
              boxShadow: '0 0 40px 15px rgba(255,255,255,0.1)',
            }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </>
      ) : (
        <>
          <CloudLayer isDark={false} />
          <motion.div
            className="absolute top-[10%] right-[20%] w-20 h-20 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #fffde7, #ffeb3b, #ffa000)',
              boxShadow: '0 0 60px 25px rgba(255,193,7,0.3)',
            }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </>
      )}

      {/* Mountains */}
      <svg className="absolute bottom-[30%] left-0 w-full h-[35%]" preserveAspectRatio="none" viewBox="0 0 1440 300">
        <defs>
          <linearGradient id="mountainGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#1e293b' : '#6b7280'} />
            <stop offset="100%" stopColor={isDark ? '#0f172a' : '#374151'} />
          </linearGradient>
          <linearGradient id="mountainGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isDark ? '#334155' : '#9ca3af'} />
            <stop offset="100%" stopColor={isDark ? '#1e293b' : '#6b7280'} />
          </linearGradient>
        </defs>
        {/* Far mountains */}
        <path d="M0 300 L0 200 L200 100 L400 180 L600 60 L800 150 L1000 80 L1200 160 L1440 120 L1440 300 Z" fill="url(#mountainGrad2)" opacity="0.6" />
        {/* Near mountains */}
        <path d="M0 300 L0 220 L150 140 L350 200 L500 100 L700 170 L850 90 L1050 160 L1250 110 L1440 180 L1440 300 Z" fill="url(#mountainGrad1)" />
        {/* Snow caps */}
        {!isDark && (
          <>
            <path d="M500 100 L520 115 L480 115 Z" fill="white" opacity="0.8" />
            <path d="M850 90 L870 108 L830 108 Z" fill="white" opacity="0.8" />
          </>
        )}
      </svg>

      {/* Pine trees */}
      {[10, 18, 82, 90].map((left, i) => (
        <motion.div
          key={i}
          className="absolute bottom-[28%]"
          style={{ left: `${left}%` }}
          animate={{ rotate: [-1, 1, -1] }}
          transition={{ duration: 5, repeat: Infinity, delay: i * 0.5 }}
        >
          <svg width={30 + (i % 2) * 10} height={60 + (i % 2) * 15} viewBox="0 0 40 80">
            <rect x="18" y="60" width="4" height="20" fill={isDark ? '#3d2914' : '#5D4037'} />
            <polygon points="20,0 5,30 35,30" fill={isDark ? '#1a3a1a' : '#2E7D32'} />
            <polygon points="20,15 3,45 37,45" fill={isDark ? '#1a3a1a' : '#388E3C'} />
            <polygon points="20,30 0,60 40,60" fill={isDark ? '#1a3a1a' : '#43A047'} />
          </svg>
        </motion.div>
      ))}

      {/* Campfire */}
      <div className="absolute left-1/2 bottom-[15%] -translate-x-1/2 z-10">
        <svg width="120" height="140" viewBox="0 0 120 140">
          {/* Fire glow */}
          <motion.ellipse
            cx="60" cy="110" rx="50" ry="20"
            fill={isDark ? 'rgba(255,100,0,0.4)' : 'rgba(255,150,50,0.3)'}
            animate={{ rx: [50, 55, 50], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />

          {/* Logs */}
          <rect x="20" y="105" width="80" height="15" rx="7" fill="#4a2c0a" transform="rotate(-8 60 110)" />
          <rect x="15" y="110" width="90" height="12" rx="6" fill="#3d2108" transform="rotate(8 60 115)" />
          <rect x="35" y="115" width="50" height="10" rx="5" fill="#2d1f05" />

          {/* Flames - outer */}
          <motion.path
            fill="url(#flameOuter)"
            animate={{
              d: [
                'M60 110 Q35 80 45 50 Q55 25 60 15 Q65 25 75 50 Q85 80 60 110',
                'M60 110 Q30 85 43 55 Q52 28 60 10 Q68 28 77 55 Q90 85 60 110',
                'M60 110 Q35 80 45 50 Q55 25 60 15 Q65 25 75 50 Q85 80 60 110',
              ],
            }}
            transition={{ duration: 0.4, repeat: Infinity }}
          />

          {/* Flames - middle */}
          <motion.path
            fill="url(#flameMiddle)"
            animate={{
              d: [
                'M60 110 Q40 85 48 60 Q55 40 60 30 Q65 40 72 60 Q80 85 60 110',
                'M60 110 Q38 88 46 62 Q53 42 60 25 Q67 42 74 62 Q82 88 60 110',
                'M60 110 Q40 85 48 60 Q55 40 60 30 Q65 40 72 60 Q80 85 60 110',
              ],
            }}
            transition={{ duration: 0.35, repeat: Infinity, delay: 0.1 }}
          />

          {/* Flames - inner */}
          <motion.path
            fill="url(#flameInner)"
            animate={{
              d: [
                'M60 110 Q48 90 52 70 Q57 55 60 45 Q63 55 68 70 Q72 90 60 110',
                'M60 110 Q46 92 50 72 Q55 57 60 40 Q65 57 70 72 Q74 92 60 110',
                'M60 110 Q48 90 52 70 Q57 55 60 45 Q63 55 68 70 Q72 90 60 110',
              ],
            }}
            transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
          />

          {/* Sparks */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.circle
              key={i}
              cx={55 + i * 3}
              cy="50"
              r="2"
              fill="#fcd34d"
              animate={{
                y: [0, -40, -60],
                x: [0, (i % 2 === 0 ? 15 : -15), (i % 2 === 0 ? 20 : -20)],
                opacity: [1, 0.6, 0],
                scale: [1, 0.6, 0.2],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}

          <defs>
            <linearGradient id="flameOuter" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="50%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <linearGradient id="flameMiddle" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="flameInner" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#fcd34d" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Fireflies (night) / Butterflies (day) */}
      {isDark ? (
        <Particles color="#fef08a" count={25} />
      ) : (
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              style={{ left: `${20 + i * 25}%`, top: `${40 + i * 5}%` }}
              animate={{ x: [0, 50, -30, 0], y: [0, -30, 20, 0], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 8 + i * 2, repeat: Infinity, delay: i }}
            >
              🦋
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================
// FOREST SCENE - Day & Night
// ============================================
function ForestScene({ isDark }: { isDark: boolean }) {
  return (
    <>
      {/* Sky elements */}
      {isDark ? (
        <>
          <StarField count={40} maxTop={35} />
          <motion.div
            className="absolute top-[5%] right-[25%] w-10 h-10 rounded-full"
            style={{
              background: 'radial-gradient(circle at 40% 40%, #fefce8, #e5e5e5)',
              boxShadow: '0 0 30px 10px rgba(255,255,255,0.08)',
            }}
          />
        </>
      ) : (
        <>
          <CloudLayer isDark={false} />
          {/* Sun rays through trees */}
          <div className="absolute top-0 right-[15%] w-48 h-64 overflow-hidden opacity-60">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-0 left-1/2 w-2 h-full origin-top"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,236,179,0.6), transparent 70%)',
                  transform: `rotate(${-35 + i * 10}deg)`,
                }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>
        </>
      )}

      {/* Layered trees - far */}
      <div className="absolute bottom-[30%] left-0 right-0 h-[25%]">
        <svg className="w-full h-full" viewBox="0 0 1440 200" preserveAspectRatio="none">
          {Array.from({ length: 25 }).map((_, i) => (
            <g key={i} transform={`translate(${i * 60 + 20}, ${30 + (i % 3) * 15})`}>
              <polygon points="25,0 0,70 50,70" fill={isDark ? '#132a13' : '#2d5a2d'} opacity={0.6 + (i % 3) * 0.1} />
              <rect x="22" y="70" width="6" height="20" fill={isDark ? '#2d1f0f' : '#5d4037'} opacity="0.5" />
            </g>
          ))}
        </svg>
      </div>

      {/* Layered trees - mid */}
      <div className="absolute bottom-[25%] left-0 right-0 h-[20%]">
        <svg className="w-full h-full" viewBox="0 0 1440 160" preserveAspectRatio="none">
          {Array.from({ length: 18 }).map((_, i) => (
            <g key={i} transform={`translate(${i * 85 + 10}, ${15 + (i % 2) * 20})`}>
              <polygon points="35,0 0,90 70,90" fill={isDark ? '#1a4a1a' : '#388e3c'} opacity={0.7 + (i % 2) * 0.15} />
              <polygon points="35,30 5,100 65,100" fill={isDark ? '#1a4a1a' : '#43a047'} opacity={0.6 + (i % 2) * 0.15} />
              <rect x="30" y="100" width="10" height="30" fill={isDark ? '#3d2914' : '#6d4c41'} opacity="0.7" />
            </g>
          ))}
        </svg>
      </div>

      {/* Foreground trees - close */}
      {[3, 92].map((left, i) => (
        <motion.div
          key={i}
          className="absolute bottom-[20%]"
          style={{ left: `${left}%`, transform: `scaleX(${i === 1 ? -1 : 1})` }}
          animate={{ rotate: [-0.5, 0.5, -0.5] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          <svg width="80" height="180" viewBox="0 0 80 180">
            <rect x="35" y="120" width="10" height="60" fill={isDark ? '#4a3520' : '#795548'} />
            <polygon points="40,0 0,60 80,60" fill={isDark ? '#1a4a1a' : '#2e7d32'} />
            <polygon points="40,25 5,90 75,90" fill={isDark ? '#1a4a1a' : '#388e3c'} />
            <polygon points="40,50 0,120 80,120" fill={isDark ? '#1a4a1a' : '#43a047'} />
          </svg>
        </motion.div>
      ))}

      {/* Forest floor details */}
      <div className="absolute bottom-[3%] left-0 right-0 flex justify-around pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -2, 0], rotate: [-3, 3, -3] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15 }}
          >
            {i % 4 === 0 ? '🍄' : i % 4 === 1 ? '🌿' : i % 4 === 2 ? '🌱' : '🍂'}
          </motion.div>
        ))}
      </div>

      {/* Animated creatures */}
      {isDark ? (
        <>
          <Particles color="#a5f3fc" count={20} />
          {/* Owl */}
          <motion.div
            className="absolute text-3xl"
            style={{ top: '35%', left: '15%' }}
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            🦉
          </motion.div>
        </>
      ) : (
        <>
          {/* Butterflies */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute text-xl"
              style={{ left: `${15 + i * 20}%`, top: `${35 + (i % 2) * 10}%` }}
              animate={{ x: [0, 40, -20, 0], y: [0, -25, 15, 0] }}
              transition={{ duration: 7 + i, repeat: Infinity, delay: i * 0.8 }}
            >
              🦋
            </motion.div>
          ))}
          {/* Deer */}
          <motion.div
            className="absolute text-4xl"
            style={{ bottom: '25%', right: '20%' }}
            animate={{ x: [-10, 10, -10] }}
            transition={{ duration: 8, repeat: Infinity }}
          >
            🦌
          </motion.div>
        </>
      )}
    </>
  );
}

// ============================================
// STUDIO SCENE - Day & Night (always dark vibe)
// ============================================
function StudioScene({ isDark }: { isDark: boolean }) {
  const ledColors = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => `hsl(${(i * 15 + (isDark ? 240 : 0)) % 360}, 80%, 55%)`),
  [isDark]);

  return (
    <>
      {/* Ambient lighting effects */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 80%, rgba(139,92,246,0.15), transparent 60%)'
            : 'radial-gradient(ellipse at 50% 80%, rgba(59,130,246,0.1), transparent 60%)',
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* LED Strip lighting - top */}
      <div className="absolute top-[8%] left-[5%] right-[5%] h-3 flex gap-0.5 rounded-full overflow-hidden">
        {ledColors.map((color, i) => (
          <motion.div
            key={i}
            className="flex-1"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
          />
        ))}
      </div>

      {/* Monitor speakers with glow */}
      {[12, 82].map((left, i) => (
        <div key={i} className="absolute top-[12%]" style={{ left: `${left}%` }}>
          <div className="w-12 h-20 bg-gradient-to-b from-gray-700 to-gray-900 rounded-lg border border-gray-600">
            <motion.div
              className="w-8 h-8 mx-auto mt-2 rounded-full bg-gray-800 border-2 border-gray-600"
              animate={{ boxShadow: isDark
                ? ['0 0 10px rgba(139,92,246,0.3)', '0 0 20px rgba(139,92,246,0.5)', '0 0 10px rgba(139,92,246,0.3)']
                : ['0 0 10px rgba(59,130,246,0.2)', '0 0 15px rgba(59,130,246,0.4)', '0 0 10px rgba(59,130,246,0.2)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="w-4 h-4 mx-auto mt-1 rounded-full bg-gray-800 border border-gray-600" />
          </div>
        </div>
      ))}

      {/* VU Meters */}
      <div className="absolute top-[14%] left-1/2 -translate-x-1/2 flex gap-1">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-2 rounded-sm"
            style={{
              background: 'linear-gradient(to top, #22c55e 0%, #22c55e 60%, #eab308 60%, #eab308 85%, #ef4444 85%, #ef4444 100%)',
            }}
            animate={{ height: [15 + Math.random() * 25, 25 + Math.random() * 35, 15 + Math.random() * 25] }}
            transition={{ duration: 0.15 + Math.random() * 0.2, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Mixing console */}
      <div className="absolute top-[22%] left-[15%] right-[15%] h-16 perspective-1000">
        <div
          className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900 rounded-t-lg border-t border-l border-r border-gray-600"
          style={{ transform: 'rotateX(30deg)', transformOrigin: 'bottom' }}
        >
          <div className="flex justify-around pt-2 px-4">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <motion.div
                  className="w-1.5 h-6 rounded-full bg-gradient-to-t from-gray-600 to-gray-400"
                  animate={{ height: [16, 24, 16] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                />
                <div className={`w-2 h-2 rounded-full ${i % 3 === 0 ? 'bg-green-500' : i % 3 === 1 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reflective floor grid */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] overflow-hidden">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${isDark ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.08)'} 1px, transparent 1px),
              linear-gradient(to bottom, ${isDark ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.08)'} 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: 'perspective(400px) rotateX(65deg)',
            transformOrigin: 'top',
            maskImage: 'linear-gradient(to bottom, transparent, black 20%)',
          }}
        />
      </div>

      {/* Floating music notes */}
      {['♪', '♫', '♬', '♩'].map((note, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl pointer-events-none"
          style={{ left: `${20 + i * 20}%`, bottom: '40%', color: isDark ? '#a78bfa' : '#60a5fa' }}
          animate={{ y: [0, -100, -150], x: [0, 20, -10], opacity: [0, 1, 0], rotate: [0, 15, -10] }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 1.5, ease: 'easeOut' }}
        >
          {note}
        </motion.div>
      ))}
    </>
  );
}

// ============================================
// SPACE SCENE - Day (nebula) & Night (deep space)
// ============================================
function SpaceScene({ isDark }: { isDark: boolean }) {
  return (
    <>
      {/* Star field - always visible, more in dark mode */}
      <StarField count={isDark ? 100 : 60} maxTop={50} />

      {/* Nebula clouds */}
      <motion.div
        className="absolute"
        style={{
          top: '5%', left: '10%', width: '40%', height: '30%',
          background: isDark
            ? 'radial-gradient(ellipse, rgba(139,92,246,0.25), rgba(236,72,153,0.15), transparent 70%)'
            : 'radial-gradient(ellipse, rgba(236,72,153,0.2), rgba(251,146,60,0.15), transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute"
        style={{
          top: '15%', right: '15%', width: '30%', height: '25%',
          background: isDark
            ? 'radial-gradient(ellipse, rgba(59,130,246,0.2), rgba(139,92,246,0.1), transparent 70%)'
            : 'radial-gradient(ellipse, rgba(6,182,212,0.2), rgba(59,130,246,0.15), transparent 70%)',
          filter: 'blur(30px)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, delay: 2 }}
      />

      {/* Planet with rings */}
      <motion.div
        className="absolute top-[8%] right-[12%]"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
      >
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 50%, #1e1b4b 100%)'
                : 'linear-gradient(135deg, #f97316 0%, #dc2626 50%, #7f1d1d 100%)',
              boxShadow: `inset -8px -8px 20px rgba(0,0,0,0.5), ${isDark ? '0 0 30px rgba(139,92,246,0.3)' : '0 0 30px rgba(249,115,22,0.3)'}`,
            }}
          />
          {/* Ring */}
          <div
            className="absolute top-1/2 left-1/2 w-32 h-6 rounded-full border-2"
            style={{
              transform: 'translate(-50%, -50%) rotateX(75deg)',
              borderColor: isDark ? 'rgba(167,139,250,0.4)' : 'rgba(251,146,60,0.5)',
              background: isDark
                ? 'linear-gradient(90deg, transparent, rgba(167,139,250,0.1), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(251,146,60,0.15), transparent)',
            }}
          />
        </div>
      </motion.div>

      {/* Distant planet/moon */}
      <motion.div
        className="absolute top-[20%] left-[20%] w-8 h-8 rounded-full"
        style={{
          background: isDark
            ? 'radial-gradient(circle at 30% 30%, #94a3b8, #475569)'
            : 'radial-gradient(circle at 30% 30%, #fef08a, #eab308)',
          boxShadow: isDark ? '0 0 15px rgba(148,163,184,0.2)' : '0 0 20px rgba(234,179,8,0.3)',
        }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      {/* Shooting stars */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: `${15 + i * 30}%`, top: '10%' }}
          animate={{
            x: [0, 150, 250],
            y: [0, 80, 120],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: 5 + i * 8,
            repeat: Infinity,
            repeatDelay: 15,
          }}
        >
          <div className="w-12 h-0.5 bg-gradient-to-l from-white to-transparent -translate-x-12" />
        </motion.div>
      ))}

      {/* Space station/platform */}
      <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[70%]">
        <div className="relative">
          {/* Main platform */}
          <div className="h-6 bg-gradient-to-b from-gray-500 to-gray-700 rounded-lg border-t border-gray-400">
            <div className="flex justify-around pt-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: isDark ? '#06b6d4' : '#22d3ee' }}
                  animate={{ opacity: [0.4, 1, 0.4], boxShadow: [`0 0 5px ${isDark ? '#06b6d4' : '#22d3ee'}`, `0 0 10px ${isDark ? '#06b6d4' : '#22d3ee'}`, `0 0 5px ${isDark ? '#06b6d4' : '#22d3ee'}`] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
          {/* Support structures */}
          <div className="absolute -left-4 top-0 w-3 h-12 bg-gradient-to-b from-gray-600 to-gray-800 rounded" />
          <div className="absolute -right-4 top-0 w-3 h-12 bg-gradient-to-b from-gray-600 to-gray-800 rounded" />
        </div>
      </div>

      {/* Floating particles */}
      <Particles color={isDark ? '#a5b4fc' : '#fcd34d'} count={15} />
    </>
  );
}

// ============================================
// ROOFTOP SCENE - Day & Night
// ============================================
function RooftopScene({ isDark }: { isDark: boolean }) {
  const buildings = useMemo(() => [
    { height: 55, width: 8, windows: 5 },
    { height: 80, width: 7, windows: 8 },
    { height: 65, width: 9, windows: 6 },
    { height: 95, width: 6, windows: 9 },
    { height: 70, width: 8, windows: 7 },
    { height: 60, width: 7, windows: 5 },
    { height: 85, width: 8, windows: 8 },
    { height: 50, width: 6, windows: 4 },
    { height: 75, width: 9, windows: 7 },
    { height: 90, width: 7, windows: 9 },
  ], []);

  return (
    <>
      {/* Sky elements */}
      {isDark ? (
        <>
          <StarField count={35} maxTop={25} />
          {/* Moon */}
          <motion.div
            className="absolute top-[6%] right-[18%]"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
          >
            <div
              className="w-14 h-14 rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #fefce8, #d4d4d4)',
                boxShadow: '0 0 40px 10px rgba(255,255,255,0.1)',
              }}
            />
          </motion.div>
        </>
      ) : (
        <>
          <CloudLayer isDark={false} />
          {/* Sun */}
          <motion.div
            className="absolute top-[8%] right-[15%] w-16 h-16 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #fffde7, #ffeb3b)',
              boxShadow: '0 0 50px 15px rgba(255,235,59,0.3)',
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </>
      )}

      {/* City skyline */}
      <div className="absolute bottom-[30%] left-0 right-0 flex items-end justify-around px-2">
        {buildings.map((building, i) => (
          <div
            key={i}
            className="relative"
            style={{
              width: `${building.width}%`,
              height: `${building.height}px`,
              background: isDark
                ? 'linear-gradient(to bottom, #1e293b, #0f172a)'
                : 'linear-gradient(to bottom, #64748b, #334155)',
            }}
          >
            {/* Windows */}
            <div className="absolute inset-1 grid grid-cols-3 gap-0.5">
              {Array.from({ length: building.windows * 3 }).map((_, j) => (
                <motion.div
                  key={j}
                  className="rounded-sm"
                  style={{
                    background: isDark
                      ? Math.random() > 0.3 ? '#fef08a' : '#1e293b'
                      : Math.random() > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(59,130,246,0.2)',
                  }}
                  animate={isDark && Math.random() > 0.7 ? { opacity: [0.3, 1, 0.3] } : {}}
                  transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
                />
              ))}
            </div>
            {/* Rooftop details */}
            {i % 3 === 0 && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-4 bg-red-500 rounded-full">
                <motion.div
                  className="w-full h-full rounded-full bg-red-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Neon signs (night) / Billboards (day) */}
      {isDark ? (
        <>
          <motion.div
            className="absolute top-[25%] left-[12%] text-lg font-bold"
            style={{ color: '#ec4899', textShadow: '0 0 20px #ec4899, 0 0 40px #ec4899' }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            OPEN 24/7
          </motion.div>
          <motion.div
            className="absolute top-[28%] right-[15%] text-sm font-bold"
            style={{ color: '#22d3ee', textShadow: '0 0 15px #22d3ee, 0 0 30px #22d3ee' }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          >
            MUSIC LIVE
          </motion.div>
        </>
      ) : (
        <>
          <div className="absolute top-[22%] left-[10%] w-16 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">ADS</span>
          </div>
        </>
      )}

      {/* Rooftop elements */}
      <div className="absolute bottom-[5%] left-0 right-0">
        {/* AC Units */}
        <div className="absolute right-[10%] bottom-[60%] w-10 h-7 bg-gradient-to-b from-gray-500 to-gray-600 rounded">
          <motion.div
            className="w-6 h-1 mx-auto mt-1 bg-gray-400 rounded"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div className="absolute right-[18%] bottom-[55%] w-8 h-6 bg-gradient-to-b from-gray-500 to-gray-600 rounded" />

        {/* Water tower */}
        <div className="absolute left-[8%] bottom-[50%]">
          <div className="w-12 h-10 bg-gradient-to-b from-amber-700 to-amber-900 rounded-t-full" />
          <div className="w-2 h-8 mx-auto bg-gray-600" />
        </div>
      </div>

      {/* City ambient lights (night) */}
      {isDark && (
        <motion.div
          className="absolute bottom-[30%] left-0 right-0 h-20 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(251,191,36,0.1), transparent)',
          }}
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}
    </>
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

  // Track previous values for transition direction
  const prevSceneRef = useRef<HomepageSceneType>(currentScene);
  const prevThemeRef = useRef<boolean>(isDark);
  const [transitionType, setTransitionType] = useState<'scene' | 'theme' | 'initial'>('initial');
  const [sceneDirection, setSceneDirection] = useState<number>(1); // 1 = going right, -1 = going left

  // Determine transition type and direction when scene or theme changes
  useEffect(() => {
    const sceneChanged = prevSceneRef.current !== currentScene;
    const themeChanged = prevThemeRef.current !== isDark;

    if (sceneChanged) {
      const prevIndex = SCENE_ORDER.indexOf(prevSceneRef.current);
      const currentIndex = SCENE_ORDER.indexOf(currentScene);
      // Positive = new scene is to the right, slides in from right
      setSceneDirection(currentIndex > prevIndex ? 1 : -1);
      setTransitionType('scene');
      prevSceneRef.current = currentScene;
    } else if (themeChanged) {
      setTransitionType('theme');
      prevThemeRef.current = isDark;
    }
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

  // Dynamic variants based on transition type
  const getSceneVariants = () => {
    if (transitionType === 'initial') {
      return {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1, x: 0, y: 0 },
        exit: { opacity: 0, scale: 0.95 },
      };
    }
    if (transitionType === 'scene') {
      // Horizontal slide - scenes are laid out left to right
      // Going right (higher index): new scene enters from right, old exits left
      // Going left (lower index): new scene enters from left, old exits right
      return {
        initial: { opacity: 0, x: `${sceneDirection * 100}%` },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: `${-sceneDirection * 100}%` },
      };
    }
    // Vertical slide for theme changes
    // Night: slides down from top (enters from -y)
    // Day: slides up from bottom (enters from +y)
    return {
      initial: { opacity: 0, y: isDark ? '-60%' : '60%' },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: isDark ? '60%' : '-60%' },
    };
  };

  const sceneVariants = getSceneVariants();

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
            x: transitionType === 'scene' ? `${sceneDirection * 30}%` : 0,
            y: transitionType === 'theme' ? (isDark ? '-20%' : '20%') : 0,
          }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{
            opacity: 0,
            x: transitionType === 'scene' ? `${-sceneDirection * 30}%` : 0,
            y: transitionType === 'theme' ? (isDark ? '20%' : '-20%') : 0,
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
