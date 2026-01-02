'use client';

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme/ThemeProvider';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { useRoomStore, type WorldPosition } from '@/stores/room-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
import { useMetronomeStore } from '@/stores/metronome-store';
import type { User } from '@/types';
import {
  Music, Mic, Guitar, Users2, Flame, TreePine, Building2,
  Palmtree, Disc3, Rocket, Sparkles, Volume2, Heart
} from 'lucide-react';
import { Drum, Piano } from '../icons';

// Import shared world components
import {
  SCENE_CONFIGS,
  KEY_COLORS,
  calculateAvatarScale,
  calculateAvatarZIndex,
  type SceneType,
  type SceneGroundConfig,
  DAW_WALKING_CONFIG,
  type MusicalContext,
  type EntityState,
} from '@/components/world';
import {
  useWorldVisibility,
  useWalkingBehavior,
  useMusicalWorld,
  usePositionBroadcast,
  usePositionReceiver,
  useStalePositionCleanup,
  useInterpolatedPosition,
} from '@/components/world/hooks';
import { WalkingEntity } from '@/components/world/WalkingEntity';

// ============================================
// Types & Constants
// ============================================

interface AvatarWorldViewProps {
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  realtimeManager?: {
    broadcastWorldPosition: (position: Omit<WorldPosition, 'userId' | 'timestamp'>) => Promise<void>;
    on: (event: string, callback: (data: unknown) => void) => () => void;
  } | null;
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
// Stars Component
// ============================================

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
// Scene Components (simplified - using shared config)
// ============================================

function CampfireScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const config = SCENE_CONFIGS.campfire.ground;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: `${config.horizonY}%` }}
      >
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-indigo-950 via-purple-900 to-violet-800'
            : 'bg-gradient-to-b from-amber-200 via-orange-300 to-rose-400'
        }`} />
        {isDark && <Stars count={25} />}

        {/* Moon/Sun */}
        <div
          className={`absolute top-[20%] left-[15%] w-10 h-10 rounded-full ${
            isDark ? 'bg-gradient-to-br from-gray-100 to-gray-300' : 'bg-gradient-to-br from-yellow-300 to-orange-400'
          }`}
          style={{ boxShadow: isDark ? '0 0 30px 10px rgba(255, 255, 255, 0.15)' : '0 0 40px 15px rgba(255, 180, 100, 0.4)' }}
        />

        {/* Treeline */}
        <svg className="absolute bottom-0 left-0 right-0 w-full h-[50%]" viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path
            d="M0 100 L0 60 Q50 30 100 50 Q150 20 200 45 Q250 15 300 40 Q350 25 400 55 Q450 20 500 45 Q550 30 600 50 Q650 15 700 40 Q750 25 800 55 Q850 20 900 45 Q950 30 1000 50 Q1050 15 1100 40 Q1150 25 1200 55 Q1250 20 1300 45 Q1350 30 1400 50 L1440 60 L1440 100 Z"
            fill={isDark ? 'rgba(15, 10, 40, 0.9)' : 'rgba(60, 40, 30, 0.6)'}
          />
        </svg>
      </div>

      {/* Ground */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-violet-900/90 via-indigo-950 to-slate-950'
            : 'bg-gradient-to-b from-amber-600/70 via-amber-700/80 to-amber-800/90'
        }`} />

        {/* Campfire */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '25%' }}>
          <svg width="120" height="100" viewBox="0 0 120 100">
            <rect x="25" y="75" width="70" height="12" rx="6" fill="#78350f" transform="rotate(-6 60 80)" />
            <rect x="25" y="75" width="70" height="12" rx="6" fill="#92400e" transform="rotate(6 60 80)" />
            <ellipse cx="60" cy="70" rx="35" ry="20" fill={keyColor} opacity="0.25" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }} />
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

        {/* Fireflies */}
        {Array.from({ length: 12 }, (_, i) => (
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
        ))}
      </div>
    </div>
  );
}

// Simplified scene stubs - keep the structure, reference shared config
function RooftopScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const config = SCENE_CONFIGS.rooftop.ground;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-purple-900' : 'bg-gradient-to-b from-sky-400 via-blue-300 to-indigo-300'}`} />
        {isDark && <Stars count={20} />}
      </div>
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900' : 'bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500'}`} />
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${keyColor}, transparent)`, opacity: 0.6 }} />
      </div>
    </div>
  );
}

function BeachScene({ keyColor, isDark }: { keyColor: string; isDark: boolean }) {
  const config = SCENE_CONFIGS.beach.ground;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-orange-400 via-pink-500 to-purple-600' : 'bg-gradient-to-b from-sky-300 via-cyan-200 to-blue-300'}`} />
        <div className={`absolute bottom-[15%] left-1/2 -translate-x-1/2 w-16 h-16 rounded-full ${isDark ? 'bg-gradient-to-b from-yellow-300 to-orange-500' : 'bg-gradient-to-b from-yellow-200 to-yellow-400'}`} style={{ boxShadow: isDark ? '0 0 40px 15px rgba(255, 180, 100, 0.5)' : '0 0 50px 20px rgba(255, 220, 100, 0.6)' }} />
      </div>
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900' : 'bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400'}`} />
      </div>
    </div>
  );
}

function StudioScene({ keyColor, isDark, audioLevel = 0 }: { keyColor: string; isDark: boolean; audioLevel?: number }) {
  const config = SCENE_CONFIGS.studio.ground;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-800" />
        {/* Stage lights */}
        <div className="absolute top-2 left-1/4 w-4 h-8 bg-zinc-700 rounded-b-full">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-24 opacity-30" style={{ background: `linear-gradient(to bottom, ${keyColor}, transparent)` }} />
        </div>
        <div className="absolute top-2 right-1/4 w-4 h-8 bg-zinc-700 rounded-b-full">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-24 opacity-30" style={{ background: `linear-gradient(to bottom, ${keyColor}, transparent)` }} />
        </div>
      </div>
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 via-zinc-900 to-black" />
        {/* VU Meter glow */}
        <div className="absolute top-4 right-8 w-12 h-24 rounded bg-zinc-800 border border-zinc-700 overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-100" style={{ height: `${audioLevel * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function SpaceScene({ keyColor, isDark, audioLevel = 0 }: { keyColor: string; isDark: boolean; audioLevel?: number }) {
  const config = SCENE_CONFIGS.space.ground;
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Stars count={80} />
      {/* Nebula */}
      <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse at 30% 40%, ${keyColor}40 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, #8b5cf640 0%, transparent 50%)` }} />
      {/* Platform */}
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950/80" />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${keyColor}60, transparent)` }} />
      </div>
    </div>
  );
}

function ForestScene({ keyColor, isDark, audioLevel = 0 }: { keyColor: string; isDark: boolean; audioLevel?: number }) {
  const config = SCENE_CONFIGS.forest.ground;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 right-0 top-0" style={{ height: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-emerald-950 via-green-900 to-green-800' : 'bg-gradient-to-b from-sky-300 via-green-200 to-green-300'}`} />
        {/* Sun rays */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full opacity-20" style={{ background: 'linear-gradient(to bottom, rgba(255,255,200,0.5) 0%, transparent 100%)' }} />
      </div>
      <div className="absolute left-0 right-0 bottom-0" style={{ top: `${config.horizonY}%` }}>
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-green-900 via-green-950 to-emerald-950' : 'bg-gradient-to-b from-green-400 via-green-500 to-green-600'}`} />
        {/* Magic circle glow */}
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 w-32 h-32 rounded-full" style={{ background: `radial-gradient(circle, ${keyColor}20 0%, transparent 70%)`, opacity: 0.3 + audioLevel * 0.5 }} />
      </div>
    </div>
  );
}

// ============================================
// User Profile Popup
// ============================================

function UserProfilePopup({
  user,
  isCurrentUser,
  keyColor,
  onClose,
}: {
  user: User;
  isCurrentUser: boolean;
  keyColor: string;
  onClose: () => void;
}) {
  const instrumentType = user.instrument || 'other';
  const instrumentIcon = INSTRUMENT_ICONS[instrumentType.toLowerCase()] || INSTRUMENT_ICONS.other;
  const tags = user.tags || [];
  const level = user.level || 1;
  const xp = user.xp || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-3 rounded-xl backdrop-blur-xl bg-black/80 border border-white/20 shadow-2xl z-[300] min-w-[180px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full overflow-hidden" style={{ borderColor: keyColor, borderWidth: 2 }}>
          <UserAvatar userId={user.id} username={user.name} size={32} variant="headshot" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{user.name}</span>
          {isCurrentUser && <span className="text-[9px] text-indigo-400">(you)</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-white/5">
        <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs font-medium text-white">Lvl {level}</span>
        <div className="w-px h-4 bg-white/20" />
        <span className="text-[10px] text-white/60">{xp.toLocaleString()} XP</span>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs font-medium text-white">
          <Users2 className="w-3 h-3" />
          View Profile
        </button>
        {!isCurrentUser && (
          <button className="flex items-center justify-center px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: keyColor }}>
            <Heart className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2 text-center text-[9px] text-white/30">Click anywhere to close</div>
    </motion.div>
  );
}

// ============================================
// Walking Avatar (using shared WalkingEntity)
// ============================================

function DAWWalkingAvatar({
  user,
  state,
  audioLevel,
  isCurrentUser,
  keyColor,
  groundConfig,
  containerWidth,
  containerHeight,
  musicalContext,
  audioLevels,
}: {
  user: User;
  state: EntityState | WorldPosition;
  audioLevel: number;
  isCurrentUser: boolean;
  keyColor: string;
  groundConfig: SceneGroundConfig;
  containerWidth: number;
  containerHeight: number;
  musicalContext: MusicalContext;
  audioLevels: Map<string, number>;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const instrumentType = user.instrument || 'other';
  const instrumentIcon = INSTRUMENT_ICONS[instrumentType.toLowerCase()] || INSTRUMENT_ICONS.other;

  return (
    <WalkingEntity
      id={user.id}
      name={user.name}
      state={state}
      groundConfig={groundConfig}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      baseSize={100}
      musicalContext={musicalContext}
      audioLevel={audioLevel}
      audioLevels={audioLevels}
      showName={true}
      showGlow={true}
      glowColor={keyColor}
      isCurrentUser={isCurrentUser}
      isRemote={'timestamp' in state && !isCurrentUser}
      onClick={() => setShowPopup(!showPopup)}
    >
      {/* Custom avatar content */}
      <div className="relative w-full h-full">
        {/* Instrument icon above */}
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 whitespace-nowrap"
          style={{ transform: `translateX(-50%) scaleX(${state.facingRight ? 1 : -1})` }}
        >
          <div className="text-white/70 scale-[0.6]">{instrumentIcon}</div>
        </div>

        {/* Avatar */}
        <div style={{ transform: `scaleX(${state.facingRight ? 1 : -1})` }}>
          <UserAvatar userId={user.id} username={user.name} size={100} variant="fullBody" />
        </div>

        {/* Profile popup */}
        <AnimatePresence>
          {showPopup && (
            <UserProfilePopup
              user={user}
              isCurrentUser={isCurrentUser}
              keyColor={keyColor}
              onClose={() => setShowPopup(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </WalkingEntity>
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
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: currentScene === scene.id ? keyColor : 'rgba(255,255,255,0.1)' }}>
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
// UI Overlays
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

export function AvatarWorldView({ users, currentUser, audioLevels, realtimeManager }: AvatarWorldViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Visibility tracking for performance
  const { containerRef, isVisible } = useWorldVisibility();
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Track container size
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  // Inject CSS keyframes
  useEffect(() => { injectKeyframes(); }, []);

  // Scene state
  const [currentScene, setCurrentScene] = useState<SceneType>('campfire');
  const groundConfig = SCENE_CONFIGS[currentScene].ground;

  // Musical context
  const tempo = useSessionTempoStore(state => state.tempo);
  const musicalKey = useSessionTempoStore(state => state.key);
  const keyScale = useSessionTempoStore(state => state.keyScale);
  const currentBeat = useMetronomeStore(state => state.currentBeat);
  const beatsPerBar = useSessionTempoStore(state => state.beatsPerBar);
  const isPlaying = useMetronomeStore(state => state.isPlaying);

  const musicalContext: MusicalContext = useMemo(() => ({
    tempo,
    beat: currentBeat,
    beatsPerBar,
    isPlaying,
    musicalKey,
    keyScale,
  }), [tempo, currentBeat, beatsPerBar, isPlaying, musicalKey, keyScale]);

  const keyColor = musicalKey ? (KEY_COLORS[musicalKey] || KEY_COLORS['C']) : KEY_COLORS['C'];

  // All users including current
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList;
  }, [users, currentUser]);

  // Walking entities
  const walkingEntities = useMemo(
    () => allUsers.map(u => ({ id: u.id })),
    [allUsers]
  );

  // Tempo-based speed multiplier
  const tempoMultiplier = useMemo(() => {
    if (!isPlaying || tempo <= 0) return 1;
    return Math.max(0.5, Math.min(1.5, tempo / 120));
  }, [tempo, isPlaying]);

  // Walking behavior with shared hook
  const { positions } = useWalkingBehavior(
    walkingEntities,
    groundConfig,
    DAW_WALKING_CONFIG,
    audioLevels,
    tempoMultiplier,
    isVisible
  );

  // Position sync: broadcast local user's position
  const localPosition = currentUser ? positions.get(currentUser.id) : null;
  const broadcastFn = realtimeManager?.broadcastWorldPosition ?? null;
  usePositionBroadcast(localPosition ?? null, currentUser?.id ?? null, broadcastFn, isVisible);

  // Position sync: receive remote positions
  const { handlePosition } = usePositionReceiver(currentUser?.id ?? null, null, isVisible);

  // Set up realtime listener
  useEffect(() => {
    if (!realtimeManager) return;
    return realtimeManager.on('world:position', handlePosition);
  }, [realtimeManager, handlePosition]);

  // Clean up stale positions
  useStalePositionCleanup();

  // Get remote positions from store
  const remotePositions = useRoomStore(state => state.worldPositions);

  // Aggregate audio level for display
  const totalAudioLevel = useMemo(() => {
    let total = 0;
    audioLevels.forEach((l) => { total += l; });
    return audioLevels.size > 0 ? Math.min(total / audioLevels.size, 1) : 0;
  }, [audioLevels]);

  // Scene change handler
  const handleSceneChange = useCallback((scene: SceneType) => {
    setCurrentScene(scene);
    realtimeManager?.broadcastWorldPosition?.({ x: 50, y: 50, facingRight: true, isWalking: false });
  }, [realtimeManager]);

  // Render scene
  const renderScene = () => {
    switch (currentScene) {
      case 'campfire': return <CampfireScene keyColor={keyColor} isDark={isDark} />;
      case 'rooftop': return <RooftopScene keyColor={keyColor} isDark={isDark} />;
      case 'beach': return <BeachScene keyColor={keyColor} isDark={isDark} />;
      case 'studio': return <StudioScene keyColor={keyColor} isDark={isDark} audioLevel={totalAudioLevel} />;
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
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
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
        {isVisible && allUsers.map((user) => {
          const isLocal = user.id === currentUser?.id;
          const localState = positions.get(user.id);
          const remoteState = remotePositions.get(user.id);

          // Use local state for current user, remote state for others
          const state = isLocal ? localState : (remoteState || localState);
          if (!state) return null;

          return (
            <DAWWalkingAvatar
              key={user.id}
              user={user}
              state={state}
              audioLevel={audioLevels.get(user.id) || 0}
              isCurrentUser={isLocal}
              keyColor={keyColor}
              groundConfig={groundConfig}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              musicalContext={musicalContext}
              audioLevels={audioLevels}
            />
          );
        })}

        {/* UI Overlays */}
        <RoomVibeIndicator userCount={allUsers.length} audioLevel={totalAudioLevel} />
        <MusicInfoDisplay tempo={tempo} musicalKey={musicalKey} keyScale={keyScale} keyColor={keyColor} />
        <BeatIndicator beat={currentBeat} beatsPerBar={beatsPerBar} isPlaying={isPlaying} />
        <SceneSelector currentScene={currentScene} onSceneChange={handleSceneChange} keyColor={keyColor} />
      </div>
    </div>
  );
}
