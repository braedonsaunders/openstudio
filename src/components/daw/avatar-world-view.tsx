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
  useVisibilityAwareAnimationFrame,
  useMusicalWorld,
  usePositionBroadcast,
  usePositionReceiver,
  useStalePositionCleanup,
  useInterpolatedPosition,
} from '@/components/world/hooks';
import { WalkingEntity } from '@/components/world/WalkingEntity';

// Import shared scene components (same as homepage)
import { SCENE_COMPONENTS, SCENE_BACKDROPS, SCENE_GROUNDS } from '@/components/world/scenes';

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

// Scene components are now imported from shared world/scenes
// They use the same detailed scenes as homepage with SceneProps interface

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
        <span className="text-sm">{instrumentIcon}</span>
        <span className="text-xs font-medium text-white capitalize">{instrumentType}</span>
        {user.isMaster && (
          <>
            <div className="w-px h-4 bg-white/20" />
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] text-yellow-400">Master</span>
          </>
        )}
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
// Walking Avatar (self-contained walking like homepage)
// ============================================

function DAWWalkingAvatar({
  user,
  audioLevel,
  isCurrentUser,
  keyColor,
  groundConfig,
  containerWidth,
  containerHeight,
  musicalContext,
  audioLevels,
  tempoMultiplier,
  onPositionUpdate,
  onStateUpdate,
  getOtherPositions,
}: {
  user: User;
  audioLevel: number;
  isCurrentUser: boolean;
  keyColor: string;
  groundConfig: SceneGroundConfig;
  containerWidth: number;
  containerHeight: number;
  musicalContext: MusicalContext;
  audioLevels: Map<string, number>;
  tempoMultiplier: number;
  onPositionUpdate?: (id: string, x: number, y: number) => void;
  onStateUpdate?: (state: EntityState) => void;
  getOtherPositions?: (excludeId: string) => Array<{ x: number; y: number }>;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const instrumentType = user.instrument || 'other';
  const instrumentIcon = INSTRUMENT_ICONS[instrumentType.toLowerCase()] || INSTRUMENT_ICONS.other;

  // Walking config
  const config = DAW_WALKING_CONFIG;

  // Internal walking state (like homepage WalkingCharacter)
  const [walkState, setWalkState] = useState<EntityState>(() => {
    const { walkableArea } = groundConfig;
    const x = walkableArea.minX + Math.random() * (walkableArea.maxX - walkableArea.minX);
    const y = walkableArea.minY + Math.random() * (walkableArea.maxY - walkableArea.minY);
    return {
      x,
      y,
      targetX: x,
      targetY: y,
      facingRight: Math.random() > 0.5,
      isWalking: false,
      isSettling: false,
      walkTimer: 0,
      idleTimer: config.idleDuration[0] + Math.random() * (config.idleDuration[1] - config.idleDuration[0]),
      settlingTimer: 0,
      timestamp: Date.now(),
    };
  });

  // Position tracking for collision avoidance
  useEffect(() => {
    onPositionUpdate?.(user.id, walkState.x, walkState.y);
  }, [user.id, walkState.x, walkState.y, onPositionUpdate]);

  // Broadcast state updates for position sync
  useEffect(() => {
    onStateUpdate?.(walkState);
  }, [walkState, onStateUpdate]);

  // Walking animation loop (runs continuously)
  useVisibilityAwareAnimationFrame(
    (deltaTime) => {
      setWalkState((prev) => {
        const { walkableArea } = groundConfig;
        const effectiveSpeed = config.tempoInfluence
          ? config.walkSpeed * tempoMultiplier
          : config.walkSpeed;

        if (prev.isWalking) {
          const dx = prev.targetX - prev.x;
          const dy = prev.targetY - prev.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 1 || prev.walkTimer <= 0) {
            return {
              ...prev,
              x: distance < 1 ? prev.targetX : prev.x,
              y: distance < 1 ? prev.targetY : prev.y,
              isWalking: false,
              isSettling: true,
              settlingTimer: config.settlingDuration,
              timestamp: Date.now(),
            };
          }

          const moveX = (dx / distance) * effectiveSpeed * deltaTime;
          const moveY = (dy / distance) * effectiveSpeed * deltaTime;
          const newX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, prev.x + moveX));
          const newY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, prev.y + moveY));

          // Collision check
          const otherPos = getOtherPositions?.(user.id) ?? [];
          const wouldCollide = otherPos.some(other => {
            const cdx = newX - other.x;
            const cdy = newY - other.y;
            return Math.sqrt(cdx * cdx + cdy * cdy) < config.minEntityDistance;
          });

          if (wouldCollide) {
            return {
              ...prev,
              isWalking: false,
              isSettling: true,
              settlingTimer: config.settlingDuration,
              timestamp: Date.now(),
            };
          }

          return {
            ...prev,
            x: newX,
            y: newY,
            walkTimer: prev.walkTimer - deltaTime,
            facingRight: dx > 0,
            timestamp: Date.now(),
          };
        } else if (prev.isSettling) {
          if (prev.settlingTimer <= 0) {
            return {
              ...prev,
              isSettling: false,
              idleTimer: config.idleDuration[0] + Math.random() * (config.idleDuration[1] - config.idleDuration[0]),
              timestamp: Date.now(),
            };
          }
          return { ...prev, settlingTimer: prev.settlingTimer - deltaTime };
        } else {
          // Idle - count down then start walking
          if (prev.idleTimer <= 0) {
            const maxStepX = 15;
            const maxStepY = 12;
            const otherPos = getOtherPositions?.(user.id) ?? [];

            // Try to find a valid target
            for (let attempt = 0; attempt < 8; attempt++) {
              const offsetX = (Math.random() - 0.5) * 2 * maxStepX;
              const offsetY = (Math.random() - 0.3) * 2 * maxStepY;
              const targetX = Math.max(walkableArea.minX, Math.min(walkableArea.maxX, prev.x + offsetX));
              const targetY = Math.max(walkableArea.minY, Math.min(walkableArea.maxY, prev.y + offsetY));

              // Check collision at target
              const wouldCollide = otherPos.some(other => {
                const dx = targetX - other.x;
                const dy = targetY - other.y;
                return Math.sqrt(dx * dx + dy * dy) < config.minEntityDistance;
              });

              if (!wouldCollide) {
                return {
                  ...prev,
                  targetX,
                  targetY,
                  isWalking: true,
                  facingRight: targetX > prev.x,
                  walkTimer: config.walkDuration[0] + Math.random() * (config.walkDuration[1] - config.walkDuration[0]),
                  timestamp: Date.now(),
                };
              }
            }

            // Couldn't find target, try again soon
            return { ...prev, idleTimer: config.idleDuration[0] * 0.5 };
          }

          return { ...prev, idleTimer: prev.idleTimer - deltaTime };
        }
      });
    },
    true, // Always visible when rendered (like homepage)
    [groundConfig, tempoMultiplier, user.id, getOtherPositions]
  );

  // Click outside to close popup
  useEffect(() => {
    if (!showPopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  return (
    <WalkingEntity
      id={user.id}
      state={walkState}
      groundConfig={groundConfig}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      baseSize={100}
      musicalContext={musicalContext}
      audioLevel={audioLevel}
      audioLevels={audioLevels}
      showName={false}
      showGlow={true}
      glowColor={keyColor}
      isCurrentUser={isCurrentUser}
      isRemote={false}
      onClick={() => setShowPopup(!showPopup)}
    >
      {/* Custom avatar content */}
      <div className="relative w-full h-full" ref={popupRef}>
        {/* Instrument icon + name above - counteract parent flip so text stays readable */}
        <div
          className="absolute -top-7 left-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 whitespace-nowrap pointer-events-none"
          style={{ transform: `translateX(-50%) scaleX(${walkState.facingRight ? 1 : -1})` }}
        >
          <div className="text-white/80 scale-75">{instrumentIcon}</div>
          <span className="text-[10px] font-medium text-white/90">{user.name}</span>
          {isCurrentUser && <span className="text-[9px] text-indigo-400">(you)</span>}
        </div>

        {/* Avatar - no flip needed, WalkingEntity handles it */}
        <UserAvatar userId={user.id} username={user.name} size={100} variant="fullBody" />

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
// Remote User Avatar (uses synced positions)
// ============================================

function RemoteUserAvatar({
  user,
  position,
  audioLevel,
  keyColor,
  groundConfig,
  containerWidth,
  containerHeight,
  musicalContext,
  audioLevels,
}: {
  user: User;
  position: WorldPosition;
  audioLevel: number;
  keyColor: string;
  groundConfig: SceneGroundConfig;
  containerWidth: number;
  containerHeight: number;
  musicalContext: MusicalContext;
  audioLevels: Map<string, number>;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const instrumentType = user.instrument || 'other';
  const instrumentIcon = INSTRUMENT_ICONS[instrumentType.toLowerCase()] || INSTRUMENT_ICONS.other;

  // Convert WorldPosition to EntityState for WalkingEntity
  const state: EntityState = {
    x: position.x,
    y: position.y,
    targetX: position.targetX ?? position.x,
    targetY: position.targetY ?? position.y,
    facingRight: position.facingRight,
    isWalking: position.isWalking,
    isSettling: false,
    walkTimer: 0,
    idleTimer: 0,
    settlingTimer: 0,
    timestamp: position.timestamp,
  };

  // Click outside to close popup
  useEffect(() => {
    if (!showPopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  return (
    <WalkingEntity
      id={user.id}
      state={state}
      groundConfig={groundConfig}
      containerWidth={containerWidth}
      containerHeight={containerHeight}
      baseSize={100}
      musicalContext={musicalContext}
      audioLevel={audioLevel}
      audioLevels={audioLevels}
      showName={false}
      showGlow={true}
      glowColor={keyColor}
      isCurrentUser={false}
      isRemote={true}
      onClick={() => setShowPopup(!showPopup)}
    >
      <div className="relative w-full h-full" ref={popupRef}>
        {/* Instrument icon + name above - counteract parent flip */}
        <div
          className="absolute -top-7 left-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 whitespace-nowrap pointer-events-none"
          style={{ transform: `translateX(-50%) scaleX(${state.facingRight ? 1 : -1})` }}
        >
          <div className="text-white/80 scale-75">{instrumentIcon}</div>
          <span className="text-[10px] font-medium text-white/90">{user.name}</span>
        </div>

        {/* Avatar - no flip needed, WalkingEntity handles it */}
        <UserAvatar userId={user.id} username={user.name} size={100} variant="fullBody" />

        {/* Profile popup */}
        <AnimatePresence>
          {showPopup && (
            <UserProfilePopup
              user={user}
              isCurrentUser={false}
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

  // Tempo-based speed multiplier
  const tempoMultiplier = useMemo(() => {
    if (!isPlaying || tempo <= 0) return 1;
    return Math.max(0.5, Math.min(1.5, tempo / 120));
  }, [tempo, isPlaying]);

  // Position tracking for collision avoidance (each avatar manages its own walking)
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const updatePosition = useCallback((id: string, x: number, y: number) => {
    positionsRef.current.set(id, { x, y });
  }, []);

  const getOtherPositions = useCallback((excludeId: string) => {
    const result: Array<{ x: number; y: number }> = [];
    positionsRef.current.forEach((pos, id) => {
      if (id !== excludeId) {
        result.push(pos);
      }
    });
    return result;
  }, []);

  // Track local user's walk state for broadcasting
  const [localWalkState, setLocalWalkState] = useState<EntityState | null>(null);

  // Position sync: broadcast local user's position
  const broadcastFn = realtimeManager?.broadcastWorldPosition ?? null;
  usePositionBroadcast(localWalkState, currentUser?.id ?? null, broadcastFn, isVisible);

  // Position sync: receive remote positions
  const { handlePosition } = usePositionReceiver(currentUser?.id ?? null, null, isVisible);

  // Get remote positions from store
  const remotePositions = useRoomStore(state => state.worldPositions);

  // Set up realtime listener
  useEffect(() => {
    if (!realtimeManager) return;
    return realtimeManager.on('world:position', handlePosition);
  }, [realtimeManager, handlePosition]);

  // Clean up stale positions
  useStalePositionCleanup();

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

  // Render scene - uses shared scene components from homepage
  const renderScene = () => {
    const SceneComponent = SCENE_COMPONENTS[currentScene];
    return <SceneComponent isDark={isDark} keyColor={keyColor} audioLevel={totalAudioLevel} />;
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

        {/* Local User Avatar (self-contained walking) */}
        {isVisible && currentUser && (
          <DAWWalkingAvatar
            key={currentUser.id}
            user={currentUser}
            audioLevel={audioLevels.get(currentUser.id) || 0}
            isCurrentUser={true}
            keyColor={keyColor}
            groundConfig={groundConfig}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            musicalContext={musicalContext}
            audioLevels={audioLevels}
            tempoMultiplier={tempoMultiplier}
            onPositionUpdate={updatePosition}
            onStateUpdate={setLocalWalkState}
            getOtherPositions={getOtherPositions}
          />
        )}

        {/* Remote User Avatars (synced positions) */}
        {isVisible && users.filter(u => u.id !== currentUser?.id).map((user) => {
          const remotePosition = remotePositions.get(user.id);
          if (!remotePosition) return null;

          return (
            <RemoteUserAvatar
              key={user.id}
              user={user}
              position={remotePosition}
              audioLevel={audioLevels.get(user.id) || 0}
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
