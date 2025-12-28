'use client';

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import {
  Mic,
  Guitar,
  Music,
  Volume2,
  VolumeX,
  Crown,
  Radio,
  Disc3,
  Music2,
  Music4,
  Signal,
  Wifi,
  Sliders,
  X,
  Power,
  BarChart3,
  Zap,
  Waves,
  Wind,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Drum, Piano } from '../icons';
import type { User, BackingTrack } from '@/types';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { MainViewSwitcher, type MainViewType } from './main-view-switcher';
import type { MasterEffectsChain } from '@/lib/audio/effects/master-effects-processor';

interface MixerViewProps {
  isMaster: boolean;
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  onUserVolumeChange?: (userId: string, volume: number) => void;
  onUserMuteChange?: (userId: string, muted: boolean) => void;
  activeView?: MainViewType;
  onViewChange?: (view: MainViewType) => void;
}

// Instrument configuration
const instrumentConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  guitar: { icon: <Guitar className="w-4 h-4" />, color: '#f59e0b' },
  bass: { icon: <Guitar className="w-4 h-4" />, color: '#22c55e' },
  drums: { icon: <Drum className="w-4 h-4" />, color: '#f97316' },
  keys: { icon: <Piano className="w-4 h-4" />, color: '#8b5cf6' },
  piano: { icon: <Piano className="w-4 h-4" />, color: '#8b5cf6' },
  vocals: { icon: <Mic className="w-4 h-4" />, color: '#ec4899' },
  mic: { icon: <Mic className="w-4 h-4" />, color: '#ec4899' },
  other: { icon: <Music className="w-4 h-4" />, color: '#3b82f6' },
};

// dB scale markings for faders
const DB_MARKS = ['+12', '+6', '0', '-6', '-12', '-24', '-48', '-∞'];
const METER_DB_MARKS = ['+6', '0', '-6', '-12', '-20', '-40'];

// Convert linear value (0-1) to dB display
function linearToDb(value: number): number {
  if (value === 0) return -Infinity;
  return 20 * Math.log10(value);
}

// Format dB value for display
function formatDb(value: number): string {
  const db = linearToDb(value);
  if (db === -Infinity) return '-∞';
  if (db >= 0) return `+${db.toFixed(1)}`;
  return db.toFixed(1);
}

// Connection quality indicator
function ConnectionIndicator({ quality }: { quality: User['connectionQuality'] }) {
  const colors = {
    excellent: 'bg-green-500',
    good: 'bg-green-400',
    fair: 'bg-yellow-500',
    poor: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'w-0.5 rounded-full transition-all',
            i === 0 ? 'h-1' : i === 1 ? 'h-1.5' : i === 2 ? 'h-2' : 'h-2.5',
            quality === 'excellent' || (quality === 'good' && i < 3) || (quality === 'fair' && i < 2) || (quality === 'poor' && i < 1)
              ? colors[quality]
              : 'bg-gray-400 dark:bg-zinc-700'
          )}
        />
      ))}
    </div>
  );
}

// LED-style Level Meter (Stereo)
function StereoMeter({ leftLevel, rightLevel, color }: { leftLevel: number; rightLevel: number; color: string }) {
  const segments = 20;

  const renderMeter = (level: number) => {
    const activeSegments = Math.floor(level * segments);

    return (
      <div className="w-1.5 h-full flex flex-col-reverse gap-[1px] p-[1px] bg-black/80 rounded-[2px]">
        {Array.from({ length: segments }).map((_, i) => {
          const isActive = i < activeSegments;
          const segmentColor = i > segments * 0.85
            ? '#ef4444' // Red - clip
            : i > segments * 0.7
            ? '#f59e0b' // Amber - hot
            : i > segments * 0.5
            ? '#eab308' // Yellow - nominal
            : color; // Channel color - safe

          return (
            <motion.div
              key={i}
              className="flex-1 rounded-[1px]"
              animate={{
                backgroundColor: isActive ? segmentColor : '#1f1f1f',
                boxShadow: isActive ? `0 0 3px ${segmentColor}60` : 'none',
              }}
              transition={{ duration: 0.05 }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex gap-[2px] h-full">
      {renderMeter(leftLevel)}
      {renderMeter(rightLevel)}
    </div>
  );
}

// Vertical Fader Component
function VerticalFader({
  value,
  onChange,
  disabled,
  color,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  color: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateValue(e);
  };

  const updateValue = (e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = 1 - Math.max(0, Math.min(1, y / rect.height));
    onChange(percentage);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => updateValue(e);
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative w-4 h-full rounded cursor-pointer',
        'bg-gradient-to-b from-gray-300 via-gray-200 to-gray-300 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800',
        'border border-gray-400/50 dark:border-zinc-700/50',
        'shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]',
        disabled && 'cursor-not-allowed opacity-40'
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Fader Fill */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 rounded-b"
        style={{
          background: `linear-gradient(to top, ${color}50, ${color}20)`,
        }}
        animate={{ height: `${value * 100}%` }}
        transition={{ duration: 0.05 }}
      />

      {/* Unity Gain Line (0dB) */}
      <div
        className="absolute left-0 right-0 h-px bg-gray-500/50 dark:bg-zinc-500/50"
        style={{ bottom: '79.4%' }}
      />

      {/* Fader Cap */}
      <motion.div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 w-6 h-5',
          'rounded cursor-grab active:cursor-grabbing',
          'shadow-lg border-t border-gray-400/50 dark:border-zinc-500/50',
          isDragging && 'ring-1 ring-black/30 dark:ring-white/30'
        )}
        style={{
          bottom: `calc(${value * 100}% - 10px)`,
          background: 'linear-gradient(180deg, #888 0%, #666 50%, #555 100%)',
        }}
        animate={{ scale: isDragging ? 1.1 : 1 }}
      >
        {/* Grip Lines */}
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 space-y-[2px]">
          <div className="h-px bg-gray-400 dark:bg-zinc-600" />
          <div className="h-px bg-gray-400 dark:bg-zinc-600" />
        </div>
      </motion.div>
    </div>
  );
}

// Pan Knob
function PanKnob({ value = 0.5, onChange, disabled }: { value?: number; onChange?: (v: number) => void; disabled?: boolean }) {
  const rotation = (value - 0.5) * 270;
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startValue = useRef(value);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || !onChange) return;
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  };

  useEffect(() => {
    if (!isDragging || !onChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = (startY.current - e.clientY) / 100;
      const newValue = Math.max(0, Math.min(1, startValue.current + delta));
      onChange(newValue);
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onChange]);

  return (
    <div className="relative">
      {/* Pan markers */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-[7px] text-gray-500 dark:text-zinc-600 font-mono">L</div>
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-[7px] text-gray-500 dark:text-zinc-600 font-mono">R</div>

      <div
        ref={knobRef}
        className={cn(
          'w-7 h-7 rounded-full cursor-pointer',
          'bg-gradient-to-b from-gray-400 to-gray-500 dark:from-zinc-500 dark:to-zinc-700',
          'border border-gray-500/30 dark:border-zinc-400/30',
          'shadow-md',
          disabled && 'opacity-40 cursor-not-allowed',
          isDragging && 'ring-1 ring-black/30 dark:ring-white/30'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Indicator */}
        <div
          className="absolute top-1 left-1/2 w-[2px] h-2 bg-white rounded-full origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, transformOrigin: 'center 10px' }}
        />
      </div>
    </div>
  );
}

// User Channel Strip
function UserChannelStrip({
  user,
  isCurrentUser,
  audioLevel,
  isMaster,
  onVolumeChange,
  onMuteChange,
}: {
  user: User;
  isCurrentUser: boolean;
  audioLevel: number;
  isMaster: boolean;
  onVolumeChange?: (volume: number) => void;
  onMuteChange?: (muted: boolean) => void;
}) {
  const instrument = user.instrument?.toLowerCase() || 'other';
  const config = instrumentConfig[instrument] || instrumentConfig.other;
  const [isSolo, setIsSolo] = useState(false);

  // Create slight stereo variation for visual interest (based on user id hash, not random)
  // This provides consistent visual stereo image per user without random jitter
  const idHash = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const stereoOffset = (idHash % 10) / 100; // 0-0.09 offset
  const leftLevel = audioLevel * (0.95 + stereoOffset);
  const rightLevel = audioLevel * (0.95 + (0.09 - stereoOffset));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        'bg-gradient-to-b from-gray-200/90 to-gray-100/95 dark:from-zinc-800/90 dark:to-zinc-900/95',
        'border border-gray-300/40 dark:border-zinc-700/40',
        'shadow-xl shadow-black/10 dark:shadow-black/30',
        isCurrentUser && 'ring-1 ring-indigo-500/50'
      )}
      style={{ width: '90px', minWidth: '90px' }}
    >
      {/* Channel Header */}
      <div className="p-2 border-b border-gray-300/80 dark:border-zinc-800/80 bg-gray-100/50 dark:bg-zinc-900/50">
        <div className="flex flex-col items-center gap-1.5">
          {/* Avatar */}
          <div className="relative">
            <AvatarDisplay
              avatar={null}
              username={user.name}
              size="sm"
              showEffects={audioLevel > 0.1}
            />
            {audioLevel > 0.1 && (
              <motion.div
                className="absolute -inset-0.5 rounded-full border-2"
                style={{ borderColor: config.color }}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
            {user.isMaster && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow">
                <Crown className="w-2.5 h-2.5 text-black" />
              </div>
            )}
          </div>

          {/* Name */}
          <div className="w-full text-center">
            <div className="text-[10px] font-semibold text-gray-800 dark:text-zinc-200 truncate px-1">
              {isCurrentUser ? 'YOU' : user.name.split(' ')[0]}
            </div>
          </div>

          {/* Instrument Badge */}
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-medium"
            style={{
              backgroundColor: `${config.color}20`,
              color: config.color
            }}
          >
            {config.icon}
            <span className="capitalize">{instrument}</span>
          </div>
        </div>
      </div>

      {/* Pan Section */}
      <div className="flex justify-center py-2 border-b border-gray-300/50 dark:border-zinc-800/50">
        <PanKnob disabled={!isMaster || isCurrentUser} />
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex items-stretch gap-1 px-2 py-2 min-h-0">
        {/* Left dB Scale */}
        <div className="flex flex-col justify-between text-[6px] text-gray-500 dark:text-zinc-600 font-mono py-1">
          {METER_DB_MARKS.map((mark) => (
            <span key={mark}>{mark}</span>
          ))}
        </div>

        {/* Meter */}
        <StereoMeter
          leftLevel={user.isMuted ? 0 : leftLevel}
          rightLevel={user.isMuted ? 0 : rightLevel}
          color={config.color}
        />

        {/* Fader */}
        <div className="flex-1 flex justify-center">
          <VerticalFader
            value={user.volume}
            onChange={onVolumeChange || (() => {})}
            disabled={!isMaster || isCurrentUser}
            color={config.color}
          />
        </div>
      </div>

      {/* dB Display */}
      <div className="px-2 pb-1">
        <div className="flex justify-center">
          <div className="px-2 py-0.5 rounded bg-white/60 dark:bg-black/60 border border-gray-300 dark:border-zinc-800">
            <span className="text-[9px] font-mono text-green-600 dark:text-green-400">
              {formatDb(user.volume)}
            </span>
          </div>
        </div>
      </div>

      {/* Mute/Solo */}
      <div className="flex gap-1 p-2 border-t border-gray-300/50 dark:border-zinc-800/50">
        <button
          onClick={() => !isCurrentUser && isMaster && onMuteChange?.(!user.isMuted)}
          disabled={isCurrentUser || !isMaster}
          className={cn(
            'flex-1 py-1 rounded text-[9px] font-bold tracking-wide transition-all',
            user.isMuted
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]'
              : 'bg-gray-300/80 dark:bg-zinc-700/80 text-gray-600 dark:text-zinc-400 hover:bg-gray-400 dark:hover:bg-zinc-600',
            (isCurrentUser || !isMaster) && 'cursor-not-allowed opacity-50'
          )}
        >
          M
        </button>
        <button
          onClick={() => !isCurrentUser && isMaster && setIsSolo(!isSolo)}
          disabled={isCurrentUser || !isMaster}
          className={cn(
            'flex-1 py-1 rounded text-[9px] font-bold tracking-wide transition-all',
            isSolo
              ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
              : 'bg-gray-300/80 dark:bg-zinc-700/80 text-gray-600 dark:text-zinc-400 hover:bg-gray-400 dark:hover:bg-zinc-600',
            (isCurrentUser || !isMaster) && 'cursor-not-allowed opacity-50'
          )}
        >
          S
        </button>
      </div>

      {/* Connection Quality */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 border-t border-gray-300/50 dark:border-zinc-800/50 bg-gray-100/30 dark:bg-zinc-900/30">
        <ConnectionIndicator quality={user.connectionQuality} />
        <span className="text-[7px] text-gray-500 dark:text-zinc-600">{user.latency}ms</span>
      </div>
    </motion.div>
  );
}

// Track Channel Strip (for backing track)
function TrackChannelStrip({
  track,
  isMaster,
  audioLevel,
}: {
  track: BackingTrack;
  isMaster: boolean;
  audioLevel: number;
}) {
  const { backingTrackVolume, setBackingTrackVolume } = useAudioStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isSolo, setIsSolo] = useState(false);

  // Use actual audio level from the engine
  const level = audioLevel;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        'bg-gradient-to-b from-indigo-200/40 to-gray-100/95 dark:from-indigo-900/40 dark:to-zinc-900/95',
        'border border-indigo-400/30 dark:border-indigo-500/30',
        'shadow-xl shadow-black/10 dark:shadow-black/30'
      )}
      style={{ width: '100px', minWidth: '100px' }}
    >
      {/* Channel Header */}
      <div className="p-2 border-b border-indigo-300/50 dark:border-indigo-900/50 bg-indigo-100/30 dark:bg-indigo-950/30">
        <div className="flex flex-col items-center gap-1.5">
          {/* Track Icon */}
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/40 flex items-center justify-center">
              {track.thumbnail ? (
                <img
                  src={track.thumbnail}
                  alt=""
                  className="w-full h-full rounded-lg object-cover"
                />
              ) : (
                <Disc3 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              )}
            </div>
            <motion.div
              className="absolute -inset-0.5 rounded-lg border border-indigo-500/50"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          {/* Track Name */}
          <div className="w-full text-center">
            <div className="text-[9px] font-semibold text-indigo-700 dark:text-indigo-200 truncate px-1">
              {track.name}
            </div>
            {track.artist && (
              <div className="text-[7px] text-indigo-500/70 dark:text-indigo-400/70 truncate px-1">
                {track.artist}
              </div>
            )}
          </div>

          {/* Track Type Badge */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-[8px] font-medium text-indigo-600 dark:text-indigo-300">
            <Radio className="w-2.5 h-2.5" />
            <span>TRACK</span>
          </div>
        </div>
      </div>

      {/* Pan Section */}
      <div className="flex justify-center py-2 border-b border-indigo-300/30 dark:border-indigo-900/30">
        <PanKnob disabled={!isMaster} />
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex items-stretch gap-1 px-2 py-2 min-h-0">
        {/* Left dB Scale */}
        <div className="flex flex-col justify-between text-[6px] text-gray-500 dark:text-zinc-600 font-mono py-1">
          {METER_DB_MARKS.map((mark) => (
            <span key={mark}>{mark}</span>
          ))}
        </div>

        {/* Meter */}
        <StereoMeter
          leftLevel={isMuted ? 0 : level}
          rightLevel={isMuted ? 0 : level * 0.95}
          color="#818cf8"
        />

        {/* Fader */}
        <div className="flex-1 flex justify-center">
          <VerticalFader
            value={backingTrackVolume}
            onChange={setBackingTrackVolume}
            disabled={!isMaster}
            color="#818cf8"
          />
        </div>
      </div>

      {/* dB Display */}
      <div className="px-2 pb-1">
        <div className="flex justify-center">
          <div className="px-2 py-0.5 rounded bg-white/60 dark:bg-black/60 border border-indigo-300/50 dark:border-indigo-800/50">
            <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-300">
              {formatDb(backingTrackVolume)}
            </span>
          </div>
        </div>
      </div>

      {/* Mute/Solo */}
      <div className="flex gap-1 p-2 border-t border-indigo-300/30 dark:border-indigo-900/30">
        <button
          onClick={() => isMaster && setIsMuted(!isMuted)}
          disabled={!isMaster}
          className={cn(
            'flex-1 py-1 rounded text-[9px] font-bold tracking-wide transition-all',
            isMuted
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]'
              : 'bg-gray-300/80 dark:bg-zinc-700/80 text-gray-600 dark:text-zinc-400 hover:bg-gray-400 dark:hover:bg-zinc-600',
            !isMaster && 'cursor-not-allowed opacity-50'
          )}
        >
          M
        </button>
        <button
          onClick={() => isMaster && setIsSolo(!isSolo)}
          disabled={!isMaster}
          className={cn(
            'flex-1 py-1 rounded text-[9px] font-bold tracking-wide transition-all',
            isSolo
              ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
              : 'bg-gray-300/80 dark:bg-zinc-700/80 text-gray-600 dark:text-zinc-400 hover:bg-gray-400 dark:hover:bg-zinc-600',
            !isMaster && 'cursor-not-allowed opacity-50'
          )}
        >
          S
        </button>
      </div>

      {/* Stereo Label */}
      <div className="flex items-center justify-center py-1.5 border-t border-indigo-300/30 dark:border-indigo-900/30 bg-indigo-100/20 dark:bg-indigo-950/20">
        <span className="text-[7px] text-indigo-500/60 dark:text-indigo-400/60 font-mono">STEREO</span>
      </div>
    </motion.div>
  );
}

// Master Channel Strip
function MasterChannelStrip({
  isMaster: isRoomMaster,
  audioLevel,
  onOpenMasterFx,
}: {
  isMaster: boolean;
  audioLevel: number;
  onOpenMasterFx?: () => void;
}) {
  const { masterVolume, setMasterVolume } = useAudioStore();
  const {
    setMasterEffectsEnabled,
    isMasterEffectsEnabled,
    getMasterEffectsMetering,
  } = useAudioEngine();

  const [fxEnabled, setFxEnabled] = useState(false);
  const [metering, setMetering] = useState<{ compressorReduction: number; limiterReduction: number } | null>(null);

  // Sync local state with engine state
  useEffect(() => {
    setFxEnabled(isMasterEffectsEnabled());
  }, [isMasterEffectsEnabled]);

  // Update metering data periodically when FX enabled
  useEffect(() => {
    if (!fxEnabled) {
      setMetering(null);
      return;
    }
    const interval = setInterval(() => {
      setMetering(getMasterEffectsMetering());
    }, 100);
    return () => clearInterval(interval);
  }, [fxEnabled, getMasterEffectsMetering]);

  const toggleFx = () => {
    const newState = !fxEnabled;
    setFxEnabled(newState);
    setMasterEffectsEnabled(newState);
  };

  // Use actual audio level from the engine
  const level = audioLevel;

  // Show gain reduction indicator
  const gainReduction = metering
    ? Math.max(metering.compressorReduction, metering.limiterReduction)
    : 0;

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        'bg-gradient-to-b from-amber-200/30 to-gray-100/95 dark:from-amber-900/30 dark:to-zinc-900/95',
        'border-2 border-amber-500/40 dark:border-amber-600/40',
        'shadow-xl shadow-black/10 dark:shadow-black/30'
      )}
      style={{ width: '110px', minWidth: '110px' }}
    >
      {/* Master Header */}
      <div className="p-3 border-b border-amber-300/40 dark:border-amber-900/40 bg-amber-100/30 dark:bg-amber-950/30">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/50 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-xs font-bold text-amber-600 dark:text-amber-300 tracking-wider">MASTER</div>

          {/* Stereo Link */}
          <div className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
            <span className="text-[7px] text-amber-600 dark:text-amber-300 font-mono">STEREO LINK</span>
          </div>
        </div>
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex items-stretch gap-2 px-3 py-2 min-h-0">
        {/* Left dB Scale */}
        <div className="flex flex-col justify-between text-[6px] text-gray-500 dark:text-zinc-600 font-mono py-1">
          {METER_DB_MARKS.map((mark) => (
            <span key={mark}>{mark}</span>
          ))}
        </div>

        {/* Left Meter */}
        <StereoMeter
          leftLevel={level}
          rightLevel={level * 0.95}
          color="#f59e0b"
        />

        {/* Fader */}
        <div className="flex-1 flex justify-center">
          <VerticalFader
            value={masterVolume}
            onChange={setMasterVolume}
            disabled={!isRoomMaster}
            color="#f59e0b"
          />
        </div>

        {/* Right Meter */}
        <StereoMeter
          leftLevel={level * 0.98}
          rightLevel={level * 0.93}
          color="#f59e0b"
        />
      </div>

      {/* dB Display */}
      <div className="px-2 pb-2">
        <div className="flex justify-center">
          <div className="px-3 py-1 rounded bg-white/60 dark:bg-black/60 border border-amber-400/50 dark:border-amber-700/50">
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-300 font-bold">
              {formatDb(masterVolume)}
            </span>
          </div>
        </div>
      </div>

      {/* Master Controls */}
      <div className="px-2 pb-2 space-y-1">
        {/* FX Toggle Button */}
        <button
          onClick={toggleFx}
          disabled={!isRoomMaster}
          className={cn(
            'w-full py-1.5 rounded text-[8px] font-bold tracking-wider flex items-center justify-center gap-1 transition-all border',
            fxEnabled
              ? 'bg-indigo-500/80 text-white border-indigo-400/50 shadow-lg shadow-indigo-500/20'
              : 'bg-gray-300/60 dark:bg-zinc-700/60 text-gray-600 dark:text-zinc-400 border-transparent hover:bg-gray-400 dark:hover:bg-zinc-600',
            !isRoomMaster && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Sliders className="w-3 h-3" />
          FX {fxEnabled ? 'ON' : 'OFF'}
        </button>

        {/* Gain Reduction Indicator (when FX enabled) */}
        {fxEnabled && gainReduction > 0.5 && (
          <div className="flex items-center justify-center gap-1 text-[7px] text-amber-500 dark:text-amber-400">
            <span>GR: -{gainReduction.toFixed(1)}dB</span>
          </div>
        )}

        {/* Edit FX Button - always visible, disabled when FX off or not master */}
        <button
          onClick={onOpenMasterFx}
          disabled={!isRoomMaster || !fxEnabled}
          className={cn(
            'w-full py-1 rounded text-[7px] font-medium tracking-wider transition-colors',
            fxEnabled
              ? 'bg-gray-200/60 dark:bg-zinc-800/60 text-gray-600 dark:text-zinc-400 hover:bg-gray-300 dark:hover:bg-zinc-700 hover:text-gray-800 dark:hover:text-zinc-300'
              : 'bg-gray-200/40 dark:bg-zinc-800/40 text-gray-500 dark:text-zinc-600',
            (!isRoomMaster || !fxEnabled) && 'opacity-50 cursor-not-allowed'
          )}
        >
          EDIT FX
        </button>
      </div>

      {/* Output Label */}
      <div className="flex items-center justify-center py-2 border-t border-amber-300/40 dark:border-amber-900/40 bg-amber-100/20 dark:bg-amber-950/20">
        <span className="text-[7px] text-amber-500/60 dark:text-amber-400/60 font-mono">MAIN OUT L/R</span>
      </div>
    </div>
  );
}

// Performance display component - shows real latency metrics
// Uses same buffer logic as transport-bar for consistency
function PerformanceDisplay({ currentUser }: { currentUser: User | null }) {
  const { performanceMetrics, settings } = useAudioStore();
  const getTracksByUser = useUserTracksStore((s) => s.getTracksByUser);

  // Calculate total latency (context + output + effects)
  const totalLatency = performanceMetrics.totalLatency || 0;

  // Use same buffer logic as transport-bar for unified display
  const userBufferSize = useMemo(() => {
    if (!currentUser) return settings.bufferSize;
    const userTracks = getTracksByUser(currentUser.id);
    if (userTracks.length === 0) return settings.bufferSize;
    // Use the first audio track's buffer setting
    const audioTrack = userTracks.find((t) => t.type !== 'midi');
    return audioTrack?.audioSettings.bufferSize ?? settings.bufferSize;
  }, [currentUser, getTracksByUser, settings.bufferSize]);

  // Calculate buffer latency in ms (buffer samples / sample rate * 1000)
  const bufferLatencyMs = (userBufferSize / settings.sampleRate) * 1000;

  return (
    <div className="flex items-center gap-3 text-[9px] text-gray-500 dark:text-zinc-500">
      <span>Latency: ~{Math.round(totalLatency)}ms</span>
      <span>Buffer: {userBufferSize} samples ({bufferLatencyMs.toFixed(1)}ms)</span>
    </div>
  );
}

// Compact Knob for master effects panel
function MasterKnob({
  value,
  min,
  max,
  onChange,
  label,
  unit = '',
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = (startY - e.clientY) * ((max - min) / 100);
      const newValue = Math.max(min, Math.min(max, startValue + delta));
      onChange(newValue);
    },
    [isDragging, startY, startValue, min, max, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={cn(
          'w-8 h-8 relative rounded-full bg-gradient-to-b from-zinc-700 to-zinc-800 shadow-inner cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute inset-1 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-700 shadow"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-1 rounded-full bg-amber-400" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-[8px] text-zinc-500 uppercase tracking-wide">{label}</div>
        <div className="text-[9px] text-zinc-300">
          {formatValue(value)}{unit}
        </div>
      </div>
    </div>
  );
}

// Effect section header with enable toggle
function EffectSectionHeader({
  name,
  icon: Icon,
  enabled,
  onToggle,
  expanded,
  onExpandToggle,
  color = 'amber',
}: {
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/20',
    rose: 'text-rose-400 bg-rose-500/20',
  };

  return (
    <div className="flex items-center gap-2 py-1.5">
      <button
        onClick={onExpandToggle}
        className="flex items-center gap-2 flex-1 text-left hover:bg-white/[0.02] rounded transition-colors -ml-1 pl-1"
      >
        <div className="p-0.5 text-zinc-500">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>
        <div className={cn('p-1 rounded', enabled ? colorMap[color] || colorMap.amber : 'text-zinc-600 bg-white/5')}>
          <Icon className="w-3 h-3" />
        </div>
        <span className={cn('text-[10px] font-medium', enabled ? 'text-white' : 'text-zinc-500')}>
          {name}
        </span>
      </button>
      <button
        onClick={onToggle}
        className={cn(
          'p-1 rounded transition-colors',
          enabled ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-600 hover:text-zinc-400'
        )}
        title={enabled ? 'Disable effect' : 'Enable effect'}
      >
        <Power className="w-3 h-3" />
      </button>
    </div>
  );
}

// Master Effects Panel Component
function MasterEffectsPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const { getMasterEffectsSettings, updateMasterEffects } = useAudioEngine();
  const [settings, setSettings] = useState<MasterEffectsChain | null>(null);
  const [expandedEffects, setExpandedEffects] = useState<Set<string>>(new Set(['eq', 'compressor']));

  // Refresh settings periodically
  useEffect(() => {
    const update = () => {
      const s = getMasterEffectsSettings();
      if (s) setSettings(s);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [getMasterEffectsSettings]);

  const toggleExpanded = (effect: string) => {
    setExpandedEffects((prev) => {
      const next = new Set(prev);
      if (next.has(effect)) next.delete(effect);
      else next.add(effect);
      return next;
    });
  };

  const handleUpdate = useCallback((updates: Partial<MasterEffectsChain>) => {
    updateMasterEffects(updates);
    // Immediately reflect in local state for responsiveness
    setSettings((prev) => prev ? { ...prev, ...updates } : null);
  }, [updateMasterEffects]);

  if (!settings) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-zinc-900 rounded-xl p-6 text-zinc-400">Loading...</div>
      </div>
    );
  }

  const reverbTypes = ['room', 'hall', 'plate', 'spring', 'ambient'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-[380px] max-h-[80vh] overflow-y-auto bg-gradient-to-b from-zinc-800 to-zinc-900 border border-amber-600/30 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40 bg-amber-950/30">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-200">Master Effects</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                handleUpdate({
                  eq: { ...settings.eq, enabled: false },
                  compressor: { ...settings.compressor, enabled: false },
                  reverb: { ...settings.reverb, enabled: false },
                  limiter: { ...settings.limiter, enabled: true },
                });
              }}
              className="p-1.5 text-zinc-500 hover:text-white transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Effects */}
        <div className="p-3 space-y-1">
          {/* EQ */}
          <div className="border-b border-white/5">
            <EffectSectionHeader
              name="Equalizer"
              icon={BarChart3}
              enabled={settings.eq.enabled}
              onToggle={() => handleUpdate({ eq: { ...settings.eq, enabled: !settings.eq.enabled } })}
              expanded={expandedEffects.has('eq')}
              onExpandToggle={() => toggleExpanded('eq')}
              color="cyan"
            />
            {expandedEffects.has('eq') && (
              <div className="pb-3 px-2 space-y-2">
                {settings.eq.bands.map((band, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-500 w-10">
                      {band.type === 'lowshelf' ? 'Low' : band.type === 'highshelf' ? 'High' : `Mid${index}`}
                    </span>
                    <div className="flex-1 flex justify-center gap-2">
                      <MasterKnob
                        value={band.frequency}
                        min={20}
                        max={20000}
                        onChange={(v) => {
                          const newBands = [...settings.eq.bands];
                          newBands[index] = { ...newBands[index], frequency: v };
                          handleUpdate({ eq: { ...settings.eq, bands: newBands } });
                        }}
                        label="Freq"
                        unit="Hz"
                        disabled={!settings.eq.enabled}
                      />
                      <MasterKnob
                        value={band.gain}
                        min={-24}
                        max={24}
                        onChange={(v) => {
                          const newBands = [...settings.eq.bands];
                          newBands[index] = { ...newBands[index], gain: v };
                          handleUpdate({ eq: { ...settings.eq, bands: newBands } });
                        }}
                        label="Gain"
                        unit="dB"
                        disabled={!settings.eq.enabled}
                      />
                      <MasterKnob
                        value={band.q}
                        min={0.1}
                        max={10}
                        onChange={(v) => {
                          const newBands = [...settings.eq.bands];
                          newBands[index] = { ...newBands[index], q: v };
                          handleUpdate({ eq: { ...settings.eq, bands: newBands } });
                        }}
                        label="Q"
                        disabled={!settings.eq.enabled}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compressor */}
          <div className="border-b border-white/5">
            <EffectSectionHeader
              name="Compressor"
              icon={Zap}
              enabled={settings.compressor.enabled}
              onToggle={() => handleUpdate({ compressor: { ...settings.compressor, enabled: !settings.compressor.enabled } })}
              expanded={expandedEffects.has('compressor')}
              onExpandToggle={() => toggleExpanded('compressor')}
              color="amber"
            />
            {expandedEffects.has('compressor') && (
              <div className="pb-3 px-2">
                <div className="flex flex-wrap justify-center gap-2">
                  <MasterKnob value={settings.compressor.threshold} min={-60} max={0} onChange={(v) => handleUpdate({ compressor: { ...settings.compressor, threshold: v } })} label="Thresh" unit="dB" disabled={!settings.compressor.enabled} />
                  <MasterKnob value={settings.compressor.ratio} min={1} max={20} onChange={(v) => handleUpdate({ compressor: { ...settings.compressor, ratio: v } })} label="Ratio" unit=":1" disabled={!settings.compressor.enabled} />
                  <MasterKnob value={settings.compressor.attack} min={0} max={1000} onChange={(v) => handleUpdate({ compressor: { ...settings.compressor, attack: v } })} label="Attack" unit="ms" disabled={!settings.compressor.enabled} />
                  <MasterKnob value={settings.compressor.release} min={0} max={3000} onChange={(v) => handleUpdate({ compressor: { ...settings.compressor, release: v } })} label="Release" unit="ms" disabled={!settings.compressor.enabled} />
                  <MasterKnob value={settings.compressor.knee} min={0} max={40} onChange={(v) => handleUpdate({ compressor: { ...settings.compressor, knee: v } })} label="Knee" unit="dB" disabled={!settings.compressor.enabled} />
                  <MasterKnob value={settings.compressor.makeupGain} min={-12} max={24} onChange={(v) => handleUpdate({ compressor: { ...settings.compressor, makeupGain: v } })} label="Makeup" unit="dB" disabled={!settings.compressor.enabled} />
                </div>
              </div>
            )}
          </div>

          {/* Reverb */}
          <div className="border-b border-white/5">
            <EffectSectionHeader
              name="Reverb"
              icon={Waves}
              enabled={settings.reverb.enabled}
              onToggle={() => handleUpdate({ reverb: { ...settings.reverb, enabled: !settings.reverb.enabled } })}
              expanded={expandedEffects.has('reverb')}
              onExpandToggle={() => toggleExpanded('reverb')}
              color="indigo"
            />
            {expandedEffects.has('reverb') && (
              <div className="pb-3 px-2 space-y-2">
                <div className="flex gap-1">
                  {reverbTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleUpdate({ reverb: { ...settings.reverb, type } })}
                      disabled={!settings.reverb.enabled}
                      className={cn(
                        'flex-1 px-2 py-1 text-[9px] font-medium rounded transition-colors',
                        settings.reverb.type === type
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-white/5 text-zinc-500 hover:bg-white/10',
                        !settings.reverb.enabled && 'opacity-50'
                      )}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <MasterKnob value={settings.reverb.mix * 100} min={0} max={100} onChange={(v) => handleUpdate({ reverb: { ...settings.reverb, mix: v / 100 } })} label="Mix" unit="%" disabled={!settings.reverb.enabled} />
                  <MasterKnob value={settings.reverb.decay} min={0.1} max={10} onChange={(v) => handleUpdate({ reverb: { ...settings.reverb, decay: v } })} label="Decay" unit="s" disabled={!settings.reverb.enabled} />
                  <MasterKnob value={settings.reverb.preDelay} min={0} max={100} onChange={(v) => handleUpdate({ reverb: { ...settings.reverb, preDelay: v } })} label="Pre-Dly" unit="ms" disabled={!settings.reverb.enabled} />
                  <MasterKnob value={settings.reverb.lowCut} min={20} max={1000} onChange={(v) => handleUpdate({ reverb: { ...settings.reverb, lowCut: v } })} label="Lo Cut" unit="Hz" disabled={!settings.reverb.enabled} />
                  <MasterKnob value={settings.reverb.highCut} min={1000} max={20000} onChange={(v) => handleUpdate({ reverb: { ...settings.reverb, highCut: v } })} label="Hi Cut" unit="Hz" disabled={!settings.reverb.enabled} />
                </div>
              </div>
            )}
          </div>

          {/* Limiter */}
          <div className="border-b border-white/5">
            <EffectSectionHeader
              name="Limiter"
              icon={Wind}
              enabled={settings.limiter.enabled}
              onToggle={() => handleUpdate({ limiter: { ...settings.limiter, enabled: !settings.limiter.enabled } })}
              expanded={expandedEffects.has('limiter')}
              onExpandToggle={() => toggleExpanded('limiter')}
              color="rose"
            />
            {expandedEffects.has('limiter') && (
              <div className="pb-3 px-2">
                <div className="flex flex-wrap justify-center gap-2">
                  <MasterKnob value={settings.limiter.threshold} min={-24} max={0} onChange={(v) => handleUpdate({ limiter: { ...settings.limiter, threshold: v } })} label="Thresh" unit="dB" disabled={!settings.limiter.enabled} />
                  <MasterKnob value={settings.limiter.release} min={10} max={1000} onChange={(v) => handleUpdate({ limiter: { ...settings.limiter, release: v } })} label="Release" unit="ms" disabled={!settings.limiter.enabled} />
                  <MasterKnob value={settings.limiter.ceiling} min={-6} max={0} onChange={(v) => handleUpdate({ limiter: { ...settings.limiter, ceiling: v } })} label="Ceiling" unit="dB" disabled={!settings.limiter.enabled} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signal Flow */}
        <div className="px-4 py-2 bg-black/20 border-t border-white/5">
          <div className="text-[8px] text-zinc-600 mb-1">Signal Flow:</div>
          <div className="flex items-center gap-1 text-[9px]">
            <span className={settings.eq.enabled ? 'text-cyan-400' : 'text-zinc-600'}>EQ</span>
            <span className="text-zinc-600">→</span>
            <span className={settings.compressor.enabled ? 'text-amber-400' : 'text-zinc-600'}>Comp</span>
            <span className="text-zinc-600">→</span>
            <span className={settings.reverb.enabled ? 'text-indigo-400' : 'text-zinc-600'}>Reverb</span>
            <span className="text-zinc-600">→</span>
            <span className={settings.limiter.enabled ? 'text-rose-400' : 'text-zinc-600'}>Limiter</span>
            <span className="text-zinc-600">→</span>
            <span className="text-amber-400">Out</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Divider between sections
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 h-full">
      <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gray-400 dark:via-zinc-600 to-transparent" />
      <div className="py-2">
        <div className="-rotate-90 whitespace-nowrap text-[8px] text-gray-500 dark:text-zinc-600 font-medium tracking-wider">
          {label}
        </div>
      </div>
      <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gray-400 dark:via-zinc-600 to-transparent" />
    </div>
  );
}

export function MixerView({
  isMaster,
  users,
  currentUser,
  audioLevels,
  onUserVolumeChange,
  onUserMuteChange,
  activeView,
  onViewChange,
}: MixerViewProps) {
  const { currentTrack } = useRoomStore();
  const [showMasterFxPanel, setShowMasterFxPanel] = useState(false);

  // Combine and sort users
  const allUsers = useMemo(() => {
    const userList = [...users];
    if (currentUser && !userList.some(u => u.id === currentUser.id)) {
      userList.unshift(currentUser);
    }
    return userList.sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      if (a.isMaster) return -1;
      if (b.isMaster) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, currentUser]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-100 via-gray-50 to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-black overflow-hidden">
      {/* Mixer Header */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-gray-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-gray-900 dark:text-zinc-100 tracking-wide flex items-center gap-2">
            <Signal className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            LIVE MIXER
          </h2>
          {!isMaster && (
            <span className="text-[9px] text-amber-600/70 dark:text-amber-400/70">(view only)</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-zinc-500">
          <span>{allUsers.length} channels</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-500 dark:text-zinc-600 font-mono">48kHz</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Mixer Console */}
      <div className="flex-1 flex items-stretch p-4 gap-2 overflow-x-auto overflow-y-hidden">
        <AnimatePresence mode="popLayout">
          {/* User Channels */}
          {allUsers.length > 0 ? (
            allUsers.map((user) => (
              <UserChannelStrip
                key={user.id}
                user={user}
                isCurrentUser={user.id === currentUser?.id}
                audioLevel={audioLevels.get(user.id) || 0}
                isMaster={isMaster}
                onVolumeChange={(vol) => onUserVolumeChange?.(user.id, vol)}
                onMuteChange={(muted) => onUserMuteChange?.(user.id, muted)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center px-8 py-4 rounded-xl bg-gray-200/30 dark:bg-zinc-800/30 border border-gray-300/30 dark:border-zinc-700/30">
              <div className="text-center">
                <Music2 className="w-8 h-8 text-gray-500 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-zinc-500">Waiting for musicians...</p>
              </div>
            </div>
          )}

          {/* Divider */}
          {(allUsers.length > 0 || currentTrack) && (
            <SectionDivider label={currentTrack ? 'TRACKS' : 'MASTER'} />
          )}

          {/* Track Channel (if backing track exists) */}
          {currentTrack && (
            <>
              <TrackChannelStrip
                track={currentTrack}
                isMaster={isMaster}
                audioLevel={audioLevels.get('backingTrack') || 0}
              />
              <SectionDivider label="MASTER" />
            </>
          )}

          {/* Master Channel */}
          <MasterChannelStrip
            isMaster={isMaster}
            audioLevel={audioLevels.get('master') || 0}
            onOpenMasterFx={() => setShowMasterFxPanel(true)}
          />
        </AnimatePresence>
      </div>

      {/* Master Effects Panel Modal */}
      <AnimatePresence>
        {showMasterFxPanel && (
          <MasterEffectsPanel onClose={() => setShowMasterFxPanel(false)} />
        )}
      </AnimatePresence>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {currentTrack ? (
            <div className="flex items-center gap-2">
              <Disc3 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                Now Playing: <span className="text-gray-800 dark:text-zinc-200">{currentTrack.name}</span>
                {currentTrack.artist && (
                  <span className="text-gray-500 dark:text-zinc-500"> — {currentTrack.artist}</span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-gray-500 dark:text-zinc-500">No track selected</span>
          )}
        </div>

        <PerformanceDisplay currentUser={currentUser} />
      </div>
    </div>
  );
}
