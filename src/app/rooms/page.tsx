'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  ArrowRight,
  Sun,
  Moon,
  Music,
  Users,
  Globe,
  Lock,
  Radio,
  Sparkles,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useAuthStore } from '@/stores/auth-store';
import { CreateRoomModal } from '@/components/rooms';
import { generateRoomId } from '@/lib/utils';
import { getPublicRooms, ROOM_GENRES } from '@/lib/rooms/service';
import type { RoomListItem } from '@/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/user';

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
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </motion.div>
    </motion.button>
  );
}

// Animated stars for night scene
function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        x: `${Math.random() * 100}%`,
        y: `${Math.random() * 50}%`,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2,
      })),
    []
  );

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

// Animated clouds for day scene
function Clouds() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[
        { x: '5%', y: '8%', scale: 0.8, duration: 100, delay: 0 },
        { x: '35%', y: '5%', scale: 0.6, duration: 120, delay: -30 },
        { x: '70%', y: '12%', scale: 0.9, duration: 90, delay: -60 },
        { x: '90%', y: '6%', scale: 0.7, duration: 110, delay: -20 },
      ].map((cloud, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: cloud.x, top: cloud.y, scale: cloud.scale }}
          animate={{ x: ['0%', '100vw'] }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <svg width="100" height="40" viewBox="0 0 120 50" fill="none">
            <ellipse cx="60" cy="35" rx="40" ry="15" fill="white" fillOpacity="0.8" />
            <ellipse cx="40" cy="28" rx="25" ry="18" fill="white" fillOpacity="0.85" />
            <ellipse cx="75" cy="30" rx="22" ry="15" fill="white" fillOpacity="0.8" />
            <ellipse cx="55" cy="22" rx="20" ry="15" fill="white" fillOpacity="0.9" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

// Floating music notes
function FloatingNotes({ isDark }: { isDark: boolean }) {
  const notes = ['♪', '♫', '♬', '♩'];
  const colors = isDark
    ? ['#a855f7', '#ec4899', '#8b5cf6', '#f472b6', '#22d3ee']
    : ['#7c3aed', '#db2777', '#6d28d9', '#ec4899', '#0891b2'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            left: `${5 + (i % 6) * 16}%`,
            bottom: '10%',
            color: colors[i % colors.length],
          }}
          animate={{
            y: [0, -300, -500],
            x: [0, i % 2 === 0 ? 30 : -30, i % 2 === 0 ? -20 : 20],
            opacity: [0, 1, 0],
            rotate: [0, i % 2 === 0 ? 20 : -20, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 6 + (i % 4),
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

// Day Scene
function DayScene() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-amber-100" />

      {/* Sun */}
      <motion.div
        className="absolute top-[10%] right-[15%]"
        animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-200 to-amber-300"
          style={{ boxShadow: '0 0 80px 25px rgba(255, 220, 100, 0.4)' }}
        />
      </motion.div>

      <Clouds />

      {/* Hills */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-[40%]"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
      >
        <path
          d="M0 400 L0 250 Q200 150 400 200 Q600 100 800 180 Q1000 80 1200 150 Q1350 100 1440 180 L1440 400 Z"
          fill="#86efac"
          fillOpacity="0.6"
        />
        <path
          d="M0 400 L0 280 Q150 180 350 240 Q550 160 700 220 Q900 140 1100 200 Q1300 160 1440 220 L1440 400 Z"
          fill="#4ade80"
          fillOpacity="0.7"
        />
        <path
          d="M0 400 L0 320 Q180 260 380 300 Q580 240 780 290 Q980 230 1180 280 Q1320 250 1440 290 L1440 400 Z"
          fill="#22c55e"
        />
      </svg>

      {/* Grass */}
      <div className="absolute bottom-0 left-0 right-0 h-[15%] bg-gradient-to-t from-green-600 to-green-500" />
    </motion.div>
  );
}

// Night Scene
function NightScene() {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 via-60% to-orange-600" />

      <Stars />

      {/* Moon */}
      <motion.div
        className="absolute top-[12%] left-[12%]"
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-300"
          style={{ boxShadow: '0 0 50px 12px rgba(255, 255, 255, 0.15)' }}
        />
      </motion.div>

      {/* City silhouette */}
      <svg
        className="absolute bottom-[25%] left-0 right-0 w-full h-32"
        viewBox="0 0 1440 150"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="buildingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
        </defs>
        <rect x="30" y="50" width="25" height="100" fill="url(#buildingGrad)" />
        <rect x="65" y="30" width="20" height="120" fill="url(#buildingGrad)" />
        <rect x="95" y="60" width="30" height="90" fill="url(#buildingGrad)" />
        <rect x="140" y="20" width="18" height="130" fill="url(#buildingGrad)" />
        <rect x="175" y="70" width="35" height="80" fill="url(#buildingGrad)" />

        <rect x="1200" y="40" width="30" height="110" fill="url(#buildingGrad)" />
        <rect x="1245" y="25" width="22" height="125" fill="url(#buildingGrad)" />
        <rect x="1280" y="55" width="26" height="95" fill="url(#buildingGrad)" />
        <rect x="1320" y="35" width="35" height="115" fill="url(#buildingGrad)" />
        <rect x="1375" y="65" width="25" height="85" fill="url(#buildingGrad)" />
      </svg>

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-indigo-950 via-purple-900/80 to-transparent" />
    </motion.div>
  );
}

// Musician character for room community visualization
function RoomMusician({
  type,
  xOffset,
  delay,
}: {
  type: 'guitarist' | 'drummer' | 'keyboardist' | 'singer' | 'bassist';
  xOffset: number;
  delay: number;
}) {
  const instruments: Record<string, ReactNode> = {
    guitarist: (
      <motion.svg
        width="35"
        height="50"
        viewBox="0 0 70 100"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <ellipse cx="35" cy="95" rx="18" ry="4" fill="rgba(0,0,0,0.15)" />
        <ellipse cx="25" cy="78" rx="12" ry="5" fill="#1e40af" />
        <ellipse cx="45" cy="78" rx="12" ry="5" fill="#1e40af" />
        <rect x="26" y="45" width="18" height="28" rx="3" fill="#dc2626" />
        <circle cx="35" cy="32" r="14" fill="#fcd34d" />
        <path d="M21 28 Q28 15 35 14 Q42 15 49 28" fill="#451a03" />
        <circle cx="30" cy="32" r="2" fill="#1e293b" />
        <circle cx="40" cy="32" r="2" fill="#1e293b" />
        <path d="M30 38 Q35 42 40 38" stroke="#1e293b" strokeWidth="1.5" fill="none" />
        <ellipse cx="35" cy="65" rx="10" ry="7" fill="#92400e" />
        <rect x="33" y="45" width="3" height="20" fill="#78350f" />
      </motion.svg>
    ),
    drummer: (
      <motion.svg
        width="45"
        height="55"
        viewBox="0 0 90 110"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <ellipse cx="45" cy="105" rx="30" ry="4" fill="rgba(0,0,0,0.15)" />
        <ellipse cx="45" cy="88" rx="25" ry="6" fill="#525252" />
        <ellipse cx="45" cy="75" rx="18" ry="15" fill="#334155" />
        <circle cx="45" cy="75" r="6" fill="#f59e0b" />
        <rect x="35" y="35" width="20" height="25" rx="3" fill="#7c3aed" />
        <circle cx="45" cy="22" r="12" fill="#fcd34d" />
        <rect x="33" y="14" width="24" height="4" rx="2" fill="#ef4444" />
        <circle cx="40" cy="22" r="2" fill="#1e293b" />
        <circle cx="50" cy="22" r="2" fill="#1e293b" />
        <ellipse cx="45" cy="28" rx="3" ry="2" fill="#1e293b" />
        <motion.rect
          x="22"
          y="38"
          width="14"
          height="5"
          rx="2"
          fill="#fcd34d"
          animate={{ rotate: [-10, 10, -10] }}
          transition={{ duration: 0.3, repeat: Infinity }}
          style={{ transformOrigin: '32px 41px' }}
        />
        <motion.rect
          x="54"
          y="38"
          width="14"
          height="5"
          rx="2"
          fill="#fcd34d"
          animate={{ rotate: [10, -10, 10] }}
          transition={{ duration: 0.28, repeat: Infinity }}
          style={{ transformOrigin: '58px 41px' }}
        />
      </motion.svg>
    ),
    keyboardist: (
      <motion.svg
        width="42"
        height="48"
        viewBox="0 0 85 95"
        animate={{ y: [0, -1, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <ellipse cx="42" cy="90" rx="28" ry="4" fill="rgba(0,0,0,0.15)" />
        <rect x="10" y="60" width="65" height="3" fill="#525252" />
        <rect x="12" y="50" width="60" height="12" rx="2" fill="#1e293b" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={14 + i * 5.5} y="52" width="4" height="8" rx="1" fill="white" />
        ))}
        <rect x="30" y="22" width="24" height="28" rx="3" fill="#10b981" />
        <circle cx="42" cy="12" r="11" fill="#fcd34d" />
        <circle cx="37" cy="12" r="2" fill="#1e293b" />
        <circle cx="47" cy="12" r="2" fill="#1e293b" />
        <path d="M37 18 Q42 22 47 18" stroke="#1e293b" strokeWidth="1.5" fill="none" />
        <path d="M31 8 Q38 0 42 0 Q46 0 53 8" fill="#78350f" />
      </motion.svg>
    ),
    singer: (
      <motion.svg
        width="30"
        height="55"
        viewBox="0 0 60 110"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <ellipse cx="30" cy="105" rx="14" ry="4" fill="rgba(0,0,0,0.15)" />
        <rect x="22" y="70" width="7" height="32" rx="3" fill="#1e40af" />
        <rect x="31" y="70" width="7" height="32" rx="3" fill="#1e40af" />
        <path d="M20 42 L23 70 L37 70 L40 42 Q30 38 20 42" fill="#f472b6" />
        <circle cx="30" cy="28" r="13" fill="#fcd34d" />
        <path d="M17 26 Q15 12 30 8 Q45 12 43 26 L43 34 Q36 30 30 34 Q24 30 17 34 Z" fill="#1e293b" />
        <circle cx="25" cy="28" r="2" fill="#1e293b" />
        <circle cx="35" cy="28" r="2" fill="#1e293b" />
        <motion.ellipse
          cx="30"
          cy="34"
          rx="3"
          ry="2"
          fill="#1e293b"
          animate={{ scaleY: [0.8, 1.2, 0.8] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <rect x="42" y="38" width="3" height="12" rx="1" fill="#525252" />
        <ellipse cx="44" cy="36" rx="4" ry="5" fill="#374151" />
        <motion.text
          x="44"
          y="18"
          fontSize="10"
          fill="#f472b6"
          animate={{ y: [18, 8], opacity: [1, 0], x: [44, 50] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        >
          ♪
        </motion.text>
      </motion.svg>
    ),
    bassist: (
      <motion.svg
        width="35"
        height="55"
        viewBox="0 0 70 110"
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <ellipse cx="35" cy="105" rx="18" ry="4" fill="rgba(0,0,0,0.15)" />
        <rect x="26" y="72" width="7" height="30" rx="3" fill="#1e40af" />
        <rect x="37" y="72" width="7" height="30" rx="3" fill="#1e40af" />
        <rect x="23" y="38" width="24" height="32" rx="3" fill="#0ea5e9" />
        <ellipse cx="42" cy="68" rx="10" ry="12" fill="#dc2626" />
        <rect x="40" y="35" width="4" height="32" fill="#78350f" />
        <rect x="37" y="28" width="10" height="8" rx="2" fill="#78350f" />
        <circle cx="35" cy="22" r="12" fill="#fcd34d" />
        <path d="M23 20 Q25 8 35 5 Q45 8 47 20 L46 24 Q35 22 24 24 Z" fill="#4f46e5" />
        <rect x="26" cy="22" width="8" height="4" rx="1" fill="#1e293b" />
        <rect x="36" cy="22" width="8" height="4" rx="1" fill="#1e293b" />
        <path d="M31 32 Q35 35 39 32" stroke="#1e293b" strokeWidth="1.5" fill="none" />
      </motion.svg>
    ),
  };

  return (
    <div style={{ transform: `translateX(${xOffset}px)` }} className="relative z-10">
      {instruments[type]}
    </div>
  );
}

// Room community visualization card
function RoomCommunityCard({
  room,
  index,
  onClick,
}: {
  room: RoomListItem;
  index: number;
  onClick: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isLive = room.activeUsers && room.activeUsers > 0;

  // Generate random musician types based on room id
  const musicianTypes: Array<'guitarist' | 'drummer' | 'keyboardist' | 'singer' | 'bassist'> = [
    'guitarist',
    'drummer',
    'keyboardist',
    'singer',
    'bassist',
  ];

  const getMusicians = useCallback(() => {
    const count = Math.min(room.activeUsers || 0, 4);
    if (count === 0) return [];
    const seed = room.id.charCodeAt(0) + room.id.charCodeAt(1);
    return Array.from({ length: count }, (_, i) => musicianTypes[(seed + i) % musicianTypes.length]);
  }, [room.id, room.activeUsers]);

  const musicians = getMusicians();
  const hasUsers = musicians.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -5 }}
      onClick={onClick}
      className={`relative group cursor-pointer rounded-2xl overflow-hidden ${
        isDark
          ? 'bg-gradient-to-b from-gray-800/90 to-gray-900/90 border border-white/10'
          : 'bg-gradient-to-b from-white/90 to-gray-50/90 border border-gray-200'
      } backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all`}
    >
      {/* Scene background */}
      <div className="relative h-36 overflow-hidden">
        {isDark ? (
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900/80 to-purple-950">
            {/* Mini stars */}
            {Array.from({ length: 15 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{ left: `${(i * 7) % 100}%`, top: `${(i * 13) % 60}%` }}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-green-300">
            {/* Mini clouds */}
            <motion.div
              className="absolute top-2 left-4"
              animate={{ x: [0, 20, 0] }}
              transition={{ duration: 10, repeat: Infinity }}
            >
              <svg width="30" height="15" viewBox="0 0 60 30" fill="none">
                <ellipse cx="30" cy="20" rx="20" ry="8" fill="white" fillOpacity="0.7" />
                <ellipse cx="22" cy="15" rx="12" ry="10" fill="white" fillOpacity="0.8" />
              </svg>
            </motion.div>
          </div>
        )}

        {/* Ground/Stage */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-14 ${
            isDark
              ? 'bg-gradient-to-t from-purple-950/90 to-transparent'
              : 'bg-gradient-to-t from-green-600/80 to-transparent'
          }`}
        />

        {/* Musicians standing together OR empty room indicator */}
        {hasUsers ? (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end justify-center gap-0">
            {musicians.map((type, i) => (
              <RoomMusician key={i} type={type} xOffset={(i - musicians.length / 2) * 8} delay={i * 0.2} />
            ))}
          </div>
        ) : (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
            {/* Empty room - show music stand or waiting indicator */}
            <motion.div
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            >
              <svg width="40" height="50" viewBox="0 0 60 70" className="mx-auto mb-1 opacity-60">
                {/* Music stand icon */}
                <rect x="28" y="20" width="4" height="45" fill="currentColor" />
                <rect x="15" y="60" width="30" height="4" rx="2" fill="currentColor" />
                <rect x="10" y="10" width="40" height="25" rx="3" fill="currentColor" fillOpacity="0.3" />
                <path d="M20 18 L25 22 M30 16 L30 24 M35 18 L40 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-medium">Empty</span>
            </motion.div>
          </div>
        )}

        {/* Room name sign/banner */}
        <motion.div
          className="absolute top-3 left-1/2 -translate-x-1/2"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className={`px-3 py-1.5 rounded-lg shadow-lg ${
              isDark ? 'bg-indigo-600/90 text-white' : 'bg-white/95 text-gray-800'
            }`}
          >
            <span className="text-sm font-bold truncate max-w-[160px] block">{room.name}</span>
          </div>
          {/* Sign posts */}
          <div className="flex justify-center gap-20">
            <div className={`w-1 h-4 ${isDark ? 'bg-indigo-400' : 'bg-amber-700'}`} />
            <div className={`w-1 h-4 ${isDark ? 'bg-indigo-400' : 'bg-amber-700'}`} />
          </div>
        </motion.div>

        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/90 backdrop-blur-sm">
            <motion.span
              className="w-2 h-2 bg-white rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-xs font-semibold text-white">LIVE</span>
          </div>
        )}

        {/* Floating music notes */}
        {isLive && (
          <>
            <motion.span
              className={`absolute text-lg ${isDark ? 'text-pink-400' : 'text-purple-500'}`}
              style={{ left: '20%', bottom: '40%' }}
              animate={{ y: [0, -20], opacity: [1, 0], x: [0, -5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            >
              ♪
            </motion.span>
            <motion.span
              className={`absolute text-lg ${isDark ? 'text-cyan-400' : 'text-pink-500'}`}
              style={{ right: '20%', bottom: '40%' }}
              animate={{ y: [0, -25], opacity: [1, 0], x: [0, 5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              ♫
            </motion.span>
          </>
        )}
      </div>

      {/* Room info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {room.creatorName && (
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>by {room.creatorName}</p>
            )}
          </div>
          <div
            className={`shrink-0 p-1.5 rounded-lg ${
              room.isPublic
                ? isDark
                  ? 'bg-green-900/40 text-green-400'
                  : 'bg-green-100 text-green-700'
                : isDark
                  ? 'bg-amber-900/40 text-amber-400'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {room.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Description */}
        {room.description && (
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-slate-600'} line-clamp-2 mb-3`}>
            {room.description}
          </p>
        )}

        {/* Tags & Meta */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {room.genre && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
              }`}
            >
              {room.genre}
            </span>
          )}
          <span
            className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
              isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Users className="w-3 h-3" />
            {room.activeUsers || 0}/{room.maxUsers}
          </span>
        </div>

        {/* Join button */}
        <motion.button
          className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            isLive
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white'
              : isDark
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLive ? 'Join Session' : 'Enter Room'}
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// Hero section with animated characters
function HeroSection({
  isDark,
  user,
  profile,
  onCreateRoom,
  roomCode,
  setRoomCode,
  onQuickJoin,
}: {
  isDark: boolean;
  user: SupabaseUser | null;
  profile: UserProfile | null;
  onCreateRoom: () => void;
  roomCode: string;
  setRoomCode: (code: string) => void;
  onQuickJoin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-10 text-center mb-8"
    >
      {/* Welcome message */}
      {user && profile && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-sm mb-2 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
        >
          Welcome back, {profile.displayName}!
        </motion.p>
      )}

      <h1
        className={`text-4xl md:text-5xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Join the Jam
        </span>
      </h1>

      <p className={`text-base mb-6 max-w-md mx-auto ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
        Find your community, create a room, or jump into a live session
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <motion.button
          onClick={onCreateRoom}
          className="group relative px-6 py-3 rounded-xl font-semibold text-white overflow-hidden shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <motion.div
            className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-40 -z-10"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="relative flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Room
          </span>
        </motion.button>

        {/* Quick join */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
            isDark ? 'bg-white/10 border border-white/20' : 'bg-white/80 border border-gray-200'
          }`}
        >
          <Input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            className={`w-24 text-center text-sm tracking-widest uppercase border-0 bg-transparent ${
              isDark ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'
            }`}
            onKeyDown={(e) => e.key === 'Enter' && onQuickJoin()}
            maxLength={8}
          />
          {roomCode.trim() && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onQuickJoin}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center justify-center gap-2 mt-5"
      >
        {[
          { icon: Zap, text: 'Low Latency' },
          { icon: Radio, text: 'Live Sessions' },
          { icon: Users, text: 'Global Community' },
        ].map((pill, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isDark ? 'bg-white/10 text-white/80' : 'bg-white/70 text-gray-700 shadow-sm'
            }`}
          >
            <pill.icon className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            {pill.text}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// Room browser filters
function RoomFilters({
  isDark,
  searchQuery,
  setSearchQuery,
  selectedGenre,
  setSelectedGenre,
  showFilters,
  setShowFilters,
  onRefresh,
  isLoading,
}: {
  isDark: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedGenre: string;
  setSelectedGenre: (g: string) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean) => void;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-400' : 'text-slate-400'
            }`}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms, genres, or tags..."
            className={`w-full pl-12 pr-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              isDark
                ? 'bg-white/10 border border-white/10 text-white placeholder:text-gray-500'
                : 'bg-white/90 border border-gray-200 text-gray-900 placeholder:text-gray-400'
            }`}
          />
        </div>

        <div className="flex gap-2">
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              showFilters
                ? 'bg-purple-500 text-white'
                : isDark
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-white/90 text-gray-700 hover:bg-white'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </motion.button>

          <motion.button
            onClick={onRefresh}
            disabled={isLoading}
            className={`p-3 rounded-xl transition-all ${
              isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/90 text-gray-700 hover:bg-white'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div
              className={`p-4 rounded-xl ${
                isDark ? 'bg-white/5 border border-white/10' : 'bg-white/80 border border-gray-200'
              }`}
            >
              <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Sparkles className="w-4 h-4 text-purple-500" />
                Genre
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedGenre('')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    !selectedGenre
                      ? 'bg-purple-500 text-white'
                      : isDark
                        ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Genres
                </button>
                {ROOM_GENRES.map((genre) => (
                  <button
                    key={genre.value}
                    onClick={() => setSelectedGenre(genre.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedGenre === genre.value
                        ? 'bg-purple-500 text-white'
                        : isDark
                          ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {genre.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { user, profile, isLoading: authLoading, isInitialized } = useAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Auth initialization is handled by onAuthStateChange in auth-store

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const publicRooms = await getPublicRooms();
      setRooms(publicRooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const filteredRooms = useMemo(() => {
    let result = [...rooms];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (room) =>
          room.name.toLowerCase().includes(query) ||
          room.description?.toLowerCase().includes(query) ||
          room.genre?.toLowerCase().includes(query) ||
          room.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedGenre) {
      result = result.filter((room) => room.genre === selectedGenre);
    }

    // Sort by live first, then by recent
    result.sort((a, b) => {
      const aLive = (a.activeUsers || 0) > 0 ? 1 : 0;
      const bLive = (b.activeUsers || 0) > 0 ? 1 : 0;
      if (bLive !== aLive) return bLive - aLive;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [rooms, searchQuery, selectedGenre]);

  const handleQuickJoin = () => {
    if (roomCode.trim()) {
      router.push(`/room/${roomCode.trim()}`);
    }
  };

  const handleCreateRoom = () => {
    if (user) {
      setShowCreateModal(true);
    } else {
      const newRoomId = generateRoomId();
      router.push(`/room/${newRoomId}`);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  if (!mounted) {
    return <div className={`min-h-screen ${isDark ? 'bg-[#050508]' : 'bg-sky-100'}`} />;
  }

  if (authLoading || !isInitialized) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center transition-colors ${
          isDark ? 'bg-[#050508] text-white' : 'bg-sky-100 text-slate-900'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  const liveCount = filteredRooms.filter((r) => r.activeUsers && r.activeUsers > 0).length;
  const totalMusicians = filteredRooms.reduce((sum, r) => sum + (r.activeUsers || 0), 0);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background scene */}
      <AnimatePresence mode="sync">{isDark ? <NightScene key="night" /> : <DayScene key="day" />}</AnimatePresence>

      {/* Floating music notes */}
      <FloatingNotes isDark={isDark} />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.a
            href="/"
            className="flex items-center gap-2.5"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
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
          </motion.a>

          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <ThemeToggle />
            <UserMenu />
          </motion.div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <HeroSection
            isDark={isDark}
            user={user}
            profile={profile}
            onCreateRoom={handleCreateRoom}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onQuickJoin={handleQuickJoin}
          />

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`flex items-center justify-center gap-6 mb-6 py-3 px-6 rounded-2xl mx-auto max-w-xl ${
              isDark ? 'bg-white/5 border border-white/10' : 'bg-white/60 border border-gray-200'
            }`}
          >
            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <Globe className="w-4 h-4" />
              <span>
                <strong>{filteredRooms.length}</strong> rooms
              </span>
            </div>
            {liveCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>
                  <strong>{liveCount}</strong> live
                </span>
              </div>
            )}
            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              <Users className="w-4 h-4" />
              <span>
                <strong>{totalMusicians}</strong> musicians
              </span>
            </div>
          </motion.div>

          {/* Filters */}
          <RoomFilters
            isDark={isDark}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            onRefresh={fetchRooms}
            isLoading={isLoading}
          />

          {/* Room grid */}
          {isLoading && rooms.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className={`h-72 rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-white/50'}`}
                />
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <div
                className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5 ${
                  isDark ? 'bg-white/10' : 'bg-white/80'
                }`}
              >
                <Music className={`w-10 h-10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>No rooms found</h3>
              <p className={`max-w-md mx-auto mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {searchQuery || selectedGenre
                  ? 'Try adjusting your search or filters to find more rooms.'
                  : 'Be the first to create a room and start jamming!'}
              </p>
              <motion.button
                onClick={handleCreateRoom}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-5 h-5" />
                Create First Room
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredRooms.map((room, index) => (
                <RoomCommunityCard
                  key={room.id}
                  room={room}
                  index={index}
                  onClick={() => handleJoinRoom(room.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Room Modal */}
      <CreateRoomModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
