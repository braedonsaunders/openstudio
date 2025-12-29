'use client';

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme/ThemeProvider';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { useRoomStore } from '@/stores/room-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
import { useMetronomeStore } from '@/stores/metronome-store';
import type { User } from '@/types';
import {
  Music, Mic, Guitar, Users2, Flame, TreePine, Building2,
  Palmtree, Disc3, Rocket, Sparkles, Volume2, Heart
} from 'lucide-react';
import { Drum, Piano } from '../icons';

// ============================================
// Types & Constants
// ============================================

type SceneType = 'campfire' | 'rooftop' | 'beach' | 'studio' | 'space' | 'forest';

interface AvatarWorldViewProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
}

interface AvatarPosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  isWalking: boolean;
  walkTimer: number;
  idleTimer: number;
  facingRight: boolean;
}

interface SceneConfig {
  id: SceneType;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const SCENES: SceneConfig[] = [
  { id: 'campfire', name: 'Campfire', icon: <Flame className="w-4 h-4" />, description: 'Cozy night jam' },
  { id: 'rooftop', name: 'Rooftop', icon: <Building2 className="w-4 h-4" />, description: 'City vibes' },
  { id: 'beach', name: 'Beach', icon: <Palmtree className="w-4 h-4" />, description: 'Sunset session' },
  { id: 'studio', name: 'Studio', icon: <Disc3 className="w-4 h-4" />, description: 'Pro recording' },
  { id: 'space', name: 'Space', icon: <Rocket className="w-4 h-4" />, description: 'Cosmic journey' },
  { id: 'forest', name: 'Forest', icon: <TreePine className="w-4 h-4" />, description: 'Magical glade' },
];

const INSTRUMENT_ICONS: Record<string, React.ReactNode> = {
  guitar: <Guitar className="w-5 h-5" />,
  bass: <Guitar className="w-5 h-5" />,
  drums: <Drum className="w-5 h-5" />,
  keys: <Piano className="w-5 h-5" />,
  piano: <Piano className="w-5 h-5" />,
  vocals: <Mic className="w-5 h-5" />,
  mic: <Mic className="w-5 h-5" />,
  other: <Music className="w-5 h-5" />,
};

// Walking bounds (percentage of container)
const WALK_BOUNDS = { minX: 15, maxX: 85, minY: 18, maxY: 32 };
const WALK_SPEED = 0.08; // Slower walking
const IDLE_DURATION_MIN = 8000;  // Longer idle times
const IDLE_DURATION_MAX = 15000;
const WALK_DURATION_MIN = 4000;
const WALK_DURATION_MAX = 8000;

// ============================================
// Musical Key Colors
// ============================================

const KEY_COLORS: Record<string, string> = {
  'C': '#ef4444', 'C#': '#f97316', 'Db': '#f97316',
  'D': '#eab308', 'D#': '#84cc16', 'Eb': '#84cc16',
  'E': '#22c55e', 'F': '#14b8a6', 'F#': '#06b6d4', 'Gb': '#06b6d4',
  'G': '#3b82f6', 'G#': '#6366f1', 'Ab': '#6366f1',
  'A': '#8b5cf6', 'A#': '#a855f7', 'Bb': '#a855f7', 'B': '#ec4899',
};

// ============================================
// CSS Keyframes (inject once)
// ============================================

const KEYFRAMES_INJECTED = { current: false };

function injectKeyframes() {
  if (KEYFRAMES_INJECTED.current || typeof document === 'undefined') return;
  KEYFRAMES_INJECTED.current = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes twinkle {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes gentle-pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
    @keyframes drift {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(10px, -5px); }
      50% { transform: translate(5px, 5px); }
      75% { transform: translate(-5px, -3px); }
    }
    @keyframes wave-motion {
      0%, 100% { d: path("M0 100 Q180 60 360 100 Q540 140 720 100 Q900 60 1080 100 Q1260 140 1440 100 L1440 200 L0 200 Z"); }
      50% { d: path("M0 100 Q180 140 360 100 Q540 60 720 100 Q900 140 1080 100 Q1260 60 1440 100 L1440 200 L0 200 Z"); }
    }
    @keyframes slow-rotate {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }
    @keyframes flame-flicker {
      0%, 100% { transform: scaleY(1) scaleX(1); }
      25% { transform: scaleY(1.05) scaleX(0.98); }
      50% { transform: scaleY(0.95) scaleX(1.02); }
      75% { transform: scaleY(1.03) scaleX(0.99); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Throttled Audio Level Hook
// ============================================

function useThrottledAudioLevel(audioLevels: Map<string, number>, throttleMs = 100) {
  const [level, setLevel] = useState(0);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) return;
    lastUpdateRef.current = now;

    let total = 0;
    audioLevels.forEach((l) => { total += l; });
    setLevel(Math.min(total / Math.max(audioLevels.size, 1), 1));
  }, [audioLevels, throttleMs]);

  return level;
}

// ============================================
// Beat Visualization Hook (throttled)
// ============================================

function useBeatPulse() {
  const tempo = useSessionTempoStore(state => state.tempo);
  const beatsPerBar = useSessionTempoStore(state => state.beatsPerBar);
  const currentBeat = useMetronomeStore(state => state.currentBeat);
  const isPlaying = useMetronomeStore(state => state.isPlaying);

  return { beat: currentBeat, beatsPerBar, tempo, isPlaying };
}

// ============================================
// Avatar Walking System (throttled to 30fps)
// ============================================

function useAvatarWalking(users: User[], audioLevels: Map<string, number>) {
  const [positions, setPositions] = useState<Map<string, AvatarPosition>>(new Map());
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Initialize positions for new users
  useEffect(() => {
    setPositions(prev => {
      const next = new Map(prev);
      users.forEach((user, index) => {
        if (!next.has(user.id)) {
          const startX = 30 + (index % 4) * 12;
          const startY = 22 + Math.floor(index / 4) * 4;
          next.set(user.id, {
            x: startX,
            y: startY,
            targetX: startX,
            targetY: startY,
            scale: 0.9,
            isWalking: false,
            walkTimer: IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN),
            idleTimer: 0,
            facingRight: index % 2 === 0,
          });
        }
      });
      const userIds = new Set(users.map(u => u.id));
      next.forEach((_, id) => {
        if (!userIds.has(id)) next.delete(id);
      });
      return next;
    });
  }, [users]);

  // Animation loop throttled to ~30fps
  useEffect(() => {
    const FRAME_TIME = 33; // ~30fps

    const animate = (time: number) => {
      const deltaTime = lastTimeRef.current ? time - lastTimeRef.current : FRAME_TIME;

      if (deltaTime < FRAME_TIME) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      lastTimeRef.current = time;

      setPositions(prev => {
        const next = new Map(prev);
        let hasChanges = false;

        next.forEach((pos, id) => {
          const audioLevel = audioLevels.get(id) || 0;
          const updated = { ...pos };

          if (updated.isWalking) {
            updated.walkTimer -= deltaTime;
            if (updated.walkTimer <= 0) {
              updated.isWalking = false;
              updated.idleTimer = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
              hasChanges = true;
            } else {
              const dx = updated.targetX - updated.x;
              const dy = updated.targetY - updated.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist > 0.5) {
                const speed = WALK_SPEED * (deltaTime / 16);
                updated.x += (dx / dist) * speed;
                updated.y += (dy / dist) * speed;
                updated.facingRight = dx > 0;
                hasChanges = true;
              } else {
                updated.isWalking = false;
                updated.idleTimer = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
              }
            }
          } else {
            updated.idleTimer -= deltaTime;
            if (updated.idleTimer <= 0 && audioLevel < 0.2) {
              updated.isWalking = true;
              updated.walkTimer = WALK_DURATION_MIN + Math.random() * (WALK_DURATION_MAX - WALK_DURATION_MIN);
              updated.targetX = WALK_BOUNDS.minX + Math.random() * (WALK_BOUNDS.maxX - WALK_BOUNDS.minX);
              updated.targetY = WALK_BOUNDS.minY + Math.random() * (WALK_BOUNDS.maxY - WALK_BOUNDS.minY);
              hasChanges = true;
            }
          }

          if (audioLevel > 0.2) {
            updated.isWalking = false;
            updated.idleTimer = IDLE_DURATION_MIN;
          }

          next.set(id, updated);
        });

        return hasChanges ? next : prev;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [audioLevels]);

  return positions;
}

// ============================================
// Static Scene Elements (CSS-animated, no JS)
// ============================================

// Stars using pure CSS animation
function Stars({ count = 50 }: { count?: number }) {
  const stars = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      top: `${(i * 23) % 45}%`,
      size: 1 + (i % 3),
      delay: (i * 0.7) % 8,
      duration: 4 + (i % 4),
    })), [count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Scene: Campfire
// ============================================

function CampfireScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-indigo-950 via-purple-900/90 to-violet-900/70'
          : 'bg-gradient-to-b from-amber-200 via-orange-300/80 to-rose-300/70'
      }`} />

      {/* Stars (dark mode) / Clouds (light mode) */}
      {isDark ? (
        <Stars count={40} />
      ) : (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[15, 35, 65, 85].map((left, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/40"
              style={{
                left: `${left}%`,
                top: `${10 + (i % 2) * 8}%`,
                width: 80 + i * 20,
                height: 30 + i * 5,
                animation: `float ${15 + i * 3}s ease-in-out ${i * 2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Moon/Sun */}
      <div
        className={`absolute top-[8%] left-[12%] w-14 h-14 rounded-full ${
          isDark
            ? 'bg-gradient-to-br from-gray-100 to-gray-300'
            : 'bg-gradient-to-br from-yellow-300 to-orange-400'
        }`}
        style={{
          boxShadow: isDark
            ? '0 0 50px 15px rgba(255, 255, 255, 0.12)'
            : '0 0 60px 20px rgba(255, 180, 100, 0.4)',
          animation: 'gentle-pulse 6s ease-in-out infinite',
        }}
      />

      {/* Mountains */}
      <svg className="absolute bottom-[18%] left-0 right-0 w-full h-[35%]" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path d="M0 300 L0 180 Q200 80 400 150 Q600 50 800 120 Q1000 40 1200 100 Q1350 60 1440 130 L1440 300 Z"
          fill={isDark ? 'rgba(30, 27, 75, 0.6)' : 'rgba(120, 100, 80, 0.4)'} />
        <path d="M0 300 L0 200 Q150 120 350 180 Q550 100 700 160 Q900 80 1100 140 Q1300 100 1440 160 L1440 300 Z"
          fill={isDark ? 'rgba(49, 46, 129, 0.5)' : 'rgba(100, 80, 60, 0.3)'} />
      </svg>

      {/* Ground */}
      <div className={`absolute bottom-0 left-0 right-0 h-[20%] ${
        isDark
          ? 'bg-gradient-to-t from-indigo-950 via-violet-900/80 to-transparent'
          : 'bg-gradient-to-t from-amber-700/60 via-orange-600/40 to-transparent'
      }`} />

      {/* Campfire */}
      <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2">
        <svg width="160" height="130" viewBox="0 0 160 130">
          <rect x="35" y="100" width="90" height="16" rx="8" fill="#78350f" transform="rotate(-8 80 105)" />
          <rect x="35" y="100" width="90" height="16" rx="8" fill="#92400e" transform="rotate(8 80 105)" />
          <ellipse cx="80" cy="95" rx="45" ry="25" fill={keyColor} opacity="0.3" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }} />
          <g style={{ transformOrigin: '80px 100px', animation: 'flame-flicker 2s ease-in-out infinite' }}>
            <ellipse cx="80" cy="70" rx="18" ry="35" fill="url(#flameGrad)" />
            <ellipse cx="65" cy="78" rx="10" ry="22" fill="url(#flameGrad2)" />
            <ellipse cx="95" cy="78" rx="10" ry="22" fill="url(#flameGrad2)" />
          </g>
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

      {/* Fireflies/Particles */}
      {useMemo(() => Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className={`absolute w-1.5 h-1.5 rounded-full ${isDark ? 'bg-yellow-300' : 'bg-orange-400'}`}
          style={{
            left: `${15 + i * 10}%`,
            top: `${35 + (i % 3) * 12}%`,
            boxShadow: isDark ? '0 0 6px 2px rgba(253, 224, 71, 0.5)' : '0 0 6px 2px rgba(251, 146, 60, 0.4)',
            animation: `drift ${8 + i * 2}s ease-in-out ${i}s infinite, gentle-pulse ${3 + i}s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      )), [isDark])}
    </div>
  );
}

// ============================================
// Scene: Rooftop
// ============================================

function RooftopScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const windows = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      x: 60 + (i % 20) * 70,
      y: 140 + Math.floor(i / 20) * 50,
      lit: i % 3 !== 0,
      delay: (i * 0.3) % 5,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950'
          : 'bg-gradient-to-b from-sky-400 via-blue-300 to-indigo-200'
      }`} />

      {isDark ? <Stars count={30} /> : (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[20, 50, 80].map((left, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/50"
              style={{
                left: `${left}%`,
                top: `${5 + i * 4}%`,
                width: 100 + i * 30,
                height: 35 + i * 8,
                animation: `float ${18 + i * 4}s ease-in-out ${i * 3}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* City skyline */}
      <svg className="absolute bottom-[18%] left-0 right-0 w-full h-[55%]" viewBox="0 0 1440 350" preserveAspectRatio="none">
        <g fill={isDark ? 'rgba(30, 30, 50, 0.95)' : 'rgba(100, 116, 139, 0.85)'}>
          <rect x="50" y="180" width="70" height="170" />
          <rect x="150" y="120" width="90" height="230" />
          <rect x="280" y="160" width="60" height="190" />
          <rect x="380" y="100" width="110" height="250" />
          <rect x="530" y="140" width="80" height="210" />
          <rect x="650" y="80" width="100" height="270" />
          <rect x="790" y="130" width="70" height="220" />
          <rect x="900" y="70" width="130" height="280" />
          <rect x="1070" y="110" width="90" height="240" />
          <rect x="1200" y="150" width="80" height="200" />
          <rect x="1320" y="100" width="120" height="250" />
        </g>

        {/* Windows */}
        {windows.map((w, i) => w.lit && (
          <rect
            key={i}
            x={w.x}
            y={w.y}
            width="8"
            height="12"
            fill={isDark ? '#fef9c3' : '#60a5fa'}
            opacity={isDark ? 0.7 : 0.5}
            style={{ animation: `gentle-pulse ${4 + (i % 3)}s ease-in-out ${w.delay}s infinite` }}
          />
        ))}
      </svg>

      {/* Neon signs */}
      <div
        className="absolute top-[32%] left-[18%] text-lg font-bold"
        style={{ color: keyColor, textShadow: `0 0 20px ${keyColor}`, animation: 'gentle-pulse 3s ease-in-out infinite' }}
      >
        LIVE
      </div>

      {/* Rooftop floor */}
      <div className={`absolute bottom-0 left-0 right-0 h-[20%] ${
        isDark
          ? 'bg-gradient-to-t from-slate-800 via-slate-700 to-slate-600'
          : 'bg-gradient-to-t from-slate-400 via-slate-300 to-slate-200'
      }`} />
    </div>
  );
}

// ============================================
// Scene: Beach
// ============================================

function BeachScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-orange-400 via-pink-500 to-purple-700'
          : 'bg-gradient-to-b from-sky-300 via-cyan-200 to-blue-300'
      }`} />

      {/* Sun */}
      <div
        className={`absolute top-[18%] left-1/2 -translate-x-1/2 w-28 h-28 rounded-full ${
          isDark
            ? 'bg-gradient-to-b from-yellow-300 to-orange-500'
            : 'bg-gradient-to-b from-yellow-200 to-yellow-400'
        }`}
        style={{
          boxShadow: isDark
            ? '0 0 60px 20px rgba(255, 180, 100, 0.4)'
            : '0 0 80px 30px rgba(255, 220, 100, 0.5)',
          animation: 'float 8s ease-in-out infinite'
        }}
      />

      {/* Clouds */}
      <svg className="absolute top-[12%] left-[8%] w-32 h-16 opacity-50" viewBox="0 0 120 50" style={{ animation: 'float 12s ease-in-out infinite' }}>
        <ellipse cx="30" cy="30" rx="25" ry="15" fill="white" />
        <ellipse cx="55" cy="25" rx="30" ry="18" fill="white" />
        <ellipse cx="85" cy="30" rx="25" ry="15" fill="white" />
      </svg>

      {/* Ocean */}
      <div className={`absolute bottom-0 left-0 right-0 h-[42%] ${
        isDark
          ? 'bg-gradient-to-b from-cyan-500 via-blue-600 to-blue-900'
          : 'bg-gradient-to-b from-cyan-400 via-blue-400 to-blue-500'
      }`} />

      {/* Waves */}
      <svg className="absolute bottom-[22%] left-0 right-0 w-full h-[20%]" viewBox="0 0 1440 180" preserveAspectRatio="none">
        <path
          d="M0 90 Q180 50 360 90 Q540 130 720 90 Q900 50 1080 90 Q1260 130 1440 90 L1440 180 L0 180 Z"
          fill={isDark ? 'rgba(6, 182, 212, 0.5)' : 'rgba(34, 211, 238, 0.6)'}
          style={{ animation: 'wave-motion 6s ease-in-out infinite' }}
        />
        <path
          d="M0 110 Q200 70 400 110 Q600 150 800 110 Q1000 70 1200 110 Q1400 150 1440 110 L1440 180 L0 180 Z"
          fill={isDark ? 'rgba(14, 165, 233, 0.6)' : 'rgba(56, 189, 248, 0.7)'}
          style={{ animation: 'wave-motion 5s ease-in-out 0.5s infinite reverse' }}
        />
      </svg>

      {/* Beach/sand */}
      <div className={`absolute bottom-0 left-0 right-0 h-[25%] ${
        isDark
          ? 'bg-gradient-to-t from-amber-200 via-amber-300 to-amber-400'
          : 'bg-gradient-to-t from-amber-100 via-amber-200 to-amber-300'
      }`} />

      {/* Palm trees */}
      <svg className="absolute bottom-[23%] left-[6%] w-20 h-40" viewBox="0 0 80 160" style={{ animation: 'float 10s ease-in-out infinite' }}>
        <path d="M38 160 Q40 120 42 80 Q44 40 42 20" stroke="#8B4513" strokeWidth="10" fill="none" />
        <path d="M42 25 Q25 15 8 30" stroke="#228B22" strokeWidth="4" fill="none" />
        <path d="M42 25 Q55 10 75 25" stroke="#228B22" strokeWidth="4" fill="none" />
        <path d="M42 22 Q30 5 15 15" stroke="#2E8B57" strokeWidth="3" fill="none" />
        <path d="M42 22 Q55 5 70 12" stroke="#2E8B57" strokeWidth="3" fill="none" />
      </svg>
    </div>
  );
}

// ============================================
// Scene: Studio
// ============================================

function StudioScene({ keyColor, audioLevel, isDark }: { keyColor: string; audioLevel: number; isDark: boolean }) {
  const vuLevel = Math.floor(audioLevel * 10);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Studio wall */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-black'
          : 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400'
      }`} />

      {/* Acoustic panels */}
      <div className={`absolute inset-0 ${isDark ? 'opacity-15' : 'opacity-10'}`} style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 55px, ${isDark ? '#27272a' : '#94a3b8'} 55px, ${isDark ? '#27272a' : '#94a3b8'} 60px), repeating-linear-gradient(90deg, transparent, transparent 55px, ${isDark ? '#27272a' : '#94a3b8'} 55px, ${isDark ? '#27272a' : '#94a3b8'} 60px)`,
      }} />

      {/* LED strip */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: `linear-gradient(90deg, ${keyColor}, #a855f7, ${keyColor})`, boxShadow: `0 0 15px ${keyColor}` }}
      />

      {/* Mixing console */}
      <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-[65%] h-[22%]">
        <div className={`absolute inset-0 rounded-t-lg border-t border-x ${
          isDark
            ? 'bg-gradient-to-b from-zinc-700 to-zinc-800 border-zinc-600'
            : 'bg-gradient-to-b from-slate-500 to-slate-600 border-slate-400'
        }`} />

        {/* VU meters */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-6">
          {[0, 1].map((ch) => (
            <div key={ch} className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-3 rounded-sm transition-colors duration-150"
                  style={{
                    backgroundColor: i < vuLevel ? (i < 7 ? '#22c55e' : i < 9 ? '#eab308' : '#ef4444') : (isDark ? '#27272a' : '#64748b'),
                    boxShadow: i < vuLevel ? `0 0 4px ${i < 7 ? '#22c55e' : i < 9 ? '#eab308' : '#ef4444'}` : 'none',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Monitor speakers */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          className={`absolute bottom-[42%] w-16 h-28 rounded-lg border flex flex-col items-center justify-center gap-2 ${
            isDark
              ? 'bg-zinc-800 border-zinc-600'
              : 'bg-slate-600 border-slate-500'
          }`}
          style={{ [side < 0 ? 'left' : 'right']: '10%' }}
        >
          <div className={`w-5 h-5 rounded-full border-2 ${isDark ? 'bg-zinc-700 border-zinc-500' : 'bg-slate-500 border-slate-400'}`} />
          <div className={`w-10 h-10 rounded-full border-2 ${isDark ? 'bg-zinc-700 border-zinc-500' : 'bg-slate-500 border-slate-400'}`} />
        </div>
      ))}

      {/* Floor */}
      <div className={`absolute bottom-0 left-0 right-0 h-[20%] ${
        isDark
          ? 'bg-gradient-to-t from-zinc-950 via-zinc-900 to-zinc-800'
          : 'bg-gradient-to-t from-slate-500 via-slate-400 to-slate-300'
      }`} />

      {/* Recording light */}
      <div className={`absolute top-5 right-5 flex items-center gap-2 px-3 py-1.5 rounded-full border ${
        isDark ? 'bg-red-900/40 border-red-500/40' : 'bg-red-100 border-red-300'
      }`}>
        <div
          className="w-2 h-2 rounded-full bg-red-500"
          style={{ animation: audioLevel > 0.1 ? 'gentle-pulse 1s ease-in-out infinite' : 'none', opacity: audioLevel > 0.1 ? 1 : 0.4 }}
        />
        <span className={`text-xs font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>REC</span>
      </div>
    </div>
  );
}

// ============================================
// Scene: Space
// ============================================

function SpaceScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep space / Light sky */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-black via-indigo-950/50 to-purple-950/30'
          : 'bg-gradient-to-b from-indigo-300 via-purple-200 to-pink-200'
      }`} />

      <Stars count={isDark ? 80 : 20} />

      {/* Nebula clouds */}
      <div
        className={`absolute top-0 left-0 w-1/2 h-2/5 ${isDark ? 'opacity-25' : 'opacity-40'}`}
        style={{ background: `radial-gradient(ellipse at 30% 30%, ${keyColor}40 0%, transparent 60%)`, animation: 'float 20s ease-in-out infinite' }}
      />

      {/* Planet */}
      <div className="absolute top-[14%] right-[14%]" style={{ animation: 'float 12s ease-in-out infinite' }}>
        <div
          className={`w-16 h-16 rounded-full ${
            isDark
              ? 'bg-gradient-to-br from-orange-400 via-red-500 to-purple-700'
              : 'bg-gradient-to-br from-pink-300 via-purple-400 to-indigo-400'
          }`}
          style={{ boxShadow: isDark ? '0 0 30px 8px rgba(249, 115, 22, 0.25)' : '0 0 30px 8px rgba(167, 139, 250, 0.4)' }}
        />
      </div>

      {/* Space platform */}
      <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 w-[75%]">
        <div
          className={`h-3 rounded-lg ${
            isDark
              ? 'bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700'
              : 'bg-gradient-to-r from-slate-400 via-slate-300 to-slate-400'
          }`}
          style={{ boxShadow: `0 0 20px ${keyColor}30` }}
        />
        <div className={`h-1.5 mt-1 mx-[5%] rounded ${
          isDark
            ? 'bg-gradient-to-r from-cyan-900 via-cyan-700 to-cyan-900'
            : 'bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400'
        }`} />

        {/* Platform lights */}
        <div className="flex justify-around mt-2 mx-[10%]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? keyColor : '#22d3ee',
                animation: `gentle-pulse 2s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Scene: Forest
// ============================================

function ForestScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Forest canopy */}
      <div className={`absolute inset-0 ${
        isDark
          ? 'bg-gradient-to-b from-emerald-900 via-green-800 to-emerald-950'
          : 'bg-gradient-to-b from-emerald-400 via-green-300 to-emerald-200'
      }`} />

      {/* Dappled light / Sun rays */}
      {useMemo(() => Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${12 + i * 11}%`,
            top: `${8 + (i % 3) * 7}%`,
            width: 40 + i * 8,
            height: 40 + i * 8,
            background: isDark
              ? 'radial-gradient(circle, rgba(254, 249, 195, 0.25) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, transparent 70%)',
            animation: `gentle-pulse ${4 + i}s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      )), [isDark])}

      {/* Trees */}
      <svg className="absolute bottom-[22%] left-0 right-0 w-full h-[55%]" viewBox="0 0 1440 350" preserveAspectRatio="none">
        <g fill={isDark ? 'rgba(5, 46, 22, 0.85)' : 'rgba(22, 101, 52, 0.7)'}>
          {[0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320].map((x, i) => (
            <path key={i} d={`M${x + 50} 350 L${x + 50} ${240 - i * 4} L${x + 20} ${280 - i * 4} L${x + 35} ${280 - i * 4} L${x + 10} ${310 - i * 4} L${x + 90} ${310 - i * 4} L${x + 65} ${280 - i * 4} L${x + 80} ${280 - i * 4} Z`} />
          ))}
        </g>
      </svg>

      {/* Ground */}
      <div className={`absolute bottom-0 left-0 right-0 h-[25%] ${
        isDark
          ? 'bg-gradient-to-t from-emerald-950 via-green-900/80 to-transparent'
          : 'bg-gradient-to-t from-emerald-600/60 via-green-400/40 to-transparent'
      }`} />

      {/* Magic circle */}
      <div
        className="absolute bottom-[8%] left-1/2 w-64 h-20"
        style={{ animation: 'slow-rotate 60s linear infinite' }}
      >
        <svg width="100%" height="100%" viewBox="0 0 260 80">
          <ellipse cx="130" cy="40" rx="120" ry="35" fill="none" stroke={keyColor} strokeWidth="1.5" opacity={isDark ? 0.3 : 0.5} />
          <ellipse cx="130" cy="40" rx="90" ry="25" fill="none" stroke={keyColor} strokeWidth="1" opacity={isDark ? 0.2 : 0.4} />
        </svg>
      </div>

      {/* Fireflies / Butterflies */}
      {useMemo(() => Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${10 + (i * 7)}%`,
            top: `${25 + (i % 4) * 12}%`,
            width: isDark ? 4 : 6,
            height: isDark ? 4 : 6,
            backgroundColor: i % 3 === 0 ? keyColor : (isDark ? '#fef08a' : '#fbbf24'),
            boxShadow: `0 0 6px 2px ${i % 3 === 0 ? keyColor : (isDark ? 'rgba(253, 224, 71, 0.5)' : 'rgba(251, 191, 36, 0.6)')}`,
            animation: `drift ${10 + i * 2}s ease-in-out ${i}s infinite, gentle-pulse ${4 + i}s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      )), [keyColor, isDark])}
    </div>
  );
}

// ============================================
// Walking Avatar
// ============================================

function WalkingAvatar({
  user,
  position,
  audioLevel,
  isCurrentUser,
  keyColor,
}: {
  user: User;
  position: AvatarPosition;
  audioLevel: number;
  isCurrentUser: boolean;
  keyColor: string;
}) {
  const instrumentType = user.instrument || 'other';
  const instrumentIcon = INSTRUMENT_ICONS[instrumentType.toLowerCase()] || INSTRUMENT_ICONS.other;

  return (
    <div
      className="absolute flex flex-col items-center transition-all duration-300 ease-out"
      style={{
        left: `${position.x}%`,
        bottom: `${position.y}%`,
        transform: `scale(${position.scale}) scaleX(${position.facingRight ? 1 : -1})`,
        transformOrigin: 'bottom center',
        zIndex: Math.floor(100 - position.y),
      }}
    >
      {/* Username */}
      <div
        className="absolute -top-7 left-1/2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 whitespace-nowrap"
        style={{ transform: `translateX(-50%) scaleX(${position.facingRight ? 1 : -1})` }}
      >
        <span className="text-[10px] font-medium text-white/90">
          {user.name}
          {isCurrentUser && <span className="text-indigo-400 ml-1">(you)</span>}
        </span>
      </div>

      {/* Avatar */}
      <div className="relative" style={{ animation: position.isWalking ? 'float 0.6s ease-in-out infinite' : 'float 4s ease-in-out infinite' }}>
        {/* Glow */}
        {audioLevel > 0.1 && (
          <div
            className="absolute inset-0 rounded-full blur-xl -z-10"
            style={{
              background: `radial-gradient(circle, ${keyColor} 0%, transparent 70%)`,
              transform: 'scale(1.5)',
              opacity: 0.3 + audioLevel * 0.3,
            }}
          />
        )}

        <div style={{ transform: `scaleX(${position.facingRight ? 1 : -1})` }}>
          <UserAvatar userId={user.id} username={user.name} size={100} variant="fullBody" />
        </div>

        {/* Instrument badge */}
        <div
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white/30"
          style={{
            background: `linear-gradient(135deg, ${keyColor}, #8b5cf6)`,
            transform: `scaleX(${position.facingRight ? 1 : -1})`,
          }}
        >
          <div className="text-white scale-[0.55]">{instrumentIcon}</div>
        </div>
      </div>

      {/* Audio bars */}
      <div className="flex gap-0.5 h-3 mt-1" style={{ transform: `scaleX(${position.facingRight ? 1 : -1})` }}>
        {[0.15, 0.3, 0.45, 0.6, 0.75].map((threshold, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full transition-all duration-100"
            style={{
              height: audioLevel > threshold ? 12 : 4,
              background: `linear-gradient(to top, ${keyColor}, #c4b5fd)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Scene Selector
// ============================================

function SceneSelector({ currentScene, onSceneChange, keyColor }: {
  currentScene: SceneType;
  onSceneChange: (scene: SceneType) => void;
  keyColor: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-[200]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-12 right-0 p-2 rounded-xl backdrop-blur-xl bg-black/70 border border-white/20 shadow-2xl z-[201]"
          >
            <div className="grid grid-cols-2 gap-1.5 w-56">
              {SCENES.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => { onSceneChange(scene.id); setIsOpen(false); }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    currentScene === scene.id ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: currentScene === scene.id ? keyColor : 'rgba(255,255,255,0.1)' }}
                  >
                    {scene.icon}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{scene.name}</div>
                    <div className="text-[9px] text-white/50">{scene.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-xl bg-black/50 border border-white/20 hover:bg-black/60 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-white/80" />
        <span className="text-xs font-medium text-white">{SCENES.find(s => s.id === currentScene)?.name}</span>
      </button>
    </div>
  );
}

// ============================================
// Music Info Display
// ============================================

function MusicInfoDisplay({ tempo, musicalKey, keyScale, keyColor }: {
  tempo: number;
  musicalKey: string | null;
  keyScale: 'major' | 'minor' | null;
  keyColor: string;
}) {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-3 px-3 py-1.5 rounded-xl backdrop-blur-xl bg-black/40 border border-white/15">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: keyColor }} />
        <div className="flex flex-col">
          <span className="text-base font-bold text-white leading-none">{tempo}</span>
          <span className="text-[9px] text-white/50 uppercase">BPM</span>
        </div>
      </div>
      {musicalKey && (
        <>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex flex-col items-center">
            <span className="text-base font-bold leading-none" style={{ color: keyColor }}>{musicalKey}</span>
            <span className="text-[9px] text-white/50 uppercase">{keyScale || 'Key'}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Room Vibe Indicator
// ============================================

function RoomVibeIndicator({ userCount, audioLevel }: { userCount: number; audioLevel: number }) {
  return (
    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/40 border border-white/15">
      <div className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'gentle-pulse 2s ease-in-out infinite' }} />
      <span className="text-xs font-medium text-white/90">{userCount} {userCount === 1 ? 'musician' : 'musicians'}</span>
      {audioLevel > 0.3 && <span className="text-sm">🎵</span>}
    </div>
  );
}

// ============================================
// Beat Indicator
// ============================================

function BeatIndicator({ beat, beatsPerBar, isPlaying }: { beat: number; beatsPerBar: number; isPlaying: boolean }) {
  if (!isPlaying) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/40 border border-white/15">
      {Array.from({ length: beatsPerBar }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full transition-all duration-100"
          style={{
            backgroundColor: i === beat - 1 ? (i === 0 ? '#ef4444' : '#a855f7') : 'rgba(255,255,255,0.2)',
            boxShadow: i === beat - 1 ? `0 0 8px ${i === 0 ? '#ef4444' : '#a855f7'}` : 'none',
            transform: i === beat - 1 ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function AvatarWorldView({ users, currentUser, audioLevels }: AvatarWorldViewProps) {
  const { resolvedTheme } = useTheme();
  const messages = useRoomStore((state) => state.messages);

  // Inject CSS keyframes once
  useEffect(() => { injectKeyframes(); }, []);

  // Musical state
  const tempo = useSessionTempoStore(state => state.tempo);
  const musicalKey = useSessionTempoStore(state => state.key);
  const keyScale = useSessionTempoStore(state => state.keyScale);
  const { beat, beatsPerBar, isPlaying } = useBeatPulse();

  // Scene state
  const [currentScene, setCurrentScene] = useState<SceneType>('campfire');

  // Throttled audio level
  const totalAudioLevel = useThrottledAudioLevel(audioLevels, 100);

  // Key color
  const keyColor = musicalKey ? (KEY_COLORS[musicalKey] || KEY_COLORS['C']) : KEY_COLORS['C'];

  // Users
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList;
  }, [users, currentUser]);

  // Walking positions
  const positions = useAvatarWalking(allUsers, audioLevels);

  // Scene change
  const handleSceneChange = useCallback((scene: SceneType) => {
    setCurrentScene(scene);
  }, []);

  // Dark mode
  const isDark = resolvedTheme === 'dark';

  // Render scene
  const renderScene = () => {
    switch (currentScene) {
      case 'campfire': return <CampfireScene keyColor={keyColor} isDark={isDark} />;
      case 'rooftop': return <RooftopScene keyColor={keyColor} isDark={isDark} />;
      case 'beach': return <BeachScene keyColor={keyColor} isDark={isDark} />;
      case 'studio': return <StudioScene keyColor={keyColor} audioLevel={totalAudioLevel} isDark={isDark} />;
      case 'space': return <SpaceScene keyColor={keyColor} isDark={isDark} />;
      case 'forest': return <ForestScene keyColor={keyColor} isDark={isDark} />;
      default: return <CampfireScene keyColor={keyColor} isDark={isDark} />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-8 px-3 flex items-center border-b border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#12121a] shrink-0">
        <div className="flex items-center gap-2">
          <Users2 className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-medium text-gray-900 dark:text-white">World</span>
          <span className="text-[10px] text-gray-500 dark:text-zinc-500">
            {allUsers.length} musician{allUsers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* World View */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scene */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {renderScene()}
          </motion.div>
        </AnimatePresence>

        {/* Avatars */}
        {allUsers.map((user) => {
          const position = positions.get(user.id);
          if (!position) return null;
          return (
            <WalkingAvatar
              key={user.id}
              user={user}
              position={position}
              audioLevel={audioLevels.get(user.id) || 0}
              isCurrentUser={user.id === currentUser?.id}
              keyColor={keyColor}
            />
          );
        })}

        {/* UI Overlays */}
        <RoomVibeIndicator userCount={allUsers.length} audioLevel={totalAudioLevel} />
        <MusicInfoDisplay tempo={tempo} musicalKey={musicalKey} keyScale={keyScale} keyColor={keyColor} />
        <BeatIndicator beat={beat} beatsPerBar={beatsPerBar} isPlaying={isPlaying} />
        <SceneSelector currentScene={currentScene} onSceneChange={handleSceneChange} keyColor={keyColor} />
      </div>
    </div>
  );
}
