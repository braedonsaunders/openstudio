'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { EFFECT_PRESETS } from '@/lib/audio/effects/presets';
import type { UserTrack } from '@/types';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Power,
  RotateCcw,
  Zap,
  Waves,
  BarChart3,
  Wind,
  Shield,
} from 'lucide-react';

// Rotary knob component
function Knob({
  value,
  min,
  max,
  onChange,
  label,
  unit = '',
  size = 'md',
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = -135 + normalizedValue * 270; // -135 to 135 degrees

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

  // Add/remove event listeners
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

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          sizeClasses,
          'relative rounded-full bg-gradient-to-b from-zinc-700 to-zinc-800 shadow-inner cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Knob indicator */}
        <div
          className="absolute inset-1 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-700 shadow"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-indigo-400 rounded-full" />
        </div>
        {/* Track arc */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${normalizedValue * 85} 100`}
            strokeDashoffset="25"
            className="text-indigo-500/30"
            style={{ transform: 'rotate(-135deg)', transformOrigin: 'center' }}
          />
        </svg>
      </div>
      <div className="text-center">
        <div className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</div>
        <div className="text-[10px] text-zinc-300">
          {formatValue(value)}{unit}
        </div>
      </div>
    </div>
  );
}

// Effect header with enable toggle
function EffectHeader({
  name,
  icon: Icon,
  enabled,
  onToggle,
  expanded,
  onExpandToggle,
  color = 'indigo',
}: {
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
  color?: 'indigo' | 'emerald' | 'amber' | 'cyan' | 'rose';
}) {
  const colorClasses = {
    indigo: 'text-indigo-400 bg-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/20',
    rose: 'text-rose-400 bg-rose-500/20',
  };

  return (
    <div className="flex items-center gap-2 py-2">
      <button
        onClick={onExpandToggle}
        className="flex items-center gap-2 flex-1 text-left hover:bg-white/[0.02] rounded transition-colors -ml-1 pl-1"
      >
        <div className="p-0.5 text-zinc-500">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>
        <div className={cn('p-1.5 rounded', enabled ? colorClasses[color] : 'text-zinc-600 bg-white/5')}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className={cn('text-xs font-medium', enabled ? 'text-white' : 'text-zinc-500')}>
          {name}
        </span>
        {!expanded && enabled && (
          <span className="text-[9px] text-zinc-600 ml-1">click to edit</span>
        )}
      </button>
      <button
        onClick={onToggle}
        className={cn(
          'p-1 rounded transition-colors',
          enabled ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-600 hover:text-zinc-400'
        )}
        title={enabled ? 'Disable effect' : 'Enable effect'}
      >
        <Power className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Noise Gate Effect UI
function NoiseGateUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.noiseGate;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();

  if (!settings) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Noise Gate"
        icon={Shield}
        enabled={settings.enabled}
        onToggle={() => updateTrackEffects(track.id, { noiseGate: { ...settings, enabled: !settings.enabled } })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="emerald"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.threshold}
              min={-96}
              max={0}
              onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, threshold: v } })}
              label="Thresh"
              unit=" dB"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.attack}
              min={0}
              max={50}
              onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, attack: v } })}
              label="Attack"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.hold}
              min={0}
              max={500}
              onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, hold: v } })}
              label="Hold"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.release}
              min={0}
              max={500}
              onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, release: v } })}
              label="Release"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.range}
              min={-80}
              max={0}
              onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, range: v } })}
              label="Range"
              unit=" dB"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// EQ Effect UI
function EQUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.eq;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();

  if (!settings) return null;

  const updateBand = (index: number, updates: { frequency?: number; gain?: number; q?: number }) => {
    const newBands = settings.bands.map((band, i) =>
      i === index ? { ...band, ...updates } : band
    );
    updateTrackEffects(track.id, { eq: { ...settings, bands: newBands } });
  };

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Equalizer"
        icon={BarChart3}
        enabled={settings.enabled}
        onToggle={() => updateTrackEffects(track.id, { eq: { ...settings, enabled: !settings.enabled } })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="cyan"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="space-y-3">
            {settings.bands.map((band, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 w-12">
                  {band.type === 'lowshelf' ? 'Low' :
                   band.type === 'highshelf' ? 'High' :
                   `Mid ${index}`}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <Knob
                    value={band.frequency}
                    min={20}
                    max={20000}
                    onChange={(v) => updateBand(index, { frequency: v })}
                    label="Freq"
                    unit=" Hz"
                    size="sm"
                    disabled={!settings.enabled}
                  />
                  <Knob
                    value={band.gain}
                    min={-24}
                    max={24}
                    onChange={(v) => updateBand(index, { gain: v })}
                    label="Gain"
                    unit=" dB"
                    size="sm"
                    disabled={!settings.enabled}
                  />
                  <Knob
                    value={band.q}
                    min={0.1}
                    max={10}
                    onChange={(v) => updateBand(index, { q: v })}
                    label="Q"
                    size="sm"
                    disabled={!settings.enabled}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compressor Effect UI
function CompressorUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.compressor;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();

  if (!settings) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Compressor"
        icon={Zap}
        enabled={settings.enabled}
        onToggle={() => updateTrackEffects(track.id, { compressor: { ...settings, enabled: !settings.enabled } })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="amber"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.threshold}
              min={-60}
              max={0}
              onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, threshold: v } })}
              label="Thresh"
              unit=" dB"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.ratio}
              min={1}
              max={20}
              onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, ratio: v } })}
              label="Ratio"
              unit=":1"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.attack}
              min={0}
              max={1000}
              onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, attack: v } })}
              label="Attack"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.release}
              min={0}
              max={3000}
              onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, release: v } })}
              label="Release"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.knee}
              min={0}
              max={40}
              onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, knee: v } })}
              label="Knee"
              unit=" dB"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.makeupGain}
              min={-12}
              max={24}
              onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, makeupGain: v } })}
              label="Makeup"
              unit=" dB"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Reverb Effect UI
function ReverbUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.reverb;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();

  if (!settings) return null;

  const reverbTypes = [
    { value: 'room', label: 'Room' },
    { value: 'hall', label: 'Hall' },
    { value: 'plate', label: 'Plate' },
    { value: 'spring', label: 'Spring' },
    { value: 'ambient', label: 'Ambient' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Reverb"
        icon={Waves}
        enabled={settings.enabled}
        onToggle={() => updateTrackEffects(track.id, { reverb: { ...settings, enabled: !settings.enabled } })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="indigo"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          {/* Type selector */}
          <div className="flex gap-1">
            {reverbTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => updateTrackEffects(track.id, { reverb: { ...settings, type: type.value as typeof settings.type } })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.type === type.value
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10',
                  !settings.enabled && 'opacity-50'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, mix: v / 100 } })}
              label="Mix"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.decay}
              min={0.1}
              max={10}
              onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, decay: v } })}
              label="Decay"
              unit=" s"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.preDelay}
              min={0}
              max={100}
              onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, preDelay: v } })}
              label="Pre-Dly"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.lowCut}
              min={20}
              max={1000}
              onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, lowCut: v } })}
              label="Lo Cut"
              unit=" Hz"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.highCut}
              min={1000}
              max={20000}
              onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, highCut: v } })}
              label="Hi Cut"
              unit=" Hz"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Limiter Effect UI
function LimiterUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.limiter;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();

  if (!settings) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Limiter"
        icon={Wind}
        enabled={settings.enabled}
        onToggle={() => updateTrackEffects(track.id, { limiter: { ...settings, enabled: !settings.enabled } })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="rose"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.threshold}
              min={-24}
              max={0}
              onChange={(v) => updateTrackEffects(track.id, { limiter: { ...settings, threshold: v } })}
              label="Thresh"
              unit=" dB"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.release}
              min={10}
              max={1000}
              onChange={(v) => updateTrackEffects(track.id, { limiter: { ...settings, release: v } })}
              label="Release"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.ceiling}
              min={-6}
              max={0}
              onChange={(v) => updateTrackEffects(track.id, { limiter: { ...settings, ceiling: v } })}
              label="Ceiling"
              unit=" dB"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Main Effects Rack Component
interface EffectsRackProps {
  track: UserTrack;
  onClose?: () => void;
}

export function EffectsRack({ track, onClose }: EffectsRackProps) {
  const { loadPreset, updateTrackEffects } = useUserTracksStore();
  const [showPresets, setShowPresets] = useState(false);

  const handleReset = () => {
    loadPreset(track.id, 'clean');
  };

  return (
    <div className="w-80 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Effects Rack</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className={cn(
              'px-2 py-1 text-[10px] font-medium rounded transition-colors',
              showPresets ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white'
            )}
          >
            Presets
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors"
            title="Reset all effects"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Presets Panel */}
      {showPresets && (
        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
          <div className="grid grid-cols-2 gap-1.5">
            {EFFECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  loadPreset(track.id, preset.id);
                  setShowPresets(false);
                }}
                className={cn(
                  'px-2 py-1.5 text-[10px] font-medium rounded transition-colors text-left',
                  track.audioSettings.activePreset === preset.id
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Preset Indicator */}
      {track.audioSettings.activePreset && (
        <div className="px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/20">
          <span className="text-[10px] text-indigo-400">
            Active Preset: {EFFECT_PRESETS.find((p) => p.id === track.audioSettings.activePreset)?.name}
          </span>
        </div>
      )}

      {/* Effects Chain */}
      <div className="max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <NoiseGateUI track={track} />
        <EQUI track={track} />
        <CompressorUI track={track} />
        <ReverbUI track={track} />
        <LimiterUI track={track} />
      </div>

      {/* Signal Flow Indicator */}
      <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <span>Signal:</span>
          <span className={track.audioSettings.effects?.noiseGate.enabled ? 'text-emerald-400' : ''}>Gate</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.eq.enabled ? 'text-cyan-400' : ''}>EQ</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.compressor.enabled ? 'text-amber-400' : ''}>Comp</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.reverb.enabled ? 'text-indigo-400' : ''}>Verb</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.limiter.enabled ? 'text-rose-400' : ''}>Limit</span>
        </div>
      </div>
    </div>
  );
}
