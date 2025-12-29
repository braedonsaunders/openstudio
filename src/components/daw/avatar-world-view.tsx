'use client';

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
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
import { MainViewSwitcher, type MainViewType } from './main-view-switcher';

// ============================================
// Types & Constants
// ============================================

type SceneType = 'campfire' | 'rooftop' | 'beach' | 'studio' | 'space' | 'forest';

interface AvatarWorldViewProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  activeView?: MainViewType;
  onViewChange?: (view: MainViewType) => void;
}

interface AvatarPosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  velocityX: number;
  velocityY: number;
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
const WALK_BOUNDS = { minX: 10, maxX: 90, minY: 15, maxY: 35 };
const WALK_SPEED = 0.15;
const IDLE_DURATION_MIN = 3000;
const IDLE_DURATION_MAX = 8000;
const WALK_DURATION_MIN = 2000;
const WALK_DURATION_MAX = 5000;

// ============================================
// Musical Key Colors
// ============================================

const KEY_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  'C': { primary: '#ef4444', secondary: '#fca5a5', glow: 'rgba(239, 68, 68, 0.5)' },
  'C#': { primary: '#f97316', secondary: '#fdba74', glow: 'rgba(249, 115, 22, 0.5)' },
  'Db': { primary: '#f97316', secondary: '#fdba74', glow: 'rgba(249, 115, 22, 0.5)' },
  'D': { primary: '#eab308', secondary: '#fde047', glow: 'rgba(234, 179, 8, 0.5)' },
  'D#': { primary: '#84cc16', secondary: '#bef264', glow: 'rgba(132, 204, 22, 0.5)' },
  'Eb': { primary: '#84cc16', secondary: '#bef264', glow: 'rgba(132, 204, 22, 0.5)' },
  'E': { primary: '#22c55e', secondary: '#86efac', glow: 'rgba(34, 197, 94, 0.5)' },
  'F': { primary: '#14b8a6', secondary: '#5eead4', glow: 'rgba(20, 184, 166, 0.5)' },
  'F#': { primary: '#06b6d4', secondary: '#67e8f9', glow: 'rgba(6, 182, 212, 0.5)' },
  'Gb': { primary: '#06b6d4', secondary: '#67e8f9', glow: 'rgba(6, 182, 212, 0.5)' },
  'G': { primary: '#3b82f6', secondary: '#93c5fd', glow: 'rgba(59, 130, 246, 0.5)' },
  'G#': { primary: '#6366f1', secondary: '#a5b4fc', glow: 'rgba(99, 102, 241, 0.5)' },
  'Ab': { primary: '#6366f1', secondary: '#a5b4fc', glow: 'rgba(99, 102, 241, 0.5)' },
  'A': { primary: '#8b5cf6', secondary: '#c4b5fd', glow: 'rgba(139, 92, 246, 0.5)' },
  'A#': { primary: '#a855f7', secondary: '#d8b4fe', glow: 'rgba(168, 85, 247, 0.5)' },
  'Bb': { primary: '#a855f7', secondary: '#d8b4fe', glow: 'rgba(168, 85, 247, 0.5)' },
  'B': { primary: '#ec4899', secondary: '#f9a8d4', glow: 'rgba(236, 72, 153, 0.5)' },
};

// ============================================
// Beat Visualization Hook
// ============================================

function useBeatPulse() {
  const tempo = useSessionTempoStore(state => state.tempo);
  const beatsPerBar = useSessionTempoStore(state => state.beatsPerBar);
  const currentBeat = useMetronomeStore(state => state.currentBeat);
  const isPlaying = useMetronomeStore(state => state.isPlaying);
  const [pulse, setPulse] = useState(0);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setPulse(0);
      return;
    }

    const beatDuration = 60000 / tempo;
    let animationFrame: number;
    let startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) % beatDuration;
      const progress = elapsed / beatDuration;
      // Exponential decay for punch
      const intensity = Math.exp(-progress * 4);
      setPulse(intensity);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [tempo, isPlaying]);

  useEffect(() => {
    setBeat(currentBeat);
  }, [currentBeat]);

  return { pulse, beat, beatsPerBar, tempo, isPlaying };
}

// ============================================
// Avatar Walking System
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
          // Initial positions in a loose group
          const startX = 35 + (index % 4) * 10 + Math.random() * 5;
          const startY = 22 + Math.floor(index / 4) * 5 + Math.random() * 3;
          next.set(user.id, {
            x: startX,
            y: startY,
            targetX: startX,
            targetY: startY,
            scale: 0.85 + Math.random() * 0.15,
            velocityX: 0,
            velocityY: 0,
            isWalking: false,
            walkTimer: Math.random() * IDLE_DURATION_MAX,
            idleTimer: 0,
            facingRight: Math.random() > 0.5,
          });
        }
      });
      // Remove positions for users who left
      const userIds = new Set(users.map(u => u.id));
      next.forEach((_, id) => {
        if (!userIds.has(id)) next.delete(id);
      });
      return next;
    });
  }, [users]);

  // Animation loop for walking
  useEffect(() => {
    const animate = (time: number) => {
      const deltaTime = lastTimeRef.current ? time - lastTimeRef.current : 16;
      lastTimeRef.current = time;

      setPositions(prev => {
        const next = new Map(prev);
        let hasChanges = false;

        next.forEach((pos, id) => {
          const audioLevel = audioLevels.get(id) || 0;
          let updated = { ...pos };

          // Update timers
          if (updated.isWalking) {
            updated.walkTimer -= deltaTime;
            if (updated.walkTimer <= 0) {
              // Stop walking, start idling
              updated.isWalking = false;
              updated.idleTimer = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
              hasChanges = true;
            } else {
              // Continue walking toward target
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
                // Reached target
                updated.isWalking = false;
                updated.idleTimer = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
              }
            }
          } else {
            updated.idleTimer -= deltaTime;
            if (updated.idleTimer <= 0 && audioLevel < 0.3) {
              // Start walking to a new random position
              updated.isWalking = true;
              updated.walkTimer = WALK_DURATION_MIN + Math.random() * (WALK_DURATION_MAX - WALK_DURATION_MIN);
              updated.targetX = WALK_BOUNDS.minX + Math.random() * (WALK_BOUNDS.maxX - WALK_BOUNDS.minX);
              updated.targetY = WALK_BOUNDS.minY + Math.random() * (WALK_BOUNDS.maxY - WALK_BOUNDS.minY);
              hasChanges = true;
            }
          }

          // When playing audio, stay put and maybe bob more
          if (audioLevel > 0.3) {
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
// Scene Components
// ============================================

// --- Animated Stars ---
function AnimatedStars({ count = 80, colors = ['#fff'] }: { count?: number; colors?: string[] }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 50}%`,
    size: Math.random() * 2.5 + 0.5,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
  })), [count, colors]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            backgroundColor: star.color,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 1.4, 1],
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

// --- Beat-Synced Ground Pulse ---
function GroundPulse({ pulse, color }: { pulse: number; color: string }) {
  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at 50% 100%, ${color} 0%, transparent 60%)`,
        opacity: pulse * 0.4,
      }}
    />
  );
}

// --- Floating Musical Notes ---
function FloatingMusicNotes({ audioLevel, keyColor }: { audioLevel: number; keyColor: string }) {
  const notes = ['♪', '♫', '♬', '♩'];
  const noteCount = Math.floor(audioLevel * 12) + 4;
  const colors = [keyColor, '#a855f7', '#ec4899', '#8b5cf6', '#f472b6', '#6366f1'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: noteCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-xl font-bold"
          style={{
            left: `${8 + (i % 10) * 9}%`,
            bottom: '15%',
            color: colors[i % colors.length],
            textShadow: `0 0 20px ${colors[i % colors.length]}`,
          }}
          animate={{
            y: [0, -250 - audioLevel * 80, -400],
            x: [0, (i % 2 === 0 ? 25 : -25) * (1 + audioLevel * 0.5), (i % 2 === 0 ? -15 : 15)],
            opacity: [0, 0.9, 0],
            rotate: [0, (i % 2 === 0 ? 15 : -15), 0],
            scale: [0.4, 1 + audioLevel * 0.2, 0.2],
          }}
          transition={{
            duration: 3.5 + (i % 3) * 0.5 - audioLevel * 0.5,
            delay: i * 0.3,
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

// --- Waveform Visualizer ---
function WaveformVisualizer({ audioLevel, keyColor, barCount = 32 }: { audioLevel: number; keyColor: string; barCount?: number }) {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    let phase = 0;
    const animate = () => {
      phase += 0.08;
      setBars(prev => prev.map((_, i) => {
        const wave = Math.sin(phase + i * 0.3) * 0.5 + 0.5;
        const noise = Math.random() * 0.3;
        return Math.max(0.1, (wave + noise) * audioLevel);
      }));
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [audioLevel, barCount]);

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-[2px] h-12 px-4 py-2 rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full"
          style={{
            height: `${8 + height * 32}px`,
            background: `linear-gradient(to top, ${keyColor}, #fff)`,
            boxShadow: `0 0 8px ${keyColor}`,
          }}
          animate={{ scaleY: [1, 1.1, 1] }}
          transition={{ duration: 0.15, delay: i * 0.01 }}
        />
      ))}
    </div>
  );
}

// --- BPM/Key Info Display ---
function MusicInfoDisplay({ tempo, musicalKey, keyScale, isPlaying, pulse }: {
  tempo: number;
  musicalKey: string | null;
  keyScale: 'major' | 'minor' | null;
  isPlaying: boolean;
  pulse: number;
}) {
  const keyColors = musicalKey ? KEY_COLORS[musicalKey] || KEY_COLORS['C'] : KEY_COLORS['C'];

  return (
    <motion.div
      className="absolute top-4 right-4 flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-xl bg-black/40 border border-white/15"
      animate={{ scale: isPlaying ? 1 + pulse * 0.02 : 1 }}
      transition={{ duration: 0.1 }}
    >
      {/* BPM Display */}
      <div className="flex items-center gap-2">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: keyColors.primary }}
          animate={isPlaying ? {
            scale: [1, 1.5, 1],
            opacity: [0.6, 1, 0.6]
          } : {}}
          transition={{ duration: 60 / tempo, repeat: Infinity }}
        />
        <div className="flex flex-col">
          <span className="text-lg font-bold text-white leading-none">{tempo}</span>
          <span className="text-[10px] text-white/60 uppercase tracking-wider">BPM</span>
        </div>
      </div>

      {/* Key Display */}
      {musicalKey && (
        <>
          <div className="w-px h-8 bg-white/20" />
          <div className="flex flex-col items-center">
            <span
              className="text-lg font-bold leading-none"
              style={{ color: keyColors.primary }}
            >
              {musicalKey}
            </span>
            <span className="text-[10px] text-white/60 uppercase tracking-wider">
              {keyScale || 'Key'}
            </span>
          </div>
        </>
      )}

      {/* Playing indicator */}
      {isPlaying && (
        <motion.div
          className="flex items-center gap-1"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Volume2 className="w-3 h-3 text-green-400" />
        </motion.div>
      )}
    </motion.div>
  );
}

// --- Beat Indicator ---
function BeatIndicator({ beat, beatsPerBar, tempo, isPlaying }: {
  beat: number;
  beatsPerBar: number;
  tempo: number;
  isPlaying: boolean;
}) {
  if (!isPlaying) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl bg-black/40 border border-white/15">
      {Array.from({ length: beatsPerBar }).map((_, i) => (
        <motion.div
          key={i}
          className="w-3 h-3 rounded-full"
          style={{
            backgroundColor: i === beat - 1 ? (i === 0 ? '#ef4444' : '#a855f7') : 'rgba(255,255,255,0.2)',
            boxShadow: i === beat - 1 ? `0 0 12px ${i === 0 ? '#ef4444' : '#a855f7'}` : 'none',
          }}
          animate={i === beat - 1 ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.15 }}
        />
      ))}
    </div>
  );
}

// ============================================
// Scene: Campfire (Night Forest)
// ============================================

function CampfireScene({ isDark, audioLevel, pulse, keyColor }: { isDark: boolean; audioLevel: number; pulse: number; keyColor: string }) {
  const flameScale = 1 + audioLevel * 0.4 + pulse * 0.2;
  const sparkCount = Math.floor(audioLevel * 8) + 4;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Night sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900/90 to-violet-900/70" />

      {/* Stars */}
      <AnimatedStars count={100} colors={['#fff', '#fef3c7', '#ddd6fe']} />

      {/* Northern lights effect */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${keyColor}22 30%, transparent 60%)`,
        }}
        animate={{
          opacity: [0.15, 0.35, 0.15],
          y: [-20, 20, -20]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Moon */}
      <motion.div
        className="absolute top-[8%] left-[12%]"
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.03, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-300"
          style={{ boxShadow: '0 0 60px 20px rgba(255, 255, 255, 0.15)' }}
        />
      </motion.div>

      {/* Mountains */}
      <svg className="absolute bottom-[20%] left-0 right-0 w-full h-[40%]" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path d="M0 320 L0 200 Q200 80 400 160 Q600 40 800 120 Q1000 20 1200 100 Q1350 50 1440 120 L1440 320 Z" fill="rgba(30, 27, 75, 0.6)" />
        <path d="M0 320 L0 220 Q150 130 350 190 Q550 100 700 160 Q900 70 1100 140 Q1300 90 1440 150 L1440 320 Z" fill="rgba(49, 46, 129, 0.5)" />
        {/* Trees silhouettes */}
        <g fill="rgba(15, 15, 35, 0.8)">
          {[100, 200, 350, 500, 650, 800, 950, 1100, 1250, 1350].map((x, i) => (
            <path key={i} d={`M${x} 320 L${x} ${220 - i * 3} L${x - 15} ${245 - i * 3} L${x - 8} ${245 - i * 3} L${x - 20} ${270 - i * 3} L${x + 20} ${270 - i * 3} L${x + 8} ${245 - i * 3} L${x + 15} ${245 - i * 3} Z`} />
          ))}
        </g>
      </svg>

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[22%] bg-gradient-to-t from-indigo-950 via-violet-900/80 to-transparent" />

      {/* Beat pulse on ground */}
      <GroundPulse pulse={pulse} color={keyColor} />

      {/* Campfire */}
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 z-10">
        <svg width="180" height="150" viewBox="0 0 180 150">
          {/* Logs */}
          <rect x="40" y="115" width="100" height="18" rx="9" fill="#78350f" transform="rotate(-8 90 120)" />
          <rect x="40" y="115" width="100" height="18" rx="9" fill="#92400e" transform="rotate(8 90 120)" />
          <rect x="65" y="118" width="50" height="14" rx="7" fill="#451a03" />

          {/* Fire glow */}
          <motion.ellipse
            cx="90"
            cy="110"
            rx={55 + audioLevel * 25}
            ry={30 + audioLevel * 15}
            fill={`url(#fireGlow-${keyColor.replace('#', '')})`}
            animate={{ opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 0.25, repeat: Infinity }}
          />

          {/* Flames */}
          <motion.g
            animate={{ scaleY: flameScale }}
            transition={{ duration: 0.08 }}
            style={{ transformOrigin: '90px 115px' }}
          >
            <motion.path
              fill="url(#flameGradient)"
              animate={{
                d: [
                  "M90 115 Q72 75 80 50 Q90 20 90 8 Q90 20 100 50 Q108 75 90 115",
                  "M90 115 Q68 80 78 52 Q88 25 90 5 Q92 25 102 52 Q112 80 90 115",
                  "M90 115 Q75 70 82 48 Q92 18 90 3 Q88 18 98 48 Q105 70 90 115",
                  "M90 115 Q72 75 80 50 Q90 20 90 8 Q90 20 100 50 Q108 75 90 115",
                ],
              }}
              transition={{ duration: 0.35 + audioLevel * 0.15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              fill="url(#flameGradient2)"
              animate={{
                d: [
                  "M62 115 Q50 88 56 68 Q62 50 62 42 Q62 50 68 68 Q74 88 62 115",
                  "M62 115 Q46 90 54 70 Q60 52 62 44 Q64 52 70 70 Q78 90 62 115",
                  "M62 115 Q53 85 59 66 Q65 48 62 40 Q59 48 65 66 Q71 85 62 115",
                  "M62 115 Q50 88 56 68 Q62 50 62 42 Q62 50 68 68 Q74 88 62 115",
                ],
              }}
              transition={{ duration: 0.32 + audioLevel * 0.12, repeat: Infinity, ease: "easeInOut", delay: 0.08 }}
            />
            <motion.path
              fill="url(#flameGradient2)"
              animate={{
                d: [
                  "M118 115 Q130 88 124 68 Q118 50 118 42 Q118 50 112 68 Q106 88 118 115",
                  "M118 115 Q134 90 126 70 Q120 52 118 44 Q116 52 110 70 Q102 90 118 115",
                  "M118 115 Q127 85 121 66 Q115 48 118 40 Q121 48 115 66 Q109 85 118 115",
                  "M118 115 Q130 88 124 68 Q118 50 118 42 Q118 50 112 68 Q106 88 118 115",
                ],
              }}
              transition={{ duration: 0.35 + audioLevel * 0.1, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
            />
          </motion.g>

          {/* Sparks */}
          {Array.from({ length: sparkCount }).map((_, i) => (
            <motion.circle
              key={i}
              cx={80 + i * 4}
              cy="55"
              r="2.5"
              fill="#fbbf24"
              animate={{
                y: [0, -50, -90],
                x: [0, (i % 2 === 0 ? 18 : -18), (i % 2 === 0 ? 25 : -25)],
                opacity: [1, 0.8, 0],
                scale: [1, 0.7, 0.2],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeOut",
              }}
            />
          ))}

          <defs>
            <linearGradient id="flameGradient" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="40%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#fef9c3" />
            </linearGradient>
            <linearGradient id="flameGradient2" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fcd34d" />
            </linearGradient>
            <radialGradient id={`fireGlow-${keyColor.replace('#', '')}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={keyColor} stopOpacity="0.7" />
              <stop offset="60%" stopColor="#f97316" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Fireflies */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-yellow-300"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${30 + Math.random() * 40}%`,
            boxShadow: '0 0 8px 2px rgba(253, 224, 71, 0.6)',
          }}
          animate={{
            opacity: [0, 0.8, 0],
            x: [0, 30, -20, 0],
            y: [0, -20, 10, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 3,
            delay: Math.random() * 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// Scene: Rooftop (City Night)
// ============================================

function RooftopScene({ audioLevel, pulse, keyColor }: { audioLevel: number; pulse: number; keyColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Night sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-950" />

      {/* Stars */}
      <AnimatedStars count={50} colors={['#fff', '#94a3b8']} />

      {/* City skyline */}
      <svg className="absolute bottom-[18%] left-0 right-0 w-full h-[60%]" viewBox="0 0 1440 400" preserveAspectRatio="none">
        {/* Far buildings */}
        <g fill="rgba(30, 30, 50, 0.9)">
          <rect x="50" y="200" width="60" height="200" />
          <rect x="130" y="150" width="80" height="250" />
          <rect x="240" y="180" width="50" height="220" />
          <rect x="320" y="120" width="100" height="280" />
          <rect x="450" y="160" width="70" height="240" />
          <rect x="550" y="100" width="90" height="300" />
          <rect x="680" y="140" width="60" height="260" />
          <rect x="770" y="80" width="120" height="320" />
          <rect x="920" y="130" width="80" height="270" />
          <rect x="1030" y="170" width="60" height="230" />
          <rect x="1120" y="110" width="100" height="290" />
          <rect x="1250" y="150" width="70" height="250" />
          <rect x="1350" y="190" width="90" height="210" />
        </g>

        {/* Building windows (lit) */}
        {Array.from({ length: 150 }).map((_, i) => {
          const x = 60 + (i % 25) * 55;
          const y = 130 + Math.floor(i / 25) * 40 + Math.random() * 20;
          const lit = Math.random() > 0.3;
          return lit ? (
            <motion.rect
              key={i}
              x={x}
              y={y}
              width="8"
              height="12"
              fill={Math.random() > 0.7 ? keyColor : '#fef9c3'}
              opacity={0.8}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2 + Math.random() * 3, delay: Math.random() * 2, repeat: Infinity }}
            />
          ) : null;
        })}
      </svg>

      {/* Neon signs */}
      <motion.div
        className="absolute top-[35%] left-[15%] px-4 py-2 rounded-lg text-xl font-bold"
        style={{
          color: keyColor,
          textShadow: `0 0 20px ${keyColor}, 0 0 40px ${keyColor}`,
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        LIVE
      </motion.div>

      <motion.div
        className="absolute top-[30%] right-[20%] px-3 py-1 rounded text-lg font-bold"
        style={{
          color: '#ec4899',
          textShadow: '0 0 20px #ec4899, 0 0 40px #ec4899',
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      >
        MUSIC
      </motion.div>

      {/* Rooftop floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-slate-800 via-slate-700 to-slate-600" />

      {/* Rooftop railing */}
      <div className="absolute bottom-[18%] left-0 right-0 h-1 bg-slate-500" />
      <div className="absolute bottom-[18%] left-0 right-0 flex justify-around">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-1 h-8 bg-slate-500" />
        ))}
      </div>

      {/* Beat pulse */}
      <GroundPulse pulse={pulse} color={keyColor} />

      {/* Ambient city glow */}
      <motion.div
        className="absolute bottom-[20%] left-0 right-0 h-32 opacity-30"
        style={{
          background: `linear-gradient(to top, ${keyColor}, transparent)`,
        }}
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 60 / 120, repeat: Infinity }}
      />

      {/* Flying birds/drones */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-white/30 text-xs"
          style={{ top: `${15 + i * 8}%` }}
          animate={{
            x: ['-10%', '110%'],
          }}
          transition={{
            duration: 15 + i * 5,
            delay: i * 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          ✈
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// Scene: Beach (Sunset)
// ============================================

function BeachScene({ audioLevel, pulse, keyColor }: { audioLevel: number; pulse: number; keyColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sunset sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-400 via-pink-500 to-purple-700" />

      {/* Sun */}
      <motion.div
        className="absolute top-[20%] left-1/2 -translate-x-1/2"
        animate={{ y: [0, 5, 0], scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-32 h-32 rounded-full bg-gradient-to-b from-yellow-300 to-orange-500"
          style={{ boxShadow: '0 0 80px 30px rgba(255, 180, 100, 0.5)' }}
        />
      </motion.div>

      {/* Clouds */}
      {[
        { left: '10%', top: '15%', scale: 1 },
        { left: '70%', top: '20%', scale: 0.7 },
        { left: '85%', top: '12%', scale: 0.5 },
      ].map((cloud, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: cloud.left, top: cloud.top, transform: `scale(${cloud.scale})` }}
          animate={{ x: [0, 20, 0] }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="120" height="50" viewBox="0 0 120 50">
            <ellipse cx="30" cy="30" rx="25" ry="18" fill="rgba(255,255,255,0.4)" />
            <ellipse cx="55" cy="25" rx="30" ry="22" fill="rgba(255,255,255,0.5)" />
            <ellipse cx="85" cy="30" rx="25" ry="18" fill="rgba(255,255,255,0.4)" />
          </svg>
        </motion.div>
      ))}

      {/* Ocean */}
      <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-b from-cyan-500 via-blue-600 to-blue-900" />

      {/* Waves */}
      <svg className="absolute bottom-[25%] left-0 right-0 w-full h-[25%]" viewBox="0 0 1440 200" preserveAspectRatio="none">
        <motion.path
          d="M0 100 Q180 50 360 100 Q540 150 720 100 Q900 50 1080 100 Q1260 150 1440 100 L1440 200 L0 200 Z"
          fill="rgba(6, 182, 212, 0.5)"
          animate={{
            d: [
              "M0 100 Q180 50 360 100 Q540 150 720 100 Q900 50 1080 100 Q1260 150 1440 100 L1440 200 L0 200 Z",
              "M0 100 Q180 150 360 100 Q540 50 720 100 Q900 150 1080 100 Q1260 50 1440 100 L1440 200 L0 200 Z",
              "M0 100 Q180 50 360 100 Q540 150 720 100 Q900 50 1080 100 Q1260 150 1440 100 L1440 200 L0 200 Z",
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M0 120 Q200 80 400 120 Q600 160 800 120 Q1000 80 1200 120 Q1400 160 1440 120 L1440 200 L0 200 Z"
          fill="rgba(14, 165, 233, 0.6)"
          animate={{
            d: [
              "M0 120 Q200 80 400 120 Q600 160 800 120 Q1000 80 1200 120 Q1400 160 1440 120 L1440 200 L0 200 Z",
              "M0 120 Q200 160 400 120 Q600 80 800 120 Q1000 160 1200 120 Q1400 80 1440 120 L1440 200 L0 200 Z",
              "M0 120 Q200 80 400 120 Q600 160 800 120 Q1000 80 1200 120 Q1400 160 1440 120 L1440 200 L0 200 Z",
            ],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </svg>

      {/* Beach/sand */}
      <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-gradient-to-t from-amber-200 via-amber-300 to-amber-400" />

      {/* Palm trees */}
      {[
        { x: 8, flip: false },
        { x: 88, flip: true },
      ].map((palm, i) => (
        <motion.svg
          key={i}
          className="absolute bottom-[26%]"
          style={{ left: `${palm.x}%`, transform: palm.flip ? 'scaleX(-1)' : 'none' }}
          width="100"
          height="200"
          viewBox="0 0 100 200"
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Trunk */}
          <path d="M45 200 Q48 150 50 100 Q52 50 50 30" stroke="#8B4513" strokeWidth="12" fill="none" />
          {/* Leaves */}
          <motion.path
            d="M50 35 Q30 20 10 40"
            stroke="#228B22"
            strokeWidth="4"
            fill="none"
            animate={{ d: ["M50 35 Q30 20 10 40", "M50 35 Q30 25 10 45", "M50 35 Q30 20 10 40"] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.path
            d="M50 35 Q70 20 90 40"
            stroke="#228B22"
            strokeWidth="4"
            fill="none"
          />
          <motion.path
            d="M50 30 Q40 10 20 20"
            stroke="#2E8B57"
            strokeWidth="4"
            fill="none"
          />
          <motion.path
            d="M50 30 Q60 10 80 20"
            stroke="#2E8B57"
            strokeWidth="4"
            fill="none"
          />
          <path d="M50 32 Q50 0 50 -15" stroke="#32CD32" strokeWidth="3" fill="none" />
        </motion.svg>
      ))}

      {/* Beat pulse on water */}
      <motion.div
        className="absolute bottom-[25%] left-0 right-0 h-20 opacity-40"
        style={{
          background: `linear-gradient(to top, ${keyColor}, transparent)`,
        }}
        animate={{ opacity: [0.2 + pulse * 0.3, 0.4 + pulse * 0.3, 0.2 + pulse * 0.3] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {/* Seagulls */}
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-slate-700 text-sm"
          style={{ top: `${10 + i * 5}%` }}
          animate={{
            x: ['-5%', '105%'],
            y: [0, -10, 5, -5, 0],
          }}
          transition={{
            x: { duration: 20 + i * 5, repeat: Infinity, ease: 'linear' },
            y: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          ~
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// Scene: Studio (Recording Studio)
// ============================================

function StudioScene({ audioLevel, pulse, keyColor }: { audioLevel: number; pulse: number; keyColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Studio wall */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black" />

      {/* Acoustic panels pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="acousticPanel" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect width="55" height="55" fill="#27272a" rx="4" />
              <rect x="5" y="5" width="45" height="45" fill="#18181b" rx="2" />
            </pattern>
          </defs>
          <rect width="100%" height="60%" fill="url(#acousticPanel)" />
        </svg>
      </div>

      {/* LED strip at top */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-2"
        style={{
          background: `linear-gradient(90deg, ${keyColor}, #a855f7, ${keyColor})`,
          boxShadow: `0 0 20px ${keyColor}`,
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Mixing console (background) */}
      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[70%] h-[25%]">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-700 to-zinc-800 rounded-t-lg border-t border-x border-zinc-600" />
        {/* Faders */}
        <div className="absolute top-4 left-4 right-4 flex justify-around">
          {Array.from({ length: 16 }).map((_, i) => {
            const faderHeight = 20 + (audioLevel * 40 * Math.sin(Date.now() * 0.01 + i));
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <motion.div
                  className="w-1 rounded-full bg-gradient-to-t"
                  style={{
                    height: `${faderHeight}px`,
                    background: `linear-gradient(to top, ${keyColor}, #fff)`,
                    boxShadow: `0 0 4px ${keyColor}`,
                  }}
                  animate={{ height: [faderHeight - 5, faderHeight + 5, faderHeight - 5] }}
                  transition={{ duration: 0.2, repeat: Infinity }}
                />
                <div className="w-2 h-2 rounded-full bg-zinc-400" />
              </div>
            );
          })}
        </div>

        {/* VU meters */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-8">
          {[0, 1].map((channel) => (
            <div key={channel} className="flex gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => {
                const level = audioLevel * 12;
                const isActive = i < level;
                const color = i < 8 ? '#22c55e' : i < 10 ? '#eab308' : '#ef4444';
                return (
                  <motion.div
                    key={i}
                    className="w-2 h-4 rounded-sm"
                    style={{
                      backgroundColor: isActive ? color : '#27272a',
                      boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Monitor speakers */}
      {[-1, 1].map((side) => (
        <motion.div
          key={side}
          className="absolute bottom-[45%]"
          style={{ [side < 0 ? 'left' : 'right']: '8%' }}
          animate={{ scale: 1 + pulse * 0.03 }}
          transition={{ duration: 0.1 }}
        >
          <div className="w-20 h-32 bg-zinc-800 rounded-lg border border-zinc-600 flex flex-col items-center justify-center gap-2 p-2">
            {/* Tweeter */}
            <motion.div
              className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-500"
              animate={{ boxShadow: [`0 0 0px ${keyColor}`, `0 0 ${10 + audioLevel * 15}px ${keyColor}`, `0 0 0px ${keyColor}`] }}
              transition={{ duration: 0.2, repeat: Infinity }}
            />
            {/* Woofer */}
            <motion.div
              className="w-12 h-12 rounded-full bg-zinc-700 border-2 border-zinc-500"
              animate={{ scale: [1, 1 + audioLevel * 0.1, 1] }}
              transition={{ duration: 0.15, repeat: Infinity }}
            />
          </div>
        </motion.div>
      ))}

      {/* Floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[22%] bg-gradient-to-t from-zinc-950 via-zinc-900 to-zinc-800" />

      {/* Floor reflections */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-16"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${keyColor}33 0%, transparent 60%)`,
        }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 60 / 120, repeat: Infinity }}
      />

      {/* Floating EQ curves */}
      <svg className="absolute top-[15%] left-[10%] w-32 h-20 opacity-30">
        <motion.path
          d="M0 40 Q20 20 40 40 Q60 60 80 40 Q100 20 128 40"
          stroke={keyColor}
          strokeWidth="2"
          fill="none"
          animate={{
            d: [
              "M0 40 Q20 20 40 40 Q60 60 80 40 Q100 20 128 40",
              "M0 40 Q20 60 40 40 Q60 20 80 40 Q100 60 128 40",
              "M0 40 Q20 20 40 40 Q60 60 80 40 Q100 20 128 40",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </svg>

      {/* Recording light */}
      <motion.div
        className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/50 border border-red-500/50"
        animate={{ opacity: audioLevel > 0.1 ? [0.5, 1, 0.5] : 0.3 }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-red-500"
          animate={{ scale: audioLevel > 0.1 ? [1, 1.3, 1] : 1 }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        <span className="text-xs font-bold text-red-400">REC</span>
      </motion.div>
    </div>
  );
}

// ============================================
// Scene: Space (Cosmic)
// ============================================

function SpaceScene({ audioLevel, pulse, keyColor }: { audioLevel: number; pulse: number; keyColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep space */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-indigo-950/50 to-purple-950/30" />

      {/* Dense starfield */}
      <AnimatedStars count={200} colors={['#fff', '#fef3c7', '#ddd6fe', '#fce7f3']} />

      {/* Nebula clouds */}
      <motion.div
        className="absolute top-0 left-0 w-[60%] h-[50%] opacity-30"
        style={{
          background: `radial-gradient(ellipse at 30% 30%, ${keyColor}40 0%, transparent 60%)`,
        }}
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 20, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-[20%] right-0 w-[50%] h-[40%] opacity-25"
        style={{
          background: 'radial-gradient(ellipse at 70% 70%, rgba(168, 85, 247, 0.4) 0%, transparent 60%)',
        }}
        animate={{ scale: [1, 1.15, 1], rotate: [0, -5, 0] }}
        transition={{ duration: 25, repeat: Infinity, delay: 5 }}
      />

      {/* Planet */}
      <motion.div
        className="absolute top-[15%] right-[15%]"
        animate={{ y: [-5, 5, -5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 via-red-500 to-purple-700"
          style={{ boxShadow: '0 0 40px 10px rgba(249, 115, 22, 0.3)' }}
        />
        {/* Planet rings */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-8 rounded-full border-2 border-orange-300/40"
          style={{ transform: 'translate(-50%, -50%) rotateX(70deg)' }}
        />
      </motion.div>

      {/* Space station / platform */}
      <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[80%] h-[20%]">
        {/* Platform base */}
        <div
          className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-lg"
          style={{ boxShadow: `0 0 30px ${keyColor}40` }}
        />
        {/* Platform surface */}
        <div className="absolute bottom-4 left-[5%] right-[5%] h-2 bg-gradient-to-r from-cyan-900 via-cyan-700 to-cyan-900 rounded" />

        {/* Platform lights */}
        <div className="absolute bottom-6 left-[10%] right-[10%] flex justify-around">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: i % 2 === 0 ? keyColor : '#22d3ee' }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>

        {/* Holographic display */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-40 h-24 rounded border border-cyan-400/30"
          style={{
            background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, transparent 100%)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.2)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Holographic waveform */}
          <svg className="w-full h-full p-2" viewBox="0 0 160 96">
            <motion.path
              d={`M0 48 ${Array.from({ length: 32 }).map((_, i) => {
                const x = i * 5;
                const y = 48 + Math.sin(i * 0.5) * 20 * audioLevel;
                return `L${x} ${y}`;
              }).join(' ')}`}
              stroke="#22d3ee"
              strokeWidth="2"
              fill="none"
              animate={{
                opacity: [0.5, 1, 0.5],
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Shooting stars */}
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{
            top: `${10 + i * 15}%`,
            boxShadow: '0 0 4px #fff, -20px 0 15px #fff, -40px 0 10px rgba(255,255,255,0.5)',
          }}
          animate={{
            x: ['0%', '150%'],
            y: ['0%', '30%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: 3 + i * 5,
            repeat: Infinity,
            repeatDelay: 10,
          }}
        />
      ))}

      {/* Audio-reactive pulsar */}
      <motion.div
        className="absolute top-[40%] left-[20%]"
        animate={{
          scale: [1, 1 + audioLevel * 0.5, 1],
          opacity: [0.3, 0.6 + audioLevel * 0.4, 0.3],
        }}
        transition={{ duration: 0.3, repeat: Infinity }}
      >
        <div
          className="w-4 h-4 rounded-full"
          style={{
            backgroundColor: keyColor,
            boxShadow: `0 0 ${20 + audioLevel * 40}px ${10 + audioLevel * 20}px ${keyColor}`,
          }}
        />
      </motion.div>
    </div>
  );
}

// ============================================
// Scene: Forest (Magical Glade)
// ============================================

function ForestScene({ audioLevel, pulse, keyColor }: { audioLevel: number; pulse: number; keyColor: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Forest canopy light */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-900 via-green-800 to-emerald-950" />

      {/* Dappled light */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${10 + i * 6}%`,
            top: `${5 + (i % 3) * 8}%`,
            width: `${30 + i * 5}px`,
            height: `${30 + i * 5}px`,
            background: 'radial-gradient(circle, rgba(254, 249, 195, 0.3) 0%, transparent 70%)',
          }}
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* Trees background */}
      <svg className="absolute bottom-[25%] left-0 right-0 w-full h-[60%]" viewBox="0 0 1440 400" preserveAspectRatio="none">
        {/* Far trees */}
        <g fill="rgba(5, 46, 22, 0.8)">
          {[0, 100, 180, 280, 380, 480, 580, 680, 780, 880, 980, 1080, 1180, 1280, 1380].map((x, i) => (
            <path key={i} d={`M${x + 30} 400 L${x + 30} ${280 - i * 5} L${x} ${330 - i * 5} L${x + 15} ${330 - i * 5} L${x - 10} ${360 - i * 5} L${x + 70} ${360 - i * 5} L${x + 45} ${330 - i * 5} L${x + 60} ${330 - i * 5} Z`} />
          ))}
        </g>
        {/* Closer trees */}
        <g fill="rgba(20, 83, 45, 0.9)">
          {[50, 200, 400, 550, 750, 900, 1100, 1250, 1400].map((x, i) => (
            <path key={i} d={`M${x + 40} 400 L${x + 40} ${250 - i * 3} L${x} ${310 - i * 3} L${x + 20} ${310 - i * 3} L${x - 15} ${350 - i * 3} L${x + 95} ${350 - i * 3} L${x + 60} ${310 - i * 3} L${x + 80} ${310 - i * 3} Z`} />
          ))}
        </g>
      </svg>

      {/* Magical glade floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-gradient-to-t from-emerald-950 via-green-900/80 to-transparent" />

      {/* Moss and grass */}
      <div
        className="absolute bottom-0 left-0 right-0 h-8"
        style={{
          background: 'linear-gradient(to top, #14532d, transparent)',
        }}
      />

      {/* Magic circle on ground */}
      <motion.div
        className="absolute bottom-[10%] left-1/2 -translate-x-1/2"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      >
        <svg width="300" height="100" viewBox="0 0 300 100">
          <ellipse cx="150" cy="50" rx="140" ry="40" fill="none" stroke={keyColor} strokeWidth="2" opacity="0.3" />
          <ellipse cx="150" cy="50" rx="110" ry="30" fill="none" stroke={keyColor} strokeWidth="1" opacity="0.2" />
          {/* Runes */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const x = 150 + Math.cos(angle) * 120;
            const y = 50 + Math.sin(angle) * 35;
            return (
              <motion.text
                key={i}
                x={x}
                y={y}
                fill={keyColor}
                fontSize="12"
                textAnchor="middle"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, delay: i * 0.25, repeat: Infinity }}
              >
                ✦
              </motion.text>
            );
          })}
        </svg>
      </motion.div>

      {/* Fireflies */}
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${5 + Math.random() * 90}%`,
            top: `${20 + Math.random() * 55}%`,
            width: '4px',
            height: '4px',
            backgroundColor: i % 3 === 0 ? keyColor : '#fef08a',
            boxShadow: `0 0 8px 3px ${i % 3 === 0 ? keyColor : 'rgba(253, 224, 71, 0.6)'}`,
          }}
          animate={{
            opacity: [0, 0.9, 0],
            x: [0, 20 - Math.random() * 40, 0],
            y: [0, -15 + Math.random() * 30, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            delay: Math.random() * 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Magical particles rising */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={`magic-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${35 + i * 2}%`,
            bottom: '12%',
            backgroundColor: keyColor,
            boxShadow: `0 0 6px ${keyColor}`,
          }}
          animate={{
            y: [0, -200, -350],
            x: [0, (i % 2 === 0 ? 15 : -15), 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.3],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            delay: i * 0.4,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Mushrooms */}
      {[15, 82].map((x, i) => (
        <motion.svg
          key={i}
          className="absolute bottom-[8%]"
          style={{ left: `${x}%` }}
          width="40"
          height="50"
          viewBox="0 0 40 50"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
        >
          <ellipse cx="20" cy="25" rx="18" ry="12" fill="#ef4444" />
          <circle cx="12" cy="22" r="3" fill="#fef3c7" opacity="0.8" />
          <circle cx="25" cy="20" r="2" fill="#fef3c7" opacity="0.8" />
          <circle cx="18" cy="28" r="2.5" fill="#fef3c7" opacity="0.8" />
          <rect x="17" y="35" width="6" height="15" fill="#fef3c7" rx="2" />
        </motion.svg>
      ))}

      {/* Beat pulse */}
      <GroundPulse pulse={pulse} color={keyColor} />
    </div>
  );
}

// ============================================
// User Avatar with Walking
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
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: `${position.x}%`,
        bottom: `${position.y}%`,
        transform: `scale(${position.scale}) scaleX(${position.facingRight ? 1 : -1})`,
        transformOrigin: 'bottom center',
        zIndex: Math.floor(100 - position.y),
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      {/* Username label (always correct orientation) */}
      <motion.div
        className="absolute -top-8 left-1/2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 whitespace-nowrap"
        style={{ transform: `translateX(-50%) scaleX(${position.facingRight ? 1 : -1})` }}
        animate={{ y: [-1, 1, -1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-[11px] font-medium text-white/90">
          {user.name}
          {isCurrentUser && <span className="text-indigo-400 ml-1">(you)</span>}
        </span>
      </motion.div>

      {/* Avatar container with effects */}
      <motion.div
        className="relative"
        animate={{
          y: position.isWalking ? [-2, 2, -2] : [-1, 1, -1],
          rotate: audioLevel > 0.3 ? [-1.5, 1.5, -1.5] : 0,
        }}
        transition={{
          duration: position.isWalking ? 0.3 : 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Audio-reactive glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl -z-10"
          style={{
            background: `radial-gradient(circle, ${keyColor} 0%, transparent 70%)`,
            transform: 'scale(1.5)',
          }}
          animate={{
            scale: [1.3, 1.6 + audioLevel * 0.5, 1.3],
            opacity: [0.2, 0.4 + audioLevel * 0.4, 0.2],
          }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />

        {/* Walking dust particles */}
        {position.isWalking && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-white/30"
                initial={{ opacity: 0, y: 0, x: 0 }}
                animate={{
                  opacity: [0, 0.5, 0],
                  y: [0, -8],
                  x: [(i - 1) * 5, (i - 1) * 10],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        )}

        {/* Avatar (flipped back to correct orientation) */}
        <div style={{ transform: `scaleX(${position.facingRight ? 1 : -1})` }}>
          <UserAvatar
            userId={user.id}
            username={user.name}
            size={110}
            variant="fullBody"
          />
        </div>

        {/* Instrument indicator */}
        <motion.div
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-white/30"
          style={{
            background: `linear-gradient(135deg, ${keyColor}, #8b5cf6)`,
            boxShadow: `0 0 ${audioLevel * 20}px ${keyColor}`,
            transform: `scaleX(${position.facingRight ? 1 : -1})`,
          }}
          animate={{
            scale: audioLevel > 0.2 ? [1, 1.15, 1] : 1,
            rotate: audioLevel > 0.4 ? [-4, 4, -4] : 0,
          }}
          transition={{ duration: 0.2, repeat: Infinity }}
        >
          <div className="text-white scale-[0.65]">{instrumentIcon}</div>
        </motion.div>
      </motion.div>

      {/* Audio level bars */}
      <div
        className="flex gap-0.5 h-4 mt-1"
        style={{ transform: `scaleX(${position.facingRight ? 1 : -1})` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full"
            style={{
              background: `linear-gradient(to top, ${keyColor}, #c4b5fd)`,
            }}
            animate={{
              height: audioLevel > (i + 1) * 0.18 ? [4, 14, 4] : 4,
            }}
            transition={{
              duration: 0.15,
              repeat: Infinity,
              delay: i * 0.04,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ============================================
// Scene Selector Component
// ============================================

function SceneSelector({
  currentScene,
  onSceneChange,
  keyColor,
}: {
  currentScene: SceneType;
  onSceneChange: (scene: SceneType) => void;
  keyColor: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-14 right-0 p-2 rounded-2xl backdrop-blur-xl bg-black/60 border border-white/15 shadow-2xl"
          >
            <div className="grid grid-cols-2 gap-2 w-64">
              {SCENES.map((scene) => (
                <motion.button
                  key={scene.id}
                  onClick={() => {
                    onSceneChange(scene.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${
                    currentScene === scene.id
                      ? 'bg-white/20 border border-white/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/15'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: currentScene === scene.id ? keyColor : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {scene.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{scene.name}</div>
                    <div className="text-[10px] text-white/50">{scene.description}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-xl bg-black/50 border border-white/20 hover:bg-black/60 transition-colors"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <Sparkles className="w-4 h-4 text-white/80" />
        <span className="text-xs font-medium text-white">
          {SCENES.find(s => s.id === currentScene)?.name}
        </span>
      </motion.button>
    </div>
  );
}

// ============================================
// Chat Bubble Component
// ============================================

function ChatBubble({ message, index, keyColor }: { message: { content: string; userName: string }; index: number; keyColor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -60, scale: 0.5 }}
      transition={{ duration: 0.5 }}
      className="absolute backdrop-blur-xl bg-black/40 border border-white/20 rounded-2xl px-4 py-2.5 max-w-52 shadow-2xl"
      style={{
        left: `${12 + (index % 4) * 18}%`,
        bottom: `${45 + (index % 3) * 6}%`,
        borderColor: `${keyColor}40`,
      }}
    >
      <p className="text-xs font-medium text-white/95 line-clamp-2">{message.content}</p>
      <span className="text-[10px] text-white/50 mt-0.5 block">{message.userName}</span>
      <div
        className="absolute -bottom-2 left-5 w-4 h-4 rotate-45 backdrop-blur-xl bg-black/40 border-r border-b border-white/20"
        style={{ borderColor: `${keyColor}40` }}
      />
    </motion.div>
  );
}

// ============================================
// Room Vibe Indicator
// ============================================

function RoomVibeIndicator({ userCount, audioLevel, keyColor }: { userCount: number; audioLevel: number; keyColor: string }) {
  return (
    <motion.div
      className="absolute top-4 left-4 flex items-center gap-2.5 px-4 py-2 rounded-full backdrop-blur-xl bg-black/40 border border-white/15"
      animate={{ scale: audioLevel > 0.5 ? [1, 1.03, 1] : 1 }}
      transition={{ duration: 0.3, repeat: Infinity }}
    >
      <motion.div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: '#22c55e' }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-xs font-medium text-white/90">
        {userCount} {userCount === 1 ? 'musician' : 'musicians'}
      </span>
      {audioLevel > 0.2 && (
        <motion.span
          className="text-sm"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        >
          🎵
        </motion.span>
      )}
      {audioLevel > 0.6 && (
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          <Heart className="w-3.5 h-3.5 text-pink-400" fill="#f472b6" />
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function AvatarWorldView({
  users,
  currentUser,
  audioLevels,
  activeView,
  onViewChange
}: AvatarWorldViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const messages = useRoomStore((state) => state.messages);

  // Musical state
  const tempo = useSessionTempoStore(state => state.tempo);
  const musicalKey = useSessionTempoStore(state => state.key);
  const keyScale = useSessionTempoStore(state => state.keyScale);
  const { pulse, beat, beatsPerBar, isPlaying } = useBeatPulse();

  // Scene state
  const [currentScene, setCurrentScene] = useState<SceneType>('campfire');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Get key color
  const keyColor = musicalKey ? (KEY_COLORS[musicalKey]?.primary || KEY_COLORS['C'].primary) : KEY_COLORS['C'].primary;

  // Combine users
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList;
  }, [users, currentUser]);

  // Total audio level
  const totalAudioLevel = useMemo(() => {
    let total = 0;
    audioLevels.forEach((level) => { total += level; });
    return Math.min(total / Math.max(audioLevels.size, 1), 1);
  }, [audioLevels]);

  // Walking positions
  const positions = useAvatarWalking(allUsers, audioLevels);

  // Recent messages
  const recentMessages = useMemo(() => {
    return messages
      .filter((m) => m.type === 'chat')
      .slice(-5)
      .map((m) => ({
        content: m.content,
        userName: allUsers.find(u => u.id === m.userId)?.name || 'User',
      }));
  }, [messages, allUsers]);

  // Scene change handler
  const handleSceneChange = useCallback((scene: SceneType) => {
    if (scene === currentScene) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentScene(scene);
      setTimeout(() => setIsTransitioning(false), 100);
    }, 400);
  }, [currentScene]);

  // Render scene
  const renderScene = () => {
    const sceneProps = { audioLevel: totalAudioLevel, pulse, keyColor };
    switch (currentScene) {
      case 'campfire': return <CampfireScene isDark={isDark} {...sceneProps} />;
      case 'rooftop': return <RooftopScene {...sceneProps} />;
      case 'beach': return <BeachScene {...sceneProps} />;
      case 'studio': return <StudioScene {...sceneProps} />;
      case 'space': return <SpaceScene {...sceneProps} />;
      case 'forest': return <ForestScene {...sceneProps} />;
      default: return <CampfireScene isDark={isDark} {...sceneProps} />;
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

      {/* World View Content */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scene with transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: isTransitioning ? 0 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {renderScene()}
          </motion.div>
        </AnimatePresence>

        {/* Floating music notes */}
        <FloatingMusicNotes audioLevel={totalAudioLevel} keyColor={keyColor} />

        {/* Walking avatars */}
        <AnimatePresence>
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
        </AnimatePresence>

        {/* Chat bubbles */}
        <AnimatePresence>
          {recentMessages.slice(-3).map((msg, index) => (
            <ChatBubble
              key={`${msg.content}-${index}`}
              message={msg}
              index={index}
              keyColor={keyColor}
            />
          ))}
        </AnimatePresence>

        {/* UI Overlays */}
        <RoomVibeIndicator userCount={allUsers.length} audioLevel={totalAudioLevel} keyColor={keyColor} />
        <MusicInfoDisplay
          tempo={tempo}
          musicalKey={musicalKey}
          keyScale={keyScale}
          isPlaying={isPlaying}
          pulse={pulse}
        />
        <BeatIndicator beat={beat} beatsPerBar={beatsPerBar} tempo={tempo} isPlaying={isPlaying} />

        {/* Waveform visualizer */}
        <WaveformVisualizer audioLevel={totalAudioLevel} keyColor={keyColor} />

        {/* Scene selector */}
        <SceneSelector
          currentScene={currentScene}
          onSceneChange={handleSceneChange}
          keyColor={keyColor}
        />

        {/* Ambient particles overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [-15, 15],
                x: [-8, 8],
                opacity: [0, 0.4, 0],
              }}
              transition={{
                duration: 6 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 6,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
