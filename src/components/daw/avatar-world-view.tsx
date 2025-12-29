'use client';

import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme/ThemeProvider';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { useRoomStore } from '@/stores/room-store';
import type { User } from '@/types';
import { Music, Mic, Guitar, Users2 } from 'lucide-react';
import { Drum, Piano } from '../icons';
import { MainViewSwitcher, type MainViewType } from './main-view-switcher';

interface AvatarWorldViewProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  activeView?: MainViewType;
  onViewChange?: (view: MainViewType) => void;
}

// Instrument icons based on user instrument type
const instrumentIcons: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-6 h-6" />,
  bass: <Guitar className="w-6 h-6" />,
  drums: <Drum className="w-6 h-6" />,
  keys: <Piano className="w-6 h-6" />,
  piano: <Piano className="w-6 h-6" />,
  vocals: <Mic className="w-6 h-6" />,
  mic: <Mic className="w-6 h-6" />,
  other: <Music className="w-6 h-6" />,
};

// Animated campfire with audio-reactive flames
function AnimatedCampfire({ audioLevel }: { audioLevel: number }) {
  const flameScale = 1 + audioLevel * 0.5;
  const sparkCount = Math.floor(audioLevel * 10) + 3;

  return (
    <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-10">
      <svg width="160" height="130" viewBox="0 0 160 130">
        {/* Logs */}
        <rect x="35" y="100" width="90" height="15" rx="7" fill="#78350f" transform="rotate(-8 80 105)" />
        <rect x="35" y="100" width="90" height="15" rx="7" fill="#92400e" transform="rotate(8 80 105)" />
        <rect x="55" y="103" width="50" height="12" rx="6" fill="#451a03" />

        {/* Fire glow - audio reactive */}
        <motion.ellipse
          cx="80"
          cy="95"
          rx={50 + audioLevel * 20}
          ry={25 + audioLevel * 10}
          fill="url(#fireGlow)"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        />

        {/* Flames - audio reactive */}
        <motion.g
          animate={{ scaleY: flameScale }}
          transition={{ duration: 0.1 }}
          style={{ transformOrigin: '80px 100px' }}
        >
          {/* Main center flame */}
          <motion.path
            fill="url(#flameGradient)"
            initial={{ d: "M80 100 Q65 65 72 45 Q80 20 80 10 Q80 20 88 45 Q95 65 80 100" }}
            animate={{
              d: [
                "M80 100 Q65 65 72 45 Q80 20 80 10 Q80 20 88 45 Q95 65 80 100",
                "M80 100 Q62 70 70 48 Q78 25 80 8 Q82 25 90 48 Q98 70 80 100",
                "M80 100 Q68 62 75 42 Q82 18 80 5 Q78 18 85 42 Q92 62 80 100",
                "M80 100 Q65 65 72 45 Q80 20 80 10 Q80 20 88 45 Q95 65 80 100",
              ],
            }}
            transition={{ duration: 0.4 + audioLevel * 0.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Left flame */}
          <motion.path
            fill="url(#flameGradient2)"
            initial={{ d: "M55 100 Q45 78 50 60 Q55 45 55 38 Q55 45 60 60 Q65 78 55 100" }}
            animate={{
              d: [
                "M55 100 Q45 78 50 60 Q55 45 55 38 Q55 45 60 60 Q65 78 55 100",
                "M55 100 Q42 80 48 62 Q54 48 55 40 Q56 48 62 62 Q68 80 55 100",
                "M55 100 Q48 75 53 58 Q58 42 55 36 Q52 42 57 58 Q62 75 55 100",
                "M55 100 Q45 78 50 60 Q55 45 55 38 Q55 45 60 60 Q65 78 55 100",
              ],
            }}
            transition={{ duration: 0.35 + audioLevel * 0.15, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          />

          {/* Right flame */}
          <motion.path
            fill="url(#flameGradient2)"
            initial={{ d: "M105 100 Q115 78 110 60 Q105 45 105 38 Q105 45 100 60 Q95 78 105 100" }}
            animate={{
              d: [
                "M105 100 Q115 78 110 60 Q105 45 105 38 Q105 45 100 60 Q95 78 105 100",
                "M105 100 Q118 80 112 62 Q106 48 105 40 Q104 48 98 62 Q92 80 105 100",
                "M105 100 Q112 75 107 58 Q102 42 105 36 Q108 42 103 58 Q98 75 105 100",
                "M105 100 Q115 78 110 60 Q105 45 105 38 Q105 45 100 60 Q95 78 105 100",
              ],
            }}
            transition={{ duration: 0.38 + audioLevel * 0.12, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </motion.g>

        {/* Sparks - audio reactive count */}
        {Array.from({ length: sparkCount }).map((_, i) => (
          <motion.circle
            key={i}
            cx={70 + i * 4}
            cy="50"
            r="2"
            fill="#fbbf24"
            animate={{
              y: [0, -40, -70],
              x: [0, (i % 2 === 0 ? 15 : -15), (i % 2 === 0 ? 20 : -20)],
              opacity: [1, 0.8, 0],
              scale: [1, 0.8, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.15,
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
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

// Animated stars for night scene
function AnimatedStars() {
  const stars = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 45}%`,
    size: Math.random() * 2.5 + 1,
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
            scale: [1, 1.3, 1],
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

// Floating music notes - audio reactive
function FloatingMusicNotes({ audioLevel }: { audioLevel: number }) {
  const notes = ['♪', '♫', '♬', '♩', '🎵', '🎶'];
  const colors = ['#a855f7', '#ec4899', '#8b5cf6', '#f472b6', '#6366f1', '#14b8a6'];
  const noteCount = Math.floor(audioLevel * 15) + 5;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: noteCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          style={{
            left: `${8 + (i % 8) * 12}%`,
            bottom: '12%',
            color: colors[i % colors.length],
          }}
          animate={{
            y: [0, -300 - audioLevel * 100, -450],
            x: [0, (i % 2 === 0 ? 30 : -30) * (1 + audioLevel), (i % 2 === 0 ? -20 : 20)],
            opacity: [0, 1, 0],
            rotate: [0, (i % 2 === 0 ? 20 : -20), 0],
            scale: [0.5, 1 + audioLevel * 0.3, 0.3],
          }}
          transition={{
            duration: 4 + (i % 3) - audioLevel,
            delay: i * 0.4,
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

// Chat bubble that floats up
function ChatBubble({ message, index }: { message: { content: string; userName: string }; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.5 }}
      transition={{ duration: 0.5 }}
      className="absolute backdrop-blur-md bg-white/20 dark:bg-black/30 border border-white/30 dark:border-white/10 rounded-2xl px-4 py-2 max-w-48 shadow-xl"
      style={{
        left: `${15 + (index % 5) * 15}%`,
        bottom: `${25 + (index % 3) * 8}%`,
      }}
    >
      <p className="text-xs font-medium text-white/90 truncate">{message.content}</p>
      <span className="text-[10px] text-white/60">{message.userName}</span>
      {/* Speech bubble tail */}
      <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white/20 dark:bg-black/30 rotate-45 border-r border-b border-white/30 dark:border-white/10" />
    </motion.div>
  );
}

// User avatar with instrument animation
function UserAvatar({
  user,
  position,
  audioLevel,
  isCurrentUser,
}: {
  user: User;
  position: { x: string; y: string; scale: number };
  audioLevel: number;
  isCurrentUser: boolean;
}) {
  const instrumentType = user.instrument || 'other';
  const instrumentIcon = instrumentIcons[instrumentType.toLowerCase()] || instrumentIcons.other;
  const glowIntensity = audioLevel * 100;

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-2"
      style={{
        left: position.x,
        bottom: position.y,
        transform: `scale(${position.scale})`,
        transformOrigin: 'bottom center',
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Username label */}
      <motion.div
        className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/20"
        animate={{ y: [-2, 2, -2] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-[10px] font-medium text-white/90">
          {user.name}
          {isCurrentUser && <span className="text-indigo-400 ml-1">(you)</span>}
        </span>
      </motion.div>

      {/* Avatar with glow */}
      <motion.div
        className="relative"
        animate={{
          y: [-3, 3, -3],
          rotate: audioLevel > 0.3 ? [-2, 2, -2] : 0,
        }}
        transition={{
          duration: 2 + Math.random(),
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Audio reactive glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl"
          style={{
            background: `radial-gradient(circle, rgba(99, 102, 241, ${audioLevel * 0.8}) 0%, transparent 70%)`,
          }}
          animate={{
            scale: [1, 1.2 + audioLevel * 0.5, 1],
            opacity: [0.5, audioLevel, 0.5],
          }}
          transition={{ duration: 0.3, repeat: Infinity }}
        />

        <div className="relative">
          <UserAvatar
            userId={user.id}
            username={user.name}
            size={128}
            variant="fullBody"
          />
        </div>

        {/* Instrument indicator with audio animation */}
        <motion.div
          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white/30"
          animate={{
            scale: audioLevel > 0.2 ? [1, 1.2, 1] : 1,
            rotate: audioLevel > 0.4 ? [-5, 5, -5] : 0,
          }}
          transition={{ duration: 0.2, repeat: Infinity }}
          style={{
            boxShadow: `0 0 ${glowIntensity}px rgba(99, 102, 241, ${audioLevel})`,
          }}
        >
          <div className="text-white scale-75">{instrumentIcon}</div>
        </motion.div>
      </motion.div>

      {/* Audio level indicator bars */}
      <div className="flex gap-0.5 h-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full"
            animate={{
              height: audioLevel > (i + 1) * 0.2 ? [4, 16, 4] : 4,
            }}
            transition={{
              duration: 0.2,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Main stage/scene component
function JamScene({ isDark }: { isDark: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky gradient */}
      <div
        className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-indigo-950 via-purple-900/80 to-violet-900/60'
            : 'bg-gradient-to-b from-sky-400 via-sky-300 to-amber-200'
        }`}
      />

      {/* Stars (night only) */}
      {isDark && <AnimatedStars />}

      {/* Moon (night) or Sun (day) */}
      <motion.div
        className={`absolute ${isDark ? 'top-[8%] left-[12%]' : 'top-[8%] right-[15%]'}`}
        animate={{
          opacity: [0.85, 1, 0.85],
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className={`rounded-full ${
            isDark
              ? 'w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-300'
              : 'w-24 h-24 bg-gradient-to-br from-yellow-200 to-amber-400'
          }`}
          style={{
            boxShadow: isDark
              ? '0 0 60px 15px rgba(255, 255, 255, 0.15)'
              : '0 0 100px 30px rgba(255, 220, 100, 0.4)',
          }}
        />
      </motion.div>

      {/* Mountains/hills in background */}
      <svg
        className="absolute bottom-[20%] left-0 right-0 w-full h-[35%]"
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
      >
        <path
          d="M0 300 L0 180 Q200 80 400 150 Q600 50 800 120 Q1000 40 1200 100 Q1350 60 1440 130 L1440 300 Z"
          fill={isDark ? 'rgba(30, 27, 75, 0.5)' : 'rgba(100, 116, 139, 0.3)'}
        />
        <path
          d="M0 300 L0 200 Q150 120 350 180 Q550 100 700 160 Q900 80 1100 140 Q1300 100 1440 160 L1440 300 Z"
          fill={isDark ? 'rgba(49, 46, 129, 0.4)' : 'rgba(148, 163, 184, 0.3)'}
        />
      </svg>

      {/* Ground */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-[22%] ${
          isDark
            ? 'bg-gradient-to-t from-indigo-950 via-violet-900/80 to-transparent'
            : 'bg-gradient-to-t from-amber-800/60 via-amber-700/40 to-transparent'
        }`}
      />

      {/* Grass/sand texture */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full h-[12%]"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
      >
        <ellipse
          cx="720"
          cy="150"
          rx="900"
          ry="100"
          fill={isDark ? '#1e1b4b' : '#92400e'}
          fillOpacity="0.5"
        />
      </svg>
    </div>
  );
}

export function AvatarWorldView({ users, currentUser, audioLevels, activeView, onViewChange }: AvatarWorldViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const messages = useRoomStore((state) => state.messages);

  // Combine current user with other users
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList;
  }, [users, currentUser]);

  // Get total audio level for ambient effects
  const totalAudioLevel = useMemo(() => {
    let total = 0;
    audioLevels.forEach((level) => {
      total += level;
    });
    return Math.min(total / Math.max(audioLevels.size, 1), 1);
  }, [audioLevels]);

  // Get recent chat messages for bubbles
  const recentMessages = useMemo(() => {
    return messages
      .filter((m) => m.type === 'chat')
      .slice(-5)
      .map((m) => ({
        content: m.content,
        userName: allUsers.find(u => u.id === m.userId)?.name || 'User',
      }));
  }, [messages, allUsers]);

  // Calculate positions for users in a semicircle around the campfire
  const userPositions = useMemo(() => {
    const positions: { x: string; y: string; scale: number }[] = [];
    const totalUsers = allUsers.length;

    // Create a semicircle arrangement
    allUsers.forEach((_, index) => {
      const angle = Math.PI * 0.15 + (Math.PI * 0.7 * index) / Math.max(totalUsers - 1, 1);
      const radius = 35; // % from center
      const x = 50 + Math.cos(angle) * radius;
      const y = 18 + Math.sin(angle) * 8; // Keep in lower portion
      const scale = 0.7 + Math.sin(angle) * 0.3; // Smaller on sides

      positions.push({
        x: `${x}%`,
        y: `${y}%`,
        scale,
      });
    });

    return positions;
  }, [allUsers]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-8 px-3 flex items-center border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <div className="flex items-center gap-2">
          <Users2 className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            World
          </span>
          <span className="text-[10px] text-gray-500 dark:text-zinc-500">
            {allUsers.length} musician{allUsers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* World View Content */}
      <div className="relative flex-1 overflow-hidden">
        {/* Main scene */}
        <JamScene isDark={isDark} />

      {/* Floating music notes - audio reactive */}
      <FloatingMusicNotes audioLevel={totalAudioLevel} />

      {/* Campfire with audio-reactive flames */}
      <AnimatedCampfire audioLevel={totalAudioLevel} />

      {/* User avatars arranged around the campfire */}
      <AnimatePresence>
        {allUsers.map((user, index) => (
          <UserAvatar
            key={user.id}
            user={user}
            position={userPositions[index] || { x: '50%', y: '20%', scale: 1 }}
            audioLevel={audioLevels.get(user.id) || 0}
            isCurrentUser={user.id === currentUser?.id}
          />
        ))}
      </AnimatePresence>

      {/* Chat bubbles floating */}
      <AnimatePresence>
        {recentMessages.slice(-3).map((msg, index) => (
          <ChatBubble key={`${msg.content}-${index}`} message={msg} index={index} />
        ))}
      </AnimatePresence>

      {/* Room vibe indicator */}
      <motion.div
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-black/30 border border-white/20"
        animate={{
          scale: totalAudioLevel > 0.5 ? [1, 1.05, 1] : 1,
        }}
        transition={{ duration: 0.3, repeat: Infinity }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-green-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className="text-xs font-medium text-white/90">
          {allUsers.length} {allUsers.length === 1 ? 'musician' : 'musicians'} jamming
        </span>
        {totalAudioLevel > 0.3 && (
          <motion.span
            className="text-xs"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            🔥
          </motion.span>
        )}
      </motion.div>

      {/* Audio visualizer bar at bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 p-2 rounded-xl backdrop-blur-md bg-black/20 border border-white/10">
        {Array.from({ length: 20 }).map((_, i) => {
          const level = totalAudioLevel * (0.5 + Math.sin(i * 0.5 + Date.now() * 0.01) * 0.5);
          return (
            <motion.div
              key={i}
              className="w-1.5 rounded-full bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500"
              animate={{
                height: [8, 8 + level * 32, 8],
              }}
              transition={{
                duration: 0.15,
                repeat: Infinity,
                delay: i * 0.02,
              }}
            />
          );
        })}
      </div>

      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, 20],
              x: [-10, 10],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
