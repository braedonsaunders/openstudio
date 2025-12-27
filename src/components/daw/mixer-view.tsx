'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { AvatarDisplay } from '@/components/avatar/AvatarDisplay';
import {
  Mic,
  Guitar,
  Music,
  Volume2,
  VolumeX,
  Crown,
  Headphones,
  Radio,
  Disc3,
  Music2,
  Music4,
  Signal,
  Wifi,
} from 'lucide-react';
import { Drum, Piano } from '../icons';
import type { User, BackingTrack } from '@/types';

interface MixerViewProps {
  isMaster: boolean;
  users: User[];
  currentUser: User | null;
  audioLevels: Map<string, number>;
  onUserVolumeChange?: (userId: string, volume: number) => void;
  onUserMuteChange?: (userId: string, muted: boolean) => void;
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
              : 'bg-zinc-700'
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
        'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-800',
        'border border-zinc-700/50',
        'shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]',
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
        className="absolute left-0 right-0 h-px bg-zinc-500/50"
        style={{ bottom: '79.4%' }}
      />

      {/* Fader Cap */}
      <motion.div
        className={cn(
          'absolute left-1/2 -translate-x-1/2 w-6 h-5',
          'rounded cursor-grab active:cursor-grabbing',
          'shadow-lg border-t border-zinc-500/50',
          isDragging && 'ring-1 ring-white/30'
        )}
        style={{
          bottom: `calc(${value * 100}% - 10px)`,
          background: 'linear-gradient(180deg, #555 0%, #333 50%, #222 100%)',
        }}
        animate={{ scale: isDragging ? 1.1 : 1 }}
      >
        {/* Grip Lines */}
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 space-y-[2px]">
          <div className="h-px bg-zinc-600" />
          <div className="h-px bg-zinc-600" />
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
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-[7px] text-zinc-600 font-mono">L</div>
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-[7px] text-zinc-600 font-mono">R</div>

      <div
        ref={knobRef}
        className={cn(
          'w-7 h-7 rounded-full cursor-pointer',
          'bg-gradient-to-b from-zinc-500 to-zinc-700',
          'border border-zinc-400/30',
          'shadow-md',
          disabled && 'opacity-40 cursor-not-allowed',
          isDragging && 'ring-1 ring-white/30'
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

  // Simulate stereo spread
  const leftLevel = audioLevel * (0.9 + Math.random() * 0.1);
  const rightLevel = audioLevel * (0.85 + Math.random() * 0.15);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        'bg-gradient-to-b from-zinc-800/90 to-zinc-900/95',
        'border border-zinc-700/40',
        'shadow-xl shadow-black/30',
        isCurrentUser && 'ring-1 ring-indigo-500/50'
      )}
      style={{ width: '90px', minWidth: '90px' }}
    >
      {/* Channel Header */}
      <div className="p-2 border-b border-zinc-800/80 bg-zinc-900/50">
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
            <div className="text-[10px] font-semibold text-zinc-200 truncate px-1">
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
      <div className="flex justify-center py-2 border-b border-zinc-800/50">
        <PanKnob disabled={!isMaster || isCurrentUser} />
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex items-stretch gap-1 px-2 py-2 min-h-0">
        {/* Left dB Scale */}
        <div className="flex flex-col justify-between text-[6px] text-zinc-600 font-mono py-1">
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
          <div className="px-2 py-0.5 rounded bg-black/60 border border-zinc-800">
            <span className="text-[9px] font-mono text-green-400">
              {formatDb(user.volume)}
            </span>
          </div>
        </div>
      </div>

      {/* Mute/Solo */}
      <div className="flex gap-1 p-2 border-t border-zinc-800/50">
        <button
          onClick={() => !isCurrentUser && isMaster && onMuteChange?.(!user.isMuted)}
          disabled={isCurrentUser || !isMaster}
          className={cn(
            'flex-1 py-1 rounded text-[9px] font-bold tracking-wide transition-all',
            user.isMuted
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]'
              : 'bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600',
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
              : 'bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600',
            (isCurrentUser || !isMaster) && 'cursor-not-allowed opacity-50'
          )}
        >
          S
        </button>
      </div>

      {/* Connection Quality */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 border-t border-zinc-800/50 bg-zinc-900/30">
        <ConnectionIndicator quality={user.connectionQuality} />
        <span className="text-[7px] text-zinc-600">{user.latency}ms</span>
      </div>
    </motion.div>
  );
}

// Track Channel Strip (for backing track)
function TrackChannelStrip({
  track,
  isMaster,
}: {
  track: BackingTrack;
  isMaster: boolean;
}) {
  const { backingTrackVolume, setBackingTrackVolume } = useAudioStore();
  const [level, setLevel] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isSolo, setIsSolo] = useState(false);

  // Simulate audio levels
  useEffect(() => {
    const interval = setInterval(() => {
      setLevel(0.3 + Math.random() * 0.5);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        'bg-gradient-to-b from-indigo-900/40 to-zinc-900/95',
        'border border-indigo-500/30',
        'shadow-xl shadow-black/30'
      )}
      style={{ width: '100px', minWidth: '100px' }}
    >
      {/* Channel Header */}
      <div className="p-2 border-b border-indigo-900/50 bg-indigo-950/30">
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
                <Disc3 className="w-5 h-5 text-indigo-400" />
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
            <div className="text-[9px] font-semibold text-indigo-200 truncate px-1">
              {track.name}
            </div>
            {track.artist && (
              <div className="text-[7px] text-indigo-400/70 truncate px-1">
                {track.artist}
              </div>
            )}
          </div>

          {/* Track Type Badge */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-[8px] font-medium text-indigo-300">
            <Radio className="w-2.5 h-2.5" />
            <span>TRACK</span>
          </div>
        </div>
      </div>

      {/* Pan Section */}
      <div className="flex justify-center py-2 border-b border-indigo-900/30">
        <PanKnob disabled={!isMaster} />
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex items-stretch gap-1 px-2 py-2 min-h-0">
        {/* Left dB Scale */}
        <div className="flex flex-col justify-between text-[6px] text-zinc-600 font-mono py-1">
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
          <div className="px-2 py-0.5 rounded bg-black/60 border border-indigo-800/50">
            <span className="text-[9px] font-mono text-indigo-300">
              {formatDb(backingTrackVolume)}
            </span>
          </div>
        </div>
      </div>

      {/* Mute/Solo */}
      <div className="flex gap-1 p-2 border-t border-indigo-900/30">
        <button
          onClick={() => isMaster && setIsMuted(!isMuted)}
          disabled={!isMaster}
          className={cn(
            'flex-1 py-1 rounded text-[9px] font-bold tracking-wide transition-all',
            isMuted
              ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]'
              : 'bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600',
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
              : 'bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600',
            !isMaster && 'cursor-not-allowed opacity-50'
          )}
        >
          S
        </button>
      </div>

      {/* Stereo Label */}
      <div className="flex items-center justify-center py-1.5 border-t border-indigo-900/30 bg-indigo-950/20">
        <span className="text-[7px] text-indigo-400/60 font-mono">STEREO</span>
      </div>
    </motion.div>
  );
}

// Master Channel Strip
function MasterChannelStrip({ isMaster: isRoomMaster }: { isMaster: boolean }) {
  const { masterVolume, setMasterVolume } = useAudioStore();
  const [level, setLevel] = useState(0.6);

  // Simulate master level
  useEffect(() => {
    const interval = setInterval(() => {
      setLevel(0.4 + Math.random() * 0.4);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-xl overflow-hidden',
        'bg-gradient-to-b from-amber-900/30 to-zinc-900/95',
        'border-2 border-amber-600/40',
        'shadow-xl shadow-black/30'
      )}
      style={{ width: '110px', minWidth: '110px' }}
    >
      {/* Master Header */}
      <div className="p-3 border-b border-amber-900/40 bg-amber-950/30">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/50 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
          <div className="text-xs font-bold text-amber-300 tracking-wider">MASTER</div>

          {/* Stereo Link */}
          <div className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
            <span className="text-[7px] text-amber-300 font-mono">STEREO LINK</span>
          </div>
        </div>
      </div>

      {/* Fader + Meter Section */}
      <div className="flex-1 flex items-stretch gap-2 px-3 py-2 min-h-0">
        {/* Left dB Scale */}
        <div className="flex flex-col justify-between text-[6px] text-zinc-600 font-mono py-1">
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
          <div className="px-3 py-1 rounded bg-black/60 border border-amber-700/50">
            <span className="text-[10px] font-mono text-amber-300 font-bold">
              {formatDb(masterVolume)}
            </span>
          </div>
        </div>
      </div>

      {/* Master Controls */}
      <div className="px-2 pb-2 space-y-1">
        <button className="w-full py-1.5 rounded bg-zinc-700/60 text-zinc-400 text-[8px] font-bold tracking-wider hover:bg-zinc-600 flex items-center justify-center gap-1">
          <Headphones className="w-3 h-3" />
          AFL
        </button>
      </div>

      {/* Output Label */}
      <div className="flex items-center justify-center py-2 border-t border-amber-900/40 bg-amber-950/20">
        <span className="text-[7px] text-amber-400/60 font-mono">MAIN OUT L/R</span>
      </div>
    </div>
  );
}

// Divider between sections
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 h-full">
      <div className="w-px flex-1 bg-gradient-to-b from-transparent via-zinc-600 to-transparent" />
      <div className="py-2">
        <div className="-rotate-90 whitespace-nowrap text-[8px] text-zinc-600 font-medium tracking-wider">
          {label}
        </div>
      </div>
      <div className="w-px flex-1 bg-gradient-to-b from-transparent via-zinc-600 to-transparent" />
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
}: MixerViewProps) {
  const { currentTrack } = useRoomStore();

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
    <div className="h-full flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black overflow-hidden">
      {/* Mixer Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-zinc-100 tracking-wide flex items-center gap-2">
            <Signal className="w-4 h-4 text-indigo-400" />
            LIVE MIXER
          </h2>
          {!isMaster && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              <Volume2 className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-300 font-medium">LISTEN ONLY</span>
            </div>
          )}
          {isMaster && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30">
              <Crown className="w-3 h-3 text-green-400" />
              <span className="text-[10px] text-green-300 font-medium">ROOM MASTER</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <Wifi className="w-3 h-3" />
            <span>{allUsers.length} CHANNELS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600 font-mono">48kHz / 24-bit</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
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
            <div className="flex items-center justify-center px-8 py-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30">
              <div className="text-center">
                <Music2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Waiting for musicians...</p>
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
              <TrackChannelStrip track={currentTrack} isMaster={isMaster} />
              <SectionDivider label="MASTER" />
            </>
          )}

          {/* Master Channel */}
          <MasterChannelStrip isMaster={isMaster} />
        </AnimatePresence>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {currentTrack ? (
            <div className="flex items-center gap-2">
              <Disc3 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] text-zinc-400">
                Now Playing: <span className="text-zinc-200">{currentTrack.name}</span>
                {currentTrack.artist && (
                  <span className="text-zinc-500"> — {currentTrack.artist}</span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-zinc-500">No track selected</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[9px] text-zinc-600">
          <span>Latency: ~{Math.round(Math.random() * 10 + 15)}ms</span>
          <span>CPU: {Math.round(Math.random() * 20 + 5)}%</span>
        </div>
      </div>
    </div>
  );
}
