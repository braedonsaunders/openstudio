'use client';

import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, ArrowRight, Zap, Radio, Sun, Moon, FolderOpen, Plus } from 'lucide-react';

// Theme toggle button
function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      onClick={toggleTheme}
      className={`relative p-2.5 rounded-xl transition-colors ${
        isDark
          ? 'bg-white/10 hover:bg-white/20 text-white'
          : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 0 : 180, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {isDark ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </motion.div>
    </motion.button>
  );
}

// Animated campfire for night scene
function Campfire() {
  return (
    <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 z-10">
      <svg width="120" height="100" viewBox="0 0 120 100">
        {/* Logs */}
        <rect x="25" y="75" width="70" height="12" rx="6" fill="#78350f" transform="rotate(-10 60 80)" />
        <rect x="25" y="75" width="70" height="12" rx="6" fill="#92400e" transform="rotate(10 60 80)" />
        <rect x="40" y="78" width="40" height="10" rx="5" fill="#451a03" />

        {/* Fire glow */}
        <ellipse cx="60" cy="70" rx="40" ry="20" fill="url(#fireGlow)" />

        {/* Flames */}
        <motion.g>
          {/* Main center flame */}
          <motion.path
            d="M60 75 Q50 50 55 35 Q60 20 60 15 Q60 20 65 35 Q70 50 60 75"
            fill="url(#flameGradient)"
            animate={{
              d: [
                "M60 75 Q50 50 55 35 Q60 20 60 15 Q60 20 65 35 Q70 50 60 75",
                "M60 75 Q48 55 53 38 Q58 22 60 12 Q62 22 67 38 Q72 55 60 75",
                "M60 75 Q52 48 57 32 Q62 18 60 10 Q58 18 63 32 Q68 48 60 75",
                "M60 75 Q50 50 55 35 Q60 20 60 15 Q60 20 65 35 Q70 50 60 75",
              ],
            }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Left flame */}
          <motion.path
            d="M45 75 Q38 58 42 45 Q46 35 45 30 Q44 35 48 45 Q52 58 45 75"
            fill="url(#flameGradient2)"
            animate={{
              d: [
                "M45 75 Q38 58 42 45 Q46 35 45 30 Q44 35 48 45 Q52 58 45 75",
                "M45 75 Q36 60 40 48 Q44 38 45 32 Q46 38 50 48 Q54 60 45 75",
                "M45 75 Q40 55 44 42 Q48 32 45 28 Q42 32 46 42 Q50 55 45 75",
                "M45 75 Q38 58 42 45 Q46 35 45 30 Q44 35 48 45 Q52 58 45 75",
              ],
            }}
            transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          />

          {/* Right flame */}
          <motion.path
            d="M75 75 Q82 58 78 45 Q74 35 75 30 Q76 35 72 45 Q68 58 75 75"
            fill="url(#flameGradient2)"
            animate={{
              d: [
                "M75 75 Q82 58 78 45 Q74 35 75 30 Q76 35 72 45 Q68 58 75 75",
                "M75 75 Q84 60 80 48 Q76 38 75 32 Q74 38 70 48 Q66 60 75 75",
                "M75 75 Q80 55 76 42 Q72 32 75 28 Q78 32 74 42 Q70 55 75 75",
                "M75 75 Q82 58 78 45 Q74 35 75 30 Q76 35 72 45 Q68 58 75 75",
              ],
            }}
            transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </motion.g>

        {/* Sparks */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.circle
            key={i}
            cx={55 + i * 3}
            cy="40"
            r="1.5"
            fill="#fbbf24"
            animate={{
              y: [0, -30, -50],
              x: [0, (i % 2 === 0 ? 10 : -10), (i % 2 === 0 ? 15 : -15)],
              opacity: [1, 0.8, 0],
              scale: [1, 0.8, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeOut",
            }}
          />
        ))}

        <defs>
          <linearGradient id="flameGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="70%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
          <linearGradient id="flameGradient2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fcd34d" />
          </linearGradient>
          <radialGradient id="fireGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

// Animated butterflies for day scene
function Butterflies() {
  const butterflies = useMemo(() => [
    { startX: 20, startY: 30, color: '#f472b6' },
    { startX: 70, startY: 25, color: '#a855f7' },
    { startX: 45, startY: 35, color: '#60a5fa' },
    { startX: 85, startY: 40, color: '#fbbf24' },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {butterflies.map((butterfly, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${butterfly.startX}%`, top: `${butterfly.startY}%` }}
          animate={{
            x: [0, 50, -30, 80, 20, -40, 0],
            y: [0, -20, 30, -10, 40, 10, 0],
          }}
          transition={{
            duration: 20 + i * 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <motion.svg
            width="24"
            height="20"
            viewBox="0 0 24 20"
            animate={{ rotateY: [0, 180, 0] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          >
            {/* Left wing */}
            <motion.ellipse
              cx="8"
              cy="10"
              rx="7"
              ry="8"
              fill={butterfly.color}
              fillOpacity="0.8"
              animate={{ scaleX: [1, 0.3, 1] }}
              transition={{ duration: 0.2, repeat: Infinity }}
            />
            {/* Right wing */}
            <motion.ellipse
              cx="16"
              cy="10"
              rx="7"
              ry="8"
              fill={butterfly.color}
              fillOpacity="0.8"
              animate={{ scaleX: [1, 0.3, 1] }}
              transition={{ duration: 0.2, repeat: Infinity }}
            />
            {/* Body */}
            <ellipse cx="12" cy="10" rx="1.5" ry="6" fill="#1e293b" />
          </motion.svg>
        </motion.div>
      ))}
    </div>
  );
}

// Animated picnic blanket for day scene
function PicnicBlanket() {
  return (
    <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-5">
      <svg width="200" height="60" viewBox="0 0 200 60">
        <ellipse cx="100" cy="40" rx="90" ry="20" fill="url(#blanketPattern)" />
        <defs>
          <pattern id="blanketPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#ef4444" />
            <rect x="10" width="10" height="10" fill="#fef2f2" />
            <rect y="10" width="10" height="10" fill="#fef2f2" />
            <rect x="10" y="10" width="10" height="10" fill="#ef4444" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}

// Animated clouds for day scene
function Clouds() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { x: '5%', y: '8%', scale: 1, duration: 120, delay: 0 },
        { x: '25%', y: '5%', scale: 0.8, duration: 150, delay: -30 },
        { x: '60%', y: '12%', scale: 1.2, duration: 100, delay: -60 },
        { x: '80%', y: '6%', scale: 0.9, duration: 130, delay: -20 },
        { x: '45%', y: '15%', scale: 0.7, duration: 140, delay: -80 },
      ].map((cloud, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: cloud.x, top: cloud.y, scale: cloud.scale }}
          animate={{
            x: ['0%', '100vw'],
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
            <ellipse cx="60" cy="35" rx="40" ry="15" fill="white" fillOpacity="0.9" />
            <ellipse cx="40" cy="28" rx="25" ry="18" fill="white" fillOpacity="0.95" />
            <ellipse cx="75" cy="30" rx="22" ry="15" fill="white" fillOpacity="0.9" />
            <ellipse cx="55" cy="22" rx="20" ry="15" fill="white" fillOpacity="1" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

// Animated stars for night scene
function Stars() {
  const stars = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 40}%`,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Day scene - Forest meadow with sunlight
function DayScene() {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    >
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-amber-100" />

      {/* Sun */}
      <motion.div
        className="absolute top-[8%] right-[15%]"
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.9, 1, 0.9],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-200 to-amber-300 shadow-2xl"
          style={{ boxShadow: '0 0 100px 30px rgba(255, 220, 100, 0.5)' }}
        />
      </motion.div>

      {/* Clouds */}
      <Clouds />

      {/* Butterflies */}
      <Butterflies />

      {/* Distant mountains */}
      <svg className="absolute bottom-[25%] left-0 right-0 w-full h-[30%]" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path d="M0 300 L0 180 Q200 80 400 150 Q600 50 800 120 Q1000 40 1200 100 Q1350 60 1440 130 L1440 300 Z" fill="#94a3b8" fillOpacity="0.3" />
        <path d="M0 300 L0 200 Q150 120 350 180 Q550 100 700 160 Q900 80 1100 140 Q1300 100 1440 160 L1440 300 Z" fill="#64748b" fillOpacity="0.3" />
      </svg>

      {/* Forest trees background */}
      <div className="absolute bottom-[20%] left-0 right-0 h-[20%]">
        <svg className="w-full h-full" viewBox="0 0 1440 200" preserveAspectRatio="none">
          {Array.from({ length: 20 }).map((_, i) => (
            <g key={i} transform={`translate(${i * 75 + 15}, ${20 + (i % 3) * 10})`}>
              <polygon points="30,150 60,0 90,150" fill="#166534" fillOpacity={0.6 + (i % 3) * 0.1} />
              <rect x="55" y="150" width="10" height="30" fill="#78350f" fillOpacity="0.6" />
            </g>
          ))}
        </svg>
      </div>

      {/* Meadow ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[30%]">
        <svg className="w-full h-full" viewBox="0 0 1440 300" preserveAspectRatio="none">
          <ellipse cx="720" cy="400" rx="1000" ry="250" fill="url(#meadowGradient)" />
          <defs>
            <linearGradient id="meadowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#84cc16" />
              <stop offset="50%" stopColor="#65a30d" />
              <stop offset="100%" stopColor="#4d7c0f" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Picnic blanket */}
      <PicnicBlanket />

      {/* Animated grass/flowers */}
      <div className="absolute bottom-[5%] left-0 right-0 h-[15%] flex items-end justify-around pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="origin-bottom"
            animate={{
              rotateZ: [-3, 3, -3],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.1,
            }}
          >
            <svg width="20" height="40" viewBox="0 0 20 40">
              <path d="M10 40 Q8 25 10 10 Q12 0 10 0" stroke="#4ade80" strokeWidth="2" fill="none" />
              {i % 4 === 0 && (
                <circle cx="10" cy="5" r="4" fill={['#fbbf24', '#f472b6', '#c084fc', '#60a5fa'][i % 4]} />
              )}
            </svg>
          </motion.div>
        ))}
      </div>

      {/* Floating leaves */}
      {[
        { startX: '10%', startY: '-5%', duration: 15, delay: 0 },
        { startX: '30%', startY: '-5%', duration: 18, delay: 3 },
        { startX: '60%', startY: '-5%', duration: 14, delay: 6 },
        { startX: '85%', startY: '-5%', duration: 20, delay: 2 },
      ].map((leaf, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: leaf.startX, top: leaf.startY }}
          animate={{
            y: ['0%', '120vh'],
            x: [0, 50, -30, 40, 0],
            rotate: [0, 180, 360, 540, 720],
          }}
          transition={{
            duration: leaf.duration,
            delay: leaf.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <ellipse cx="10" cy="10" rx="8" ry="4" fill="#22c55e" transform="rotate(45 10 10)" />
          </svg>
        </motion.div>
      ))}

      {/* Birds flying */}
      {[
        { x: '20%', y: '15%', duration: 25, delay: 0 },
        { x: '40%', y: '20%', duration: 30, delay: 5 },
        { x: '70%', y: '12%', duration: 22, delay: 10 },
      ].map((bird, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: bird.x, top: bird.y }}
          animate={{
            x: [0, 200, 400],
            y: [0, -20, 0],
          }}
          transition={{
            duration: bird.duration,
            delay: bird.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <motion.svg
            width="20"
            height="10"
            viewBox="0 0 20 10"
            animate={{ scaleY: [1, 0.5, 1] }}
            transition={{ duration: 0.3, repeat: Infinity }}
          >
            <path d="M0 5 Q5 0 10 5 Q15 0 20 5" stroke="#374151" strokeWidth="1.5" fill="none" />
          </motion.svg>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Night scene - Tropical beach sunset with city skyline
function NightScene() {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    >
      {/* Sunset sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 via-60% to-orange-500" />

      {/* Stars */}
      <Stars />

      {/* Moon */}
      <motion.div
        className="absolute top-[10%] left-[15%]"
        animate={{
          opacity: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-300"
          style={{ boxShadow: '0 0 60px 15px rgba(255, 255, 255, 0.2)' }}
        />
      </motion.div>

      {/* City skyline in the distance */}
      <div className="absolute bottom-[30%] left-0 right-0">
        <svg className="w-full h-32" viewBox="0 0 1440 150" preserveAspectRatio="none">
          <defs>
            <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
          </defs>
          <rect x="50" y="50" width="30" height="100" fill="url(#buildingGradient)" />
          <rect x="90" y="30" width="25" height="120" fill="url(#buildingGradient)" />
          <rect x="120" y="60" width="35" height="90" fill="url(#buildingGradient)" />
          <rect x="165" y="20" width="20" height="130" fill="url(#buildingGradient)" />
          <rect x="200" y="70" width="40" height="80" fill="url(#buildingGradient)" />

          <rect x="1150" y="40" width="35" height="110" fill="url(#buildingGradient)" />
          <rect x="1200" y="25" width="25" height="125" fill="url(#buildingGradient)" />
          <rect x="1240" y="55" width="30" height="95" fill="url(#buildingGradient)" />
          <rect x="1280" y="35" width="40" height="115" fill="url(#buildingGradient)" />
          <rect x="1340" y="65" width="30" height="85" fill="url(#buildingGradient)" />

          {Array.from({ length: 40 }).map((_, i) => (
            <motion.rect
              key={i}
              x={50 + (i % 10) * 25 + (i % 7) * 2}
              y={40 + Math.floor(i / 10) * 25 + (i % 5) * 2}
              width="3"
              height="4"
              fill="#fef08a"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1 + (i % 3),
                delay: (i % 10) * 0.2,
                repeat: Infinity,
              }}
            />
          ))}
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.rect
              key={`right-${i}`}
              x={1150 + (i % 10) * 20 + (i % 5)}
              y={40 + Math.floor(i / 10) * 25 + (i % 4) * 2}
              width="3"
              height="4"
              fill="#fef08a"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1 + (i % 3),
                delay: (i % 10) * 0.2,
                repeat: Infinity,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Palm trees silhouettes */}
      <div className="absolute bottom-[15%] left-[5%]">
        <motion.svg
          width="120"
          height="200"
          viewBox="0 0 120 200"
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <path d="M60 200 Q55 150 60 50" stroke="#1e1b4b" strokeWidth="8" fill="none" />
          <ellipse cx="60" cy="50" rx="50" ry="15" fill="#1e1b4b" transform="rotate(-30 60 50)" />
          <ellipse cx="60" cy="50" rx="45" ry="12" fill="#1e1b4b" transform="rotate(20 60 50)" />
          <ellipse cx="60" cy="50" rx="40" ry="10" fill="#1e1b4b" transform="rotate(-60 60 50)" />
          <ellipse cx="60" cy="50" rx="48" ry="13" fill="#1e1b4b" transform="rotate(50 60 50)" />
          <ellipse cx="60" cy="50" rx="35" ry="10" fill="#1e1b4b" transform="rotate(-10 60 50)" />
        </motion.svg>
      </div>

      <div className="absolute bottom-[15%] right-[8%]">
        <motion.svg
          width="100"
          height="180"
          viewBox="0 0 100 180"
          animate={{ rotate: [2, -2, 2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <path d="M50 180 Q45 130 50 40" stroke="#1e1b4b" strokeWidth="7" fill="none" />
          <ellipse cx="50" cy="40" rx="45" ry="12" fill="#1e1b4b" transform="rotate(-25 50 40)" />
          <ellipse cx="50" cy="40" rx="40" ry="10" fill="#1e1b4b" transform="rotate(30 50 40)" />
          <ellipse cx="50" cy="40" rx="35" ry="9" fill="#1e1b4b" transform="rotate(-55 50 40)" />
          <ellipse cx="50" cy="40" rx="42" ry="11" fill="#1e1b4b" transform="rotate(60 50 40)" />
        </motion.svg>
      </div>

      {/* Ocean with reflection */}
      <div className="absolute bottom-0 left-0 right-0 h-[25%]">
        <svg className="w-full h-full" viewBox="0 0 1440 250" preserveAspectRatio="none">
          <defs>
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#4c1d95" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </linearGradient>
            <linearGradient id="sunReflection" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="1440" height="250" fill="url(#oceanGradient)" />
          <ellipse cx="720" cy="20" rx="150" ry="200" fill="url(#sunReflection)" />
        </svg>

        <motion.svg
          className="absolute top-0 left-0 w-full"
          viewBox="0 0 1440 50"
          preserveAspectRatio="none"
          animate={{ x: [-50, 0, -50] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path d="M0 25 Q60 10 120 25 Q180 40 240 25 Q300 10 360 25 Q420 40 480 25 Q540 10 600 25 Q660 40 720 25 Q780 10 840 25 Q900 40 960 25 Q1020 10 1080 25 Q1140 40 1200 25 Q1260 10 1320 25 Q1380 40 1440 25 L1440 50 L0 50 Z" fill="rgba(139, 92, 246, 0.3)" />
        </motion.svg>
      </div>

      {/* Beach sand */}
      <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-gradient-to-t from-amber-900/80 to-amber-800/60" />

      {/* Campfire */}
      <Campfire />

      {/* Shooting stars */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            left: `${20 + i * 30}%`,
            top: '10%',
            boxShadow: '0 0 6px 2px rgba(255, 255, 255, 0.8)',
          }}
          animate={{
            x: [0, 200],
            y: [0, 100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: i * 8 + 5,
            repeat: Infinity,
            repeatDelay: 20,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Fireflies */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: `${10 + (i * 6) % 80}%`,
            bottom: `${15 + (i * 3) % 20}%`,
            background: 'radial-gradient(circle, rgba(250, 204, 21, 0.9), transparent)',
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
            x: [0, (i % 2 === 0 ? 20 : -20), 0],
            y: [0, (i % 3 === 0 ? -15 : 15), 0],
          }}
          transition={{
            duration: 3 + (i % 3),
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </motion.div>
  );
}

// Musician character - Generic with different instruments
function MusicianCharacter({
  type,
  position,
  isVisible,
  delay
}: {
  type: 'guitarist' | 'drummer' | 'keyboardist' | 'singer' | 'bassist';
  position: string;
  isVisible: boolean;
  delay: number;
}) {
  const characters: Record<string, ReactNode> = {
    guitarist: (
      <motion.svg width="80" height="110" viewBox="0 0 100 140" animate={{ y: [0, -3, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="50" cy="135" rx="25" ry="4" fill="rgba(0,0,0,0.15)" />
        <ellipse cx="35" cy="115" rx="18" ry="7" fill="#1e40af" />
        <ellipse cx="65" cy="115" rx="18" ry="7" fill="#1e40af" />
        <rect x="38" y="70" width="24" height="35" rx="4" fill="#dc2626" />
        <motion.g animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity }} style={{ transformOrigin: '35px 80px' }}>
          <rect x="18" y="75" width="22" height="8" rx="4" fill="#fcd34d" />
        </motion.g>
        <motion.g animate={{ rotate: [2, -2, 2] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ transformOrigin: '65px 80px' }}>
          <rect x="60" y="75" width="22" height="8" rx="4" fill="#fcd34d" />
        </motion.g>
        <circle cx="50" cy="55" r="18" fill="#fcd34d" />
        <path d="M32 50 Q38 32 50 30 Q62 32 68 50" fill="#451a03" />
        <circle cx="44" cy="55" r="2.5" fill="#1e293b" />
        <circle cx="56" cy="55" r="2.5" fill="#1e293b" />
        <path d="M44 62 Q50 67 56 62" stroke="#1e293b" strokeWidth="1.5" fill="none" />
        <motion.g animate={{ rotate: [-1, 1, -1] }} transition={{ duration: 2, repeat: Infinity }} style={{ transformOrigin: '50px 95px' }}>
          <ellipse cx="50" cy="95" rx="15" ry="10" fill="#92400e" />
          <ellipse cx="50" cy="95" rx="4" ry="2.5" fill="#1e293b" />
          <rect x="48" y="68" width="4" height="27" fill="#78350f" />
        </motion.g>
      </motion.svg>
    ),
    drummer: (
      <motion.svg width="110" height="120" viewBox="0 0 140 150" animate={{ y: [0, -2, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="70" cy="142" rx="45" ry="4" fill="rgba(0,0,0,0.15)" />
        <ellipse cx="70" cy="125" rx="35" ry="8" fill="#525252" />
        <ellipse cx="70" cy="108" rx="26" ry="22" fill="#1e293b" />
        <ellipse cx="70" cy="108" rx="22" ry="17" fill="#334155" />
        <circle cx="70" cy="108" r="8" fill="#f59e0b" />
        <ellipse cx="35" cy="98" rx="12" ry="8" fill="#475569" />
        <ellipse cx="105" cy="98" rx="12" ry="8" fill="#475569" />
        <motion.ellipse cx="118" cy="68" rx="10" ry="2.5" fill="#fbbf24" animate={{ rotate: [-5, 5, -5], y: [0, 2, 0] }} transition={{ duration: 0.5, repeat: Infinity }} style={{ transformOrigin: '118px 68px' }} />
        <rect x="58" y="52" width="24" height="30" rx="4" fill="#7c3aed" />
        <circle cx="70" cy="38" r="15" fill="#fcd34d" />
        <rect x="55" y="28" width="30" height="4" rx="2" fill="#ef4444" />
        <circle cx="64" cy="38" r="2.5" fill="#1e293b" />
        <circle cx="76" cy="38" r="2.5" fill="#1e293b" />
        <ellipse cx="70" cy="44" rx="4" ry="2.5" fill="#1e293b" />
        <motion.g animate={{ rotate: [-15, 15, -15] }} transition={{ duration: 0.4, repeat: Infinity }} style={{ transformOrigin: '45px 60px' }}>
          <rect x="28" y="55" width="22" height="7" rx="3" fill="#fcd34d" />
          <rect x="18" y="54" width="16" height="2.5" rx="1" fill="#a16207" />
        </motion.g>
        <motion.g animate={{ rotate: [15, -15, 15] }} transition={{ duration: 0.35, repeat: Infinity }} style={{ transformOrigin: '95px 60px' }}>
          <rect x="90" y="55" width="22" height="7" rx="3" fill="#fcd34d" />
          <rect x="102" y="54" width="16" height="2.5" rx="1" fill="#a16207" />
        </motion.g>
      </motion.svg>
    ),
    keyboardist: (
      <motion.svg width="100" height="105" viewBox="0 0 130 130" animate={{ y: [0, -2, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="65" cy="122" rx="40" ry="4" fill="rgba(0,0,0,0.15)" />
        <rect x="15" y="82" width="100" height="4" fill="#525252" />
        <rect x="22" y="86" width="4" height="30" fill="#525252" />
        <rect x="104" y="86" width="4" height="30" fill="#525252" />
        <rect x="18" y="72" width="94" height="13" rx="2" fill="#1e293b" />
        {Array.from({ length: 13 }).map((_, i) => (
          <motion.rect key={i} x={20 + i * 7} y="74" width="5" height="9" rx="1" fill="white" animate={{ y: i % 3 === 0 ? [74, 75, 74] : [74, 74, 74] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }} />
        ))}
        <rect x="52" y="38" width="26" height="30" rx="4" fill="#10b981" />
        <circle cx="65" cy="24" r="14" fill="#fcd34d" />
        <circle cx="58" cy="24" r="5" fill="none" stroke="#1e293b" strokeWidth="1.5" />
        <circle cx="72" cy="24" r="5" fill="none" stroke="#1e293b" strokeWidth="1.5" />
        <circle cx="58" cy="24" r="1.5" fill="#1e293b" />
        <circle cx="72" cy="24" r="1.5" fill="#1e293b" />
        <path d="M58 30 Q65 34 72 30" stroke="#1e293b" strokeWidth="1.5" fill="none" />
        <path d="M51 20 Q57 8 65 8 Q73 8 79 20" fill="#78350f" />
        <motion.rect x="32" y="48" width="22" height="7" rx="3" fill="#fcd34d" animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 1, repeat: Infinity }} style={{ transformOrigin: '52px 52px' }} />
        <motion.rect x="76" y="48" width="22" height="7" rx="3" fill="#fcd34d" animate={{ rotate: [3, -3, 3] }} transition={{ duration: 0.8, repeat: Infinity }} style={{ transformOrigin: '78px 52px' }} />
      </motion.svg>
    ),
    singer: (
      <motion.svg width="65" height="120" viewBox="0 0 80 150" animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="40" cy="142" rx="18" ry="4" fill="rgba(0,0,0,0.15)" />
        <rect x="30" y="100" width="8" height="38" rx="4" fill="#1e40af" />
        <rect x="42" y="100" width="8" height="38" rx="4" fill="#1e40af" />
        <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 2, repeat: Infinity }} style={{ transformOrigin: '40px 100px' }}>
          <path d="M27 60 L31 100 L49 100 L53 60 Q40 55 27 60" fill="#f472b6" />
          <motion.g animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ transformOrigin: '27px 65px' }}>
            <rect x="12" y="60" width="18" height="7" rx="3" fill="#fcd34d" />
          </motion.g>
          <motion.g animate={{ rotate: [5, -5, 5] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ transformOrigin: '53px 65px' }}>
            <rect x="50" y="60" width="18" height="7" rx="3" fill="#fcd34d" />
            <rect x="66" y="55" width="4" height="16" rx="2" fill="#525252" />
            <ellipse cx="68" cy="52" rx="5" ry="7" fill="#374151" />
          </motion.g>
          <circle cx="40" cy="42" r="16" fill="#fcd34d" />
          <path d="M24 40 Q22 22 40 17 Q58 22 56 40 L56 52 Q48 48 40 52 Q32 48 24 52 Z" fill="#1e293b" />
          <path d="M33 42 Q36 40 39 42" stroke="#1e293b" strokeWidth="1.5" fill="none" />
          <path d="M41 42 Q44 40 47 42" stroke="#1e293b" strokeWidth="1.5" fill="none" />
          <motion.ellipse cx="40" cy="49" rx="4" ry="3" fill="#1e293b" animate={{ scaleY: [0.8, 1.3, 0.8] }} transition={{ duration: 1, repeat: Infinity }} style={{ transformOrigin: '40px 49px' }} />
        </motion.g>
        <motion.text x="58" y="28" fontSize="12" fill="#f472b6" animate={{ y: [28, 15], opacity: [1, 0], x: [58, 66] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}>♪</motion.text>
      </motion.svg>
    ),
    bassist: (
      <motion.svg width="72" height="125" viewBox="0 0 90 160" animate={{ y: [0, -3, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="45" cy="152" rx="22" ry="4" fill="rgba(0,0,0,0.15)" />
        <rect x="34" y="105" width="8" height="42" rx="4" fill="#1e40af" />
        <rect x="48" y="105" width="8" height="42" rx="4" fill="#1e40af" />
        <motion.g animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 3, repeat: Infinity }} style={{ transformOrigin: '45px 105px' }}>
          <rect x="30" y="55" width="30" height="45" rx="4" fill="#0ea5e9" />
          <motion.g animate={{ rotate: [-1, 1, -1] }} transition={{ duration: 2, repeat: Infinity }} style={{ transformOrigin: '52px 88px' }}>
            <ellipse cx="55" cy="98" rx="13" ry="17" fill="#dc2626" />
            <rect x="52" y="50" width="5" height="45" fill="#78350f" />
            <rect x="49" y="43" width="12" height="10" rx="2" fill="#78350f" />
          </motion.g>
          <motion.rect x="14" y="60" width="18" height="7" rx="3" fill="#fcd34d" animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ transformOrigin: '30px 64px' }} />
          <circle cx="45" cy="40" r="15" fill="#fcd34d" />
          <path d="M30 37 Q32 22 45 18 Q58 22 60 37 L58 40 Q45 37 32 40 Z" fill="#4f46e5" />
          <rect x="30" y="35" width="30" height="5" rx="2" fill="#6366f1" />
          <rect x="34" y="38" width="9" height="5" rx="2" fill="#1e293b" />
          <rect x="47" y="38" width="9" height="5" rx="2" fill="#1e293b" />
          <path d="M40 50 Q45 53 50 50" stroke="#1e293b" strokeWidth="1.5" fill="none" />
        </motion.g>
      </motion.svg>
    ),
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`absolute ${position}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 1.5, delay, ease: 'easeOut' }}
        >
          {characters[type]}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Audience member
function AudienceMember({ position, variant, isVisible }: { position: string; variant: number; isVisible: boolean }) {
  const colors = ['#f472b6', '#a855f7', '#3b82f6', '#10b981', '#f59e0b'];
  const hairColors = ['#451a03', '#1e293b', '#78350f', '#dc2626', '#fbbf24'];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`absolute ${position}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <motion.svg
            width="40"
            height="60"
            viewBox="0 0 40 60"
            animate={{ y: [0, -2, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 2 + variant * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ellipse cx="20" cy="57" rx="12" ry="3" fill="rgba(0,0,0,0.1)" />
            {/* Body */}
            <rect x="12" y="30" width="16" height="24" rx="3" fill={colors[variant % colors.length]} />
            {/* Head */}
            <circle cx="20" cy="20" r="12" fill="#fcd34d" />
            {/* Hair */}
            <path d={variant % 2 === 0 ? "M8 18 Q12 6 20 5 Q28 6 32 18" : "M8 16 Q10 4 20 4 Q30 4 32 16 L32 22 Q26 20 20 22 Q14 20 8 22 Z"} fill={hairColors[variant % hairColors.length]} />
            {/* Eyes */}
            <circle cx="16" cy="20" r="1.5" fill="#1e293b" />
            <circle cx="24" cy="20" r="1.5" fill="#1e293b" />
            {/* Smile */}
            <path d="M16 25 Q20 28 24 25" stroke="#1e293b" strokeWidth="1" fill="none" />
            {/* Raised hands clapping */}
            <motion.g
              animate={{ rotate: [-10, 10, -10] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{ transformOrigin: '8px 35px' }}
            >
              <rect x="2" y="28" width="10" height="5" rx="2" fill="#fcd34d" />
            </motion.g>
            <motion.g
              animate={{ rotate: [10, -10, 10] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{ transformOrigin: '32px 35px' }}
            >
              <rect x="28" y="28" width="10" height="5" rx="2" fill="#fcd34d" />
            </motion.g>
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Floating music notes ambient
function FloatingMusicNotes({ isDark }: { isDark: boolean }) {
  const notes = ['♪', '♫', '♬', '♩'];
  const colors = isDark
    ? ['#a855f7', '#ec4899', '#8b5cf6', '#f472b6']
    : ['#7c3aed', '#db2777', '#6d28d9', '#ec4899'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-xl"
          style={{
            left: `${10 + (i % 5) * 18}%`,
            bottom: '18%',
            color: colors[i % colors.length],
          }}
          animate={{
            y: [0, -250, -350],
            x: [0, (i % 2 === 0 ? 25 : -25), (i % 2 === 0 ? -15 : 15)],
            opacity: [0, 1, 0],
            rotate: [0, (i % 2 === 0 ? 15 : -15), 0],
          }}
          transition={{
            duration: 5 + (i % 4),
            delay: i * 0.7,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        >
          {notes[i % notes.length]}
        </motion.div>
      ))}
    </div>
  );
}

// Feature pill
function FeaturePill({ icon: Icon, text, delay, isDark }: { icon: React.ElementType; text: string; delay: number; isDark: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs backdrop-blur-md ${
        isDark
          ? 'bg-white/10 border border-white/20 text-white'
          : 'bg-white/70 border border-white/50 text-slate-700 shadow-lg'
      }`}
    >
      <Icon className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      <span className="font-medium">{text}</span>
    </motion.div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, profile, isLoading, isInitialized, initialize } = useAuthStore();

  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [mounted, setMounted] = useState(false);

  // State for characters coming and going
  const [visibleMusicians, setVisibleMusicians] = useState({
    guitarist: true,
    drummer: true,
    keyboardist: true,
    singer: true,
    bassist: true,
  });

  const [visibleAudience, setVisibleAudience] = useState([true, false, true, false, true]);

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize();
    }
  }, [isInitialized, isLoading, initialize]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Randomize musicians and audience
  useEffect(() => {
    const musicianInterval = setInterval(() => {
      setVisibleMusicians(prev => {
        const keys = Object.keys(prev) as Array<keyof typeof prev>;
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        // Keep at least 3 musicians visible
        const visibleCount = Object.values(prev).filter(Boolean).length;
        if (visibleCount <= 3 && prev[randomKey]) return prev;
        return { ...prev, [randomKey]: !prev[randomKey] };
      });
    }, 8000);

    const audienceInterval = setInterval(() => {
      setVisibleAudience(prev => {
        const newState = [...prev];
        const randomIndex = Math.floor(Math.random() * newState.length);
        newState[randomIndex] = !newState[randomIndex];
        return newState;
      });
    }, 5000);

    return () => {
      clearInterval(musicianInterval);
      clearInterval(audienceInterval);
    };
  }, []);

  const handleCreateRoom = useCallback(async () => {
    setIsCreating(true);
    if (user) {
      router.push('/rooms');
    } else {
      const newRoomId = generateRoomId();
      router.push(`/room/${newRoomId}`);
    }
  }, [router, user]);

  const handleJoinRoom = useCallback(() => {
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    }
  }, [router, roomCode]);

  const handleBrowseRooms = useCallback(() => {
    router.push('/rooms');
  }, [router]);

  if (!mounted) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-sky-300 to-amber-100 dark:from-indigo-950 dark:to-purple-900" />
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Scene based on theme - with AnimatePresence for smooth transitions */}
      <AnimatePresence mode="wait">
        {isDark ? <NightScene key="night" /> : <DayScene key="day" />}
      </AnimatePresence>

      {/* Animated Musicians - positioned across the scene with coming/going */}
      <div className="absolute inset-0 pointer-events-none">
        <MusicianCharacter type="guitarist" position="left-[5%] bottom-[6%]" isVisible={visibleMusicians.guitarist} delay={0.2} />
        <MusicianCharacter type="drummer" position="left-[18%] bottom-[4%]" isVisible={visibleMusicians.drummer} delay={0.4} />
        <MusicianCharacter type="keyboardist" position="left-[35%] bottom-[3%]" isVisible={visibleMusicians.keyboardist} delay={0.6} />
        <MusicianCharacter type="singer" position="right-[32%] bottom-[6%]" isVisible={visibleMusicians.singer} delay={0.8} />
        <MusicianCharacter type="bassist" position="right-[8%] bottom-[2%]" isVisible={visibleMusicians.bassist} delay={1} />

        {/* Audience members */}
        <AudienceMember position="left-[12%] bottom-[2%]" variant={0} isVisible={visibleAudience[0]} />
        <AudienceMember position="left-[28%] bottom-[1%]" variant={1} isVisible={visibleAudience[1]} />
        <AudienceMember position="right-[25%] bottom-[2%]" variant={2} isVisible={visibleAudience[2]} />
        <AudienceMember position="right-[18%] bottom-[1%]" variant={3} isVisible={visibleAudience[3]} />
        <AudienceMember position="right-[3%] bottom-[1%]" variant={4} isVisible={visibleAudience[4]} />
      </div>

      {/* Floating music notes */}
      <FloatingMusicNotes isDark={isDark} />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
                <Music className="w-4 h-4 text-white" />
              </div>
              <motion.div
                className="absolute -inset-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-lg opacity-50 blur-lg -z-10"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              OpenStudio
            </span>
          </motion.div>

          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ThemeToggle />
            <UserMenu />
          </motion.div>
        </div>
      </header>

      {/* Main content - SHORTER and WIDER card */}
      <main className="absolute inset-0 flex items-center justify-center z-10 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className={`text-center px-10 py-6 max-w-2xl w-full mx-4 rounded-2xl backdrop-blur-xl ${
            isDark
              ? 'bg-black/40 border border-white/10 shadow-2xl'
              : 'bg-white/60 border border-white/50 shadow-2xl'
          }`}
        >
          {/* Live indicator + headline in one row */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className={`text-xs tracking-wide uppercase font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Live
            </span>
          </div>

          {/* Main headline - more compact */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-3xl md:text-4xl font-bold mb-2 tracking-tight leading-none"
          >
            <span className={`${isDark ? 'text-white' : 'text-slate-800'}`}>Play </span>
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Together
            </span>
          </motion.h1>

          {/* Subtitle - single line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            Real-time jamming worldwide • Sub-30ms latency • Zero downloads
          </motion.p>

          {/* CTA Section - more compact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="space-y-3"
          >
            {/* Welcome message for logged in users */}
            {user && profile && (
              <p className={`text-xs ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                Welcome back, {profile.displayName}!
              </p>
            )}

            {/* Main buttons - horizontal layout */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <motion.button
                onClick={handleCreateRoom}
                disabled={isCreating}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group relative px-5 py-2.5 text-sm font-semibold rounded-xl overflow-hidden shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  animate={{ opacity: isHovering ? 1 : 0.9 }}
                />
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-40 -z-10"
                  animate={{ opacity: isHovering ? 0.7 : 0.3, scale: isHovering ? 1.1 : 1 }}
                />
                <span className="relative flex items-center justify-center gap-1.5 text-white">
                  {isCreating ? (
                    <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <>
                      {user ? <Plus className="w-4 h-4" /> : null}
                      <span>{user ? 'Create Room' : 'Start Jamming'}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>

              {user && (
                <motion.button
                  onClick={handleBrowseRooms}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Browse</span>
                </motion.button>
              )}

              {/* Join input inline */}
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>or</span>
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className={`w-20 text-center text-xs tracking-widest uppercase h-9 ${
                    isDark
                      ? 'bg-white/10 border-white/20 text-white placeholder:text-slate-500'
                      : 'bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  maxLength={8}
                />
                {roomCode.trim() && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleJoinRoom}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Feature pills - smaller */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            className="flex flex-wrap items-center justify-center gap-2 mt-4"
          >
            <FeaturePill icon={Zap} text="Low latency" delay={1.2} isDark={isDark} />
            <FeaturePill icon={Radio} text="AI stems" delay={1.3} isDark={isDark} />
            <FeaturePill icon={Music} text="Backing tracks" delay={1.4} isDark={isDark} />
          </motion.div>
        </motion.div>
      </main>

      {/* Bottom branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        className="absolute bottom-3 left-0 right-0 text-center z-20"
      >
        <p className={`text-[10px] tracking-wide font-medium ${isDark ? 'text-white/40' : 'text-slate-500/60'}`}>
          POWERED BY CLOUDFLARE CALLS
        </p>
      </motion.div>
    </div>
  );
}
