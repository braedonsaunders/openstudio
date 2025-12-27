'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { Progress } from '../ui/progress';
import {
  Mic,
  Guitar,
  Music,
  Volume2,
  VolumeX,
  Wand2,
  Loader2,
  Lock,
  Crown,
  Headphones,
} from 'lucide-react';
import { Drum } from '../icons';
import type { StemType } from '@/types';
import type { User } from '@/types';

interface MixerViewProps {
  isMaster: boolean;
  onToggleStem: (stem: StemType, enabled: boolean) => void;
  onStemVolumeChange: (stem: StemType, volume: number) => void;
  onSeparateTrack?: () => void;
  isSeparating?: boolean;
  separationProgress?: number;
  users: User[];
  audioLevels: Map<string, number>;
}

const stemConfig: Record<string, { icon: React.ReactNode; label: string; color: string; shortLabel: string }> = {
  vocals: {
    icon: <Mic className="w-4 h-4" />,
    label: 'Vocals',
    shortLabel: 'VOX',
    color: '#ec4899',
  },
  drums: {
    icon: <Drum className="w-4 h-4" />,
    label: 'Drums',
    shortLabel: 'DRM',
    color: '#f97316',
  },
  bass: {
    icon: <Guitar className="w-4 h-4" />,
    label: 'Bass',
    shortLabel: 'BAS',
    color: '#22c55e',
  },
  other: {
    icon: <Music className="w-4 h-4" />,
    label: 'Other',
    shortLabel: 'OTH',
    color: '#3b82f6',
  },
};

// dB scale markings
const DB_MARKS = ['+12', '+6', '0', '-6', '-12', '-24', '-48', '-∞'];

// Convert linear value (0-1) to dB display
function linearToDb(value: number): number {
  if (value === 0) return -Infinity;
  return 20 * Math.log10(value);
}

// Convert dB to linear (0-1)
function dbToLinear(db: number): number {
  if (db === -Infinity) return 0;
  return Math.pow(10, db / 20);
}

// Format dB value for display
function formatDb(value: number): string {
  const db = linearToDb(value);
  if (db === -Infinity) return '-∞';
  if (db >= 0) return `+${db.toFixed(1)}`;
  return db.toFixed(1);
}

// Vertical Fader Component
function ChannelFader({
  value,
  onChange,
  disabled,
  color,
  isMaster,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  color: string;
  isMaster: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || !isMaster) return;
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
    <div className="relative h-full flex flex-col items-center">
      {/* dB Scale */}
      <div className="absolute left-0 top-0 bottom-8 w-6 flex flex-col justify-between text-[8px] text-zinc-500 font-mono">
        {DB_MARKS.map((mark, i) => (
          <span key={i} className="leading-none">{mark}</span>
        ))}
      </div>

      {/* Fader Track */}
      <div
        ref={trackRef}
        className={cn(
          'relative w-3 flex-1 mx-6 rounded-sm cursor-pointer',
          'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-800',
          'border border-zinc-700',
          'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]',
          !isMaster && 'cursor-not-allowed opacity-60'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Fader Fill */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-sm"
          style={{
            background: `linear-gradient(to top, ${color}40, ${color}20)`,
          }}
          animate={{ height: `${value * 100}%` }}
          transition={{ duration: 0.05 }}
        />

        {/* Unity Gain Line (0dB) */}
        <div
          className="absolute left-0 right-0 h-px bg-zinc-500"
          style={{ bottom: '79.4%' }} // 0dB = ~0.794 linear
        />

        {/* Fader Cap/Knob */}
        <motion.div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 w-7 h-6 -ml-0.5',
            'rounded-sm cursor-grab active:cursor-grabbing',
            'shadow-lg',
            isDragging && 'ring-2 ring-white/30'
          )}
          style={{
            bottom: `calc(${value * 100}% - 12px)`,
            background: 'linear-gradient(180deg, #4a4a4a 0%, #2a2a2a 50%, #1a1a1a 100%)',
            borderTop: '1px solid #666',
            borderBottom: '1px solid #111',
          }}
          animate={{ scale: isDragging ? 1.05 : 1 }}
        >
          {/* Grip Lines */}
          <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 space-y-0.5">
            <div className="h-px bg-zinc-600" />
            <div className="h-px bg-zinc-600" />
            <div className="h-px bg-zinc-600" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Level Meter Component
function LevelMeter({ level, color }: { level: number; color: string }) {
  // Segment the meter for LED-style display
  const segments = 24;
  const activeSegments = Math.floor(level * segments);

  return (
    <div className="w-2 h-full flex flex-col-reverse gap-px p-px bg-black/50 rounded-sm">
      {Array.from({ length: segments }).map((_, i) => {
        const isActive = i < activeSegments;
        const segmentColor = i > segments * 0.85
          ? '#ef4444' // Red for peak
          : i > segments * 0.7
          ? '#f59e0b' // Amber for high
          : color; // Channel color for normal

        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-opacity duration-75"
            style={{
              backgroundColor: isActive ? segmentColor : '#1a1a1a',
              opacity: isActive ? 1 : 0.3,
              boxShadow: isActive ? `0 0 4px ${segmentColor}40` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

// Pan Knob Component
function PanKnob({ value = 0.5, onChange, disabled }: { value?: number; onChange?: (v: number) => void; disabled?: boolean }) {
  const rotation = (value - 0.5) * 270; // -135 to +135 degrees

  return (
    <div className="relative w-8 h-8">
      {/* Knob background */}
      <div
        className={cn(
          'w-full h-full rounded-full',
          'bg-gradient-to-b from-zinc-600 to-zinc-800',
          'border border-zinc-500',
          'shadow-lg',
          disabled && 'opacity-50'
        )}
      >
        {/* Indicator line */}
        <div
          className="absolute top-1 left-1/2 w-0.5 h-2 bg-white rounded-full origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, transformOrigin: 'center 12px' }}
        />
      </div>
      {/* Center label */}
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-zinc-500 font-mono">
        {value === 0.5 ? 'C' : value < 0.5 ? 'L' : 'R'}
      </span>
    </div>
  );
}

// Channel Strip Component
function ChannelStrip({
  stem,
  config,
  state,
  isMaster,
  onToggle,
  onVolumeChange,
  meterLevel,
}: {
  stem: string;
  config: typeof stemConfig.vocals;
  state: { enabled: boolean; volume: number };
  isMaster: boolean;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
  meterLevel: number;
}) {
  const isEnabled = state?.enabled ?? true;
  const volume = state?.volume ?? 1;
  const [isSolo, setIsSolo] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col h-full p-2 rounded-lg',
        'bg-gradient-to-b from-zinc-800/80 to-zinc-900/80',
        'border border-zinc-700/50',
        !isEnabled && 'opacity-50'
      )}
      style={{ minWidth: '80px' }}
    >
      {/* Channel Label */}
      <div className="text-center mb-2">
        <div
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1"
          style={{ backgroundColor: `${config.color}30`, color: config.color }}
        >
          {config.icon}
        </div>
        <div className="text-[10px] font-bold text-zinc-300 tracking-wider">
          {config.shortLabel}
        </div>
      </div>

      {/* Pan Knob */}
      <div className="flex justify-center mb-3">
        <PanKnob disabled={!isMaster} />
      </div>

      {/* Fader + Meter Area */}
      <div className="flex-1 flex gap-1 min-h-0">
        {/* Level Meter */}
        <LevelMeter level={isEnabled ? meterLevel : 0} color={config.color} />

        {/* Fader */}
        <div className="flex-1">
          <ChannelFader
            value={volume}
            onChange={onVolumeChange}
            disabled={!isEnabled}
            color={config.color}
            isMaster={isMaster}
          />
        </div>

        {/* Right Meter (stereo) */}
        <LevelMeter level={isEnabled ? meterLevel * 0.95 : 0} color={config.color} />
      </div>

      {/* dB Value Display */}
      <div className="text-center my-2">
        <div className="inline-block px-2 py-1 rounded bg-black/50 border border-zinc-700">
          <span className="text-[10px] font-mono text-green-400">
            {formatDb(volume)}
          </span>
        </div>
      </div>

      {/* Mute / Solo Buttons */}
      <div className="flex gap-1">
        <button
          onClick={isMaster ? onToggle : undefined}
          disabled={!isMaster}
          className={cn(
            'flex-1 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all',
            !isEnabled
              ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]'
              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600',
            !isMaster && 'cursor-not-allowed'
          )}
        >
          M
        </button>
        <button
          onClick={() => isMaster && setIsSolo(!isSolo)}
          disabled={!isMaster}
          className={cn(
            'flex-1 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all',
            isSolo
              ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]'
              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600',
            !isMaster && 'cursor-not-allowed'
          )}
        >
          S
        </button>
      </div>
    </div>
  );
}

// Master Channel Strip
function MasterStrip({ isMaster: isRoomMaster }: { isMaster: boolean }) {
  const { masterVolume } = useAudioStore();
  const [level, setLevel] = useState(0.6);

  // Simulate master level animation
  useEffect(() => {
    const interval = setInterval(() => {
      setLevel(0.5 + Math.random() * 0.3);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col h-full p-2 rounded-lg',
        'bg-gradient-to-b from-zinc-700/80 to-zinc-800/80',
        'border-2 border-amber-600/50',
      )}
      style={{ minWidth: '100px' }}
    >
      {/* Master Label */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-1 bg-amber-600/30">
          <Crown className="w-5 h-5 text-amber-500" />
        </div>
        <div className="text-xs font-bold text-amber-400 tracking-wider">
          MASTER
        </div>
      </div>

      {/* Stereo Link Indicator */}
      <div className="flex justify-center mb-2">
        <div className="px-2 py-0.5 rounded bg-amber-600/20 border border-amber-600/30">
          <span className="text-[8px] text-amber-400 font-mono">STEREO</span>
        </div>
      </div>

      {/* Fader + Meter Area */}
      <div className="flex-1 flex gap-1 min-h-0">
        {/* Left Meter */}
        <LevelMeter level={level} color="#f59e0b" />

        {/* Fader */}
        <div className="flex-1">
          <ChannelFader
            value={masterVolume}
            onChange={() => {}}
            color="#f59e0b"
            isMaster={isRoomMaster}
          />
        </div>

        {/* Right Meter */}
        <LevelMeter level={level * 0.92} color="#f59e0b" />
      </div>

      {/* dB Value Display */}
      <div className="text-center my-2">
        <div className="inline-block px-3 py-1 rounded bg-black/50 border border-amber-600/50">
          <span className="text-xs font-mono text-amber-400">
            {formatDb(masterVolume)}
          </span>
        </div>
      </div>

      {/* Master Controls */}
      <div className="space-y-1">
        <button className="w-full py-1.5 rounded bg-zinc-700 text-zinc-400 text-[10px] font-bold tracking-wider hover:bg-zinc-600">
          <Headphones className="w-3 h-3 inline mr-1" />
          AFL
        </button>
      </div>
    </div>
  );
}

export function MixerView({
  isMaster,
  onToggleStem,
  onStemVolumeChange,
  onSeparateTrack,
  isSeparating = false,
  separationProgress = 0,
  users,
  audioLevels,
}: MixerViewProps) {
  const { stemMixState, stemsAvailable, currentTrack } = useRoomStore();

  // Simulate meter levels based on stem state
  const getMeterLevel = (stem: string) => {
    const state = stemMixState[stem as keyof typeof stemMixState];
    if (!state?.enabled) return 0;
    return 0.4 + Math.random() * 0.4 * state.volume;
  };

  // Empty state - no track
  if (!currentTrack) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800/50 border border-zinc-700 flex items-center justify-center">
            <Wand2 className="w-10 h-10 text-zinc-600" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-300 mb-2">
            No Track Selected
          </h3>
          <p className="text-zinc-500">
            Select a track from the queue to use the stem mixer
          </p>
        </div>
      </div>
    );
  }

  // Separating state
  if (isSeparating) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-8">
        <div className="text-center w-full max-w-md">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-zinc-300 mb-4">
            Separating Audio Stems
          </h3>
          <Progress value={separationProgress} showLabel className="mb-4" />
          <p className="text-sm text-zinc-500">
            Using Meta SAM to extract vocals, drums, bass, and other instruments...
          </p>
        </div>
      </div>
    );
  }

  // No stems yet - show separation prompt
  if (!stemsAvailable) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Wand2 className="w-12 h-12 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-200 mb-3">
            AI Stem Separation
          </h3>
          <p className="text-zinc-400 mb-6">
            Separate the track into individual stems to mix vocals, drums, bass, and other instruments independently
          </p>

          {isMaster ? (
            <button
              onClick={onSeparateTrack}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center gap-2 mx-auto hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25"
            >
              <Wand2 className="w-5 h-5" />
              Separate Track
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-amber-500/80">
              <Lock className="w-4 h-4" />
              <span className="text-sm">Only the room master can separate tracks</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mixer console view
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-zinc-900 via-zinc-900 to-black overflow-hidden">
      {/* Mixer Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-zinc-200 tracking-wide">STEM MIXER</h2>
          {!isMaster && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
              <Lock className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-amber-500 font-medium">VIEW ONLY</span>
            </div>
          )}
          {isMaster && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
              <Crown className="w-3 h-3 text-green-500" />
              <span className="text-[10px] text-green-500 font-medium">MASTER</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 font-mono">META SAM</span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Mixer Console */}
      <div className="flex-1 flex items-stretch p-4 gap-2 overflow-x-auto overflow-y-hidden">
        {/* Stem Channels */}
        {Object.entries(stemConfig).map(([stem, config]) => {
          const state = stemMixState[stem as keyof typeof stemMixState];
          return (
            <ChannelStrip
              key={stem}
              stem={stem}
              config={config}
              state={state}
              isMaster={isMaster}
              onToggle={() => onToggleStem(stem as StemType, !(state?.enabled ?? true))}
              onVolumeChange={(volume) => onStemVolumeChange(stem as StemType, volume)}
              meterLevel={getMeterLevel(stem)}
            />
          );
        })}

        {/* Divider */}
        <div className="w-px bg-zinc-700 mx-2 self-stretch" />

        {/* Master Channel */}
        <MasterStrip isMaster={isMaster} />
      </div>

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-zinc-500">
            Track: <span className="text-zinc-300">{currentTrack.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">48kHz / 24-bit</span>
        </div>
      </div>
    </div>
  );
}
