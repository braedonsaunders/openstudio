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

// Ground configuration for perspective-based walking
interface GroundConfig {
  horizonY: number;      // Where horizon line is (% from top)
  walkableMinY: number;  // Near horizon (far away, % from top)
  walkableMaxY: number;  // Near camera (close, % from top)
  minScale: number;      // Scale at horizon (far)
  maxScale: number;      // Scale at front (close)
}

const SCENE_GROUNDS: Record<SceneType, GroundConfig> = {
  campfire: {
    horizonY: 28,
    walkableMinY: 32,
    walkableMaxY: 78,
    minScale: 0.5,
    maxScale: 1.15,
  },
  rooftop: {
    horizonY: 25,
    walkableMinY: 30,
    walkableMaxY: 75,
    minScale: 0.5,
    maxScale: 1.1,
  },
  beach: {
    horizonY: 32,
    walkableMinY: 38,
    walkableMaxY: 82,
    minScale: 0.45,
    maxScale: 1.2,
  },
  studio: {
    horizonY: 22,
    walkableMinY: 28,
    walkableMaxY: 75,
    minScale: 0.55,
    maxScale: 1.05,
  },
  space: {
    horizonY: 30,
    walkableMinY: 35,
    walkableMaxY: 78,
    minScale: 0.5,
    maxScale: 1.1,
  },
  forest: {
    horizonY: 30,
    walkableMinY: 35,
    walkableMaxY: 80,
    minScale: 0.5,
    maxScale: 1.15,
  },
};

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

// Walking configuration
const WALK_X_BOUNDS = { minX: 10, maxX: 90 };
const WALK_SPEED = 0.06; // Smooth walking
const IDLE_DURATION_MIN = 6000;
const IDLE_DURATION_MAX = 12000;
const WALK_DURATION_MIN = 3000;
const WALK_DURATION_MAX = 6000;

// Calculate perspective scale based on Y position
function calculatePerspectiveScale(yPosition: number, config: GroundConfig): number {
  const normalized = (yPosition - config.walkableMinY) / (config.walkableMaxY - config.walkableMinY);
  const clamped = Math.max(0, Math.min(1, normalized));
  return config.minScale + (config.maxScale - config.minScale) * clamped;
}

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

function useAvatarWalking(users: User[], audioLevels: Map<string, number>, sceneType: SceneType) {
  const [positions, setPositions] = useState<Map<string, AvatarPosition>>(new Map());
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const groundConfig = SCENE_GROUNDS[sceneType];

  // Initialize positions for new users
  useEffect(() => {
    setPositions(prev => {
      const next = new Map(prev);
      const config = SCENE_GROUNDS[sceneType];
      users.forEach((user, index) => {
        if (!next.has(user.id)) {
          // Spread users across the ground area
          const startX = 25 + (index % 5) * 12;
          const startY = config.walkableMinY + 10 + (Math.floor(index / 5) * 8);
          next.set(user.id, {
            x: startX,
            y: Math.min(startY, config.walkableMaxY - 5),
            targetX: startX,
            targetY: startY,
            scale: calculatePerspectiveScale(startY, config),
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
  }, [users, sceneType]);

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
                // Speed varies with depth - slower at back for perspective
                const depthFactor = 0.6 + (updated.y - groundConfig.walkableMinY) /
                  (groundConfig.walkableMaxY - groundConfig.walkableMinY) * 0.4;
                const speed = WALK_SPEED * depthFactor * (deltaTime / 16);
                updated.x += (dx / dist) * speed;
                updated.y += (dy / dist) * speed;
                updated.scale = calculatePerspectiveScale(updated.y, groundConfig);
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
              updated.targetX = WALK_X_BOUNDS.minX + Math.random() * (WALK_X_BOUNDS.maxX - WALK_X_BOUNDS.minX);
              updated.targetY = groundConfig.walkableMinY + Math.random() * (groundConfig.walkableMaxY - groundConfig.walkableMinY);
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
  }, [audioLevels, groundConfig]);

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
// Scene: Campfire (Ground-dominant forest clearing)
// ============================================

function CampfireScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const config = SCENE_GROUNDS.campfire;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky - compact at top */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-indigo-950 via-purple-900 to-violet-800'
            : 'bg-gradient-to-b from-amber-200 via-orange-300 to-rose-400'
        }`} />

        {/* Stars (dark mode) */}
        {isDark && <Stars count={25} />}

        {/* Moon/Sun */}
        <div
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
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: `${config.horizonY}%` }}
      >
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

        {/* Campfire - positioned in mid-ground */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '25%' }}>
          <svg width="120" height="100" viewBox="0 0 120 100">
            {/* Log base */}
            <rect x="25" y="75" width="70" height="12" rx="6" fill="#78350f" transform="rotate(-6 60 80)" />
            <rect x="25" y="75" width="70" height="12" rx="6" fill="#92400e" transform="rotate(6 60 80)" />
            {/* Fire glow */}
            <ellipse cx="60" cy="70" rx="35" ry="20" fill={keyColor} opacity="0.25" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }} />
            {/* Flames */}
            <g style={{ transformOrigin: '60px 75px', animation: 'flame-flicker 2s ease-in-out infinite' }}>
              <ellipse cx="60" cy="50" rx="14" ry="28" fill="url(#flameGrad)" />
              <ellipse cx="48" cy="56" rx="8" ry="18" fill="url(#flameGrad2)" />
              <ellipse cx="72" cy="56" rx="8" ry="18" fill="url(#flameGrad2)" />
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

        {/* Sitting logs around campfire */}
        {useMemo(() => [
          { x: 30, y: 35, rotation: -15, scale: 0.6 },
          { x: 62, y: 38, rotation: 20, scale: 0.55 },
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
      {useMemo(() => Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className={`absolute w-1.5 h-1.5 rounded-full ${isDark ? 'bg-yellow-300' : 'bg-orange-400'}`}
          style={{
            left: `${10 + (i * 7)}%`,
            top: `${30 + (i % 5) * 12}%`,
            boxShadow: isDark ? '0 0 6px 2px rgba(253, 224, 71, 0.5)' : '0 0 6px 2px rgba(251, 146, 60, 0.4)',
            animation: `drift ${8 + i * 1.5}s ease-in-out ${i * 0.7}s infinite, gentle-pulse ${3 + (i % 3)}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      )), [isDark])}
    </div>
  );
}

// ============================================
// Scene: Rooftop (Urban terrace with city view)
// ============================================

function RooftopScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const config = SCENE_GROUNDS.rooftop;

  const windows = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      x: 50 + (i % 10) * 130,
      y: 30 + Math.floor(i / 10) * 35,
      lit: i % 3 !== 0,
      delay: (i * 0.3) % 5,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky - compact at top */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-900'
            : 'bg-gradient-to-b from-sky-400 via-blue-300 to-indigo-300'
        }`} />

        {isDark && <Stars count={20} />}

        {/* City skyline at horizon */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[80%]" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <g fill={isDark ? 'rgba(20, 20, 35, 0.95)' : 'rgba(80, 90, 100, 0.8)'}>
            <rect x="30" y="80" width="50" height="120" />
            <rect x="100" y="50" width="70" height="150" />
            <rect x="200" y="70" width="45" height="130" />
            <rect x="280" y="30" width="80" height="170" />
            <rect x="400" y="60" width="55" height="140" />
            <rect x="490" y="20" width="90" height="180" />
            <rect x="620" y="50" width="60" height="150" />
            <rect x="720" y="40" width="100" height="160" />
            <rect x="860" y="60" width="70" height="140" />
            <rect x="970" y="25" width="85" height="175" />
            <rect x="1100" y="55" width="65" height="145" />
            <rect x="1200" y="35" width="95" height="165" />
            <rect x="1330" y="50" width="110" height="150" />
          </g>
          {/* Windows on buildings */}
          {windows.map((w, i) => w.lit && (
            <rect
              key={i}
              x={w.x}
              y={w.y}
              width="6"
              height="10"
              fill={isDark ? '#fef9c3' : '#60a5fa'}
              opacity={isDark ? 0.6 : 0.4}
              style={{ animation: `gentle-pulse ${4 + (i % 3)}s ease-in-out ${w.delay}s infinite` }}
            />
          ))}
        </svg>

        {/* Neon signs on distant buildings */}
        <div
          className="absolute bottom-[30%] left-[15%] text-sm font-bold"
          style={{ color: keyColor, textShadow: `0 0 15px ${keyColor}`, animation: 'gentle-pulse 3s ease-in-out infinite' }}
        >
          LIVE
        </div>
        <div
          className="absolute bottom-[40%] right-[20%] text-xs font-bold"
          style={{ color: '#ec4899', textShadow: '0 0 12px #ec4899', animation: 'gentle-pulse 4s ease-in-out 1s infinite' }}
        >
          MUSIC
        </div>
      </div>

      {/* Rooftop floor - large terrace area */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: `${config.horizonY}%` }}
      >
        {/* Concrete floor with perspective */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900'
            : 'bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500'
        }`} />

        {/* Floor tile grid lines */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Horizontal lines - closer together at horizon */}
          {[0.05, 0.12, 0.22, 0.35, 0.52, 0.75].map((y, i) => (
            <line
              key={`h-${i}`}
              x1="0%"
              x2="100%"
              y1={`${y * 100}%`}
              y2={`${y * 100}%`}
              stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
              strokeWidth="1"
            />
          ))}
          {/* Converging vertical lines */}
          {[-50, -30, -15, 0, 15, 30, 50].map((offset, i) => (
            <line
              key={`v-${i}`}
              x1="50%"
              y1="0%"
              x2={`${50 + offset}%`}
              y2="100%"
              stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Railing at horizon */}
        <div className="absolute top-0 left-0 right-0 h-3 flex items-end">
          <div className={`w-full h-1.5 ${isDark ? 'bg-slate-600' : 'bg-slate-400'}`} />
        </div>

        {/* String lights across the terrace */}
        <svg className="absolute top-[5%] left-0 right-0 w-full h-[15%]" viewBox="0 0 1000 50" preserveAspectRatio="none">
          <path
            d="M0 20 Q250 35 500 20 Q750 35 1000 20"
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}
            strokeWidth="1"
          />
          {[80, 180, 280, 380, 480, 580, 680, 780, 880].map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={x % 200 < 100 ? 25 : 30}
              r="4"
              fill={i % 3 === 0 ? keyColor : (i % 3 === 1 ? '#fbbf24' : '#f472b6')}
              style={{ animation: `gentle-pulse ${2 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` }}
            />
          ))}
        </svg>

        {/* Lounge furniture at different depths */}
        {useMemo(() => [
          { x: 15, y: 30, type: 'couch', scale: 0.5 },
          { x: 80, y: 35, type: 'table', scale: 0.55 },
          { x: 25, y: 60, type: 'chair', scale: 0.7 },
          { x: 75, y: 65, type: 'plant', scale: 0.75 },
        ].map((item, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `scale(${item.scale})`,
              opacity: 0.4 + item.scale * 0.4,
            }}
          >
            {item.type === 'couch' && (
              <div className={`w-20 h-6 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-400'}`} />
            )}
            {item.type === 'table' && (
              <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-amber-900/60' : 'bg-amber-700/50'}`} />
            )}
            {item.type === 'chair' && (
              <div className={`w-8 h-8 rounded ${isDark ? 'bg-slate-600' : 'bg-slate-400'}`} />
            )}
            {item.type === 'plant' && (
              <div className="relative">
                <div className={`w-6 h-8 rounded-b-lg ${isDark ? 'bg-slate-600' : 'bg-slate-400'}`} />
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-6 rounded-full bg-green-600/60" />
              </div>
            )}
          </div>
        )), [isDark])}

        {/* LED strip along edges */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, transparent, ${keyColor}, transparent)`, opacity: 0.6 }}
        />
      </div>
    </div>
  );
}

// ============================================
// Scene: Beach (Sandy shore with ocean horizon)
// ============================================

function BeachScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const config = SCENE_GROUNDS.beach;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky + Ocean at horizon */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
        {/* Sky gradient */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-orange-400 via-pink-500 to-purple-600'
            : 'bg-gradient-to-b from-sky-300 via-cyan-200 to-blue-300'
        }`} />

        {/* Sun/Moon at horizon */}
        <div
          className={`absolute bottom-[15%] left-1/2 -translate-x-1/2 w-16 h-16 rounded-full ${
            isDark
              ? 'bg-gradient-to-b from-yellow-300 to-orange-500'
              : 'bg-gradient-to-b from-yellow-200 to-yellow-400'
          }`}
          style={{
            boxShadow: isDark
              ? '0 0 40px 15px rgba(255, 180, 100, 0.5)'
              : '0 0 50px 20px rgba(255, 220, 100, 0.6)',
          }}
        />

        {/* Ocean strip at horizon */}
        <div className={`absolute bottom-0 left-0 right-0 h-[25%] ${
          isDark
            ? 'bg-gradient-to-b from-purple-700 via-blue-700 to-cyan-600'
            : 'bg-gradient-to-b from-blue-400 via-cyan-400 to-cyan-300'
        }`} />

        {/* Waves at waterline */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[15%]" viewBox="0 0 1440 50" preserveAspectRatio="none">
          <path
            d="M0 25 Q90 15 180 25 Q270 35 360 25 Q450 15 540 25 Q630 35 720 25 Q810 15 900 25 Q990 35 1080 25 Q1170 15 1260 25 Q1350 35 1440 25 L1440 50 L0 50 Z"
            fill={isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(34, 211, 238, 0.5)'}
            style={{ animation: 'wave-motion 4s ease-in-out infinite' }}
          />
        </svg>
      </div>

      {/* Sandy beach - large walkable area */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: `${config.horizonY}%` }}
      >
        {/* Sand gradient with perspective */}
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-amber-400 via-amber-300 to-amber-200'
            : 'bg-gradient-to-b from-amber-300 via-amber-200 to-amber-100'
        }`} />

        {/* Wet sand near water */}
        <div
          className={`absolute top-0 left-0 right-0 h-[15%] ${
            isDark ? 'bg-amber-500/40' : 'bg-amber-400/30'
          }`}
        />

        {/* Beach items at different depths */}
        {useMemo(() => [
          { x: 8, y: 8, type: 'shell', scale: 0.4 },
          { x: 92, y: 12, type: 'shell', scale: 0.45 },
          { x: 20, y: 35, type: 'towel', scale: 0.55 },
          { x: 75, y: 40, type: 'umbrella', scale: 0.6 },
          { x: 15, y: 65, type: 'bucket', scale: 0.75 },
          { x: 85, y: 70, type: 'shell', scale: 0.8 },
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
            {item.type === 'shell' && (
              <div className="w-4 h-3 rounded-full bg-pink-200/70" />
            )}
            {item.type === 'towel' && (
              <div className="w-16 h-8 rounded bg-red-400/60" />
            )}
            {item.type === 'umbrella' && (
              <div className="relative">
                <div className="w-20 h-10 rounded-t-full bg-yellow-400/70" />
                <div className="absolute top-8 left-1/2 w-1 h-8 bg-amber-800/60" />
              </div>
            )}
            {item.type === 'bucket' && (
              <div className="w-6 h-5 rounded-b bg-blue-400/60" />
            )}
          </div>
        )), [])}

        {/* Palm trees at back corners */}
        <svg className="absolute top-[5%] left-[3%]" width="50" height="80" viewBox="0 0 80 160" style={{ opacity: 0.7 }}>
          <path d="M38 160 Q40 120 42 80 Q44 40 42 20" stroke="#8B4513" strokeWidth="8" fill="none" />
          <path d="M42 25 Q25 15 8 30" stroke="#228B22" strokeWidth="3" fill="none" />
          <path d="M42 25 Q55 10 75 25" stroke="#228B22" strokeWidth="3" fill="none" />
          <path d="M42 22 Q30 5 15 15" stroke="#2E8B57" strokeWidth="2" fill="none" />
        </svg>
        <svg className="absolute top-[8%] right-[5%]" width="45" height="70" viewBox="0 0 80 160" style={{ opacity: 0.6 }}>
          <path d="M38 160 Q40 120 42 80 Q44 40 42 20" stroke="#8B4513" strokeWidth="8" fill="none" />
          <path d="M42 25 Q25 15 8 30" stroke="#228B22" strokeWidth="3" fill="none" />
          <path d="M42 25 Q55 10 75 25" stroke="#228B22" strokeWidth="3" fill="none" />
        </svg>

        {/* Footprints leading across sand */}
        {useMemo(() => Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="absolute opacity-20"
            style={{
              left: `${30 + i * 8}%`,
              top: `${45 + (i % 2) * 3}%`,
            }}
          >
            <div className={`w-2 h-3 rounded-full ${isDark ? 'bg-amber-700' : 'bg-amber-500'}`} />
          </div>
        )), [isDark])}

        {/* Seagull silhouettes in sky */}
        {useMemo(() => [
          { x: 20, y: -15, scale: 0.6 },
          { x: 70, y: -20, scale: 0.5 },
        ].map((bird, i) => (
          <svg
            key={i}
            className="absolute"
            style={{
              left: `${bird.x}%`,
              top: `${bird.y}%`,
              transform: `scale(${bird.scale})`,
              animation: `float ${8 + i * 2}s ease-in-out ${i}s infinite`,
            }}
            width="20" height="10" viewBox="0 0 20 10"
          >
            <path d="M0 5 Q5 0 10 5 Q15 0 20 5" stroke={isDark ? '#1e293b' : '#64748b'} strokeWidth="2" fill="none" />
          </svg>
        )), [isDark])}
      </div>
    </div>
  );
}

// ============================================
// Scene: Studio (Stage with spotlights for active players)
// ============================================

function StudioScene({ keyColor, audioLevel, isDark, activeUserPositions }: {
  keyColor: string;
  audioLevel: number;
  isDark: boolean;
  activeUserPositions?: Array<{ x: number; y: number; level: number }>;
}) {
  const config = SCENE_GROUNDS.studio;
  const vuLevel = Math.floor(audioLevel * 10);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Stage back wall */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
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
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, ${keyColor}, #a855f7, ${keyColor})`, boxShadow: `0 0 10px ${keyColor}` }}
        />

        {/* Stage monitors at back */}
        {[-1, 1].map((side) => (
          <div
            key={side}
            className={`absolute bottom-[10%] w-10 h-16 rounded border flex flex-col items-center justify-center gap-1 ${
              isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-slate-600 border-slate-500'
            }`}
            style={{ [side < 0 ? 'left' : 'right']: '15%' }}
          >
            <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-slate-500'}`} />
            <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-slate-500'}`} />
          </div>
        ))}

        {/* VU meters on back wall */}
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex gap-4">
          {[0, 1].map((ch) => (
            <div key={ch} className="flex gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-2 rounded-sm"
                  style={{
                    backgroundColor: i < vuLevel ? (i < 5 ? '#22c55e' : i < 7 ? '#eab308' : '#ef4444') : (isDark ? '#27272a' : '#64748b'),
                    boxShadow: i < vuLevel ? `0 0 3px ${i < 5 ? '#22c55e' : i < 7 ? '#eab308' : '#ef4444'}` : 'none',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Stage floor - large performance area */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: `${config.horizonY}%` }}
      >
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

        {/* Spotlights for active players! */}
        {activeUserPositions?.map((pos, i) => pos.level > 0.1 && (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y - 5}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Spotlight cone from above */}
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '40px solid transparent',
                borderRight: '40px solid transparent',
                borderTop: `120px solid ${keyColor}`,
                opacity: 0.15 + pos.level * 0.2,
                filter: 'blur(8px)',
              }}
            />
            {/* Ground glow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                width: 80 + pos.level * 40,
                height: 20 + pos.level * 10,
                background: `radial-gradient(ellipse, ${keyColor}40 0%, transparent 70%)`,
                opacity: 0.4 + pos.level * 0.4,
              }}
            />
          </div>
        ))}

        {/* Stage edge lights */}
        <div className="absolute top-0 left-0 right-0 h-1 flex justify-around px-[10%]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: i % 2 === 0 ? keyColor : '#fbbf24',
                boxShadow: `0 0 6px ${i % 2 === 0 ? keyColor : '#fbbf24'}`,
                animation: `gentle-pulse ${2 + (i % 3) * 0.5}s ease-in-out ${i * 0.2}s infinite`,
              }}
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
        <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
          <path d="M10% 60% Q30% 55% 50% 65% Q70% 75% 90% 70%" stroke={isDark ? '#52525b' : '#64748b'} strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Recording light */}
      <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full border ${
        isDark ? 'bg-red-900/40 border-red-500/40' : 'bg-red-100 border-red-300'
      }`}>
        <div
          className="w-2 h-2 rounded-full bg-red-500"
          style={{ animation: audioLevel > 0.1 ? 'gentle-pulse 1s ease-in-out infinite' : 'none', opacity: audioLevel > 0.1 ? 1 : 0.4 }}
        />
        <span className={`text-[10px] font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>LIVE</span>
      </div>
    </div>
  );
}

// ============================================
// Scene: Space (Floating platform with energy rings)
// ============================================

function SpaceScene({ keyColor, isDark, audioLevel }: { keyColor: string; isDark: boolean; audioLevel?: number }) {
  const config = SCENE_GROUNDS.space;
  const level = audioLevel || 0;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep space background */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-black via-indigo-950 to-purple-900'
            : 'bg-gradient-to-b from-indigo-300 via-purple-200 to-pink-300'
        }`} />

        <Stars count={isDark ? 50 : 15} />

        {/* Nebula clouds */}
        <div
          className={`absolute top-[10%] left-[5%] w-[40%] h-[60%] ${isDark ? 'opacity-20' : 'opacity-30'}`}
          style={{ background: `radial-gradient(ellipse at 40% 40%, ${keyColor}50 0%, transparent 60%)` }}
        />

        {/* Planet at horizon */}
        <div className="absolute bottom-[5%] right-[12%]">
          <div
            className={`w-12 h-12 rounded-full ${
              isDark
                ? 'bg-gradient-to-br from-orange-400 via-red-500 to-purple-700'
                : 'bg-gradient-to-br from-pink-300 via-purple-400 to-indigo-400'
            }`}
            style={{ boxShadow: isDark ? '0 0 20px 5px rgba(249, 115, 22, 0.2)' : '0 0 20px 5px rgba(167, 139, 250, 0.3)' }}
          />
          {/* Planet ring */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-4 rounded-full border opacity-40"
            style={{ borderColor: isDark ? '#f97316' : '#a78bfa', transform: 'translate(-50%, -50%) rotateX(70deg)' }}
          />
        </div>
      </div>

      {/* Platform surface - floating in space */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: `${config.horizonY}%` }}
      >
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

        {/* Energy rings that pulse with audio */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[60%]">
          {[0, 1, 2].map((ring) => (
            <div
              key={ring}
              className="absolute left-1/2 -translate-x-1/2 rounded-full border-2"
              style={{
                width: `${100 + ring * 40}%`,
                height: 20 + ring * 8,
                top: -ring * 5,
                borderColor: keyColor,
                opacity: 0.2 + level * 0.3 - ring * 0.05,
                boxShadow: `0 0 ${10 + level * 15}px ${keyColor}`,
                animation: `gentle-pulse ${3 + ring}s ease-in-out ${ring * 0.3}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Holographic data displays */}
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
                borderColor: `${keyColor}60`,
                background: `linear-gradient(180deg, ${keyColor}20 0%, transparent 100%)`,
                boxShadow: `0 0 10px ${keyColor}30`,
              }}
            >
              {/* Fake waveform lines */}
              <div className="flex items-end justify-around h-full p-1">
                {[0.3, 0.6, 0.8, 0.5, 0.7, 0.4].map((h, j) => (
                  <div
                    key={j}
                    className="w-1 rounded-t"
                    style={{
                      height: `${h * 100}%`,
                      backgroundColor: keyColor,
                      opacity: 0.6,
                      animation: `gentle-pulse ${1.5 + j * 0.2}s ease-in-out ${j * 0.1}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )), [keyColor])}

        {/* Platform edge lights */}
        <div className="absolute top-0 left-0 right-0 h-1">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${keyColor} 20%, #22d3ee 50%, ${keyColor} 80%, transparent 95%)`,
              opacity: 0.4 + level * 0.3,
              boxShadow: `0 0 15px ${keyColor}`,
            }}
          />
        </div>

        {/* Floating particles */}
        {useMemo(() => Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${15 + i * 10}%`,
              top: `${20 + (i % 4) * 15}%`,
              backgroundColor: i % 2 === 0 ? keyColor : '#22d3ee',
              boxShadow: `0 0 4px ${i % 2 === 0 ? keyColor : '#22d3ee'}`,
              animation: `float ${6 + i}s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        )), [keyColor])}
      </div>
    </div>
  );
}

// ============================================
// Scene: Forest (Magical glade with music-reactive circle)
// ============================================

function ForestScene({ keyColor, isDark, audioLevel }: { keyColor: string; isDark: boolean; audioLevel?: number }) {
  const config = SCENE_GROUNDS.forest;
  const level = audioLevel || 0;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Forest canopy at horizon */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-emerald-950 via-green-900 to-emerald-800'
            : 'bg-gradient-to-b from-emerald-400 via-green-300 to-emerald-300'
        }`} />

        {/* Light rays through canopy */}
        {useMemo(() => Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * 18}%`,
              top: 0,
              width: 30 + i * 5,
              height: '100%',
              background: isDark
                ? `linear-gradient(180deg, rgba(254, 249, 195, 0.15) 0%, transparent 80%)`
                : `linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 80%)`,
              transform: `skewX(${-10 + i * 5}deg)`,
              opacity: 0.3 + level * 0.2,
            }}
          />
        )), [isDark, level])}

        {/* Distant tree silhouettes at horizon */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[70%]" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <g fill={isDark ? 'rgba(5, 46, 22, 0.9)' : 'rgba(22, 101, 52, 0.6)'}>
            {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400].map((x, i) => (
              <path key={i} d={`M${x + 40} 200 L${x + 40} ${140 - (i % 3) * 20} L${x + 20} ${170 - (i % 3) * 15} L${x + 60} ${170 - (i % 3) * 15} Z`} />
            ))}
          </g>
        </svg>
      </div>

      {/* Forest floor - large magical glade */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ top: `${config.horizonY}%` }}
      >
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

        {/* Magic circle in the center - pulses with music! */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: '25%' }}
        >
          <svg width="180" height="60" viewBox="0 0 180 60">
            {/* Outer ring */}
            <ellipse
              cx="90" cy="30" rx="85" ry="25"
              fill="none"
              stroke={keyColor}
              strokeWidth={1.5 + level * 2}
              opacity={0.3 + level * 0.4}
              style={{ filter: `drop-shadow(0 0 ${5 + level * 10}px ${keyColor})` }}
            />
            {/* Inner ring */}
            <ellipse
              cx="90" cy="30" rx="60" ry="18"
              fill="none"
              stroke={keyColor}
              strokeWidth={1 + level}
              opacity={0.2 + level * 0.3}
            />
            {/* Center glow */}
            <ellipse
              cx="90" cy="30" rx="30" ry="10"
              fill={keyColor}
              opacity={0.1 + level * 0.2}
            />
            {/* Rune markers */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <circle
                key={i}
                cx={90 + Math.cos(angle * Math.PI / 180) * 70}
                cy={30 + Math.sin(angle * Math.PI / 180) * 20}
                r={2 + level * 2}
                fill={keyColor}
                opacity={0.4 + level * 0.4}
                style={{ animation: `gentle-pulse ${2 + i * 0.3}s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </svg>
        </div>

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
            <div
              className="w-6 h-3 -mt-1 rounded-t-full"
              style={{
                backgroundColor: `hsl(${shroom.hue}, 70%, ${isDark ? '50%' : '60%'})`,
                boxShadow: `0 0 ${8 + level * 8}px hsl(${shroom.hue}, 70%, 50%)`,
                opacity: 0.6 + level * 0.3,
              }}
            />
          </div>
        )), [isDark, level])}

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
      </div>

      {/* Fireflies floating everywhere */}
      {useMemo(() => Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${8 + (i * 9)}%`,
            top: `${30 + (i % 5) * 12}%`,
            width: isDark ? 3 : 4,
            height: isDark ? 3 : 4,
            backgroundColor: i % 3 === 0 ? keyColor : (isDark ? '#fef08a' : '#fbbf24'),
            boxShadow: `0 0 ${4 + level * 4}px ${i % 3 === 0 ? keyColor : (isDark ? '#fef08a' : '#fbbf24')}`,
            animation: `drift ${8 + i * 1.5}s ease-in-out ${i * 0.6}s infinite`,
          }}
        />
      )), [keyColor, isDark, level])}
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
      className="absolute flex flex-col items-center transition-all duration-200 ease-out"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translateX(-50%) scale(${position.scale}) scaleX(${position.facingRight ? 1 : -1})`,
        transformOrigin: 'bottom center',
        zIndex: Math.floor(position.y), // Higher Y = more in front = higher z-index
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

  // Walking positions - pass scene type for ground-specific bounds
  const positions = useAvatarWalking(allUsers, audioLevels, currentScene);

  // Scene change
  const handleSceneChange = useCallback((scene: SceneType) => {
    setCurrentScene(scene);
  }, []);

  // Dark mode
  const isDark = resolvedTheme === 'dark';

  // Get active user positions for spotlight effects
  const activeUserPositions = useMemo(() => {
    const active: Array<{ x: number; y: number; level: number }> = [];
    positions.forEach((pos, id) => {
      const level = audioLevels.get(id) || 0;
      if (level > 0.1) {
        active.push({ x: pos.x, y: pos.y, level });
      }
    });
    return active;
  }, [positions, audioLevels]);

  // Render scene with appropriate props
  const renderScene = () => {
    switch (currentScene) {
      case 'campfire': return <CampfireScene keyColor={keyColor} isDark={isDark} />;
      case 'rooftop': return <RooftopScene keyColor={keyColor} isDark={isDark} />;
      case 'beach': return <BeachScene keyColor={keyColor} isDark={isDark} />;
      case 'studio': return <StudioScene keyColor={keyColor} audioLevel={totalAudioLevel} isDark={isDark} activeUserPositions={activeUserPositions} />;
      case 'space': return <SpaceScene keyColor={keyColor} isDark={isDark} audioLevel={totalAudioLevel} />;
      case 'forest': return <ForestScene keyColor={keyColor} isDark={isDark} audioLevel={totalAudioLevel} />;
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
