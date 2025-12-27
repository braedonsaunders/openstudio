'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { motion } from 'framer-motion';
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
  const stars = Array.from({ length: 50 }, (_, i) => ({
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 40}%`,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 2,
  }));

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
    <div className="absolute inset-0">
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

      {/* Distant mountains */}
      <svg className="absolute bottom-[25%] left-0 right-0 w-full h-[30%]" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path d="M0 300 L0 180 Q200 80 400 150 Q600 50 800 120 Q1000 40 1200 100 Q1350 60 1440 130 L1440 300 Z" fill="#94a3b8" fillOpacity="0.3" />
        <path d="M0 300 L0 200 Q150 120 350 180 Q550 100 700 160 Q900 80 1100 140 Q1300 100 1440 160 L1440 300 Z" fill="#64748b" fillOpacity="0.3" />
      </svg>

      {/* Forest trees background */}
      <div className="absolute bottom-[20%] left-0 right-0 h-[20%]">
        <svg className="w-full h-full" viewBox="0 0 1440 200" preserveAspectRatio="none">
          {/* Background trees */}
          {Array.from({ length: 20 }).map((_, i) => (
            <g key={i} transform={`translate(${i * 75 + Math.random() * 30}, ${20 + Math.random() * 30})`}>
              <polygon points="30,150 60,0 90,150" fill="#166534" fillOpacity={0.6 + Math.random() * 0.2} />
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

      {/* Animated grass/flowers */}
      <div className="absolute bottom-[5%] left-0 right-0 h-[15%] flex items-end justify-around">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="origin-bottom"
            animate={{
              rotateZ: [-3, 3, -3],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: Math.random(),
            }}
          >
            <svg width="20" height="40" viewBox="0 0 20 40">
              <path d="M10 40 Q8 25 10 10 Q12 0 10 0" stroke="#4ade80" strokeWidth="2" fill="none" />
              {Math.random() > 0.7 && (
                <circle cx="10" cy="5" r="4" fill={['#fbbf24', '#f472b6', '#c084fc', '#60a5fa'][Math.floor(Math.random() * 4)]} />
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
    </div>
  );
}

// Night scene - Tropical beach sunset with city skyline
function NightScene() {
  return (
    <div className="absolute inset-0">
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
          {/* Buildings silhouette */}
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

          {/* Windows - twinkling lights */}
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.rect
              key={i}
              x={50 + (i % 10) * 25 + Math.random() * 15}
              y={40 + Math.floor(i / 10) * 25 + Math.random() * 10}
              width="3"
              height="4"
              fill="#fef08a"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
              }}
            />
          ))}
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.rect
              key={`right-${i}`}
              x={1150 + (i % 10) * 20 + Math.random() * 10}
              y={40 + Math.floor(i / 10) * 25 + Math.random() * 10}
              width="3"
              height="4"
              fill="#fef08a"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1 + Math.random() * 2,
                delay: Math.random() * 2,
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
          {/* Sun reflection on water */}
          <ellipse cx="720" cy="20" rx="150" ry="200" fill="url(#sunReflection)" />
        </svg>

        {/* Animated waves */}
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
            left: `${10 + Math.random() * 80}%`,
            bottom: `${15 + Math.random() * 20}%`,
            background: 'radial-gradient(circle, rgba(250, 204, 21, 0.9), transparent)',
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
            x: [0, Math.random() * 40 - 20, 0],
            y: [0, Math.random() * 30 - 15, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Musician with Guitar - sitting position
function GuitaristCharacter({ position, delay }: { position: 'left' | 'center-left' | 'center' | 'center-right' | 'right'; delay: number }) {
  const positionStyles = {
    'left': 'left-[8%] bottom-[8%]',
    'center-left': 'left-[25%] bottom-[10%]',
    'center': 'left-[45%] bottom-[8%]',
    'center-right': 'left-[62%] bottom-[10%]',
    'right': 'left-[80%] bottom-[8%]',
  };

  return (
    <motion.div
      className={`absolute ${positionStyles[position]}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2, delay, ease: 'easeOut' }}
    >
      <motion.svg
        width="100"
        height="140"
        viewBox="0 0 100 140"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Shadow */}
        <ellipse cx="50" cy="135" rx="30" ry="5" fill="rgba(0,0,0,0.2)" />

        {/* Legs sitting cross-legged */}
        <ellipse cx="35" cy="120" rx="20" ry="8" fill="#1e40af" />
        <ellipse cx="65" cy="120" rx="20" ry="8" fill="#1e40af" />

        {/* Body */}
        <rect x="35" y="70" width="30" height="40" rx="5" fill="#dc2626" />

        {/* Arms */}
        <motion.g
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '35px 80px' }}
        >
          <rect x="15" y="75" width="25" height="10" rx="5" fill="#fcd34d" />
        </motion.g>
        <motion.g
          animate={{ rotate: [2, -2, 2] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '65px 80px' }}
        >
          <rect x="60" y="75" width="25" height="10" rx="5" fill="#fcd34d" />
        </motion.g>

        {/* Head */}
        <circle cx="50" cy="55" r="20" fill="#fcd34d" />

        {/* Hair */}
        <path d="M30 50 Q35 30 50 28 Q65 30 70 50" fill="#451a03" />

        {/* Eyes */}
        <circle cx="43" cy="55" r="3" fill="#1e293b" />
        <circle cx="57" cy="55" r="3" fill="#1e293b" />

        {/* Smile */}
        <path d="M43 62 Q50 68 57 62" stroke="#1e293b" strokeWidth="2" fill="none" />

        {/* Guitar */}
        <motion.g
          animate={{ rotate: [-1, 1, -1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '50px 100px' }}
        >
          <ellipse cx="50" cy="100" rx="18" ry="12" fill="#92400e" />
          <ellipse cx="50" cy="100" rx="5" ry="3" fill="#1e293b" />
          <rect x="48" y="70" width="4" height="30" fill="#78350f" />
          <rect x="45" y="65" width="10" height="8" rx="2" fill="#78350f" />
          {/* Strings */}
          <line x1="47" y1="88" x2="47" y2="110" stroke="#fcd34d" strokeWidth="0.5" />
          <line x1="50" y1="88" x2="50" y2="110" stroke="#fcd34d" strokeWidth="0.5" />
          <line x1="53" y1="88" x2="53" y2="110" stroke="#fcd34d" strokeWidth="0.5" />
        </motion.g>
      </motion.svg>
    </motion.div>
  );
}

// Drummer character
function DrummerCharacter({ position, delay }: { position: string; delay: number }) {
  return (
    <motion.div
      className={`absolute ${position}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2, delay, ease: 'easeOut' }}
    >
      <motion.svg
        width="140"
        height="150"
        viewBox="0 0 140 150"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Shadow */}
        <ellipse cx="70" cy="145" rx="50" ry="5" fill="rgba(0,0,0,0.2)" />

        {/* Drum set base */}
        <ellipse cx="70" cy="130" rx="40" ry="10" fill="#525252" />

        {/* Bass drum */}
        <ellipse cx="70" cy="110" rx="30" ry="25" fill="#1e293b" />
        <ellipse cx="70" cy="110" rx="25" ry="20" fill="#334155" />
        <circle cx="70" cy="110" r="10" fill="#f59e0b" />

        {/* Side drums */}
        <ellipse cx="30" cy="100" rx="15" ry="10" fill="#475569" />
        <ellipse cx="30" cy="95" rx="15" ry="5" fill="#64748b" />
        <ellipse cx="110" cy="100" rx="15" ry="10" fill="#475569" />
        <ellipse cx="110" cy="95" rx="15" ry="5" fill="#64748b" />

        {/* Cymbal */}
        <motion.ellipse
          cx="125"
          cy="70"
          rx="12"
          ry="3"
          fill="#fbbf24"
          animate={{ rotate: [-5, 5, -5], y: [0, 2, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ transformOrigin: '125px 70px' }}
        />
        <line x1="125" y1="70" x2="125" y2="130" stroke="#71717a" strokeWidth="2" />

        {/* Character sitting */}
        <rect x="55" y="50" width="30" height="35" rx="5" fill="#7c3aed" />

        {/* Head */}
        <circle cx="70" cy="35" r="18" fill="#fcd34d" />

        {/* Headband */}
        <rect x="52" y="25" width="36" height="5" rx="2" fill="#ef4444" />

        {/* Eyes */}
        <circle cx="63" cy="35" r="3" fill="#1e293b" />
        <circle cx="77" cy="35" r="3" fill="#1e293b" />

        {/* Excited expression */}
        <ellipse cx="70" cy="42" rx="5" ry="3" fill="#1e293b" />

        {/* Arms with drumsticks */}
        <motion.g
          animate={{ rotate: [-15, 15, -15] }}
          transition={{ duration: 0.4, repeat: Infinity }}
          style={{ transformOrigin: '45px 60px' }}
        >
          <rect x="25" y="55" width="25" height="8" rx="4" fill="#fcd34d" />
          <rect x="15" y="53" width="20" height="3" rx="1" fill="#a16207" />
        </motion.g>
        <motion.g
          animate={{ rotate: [15, -15, 15] }}
          transition={{ duration: 0.35, repeat: Infinity }}
          style={{ transformOrigin: '95px 60px' }}
        >
          <rect x="90" y="55" width="25" height="8" rx="4" fill="#fcd34d" />
          <rect x="105" y="53" width="20" height="3" rx="1" fill="#a16207" />
        </motion.g>

        {/* Legs */}
        <rect x="50" y="80" width="12" height="25" rx="5" fill="#1e40af" />
        <rect x="78" y="80" width="12" height="25" rx="5" fill="#1e40af" />
      </motion.svg>
    </motion.div>
  );
}

// Keyboard player
function KeyboardistCharacter({ position, delay }: { position: string; delay: number }) {
  return (
    <motion.div
      className={`absolute ${position}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2, delay, ease: 'easeOut' }}
    >
      <motion.svg
        width="130"
        height="130"
        viewBox="0 0 130 130"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Shadow */}
        <ellipse cx="65" cy="125" rx="45" ry="5" fill="rgba(0,0,0,0.2)" />

        {/* Keyboard stand */}
        <rect x="10" y="85" width="110" height="5" fill="#525252" />
        <rect x="20" y="90" width="5" height="35" fill="#525252" />
        <rect x="105" y="90" width="5" height="35" fill="#525252" />

        {/* Keyboard */}
        <rect x="15" y="75" width="100" height="15" rx="2" fill="#1e293b" />
        {/* White keys */}
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.rect
            key={i}
            x={17 + i * 7}
            y="77"
            width="6"
            height="11"
            rx="1"
            fill="white"
            animate={{ y: i % 3 === 0 ? [77, 78, 77] : [77, 77, 77] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
        {/* Black keys */}
        {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i, idx) => (
          <rect key={idx} x={21 + i * 7} y="77" width="4" height="6" rx="1" fill="#1e293b" />
        ))}

        {/* Character */}
        <rect x="50" y="35" width="30" height="35" rx="5" fill="#10b981" />

        {/* Head */}
        <circle cx="65" cy="22" r="16" fill="#fcd34d" />

        {/* Glasses */}
        <circle cx="58" cy="22" r="6" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="72" cy="22" r="6" fill="none" stroke="#1e293b" strokeWidth="2" />
        <line x1="64" y1="22" x2="66" y2="22" stroke="#1e293b" strokeWidth="2" />

        {/* Eyes behind glasses */}
        <circle cx="58" cy="22" r="2" fill="#1e293b" />
        <circle cx="72" cy="22" r="2" fill="#1e293b" />

        {/* Smile */}
        <path d="M58 28 Q65 33 72 28" stroke="#1e293b" strokeWidth="1.5" fill="none" />

        {/* Hair */}
        <path d="M49 18 Q55 5 65 5 Q75 5 81 18" fill="#78350f" />

        {/* Arms playing keyboard */}
        <motion.g
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ transformOrigin: '50px 50px' }}
        >
          <rect x="30" y="45" width="25" height="8" rx="4" fill="#fcd34d" />
        </motion.g>
        <motion.g
          animate={{ rotate: [3, -3, 3] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{ transformOrigin: '80px 50px' }}
        >
          <rect x="75" y="45" width="25" height="8" rx="4" fill="#fcd34d" />
        </motion.g>

        {/* Legs on stool */}
        <rect x="55" y="68" width="8" height="20" rx="4" fill="#1e40af" />
        <rect x="67" y="68" width="8" height="20" rx="4" fill="#1e40af" />

        {/* Stool */}
        <rect x="48" y="88" width="34" height="8" rx="2" fill="#78350f" />
      </motion.svg>
    </motion.div>
  );
}

// Singer with microphone
function SingerCharacter({ position, delay }: { position: string; delay: number }) {
  return (
    <motion.div
      className={`absolute ${position}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2, delay, ease: 'easeOut' }}
    >
      <motion.svg
        width="80"
        height="150"
        viewBox="0 0 80 150"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Shadow */}
        <ellipse cx="40" cy="145" rx="20" ry="5" fill="rgba(0,0,0,0.2)" />

        {/* Legs standing */}
        <rect x="28" y="100" width="10" height="40" rx="5" fill="#1e40af" />
        <rect x="42" y="100" width="10" height="40" rx="5" fill="#1e40af" />

        {/* Body swaying */}
        <motion.g
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '40px 100px' }}
        >
          {/* Torso */}
          <path d="M25 60 L30 100 L50 100 L55 60 Q40 55 25 60" fill="#f472b6" />

          {/* Arms */}
          <motion.g
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ transformOrigin: '25px 65px' }}
          >
            <rect x="10" y="60" width="20" height="8" rx="4" fill="#fcd34d" />
          </motion.g>
          <motion.g
            animate={{ rotate: [5, -5, 5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ transformOrigin: '55px 65px' }}
          >
            <rect x="50" y="60" width="20" height="8" rx="4" fill="#fcd34d" />
            {/* Microphone */}
            <rect x="68" y="55" width="5" height="20" rx="2" fill="#525252" />
            <ellipse cx="70" cy="52" rx="6" ry="8" fill="#374151" />
          </motion.g>

          {/* Head */}
          <circle cx="40" cy="42" r="18" fill="#fcd34d" />

          {/* Long hair */}
          <path d="M22 40 Q20 20 40 15 Q60 20 58 40 L58 55 Q50 50 40 55 Q30 50 22 55 Z" fill="#1e293b" />

          {/* Eyes closed - singing */}
          <path d="M32 42 Q35 40 38 42" stroke="#1e293b" strokeWidth="2" fill="none" />
          <path d="M42 42 Q45 40 48 42" stroke="#1e293b" strokeWidth="2" fill="none" />

          {/* Singing mouth */}
          <motion.ellipse
            cx="40"
            cy="50"
            rx="5"
            ry="4"
            fill="#1e293b"
            animate={{ ry: [3, 5, 3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.g>

        {/* Music notes floating */}
        <motion.text
          x="60"
          y="30"
          fontSize="14"
          fill="#f472b6"
          animate={{ y: [30, 15], opacity: [1, 0], x: [60, 70] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        >
          ♪
        </motion.text>
        <motion.text
          x="15"
          y="35"
          fontSize="12"
          fill="#a855f7"
          animate={{ y: [35, 20], opacity: [1, 0], x: [15, 5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
        >
          ♫
        </motion.text>
      </motion.svg>
    </motion.div>
  );
}

// Bass player
function BassistCharacter({ position, delay }: { position: string; delay: number }) {
  return (
    <motion.div
      className={`absolute ${position}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2, delay, ease: 'easeOut' }}
    >
      <motion.svg
        width="90"
        height="160"
        viewBox="0 0 90 160"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Shadow */}
        <ellipse cx="45" cy="155" rx="25" ry="5" fill="rgba(0,0,0,0.2)" />

        {/* Legs */}
        <rect x="32" y="105" width="10" height="45" rx="5" fill="#1e40af" />
        <rect x="48" y="105" width="10" height="45" rx="5" fill="#1e40af" />

        {/* Body swaying slightly */}
        <motion.g
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '45px 105px' }}
        >
          {/* Torso */}
          <rect x="28" y="55" width="34" height="50" rx="5" fill="#0ea5e9" />

          {/* Bass guitar */}
          <motion.g
            animate={{ rotate: [-1, 1, -1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ transformOrigin: '50px 90px' }}
          >
            <ellipse cx="55" cy="100" rx="15" ry="20" fill="#dc2626" />
            <ellipse cx="55" cy="100" rx="4" ry="5" fill="#1e293b" />
            <rect x="52" y="50" width="6" height="50" fill="#78350f" />
            <rect x="48" y="42" width="14" height="12" rx="2" fill="#78350f" />
            {/* Tuning pegs */}
            <circle cx="50" cy="45" r="2" fill="#fcd34d" />
            <circle cx="60" cy="45" r="2" fill="#fcd34d" />
            <circle cx="50" cy="52" r="2" fill="#fcd34d" />
            <circle cx="60" cy="52" r="2" fill="#fcd34d" />
            {/* Strings */}
            <line x1="53" y1="52" x2="53" y2="115" stroke="#e5e7eb" strokeWidth="0.5" />
            <line x1="55" y1="52" x2="55" y2="115" stroke="#e5e7eb" strokeWidth="0.5" />
            <line x1="57" y1="52" x2="57" y2="115" stroke="#e5e7eb" strokeWidth="0.5" />
          </motion.g>

          {/* Arms */}
          <motion.rect
            x="12"
            y="60"
            width="20"
            height="8"
            rx="4"
            fill="#fcd34d"
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ transformOrigin: '28px 64px' }}
          />
          <motion.rect
            x="58"
            y="70"
            width="20"
            height="8"
            rx="4"
            fill="#fcd34d"
            animate={{ y: [70, 75, 70] }}
            transition={{ duration: 1, repeat: Infinity }}
          />

          {/* Head */}
          <circle cx="45" cy="38" r="17" fill="#fcd34d" />

          {/* Beanie hat */}
          <path d="M28 35 Q30 18 45 15 Q60 18 62 35 L60 38 Q45 35 30 38 Z" fill="#4f46e5" />
          <rect x="28" y="33" width="34" height="6" rx="2" fill="#6366f1" />

          {/* Cool sunglasses */}
          <rect x="33" y="36" width="10" height="6" rx="2" fill="#1e293b" />
          <rect x="47" y="36" width="10" height="6" rx="2" fill="#1e293b" />
          <line x1="43" y1="39" x2="47" y2="39" stroke="#1e293b" strokeWidth="2" />

          {/* Slight smile */}
          <path d="M39 48 Q45 52 51 48" stroke="#1e293b" strokeWidth="1.5" fill="none" />
        </motion.g>
      </motion.svg>
    </motion.div>
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
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            left: `${10 + (i % 6) * 15}%`,
            bottom: '20%',
            color: colors[i % colors.length],
          }}
          animate={{
            y: [0, -300, -400],
            x: [0, (i % 2 === 0 ? 30 : -30), (i % 2 === 0 ? -20 : 20)],
            opacity: [0, 1, 0],
            rotate: [0, (i % 2 === 0 ? 20 : -20), 0],
          }}
          transition={{
            duration: 6 + Math.random() * 4,
            delay: i * 0.8,
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm backdrop-blur-md ${
        isDark
          ? 'bg-white/10 border border-white/20 text-white'
          : 'bg-white/70 border border-white/50 text-slate-700 shadow-lg'
      }`}
    >
      <Icon className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
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

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize();
    }
  }, [isInitialized, isLoading, initialize]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateRoom = useCallback(async () => {
    setIsCreating(true);
    // If logged in, go to rooms page to use the create modal
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
      {/* Scene based on theme */}
      {isDark ? <NightScene /> : <DayScene />}

      {/* Animated Musicians - positioned across the scene */}
      <div className="absolute inset-0 pointer-events-none">
        <GuitaristCharacter position="left" delay={0.5} />
        <DrummerCharacter position="left-[20%] bottom-[6%]" delay={0.8} />
        <KeyboardistCharacter position="left-[38%] bottom-[5%]" delay={1.1} />
        <SingerCharacter position="left-[58%] bottom-[8%]" delay={1.4} />
        <BassistCharacter position="left-[75%] bottom-[4%]" delay={1.7} />
      </div>

      {/* Floating music notes */}
      <FloatingMusicNotes isDark={isDark} />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <Music className="w-5 h-5 text-white" />
              </div>
              <motion.div
                className="absolute -inset-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl opacity-50 blur-lg -z-10"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              OpenStudio
            </span>
          </motion.div>

          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ThemeToggle />
            <UserMenu />
          </motion.div>
        </div>
      </header>

      {/* Main content - centered card */}
      <main className="absolute inset-0 flex items-center justify-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className={`text-center px-8 py-10 max-w-xl mx-4 rounded-3xl backdrop-blur-xl ${
            isDark
              ? 'bg-black/40 border border-white/10 shadow-2xl'
              : 'bg-white/60 border border-white/50 shadow-2xl'
          }`}
        >
          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="inline-flex items-center gap-2 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className={`text-sm tracking-wide uppercase font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Live Sessions Active
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight leading-none"
          >
            <span className={`block ${isDark ? 'text-white' : 'text-slate-800'}`}>Play</span>
            <span className="block bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Together
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className={`text-base md:text-lg mb-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
          >
            Real-time jamming with musicians worldwide.
            <br />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Sub-30ms latency. Zero downloads.</span>
          </motion.p>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="space-y-4"
          >
            {/* Welcome message for logged in users */}
            {user && profile && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-sm mb-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
              >
                Welcome back, {profile.displayName}!
              </motion.p>
            )}

            {/* Main buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Create/Start button */}
              <motion.button
                onClick={handleCreateRoom}
                disabled={isCreating}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="group relative px-8 py-4 text-lg font-semibold rounded-2xl overflow-hidden shadow-xl"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Button glow */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  animate={{
                    opacity: isHovering ? 1 : 0.9,
                  }}
                />
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 -z-10"
                  animate={{
                    opacity: isHovering ? 0.8 : 0.4,
                    scale: isHovering ? 1.1 : 1,
                  }}
                />

                <span className="relative flex items-center justify-center gap-2 text-white">
                  {isCreating ? (
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <>
                      {user ? <Plus className="w-5 h-5" /> : null}
                      <span>{user ? 'Create Room' : 'Start Jamming'}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>

              {/* Browse Rooms button - only for logged in users */}
              {user && (
                <motion.button
                  onClick={handleBrowseRooms}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`group flex items-center gap-2 px-6 py-4 text-lg font-semibold rounded-2xl transition-all ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-900/10 hover:bg-slate-900/20 text-slate-900'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Browse Rooms</span>
                </motion.button>
              )}
            </div>

            {/* Join room input */}
            <div className="flex items-center justify-center gap-2">
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>or join</span>
              <div className="relative">
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  className={`w-32 text-center text-sm tracking-widest uppercase ${
                    isDark
                      ? 'bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/20'
                      : 'bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500/20'
                  }`}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  maxLength={8}
                />
              </div>
              {roomCode.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleJoinRoom}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.3 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-8"
          >
            <FeaturePill icon={Zap} text="Sub-30ms latency" delay={1.4} isDark={isDark} />
            <FeaturePill icon={Radio} text="AI stem separation" delay={1.5} isDark={isDark} />
            <FeaturePill icon={Music} text="AI backing tracks" delay={1.6} isDark={isDark} />
          </motion.div>
        </motion.div>
      </main>

      {/* Bottom branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2 }}
        className="absolute bottom-6 left-0 right-0 text-center z-20"
      >
        <p className={`text-xs tracking-wide font-medium ${
          isDark ? 'text-white/50' : 'text-slate-600/70'
        }`}>
          POWERED BY CLOUDFLARE CALLS
        </p>
      </motion.div>
    </div>
  );
}
