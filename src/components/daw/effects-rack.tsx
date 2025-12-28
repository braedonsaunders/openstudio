'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { EFFECT_PRESETS } from '@/lib/audio/effects/presets';
import { GUITAR_PRESETS } from '@/lib/audio/effects/guitar';
import { DEFAULT_UNIFIED_EFFECTS } from '@/lib/audio/effects/unified-effects-processor';
import { DEFAULT_FULL_EFFECTS } from '@/lib/audio/effects/extended-effects-processor';
import type { UserTrack, ExtendedEffectsChain } from '@/types';
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
  Search,
  X,
  Guitar,
  Mic2,
  Speaker,
  Clock,
  Radio,
  Filter,
  Volume2,
  Music,
  Sliders,
  // New icons for extended effects
  Gauge,
  Activity,
  Disc3,
  AudioWaveform,
  SlidersHorizontal,
  Move3D,
  Palette,
  Hash,
  Binary,
  CircleDot,
  ArrowLeftRight,
  Grid3X3,
  RotateCw,
  PanelLeftClose,
  Wand2,
  MonitorSpeaker,
  Expand,
  Maximize2,
  Split,
  Home,
  Cloudy,
} from 'lucide-react';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

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
  color = 'indigo',
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  color?: 'indigo' | 'orange';
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

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const colorClasses = color === 'orange' ? 'text-orange-500/30' : 'text-indigo-500/30';
  const indicatorColor = color === 'orange' ? 'bg-orange-400' : 'bg-indigo-400';

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
        <div
          className="absolute inset-1 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-700 shadow"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className={cn('absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 rounded-full', indicatorColor)} />
        </div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${normalizedValue * 85} 100`}
            strokeDashoffset="25"
            className={colorClasses}
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
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/20',
    rose: 'text-rose-400 bg-rose-500/20',
    orange: 'text-orange-400 bg-orange-500/20',
    red: 'text-red-400 bg-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
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
        <div className={cn('p-1.5 rounded', enabled ? colorMap[color] || colorMap.indigo : 'text-zinc-600 bg-white/5')}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className={cn('text-xs font-medium', enabled ? 'text-white' : 'text-zinc-500')}>
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
        <Power className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// STANDARD EFFECTS UI COMPONENTS
// ============================================================================

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
            <Knob value={settings.threshold} min={-96} max={0} onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, threshold: v } })} label="Thresh" unit=" dB" disabled={!settings.enabled} />
            <Knob value={settings.attack} min={0} max={50} onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, attack: v } })} label="Attack" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.hold} min={0} max={500} onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, hold: v } })} label="Hold" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.release} min={0} max={500} onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, release: v } })} label="Release" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.range} min={-80} max={0} onChange={(v) => updateTrackEffects(track.id, { noiseGate: { ...settings, range: v } })} label="Range" unit=" dB" disabled={!settings.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function EQUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.eq;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();
  if (!settings) return null;

  const updateBand = (index: number, updates: { frequency?: number; gain?: number; q?: number }) => {
    const newBands = settings.bands.map((band, i) => i === index ? { ...band, ...updates } : band);
    updateTrackEffects(track.id, { eq: { ...settings, bands: newBands } });
  };

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Equalizer" icon={BarChart3} enabled={settings.enabled} onToggle={() => updateTrackEffects(track.id, { eq: { ...settings, enabled: !settings.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="cyan" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="space-y-3">
            {settings.bands.map((band, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 w-12">{band.type === 'lowshelf' ? 'Low' : band.type === 'highshelf' ? 'High' : `Mid ${index}`}</span>
                <div className="flex-1 flex items-center gap-2">
                  <Knob value={band.frequency} min={20} max={20000} onChange={(v) => updateBand(index, { frequency: v })} label="Freq" unit=" Hz" size="sm" disabled={!settings.enabled} />
                  <Knob value={band.gain} min={-24} max={24} onChange={(v) => updateBand(index, { gain: v })} label="Gain" unit=" dB" size="sm" disabled={!settings.enabled} />
                  <Knob value={band.q} min={0.1} max={10} onChange={(v) => updateBand(index, { q: v })} label="Q" size="sm" disabled={!settings.enabled} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompressorUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.compressor;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();
  if (!settings) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Compressor" icon={Zap} enabled={settings.enabled} onToggle={() => updateTrackEffects(track.id, { compressor: { ...settings, enabled: !settings.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="amber" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={settings.threshold} min={-60} max={0} onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, threshold: v } })} label="Thresh" unit=" dB" disabled={!settings.enabled} />
            <Knob value={settings.ratio} min={1} max={20} onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, ratio: v } })} label="Ratio" unit=":1" disabled={!settings.enabled} />
            <Knob value={settings.attack} min={0} max={1000} onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, attack: v } })} label="Attack" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.release} min={0} max={3000} onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, release: v } })} label="Release" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.knee} min={0} max={40} onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, knee: v } })} label="Knee" unit=" dB" disabled={!settings.enabled} />
            <Knob value={settings.makeupGain} min={-12} max={24} onChange={(v) => updateTrackEffects(track.id, { compressor: { ...settings, makeupGain: v } })} label="Makeup" unit=" dB" disabled={!settings.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReverbUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.reverb;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();
  if (!settings) return null;

  const reverbTypes = [{ value: 'room', label: 'Room' }, { value: 'hall', label: 'Hall' }, { value: 'plate', label: 'Plate' }, { value: 'spring', label: 'Spring' }, { value: 'ambient', label: 'Ambient' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Reverb" icon={Waves} enabled={settings.enabled} onToggle={() => updateTrackEffects(track.id, { reverb: { ...settings, enabled: !settings.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="indigo" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {reverbTypes.map((type) => (
              <button key={type.value} onClick={() => updateTrackEffects(track.id, { reverb: { ...settings, type: type.value as typeof settings.type } })} disabled={!settings.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors', settings.type === type.value ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !settings.enabled && 'opacity-50')}>{type.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={settings.mix * 100} min={0} max={100} onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, mix: v / 100 } })} label="Mix" unit="%" disabled={!settings.enabled} />
            <Knob value={settings.decay} min={0.1} max={10} onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, decay: v } })} label="Decay" unit=" s" disabled={!settings.enabled} />
            <Knob value={settings.preDelay} min={0} max={100} onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, preDelay: v } })} label="Pre-Dly" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.lowCut} min={20} max={1000} onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, lowCut: v } })} label="Lo Cut" unit=" Hz" disabled={!settings.enabled} />
            <Knob value={settings.highCut} min={1000} max={20000} onChange={(v) => updateTrackEffects(track.id, { reverb: { ...settings, highCut: v } })} label="Hi Cut" unit=" Hz" disabled={!settings.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function LimiterUI({ track }: { track: UserTrack }) {
  const settings = track.audioSettings.effects?.limiter;
  const [expanded, setExpanded] = useState(settings?.enabled ?? false);
  const { updateTrackEffects } = useUserTracksStore();
  if (!settings) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Limiter" icon={Wind} enabled={settings.enabled} onToggle={() => updateTrackEffects(track.id, { limiter: { ...settings, enabled: !settings.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="rose" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={settings.threshold} min={-24} max={0} onChange={(v) => updateTrackEffects(track.id, { limiter: { ...settings, threshold: v } })} label="Thresh" unit=" dB" disabled={!settings.enabled} />
            <Knob value={settings.release} min={10} max={1000} onChange={(v) => updateTrackEffects(track.id, { limiter: { ...settings, release: v } })} label="Release" unit=" ms" disabled={!settings.enabled} />
            <Knob value={settings.ceiling} min={-6} max={0} onChange={(v) => updateTrackEffects(track.id, { limiter: { ...settings, ceiling: v } })} label="Ceiling" unit=" dB" disabled={!settings.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GUITAR EFFECTS UI COMPONENTS
// ============================================================================

interface EffectProps {
  settings: ExtendedEffectsChain;
  onChange: (settings: Partial<ExtendedEffectsChain>) => void;
}

// Legacy alias
type GuitarEffectProps = EffectProps;

function WahUI({ settings, onChange }: GuitarEffectProps) {
  const wah = settings.wah;
  const [expanded, setExpanded] = useState(wah.enabled);
  const modes = [{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }, { value: 'envelope', label: 'Env' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Wah" icon={Filter} enabled={wah.enabled} onToggle={() => onChange({ wah: { ...wah, enabled: !wah.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="purple" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {modes.map((m) => <button key={m.value} onClick={() => onChange({ wah: { ...wah, mode: m.value as 'manual' | 'auto' | 'envelope' } })} disabled={!wah.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', wah.mode === m.value ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !wah.enabled && 'opacity-50')}>{m.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {wah.mode === 'manual' && <Knob value={wah.frequency * 100} min={0} max={100} onChange={(v) => onChange({ wah: { ...wah, frequency: v / 100 } })} label="Position" unit="%" disabled={!wah.enabled} color="orange" />}
            {wah.mode === 'auto' && <Knob value={wah.rate} min={0.1} max={10} onChange={(v) => onChange({ wah: { ...wah, rate: v } })} label="Rate" unit=" Hz" disabled={!wah.enabled} color="orange" />}
            {wah.mode === 'envelope' && <Knob value={wah.sensitivity * 100} min={0} max={100} onChange={(v) => onChange({ wah: { ...wah, sensitivity: v / 100 } })} label="Sens" unit="%" disabled={!wah.enabled} color="orange" />}
            <Knob value={wah.depth * 100} min={0} max={100} onChange={(v) => onChange({ wah: { ...wah, depth: v / 100 } })} label="Depth" unit="%" disabled={!wah.enabled} color="orange" />
            <Knob value={wah.q} min={1} max={20} onChange={(v) => onChange({ wah: { ...wah, q: v } })} label="Q" disabled={!wah.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function OverdriveUI({ settings, onChange }: GuitarEffectProps) {
  const od = settings.overdrive;
  const [expanded, setExpanded] = useState(od.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Overdrive" icon={Zap} enabled={od.enabled} onToggle={() => onChange({ overdrive: { ...od, enabled: !od.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="yellow" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={od.drive * 100} min={0} max={100} onChange={(v) => onChange({ overdrive: { ...od, drive: v / 100 } })} label="Drive" unit="%" disabled={!od.enabled} color="orange" />
            <Knob value={od.tone * 100} min={0} max={100} onChange={(v) => onChange({ overdrive: { ...od, tone: v / 100 } })} label="Tone" unit="%" disabled={!od.enabled} color="orange" />
            <Knob value={od.level * 100} min={0} max={100} onChange={(v) => onChange({ overdrive: { ...od, level: v / 100 } })} label="Level" unit="%" disabled={!od.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function DistortionUI({ settings, onChange }: GuitarEffectProps) {
  const dist = settings.distortion;
  const [expanded, setExpanded] = useState(dist.enabled);
  const types = [{ value: 'classic', label: 'Classic' }, { value: 'hard', label: 'Hard' }, { value: 'fuzz', label: 'Fuzz' }, { value: 'rectifier', label: 'Rect' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Distortion" icon={Zap} enabled={dist.enabled} onToggle={() => onChange({ distortion: { ...dist, enabled: !dist.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="red" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {types.map((t) => <button key={t.value} onClick={() => onChange({ distortion: { ...dist, type: t.value as typeof dist.type } })} disabled={!dist.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', dist.type === t.value ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !dist.enabled && 'opacity-50')}>{t.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={dist.amount * 100} min={0} max={100} onChange={(v) => onChange({ distortion: { ...dist, amount: v / 100 } })} label="Gain" unit="%" disabled={!dist.enabled} color="orange" />
            <Knob value={dist.tone * 100} min={0} max={100} onChange={(v) => onChange({ distortion: { ...dist, tone: v / 100 } })} label="Tone" unit="%" disabled={!dist.enabled} color="orange" />
            <Knob value={dist.level * 100} min={0} max={100} onChange={(v) => onChange({ distortion: { ...dist, level: v / 100 } })} label="Level" unit="%" disabled={!dist.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function AmpSimulatorUI({ settings, onChange }: GuitarEffectProps) {
  const amp = settings.ampSimulator;
  const [expanded, setExpanded] = useState(amp.enabled);
  const types = [{ value: 'clean', label: 'Clean' }, { value: 'crunch', label: 'Crunch' }, { value: 'british', label: 'British' }, { value: 'american', label: 'US' }, { value: 'highgain', label: 'Hi-Gain' }, { value: 'modern', label: 'Modern' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Amp Simulator" icon={Volume2} enabled={amp.enabled} onToggle={() => onChange({ ampSimulator: { ...amp, enabled: !amp.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="orange" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex flex-wrap gap-1">
            {types.map((t) => <button key={t.value} onClick={() => onChange({ ampSimulator: { ...amp, type: t.value as typeof amp.type } })} disabled={!amp.enabled} className={cn('px-2 py-1 text-[10px] font-medium rounded', amp.type === t.value ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !amp.enabled && 'opacity-50')}>{t.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={amp.gain * 100} min={0} max={100} onChange={(v) => onChange({ ampSimulator: { ...amp, gain: v / 100 } })} label="Gain" unit="%" disabled={!amp.enabled} color="orange" />
            <Knob value={amp.bass * 100} min={0} max={100} onChange={(v) => onChange({ ampSimulator: { ...amp, bass: v / 100 } })} label="Bass" unit="%" disabled={!amp.enabled} color="orange" />
            <Knob value={amp.mid * 100} min={0} max={100} onChange={(v) => onChange({ ampSimulator: { ...amp, mid: v / 100 } })} label="Mid" unit="%" disabled={!amp.enabled} color="orange" />
            <Knob value={amp.treble * 100} min={0} max={100} onChange={(v) => onChange({ ampSimulator: { ...amp, treble: v / 100 } })} label="Treble" unit="%" disabled={!amp.enabled} color="orange" />
            <Knob value={amp.presence * 100} min={0} max={100} onChange={(v) => onChange({ ampSimulator: { ...amp, presence: v / 100 } })} label="Pres" unit="%" disabled={!amp.enabled} color="orange" />
            <Knob value={amp.master * 100} min={0} max={100} onChange={(v) => onChange({ ampSimulator: { ...amp, master: v / 100 } })} label="Master" unit="%" disabled={!amp.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function CabinetUI({ settings, onChange }: GuitarEffectProps) {
  const cab = settings.cabinet;
  const [expanded, setExpanded] = useState(cab.enabled);
  const cabTypes = [{ value: '1x12', label: '1x12' }, { value: '2x12', label: '2x12' }, { value: '4x12', label: '4x12' }, { value: '1x15', label: '1x15' }];
  const micPositions = [{ value: 'center', label: 'Center' }, { value: 'edge', label: 'Edge' }, { value: 'room', label: 'Room' }, { value: 'blend', label: 'Blend' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Cabinet" icon={Speaker} enabled={cab.enabled} onToggle={() => onChange({ cabinet: { ...cab, enabled: !cab.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="amber" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {cabTypes.map((t) => <button key={t.value} onClick={() => onChange({ cabinet: { ...cab, type: t.value as typeof cab.type } })} disabled={!cab.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', cab.type === t.value ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !cab.enabled && 'opacity-50')}>{t.label}</button>)}
          </div>
          <div className="flex gap-1">
            {micPositions.map((m) => <button key={m.value} onClick={() => onChange({ cabinet: { ...cab, micPosition: m.value as typeof cab.micPosition } })} disabled={!cab.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', cab.micPosition === m.value ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !cab.enabled && 'opacity-50')}>{m.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={cab.mix * 100} min={0} max={100} onChange={(v) => onChange({ cabinet: { ...cab, mix: v / 100 } })} label="Mix" unit="%" disabled={!cab.enabled} color="orange" />
            <Knob value={cab.roomLevel * 100} min={0} max={100} onChange={(v) => onChange({ cabinet: { ...cab, roomLevel: v / 100 } })} label="Room" unit="%" disabled={!cab.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function ChorusUI({ settings, onChange }: GuitarEffectProps) {
  const chorus = settings.chorus;
  const [expanded, setExpanded] = useState(chorus.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Chorus" icon={Waves} enabled={chorus.enabled} onToggle={() => onChange({ chorus: { ...chorus, enabled: !chorus.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="indigo" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={chorus.rate} min={0.1} max={10} onChange={(v) => onChange({ chorus: { ...chorus, rate: v } })} label="Rate" unit=" Hz" disabled={!chorus.enabled} color="orange" />
            <Knob value={chorus.depth * 100} min={0} max={100} onChange={(v) => onChange({ chorus: { ...chorus, depth: v / 100 } })} label="Depth" unit="%" disabled={!chorus.enabled} color="orange" />
            <Knob value={chorus.mix * 100} min={0} max={100} onChange={(v) => onChange({ chorus: { ...chorus, mix: v / 100 } })} label="Mix" unit="%" disabled={!chorus.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function FlangerUI({ settings, onChange }: GuitarEffectProps) {
  const flanger = settings.flanger;
  const [expanded, setExpanded] = useState(flanger.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Flanger" icon={Wind} enabled={flanger.enabled} onToggle={() => onChange({ flanger: { ...flanger, enabled: !flanger.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="emerald" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={flanger.rate} min={0.05} max={5} onChange={(v) => onChange({ flanger: { ...flanger, rate: v } })} label="Rate" unit=" Hz" disabled={!flanger.enabled} color="orange" />
            <Knob value={flanger.depth * 100} min={0} max={100} onChange={(v) => onChange({ flanger: { ...flanger, depth: v / 100 } })} label="Depth" unit="%" disabled={!flanger.enabled} color="orange" />
            <Knob value={flanger.feedback * 100} min={0} max={95} onChange={(v) => onChange({ flanger: { ...flanger, feedback: v / 100 } })} label="Fdbk" unit="%" disabled={!flanger.enabled} color="orange" />
            <Knob value={flanger.mix * 100} min={0} max={100} onChange={(v) => onChange({ flanger: { ...flanger, mix: v / 100 } })} label="Mix" unit="%" disabled={!flanger.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function PhaserUI({ settings, onChange }: GuitarEffectProps) {
  const phaser = settings.phaser;
  const [expanded, setExpanded] = useState(phaser.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Phaser" icon={Radio} enabled={phaser.enabled} onToggle={() => onChange({ phaser: { ...phaser, enabled: !phaser.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="purple" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={phaser.rate} min={0.1} max={8} onChange={(v) => onChange({ phaser: { ...phaser, rate: v } })} label="Rate" unit=" Hz" disabled={!phaser.enabled} color="orange" />
            <Knob value={phaser.depth * 100} min={0} max={100} onChange={(v) => onChange({ phaser: { ...phaser, depth: v / 100 } })} label="Depth" unit="%" disabled={!phaser.enabled} color="orange" />
            <Knob value={phaser.feedback * 100} min={0} max={95} onChange={(v) => onChange({ phaser: { ...phaser, feedback: v / 100 } })} label="Fdbk" unit="%" disabled={!phaser.enabled} color="orange" />
            <Knob value={phaser.mix * 100} min={0} max={100} onChange={(v) => onChange({ phaser: { ...phaser, mix: v / 100 } })} label="Mix" unit="%" disabled={!phaser.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function DelayUI({ settings, onChange }: GuitarEffectProps) {
  const delay = settings.delay;
  const [expanded, setExpanded] = useState(delay.enabled);
  const types = [{ value: 'digital', label: 'Digital' }, { value: 'analog', label: 'Analog' }, { value: 'tape', label: 'Tape' }, { value: 'pingpong', label: 'Ping Pong' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Delay" icon={Clock} enabled={delay.enabled} onToggle={() => onChange({ delay: { ...delay, enabled: !delay.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="cyan" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {types.map((t) => <button key={t.value} onClick={() => onChange({ delay: { ...delay, type: t.value as typeof delay.type } })} disabled={!delay.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', delay.type === t.value ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !delay.enabled && 'opacity-50')}>{t.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={delay.time * 1000} min={10} max={2000} onChange={(v) => onChange({ delay: { ...delay, time: v / 1000 } })} label="Time" unit=" ms" disabled={!delay.enabled} color="orange" />
            <Knob value={delay.feedback * 100} min={0} max={95} onChange={(v) => onChange({ delay: { ...delay, feedback: v / 100 } })} label="Fdbk" unit="%" disabled={!delay.enabled} color="orange" />
            <Knob value={delay.mix * 100} min={0} max={100} onChange={(v) => onChange({ delay: { ...delay, mix: v / 100 } })} label="Mix" unit="%" disabled={!delay.enabled} color="orange" />
            <Knob value={delay.tone * 100} min={0} max={100} onChange={(v) => onChange({ delay: { ...delay, tone: v / 100 } })} label="Tone" unit="%" disabled={!delay.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function TremoloUI({ settings, onChange }: GuitarEffectProps) {
  const trem = settings.tremolo;
  const [expanded, setExpanded] = useState(trem.enabled);
  const waveforms = [{ value: 'sine', label: 'Sine' }, { value: 'triangle', label: 'Tri' }, { value: 'square', label: 'Sqr' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Tremolo" icon={Sparkles} enabled={trem.enabled} onToggle={() => onChange({ tremolo: { ...trem, enabled: !trem.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="amber" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {waveforms.map((w) => <button key={w.value} onClick={() => onChange({ tremolo: { ...trem, waveform: w.value as typeof trem.waveform } })} disabled={!trem.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', trem.waveform === w.value ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !trem.enabled && 'opacity-50')}>{w.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={trem.rate} min={0.1} max={20} onChange={(v) => onChange({ tremolo: { ...trem, rate: v } })} label="Rate" unit=" Hz" disabled={!trem.enabled} color="orange" />
            <Knob value={trem.depth * 100} min={0} max={100} onChange={(v) => onChange({ tremolo: { ...trem, depth: v / 100 } })} label="Depth" unit="%" disabled={!trem.enabled} color="orange" />
            <Knob value={trem.spread} min={0} max={180} onChange={(v) => onChange({ tremolo: { ...trem, spread: v } })} label="Stereo" unit="°" disabled={!trem.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VOCAL EFFECTS UI COMPONENTS
// ============================================================================

function PitchCorrectionUI({ settings, onChange }: EffectProps) {
  const pc = settings.pitchCorrection;
  const [expanded, setExpanded] = useState(pc?.enabled ?? false);
  if (!pc) return null;

  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const scales = [
    { value: 'major', label: 'Major' },
    { value: 'minor', label: 'Minor' },
    { value: 'chromatic', label: 'Chromatic' },
    { value: 'pentatonicMajor', label: 'Pent Maj' },
    { value: 'pentatonicMinor', label: 'Pent Min' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Pitch Correction" icon={Gauge} enabled={pc.enabled} onToggle={() => onChange({ pitchCorrection: { ...pc, enabled: !pc.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="rose" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1 flex-wrap">
            {keys.map((k) => <button key={k} onClick={() => onChange({ pitchCorrection: { ...pc, key: k } })} disabled={!pc.enabled} className={cn('px-1.5 py-0.5 text-[9px] font-medium rounded', pc.key === k ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !pc.enabled && 'opacity-50')}>{k}</button>)}
          </div>
          <div className="flex gap-1">
            {scales.map((s) => <button key={s.value} onClick={() => onChange({ pitchCorrection: { ...pc, scale: s.value as typeof pc.scale } })} disabled={!pc.enabled} className={cn('flex-1 px-1.5 py-1 text-[9px] font-medium rounded', pc.scale === s.value ? 'bg-rose-500/20 text-rose-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !pc.enabled && 'opacity-50')}>{s.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={pc.speed} min={0} max={100} onChange={(v) => onChange({ pitchCorrection: { ...pc, speed: v } })} label="Speed" unit="%" disabled={!pc.enabled} />
            <Knob value={pc.humanize} min={0} max={100} onChange={(v) => onChange({ pitchCorrection: { ...pc, humanize: v } })} label="Humanize" unit="%" disabled={!pc.enabled} />
            <Knob value={pc.detune} min={-100} max={100} onChange={(v) => onChange({ pitchCorrection: { ...pc, detune: v } })} label="Detune" unit=" ct" disabled={!pc.enabled} />
            <Knob value={pc.mix} min={0} max={100} onChange={(v) => onChange({ pitchCorrection: { ...pc, mix: v } })} label="Mix" unit="%" disabled={!pc.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function VocalDoublerUI({ settings, onChange }: EffectProps) {
  const vd = settings.vocalDoubler;
  const [expanded, setExpanded] = useState(vd?.enabled ?? false);
  if (!vd) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Vocal Doubler" icon={Disc3} enabled={vd.enabled} onToggle={() => onChange({ vocalDoubler: { ...vd, enabled: !vd.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="pink" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={vd.voices} min={1} max={4} onChange={(v) => onChange({ vocalDoubler: { ...vd, voices: Math.round(v) } })} label="Voices" disabled={!vd.enabled} />
            <Knob value={vd.detune} min={0} max={50} onChange={(v) => onChange({ vocalDoubler: { ...vd, detune: v } })} label="Detune" unit=" ct" disabled={!vd.enabled} />
            <Knob value={vd.delay} min={0} max={50} onChange={(v) => onChange({ vocalDoubler: { ...vd, delay: v } })} label="Delay" unit=" ms" disabled={!vd.enabled} />
            <Knob value={vd.spread} min={0} max={100} onChange={(v) => onChange({ vocalDoubler: { ...vd, spread: v } })} label="Spread" unit="%" disabled={!vd.enabled} />
            <Knob value={vd.mix} min={0} max={100} onChange={(v) => onChange({ vocalDoubler: { ...vd, mix: v } })} label="Mix" unit="%" disabled={!vd.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function DeEsserUI({ settings, onChange }: EffectProps) {
  const de = settings.deEsser;
  const [expanded, setExpanded] = useState(de?.enabled ?? false);
  if (!de) return null;

  const modes = [{ value: 'split', label: 'Split' }, { value: 'wideband', label: 'Wideband' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="De-Esser" icon={AudioWaveform} enabled={de.enabled} onToggle={() => onChange({ deEsser: { ...de, enabled: !de.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="fuchsia" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {modes.map((m) => <button key={m.value} onClick={() => onChange({ deEsser: { ...de, mode: m.value as typeof de.mode } })} disabled={!de.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', de.mode === m.value ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !de.enabled && 'opacity-50')}>{m.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={de.frequency} min={2000} max={10000} onChange={(v) => onChange({ deEsser: { ...de, frequency: v } })} label="Freq" unit=" Hz" disabled={!de.enabled} />
            <Knob value={de.threshold} min={-60} max={0} onChange={(v) => onChange({ deEsser: { ...de, threshold: v } })} label="Thresh" unit=" dB" disabled={!de.enabled} />
            <Knob value={de.reduction} min={0} max={24} onChange={(v) => onChange({ deEsser: { ...de, reduction: v } })} label="Reduce" unit=" dB" disabled={!de.enabled} />
            <Knob value={de.range} min={0} max={24} onChange={(v) => onChange({ deEsser: { ...de, range: v } })} label="Range" unit=" dB" disabled={!de.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function FormantShifterUI({ settings, onChange }: EffectProps) {
  const fs = settings.formantShifter;
  const [expanded, setExpanded] = useState(fs?.enabled ?? false);
  if (!fs) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Formant Shifter" icon={Activity} enabled={fs.enabled} onToggle={() => onChange({ formantShifter: { ...fs, enabled: !fs.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="violet" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={fs.shift} min={-12} max={12} onChange={(v) => onChange({ formantShifter: { ...fs, shift: v } })} label="Shift" unit=" st" disabled={!fs.enabled} />
            <Knob value={fs.gender} min={-100} max={100} onChange={(v) => onChange({ formantShifter: { ...fs, gender: v } })} label="Gender" unit="%" disabled={!fs.enabled} />
            <Knob value={fs.mix} min={0} max={100} onChange={(v) => onChange({ formantShifter: { ...fs, mix: v } })} label="Mix" unit="%" disabled={!fs.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function HarmonizerUI({ settings, onChange }: EffectProps) {
  const harm = settings.harmonizer;
  const [expanded, setExpanded] = useState(harm?.enabled ?? false);
  if (!harm) return null;

  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const harmonies = [
    { value: 'third', label: '3rd' },
    { value: 'fifth', label: '5th' },
    { value: 'octave', label: 'Oct' },
    { value: 'thirdAndFifth', label: '3+5' },
    { value: 'powerChord', label: 'Power' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Harmonizer" icon={Music} enabled={harm.enabled} onToggle={() => onChange({ harmonizer: { ...harm, enabled: !harm.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="purple" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1 flex-wrap">
            {keys.map((k) => <button key={k} onClick={() => onChange({ harmonizer: { ...harm, key: k } })} disabled={!harm.enabled} className={cn('px-1.5 py-0.5 text-[9px] font-medium rounded', harm.key === k ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !harm.enabled && 'opacity-50')}>{k}</button>)}
          </div>
          <div className="flex gap-1">
            {harmonies.map((h) => <button key={h.value} onClick={() => onChange({ harmonizer: { ...harm, harmonyType: h.value as typeof harm.harmonyType } })} disabled={!harm.enabled} className={cn('flex-1 px-1.5 py-1 text-[9px] font-medium rounded', harm.harmonyType === h.value ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !harm.enabled && 'opacity-50')}>{h.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={harm.voices} min={1} max={4} onChange={(v) => onChange({ harmonizer: { ...harm, voices: Math.round(v) } })} label="Voices" disabled={!harm.enabled} />
            <Knob value={harm.spread} min={0} max={100} onChange={(v) => onChange({ harmonizer: { ...harm, spread: v } })} label="Spread" unit="%" disabled={!harm.enabled} />
            <Knob value={harm.mix} min={0} max={100} onChange={(v) => onChange({ harmonizer: { ...harm, mix: v } })} label="Mix" unit="%" disabled={!harm.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CREATIVE EFFECTS UI COMPONENTS
// ============================================================================

function BitcrusherUI({ settings, onChange }: EffectProps) {
  const bc = settings.bitcrusher;
  const [expanded, setExpanded] = useState(bc?.enabled ?? false);
  if (!bc) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Bitcrusher" icon={Binary} enabled={bc.enabled} onToggle={() => onChange({ bitcrusher: { ...bc, enabled: !bc.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="lime" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={bc.bits} min={1} max={16} onChange={(v) => onChange({ bitcrusher: { ...bc, bits: Math.round(v) } })} label="Bits" disabled={!bc.enabled} />
            <Knob value={bc.sampleRate} min={100} max={44100} onChange={(v) => onChange({ bitcrusher: { ...bc, sampleRate: v } })} label="Sample" unit=" Hz" disabled={!bc.enabled} />
            <Knob value={bc.mix} min={0} max={100} onChange={(v) => onChange({ bitcrusher: { ...bc, mix: v } })} label="Mix" unit="%" disabled={!bc.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function RingModulatorUI({ settings, onChange }: EffectProps) {
  const rm = settings.ringModulator;
  const [expanded, setExpanded] = useState(rm?.enabled ?? false);
  if (!rm) return null;

  const waveforms = [{ value: 'sine', label: 'Sine' }, { value: 'square', label: 'Sqr' }, { value: 'triangle', label: 'Tri' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Ring Modulator" icon={CircleDot} enabled={rm.enabled} onToggle={() => onChange({ ringModulator: { ...rm, enabled: !rm.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="teal" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {waveforms.map((w) => <button key={w.value} onClick={() => onChange({ ringModulator: { ...rm, waveform: w.value as typeof rm.waveform } })} disabled={!rm.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', rm.waveform === w.value ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !rm.enabled && 'opacity-50')}>{w.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={rm.frequency} min={20} max={5000} onChange={(v) => onChange({ ringModulator: { ...rm, frequency: v } })} label="Freq" unit=" Hz" disabled={!rm.enabled} />
            <Knob value={rm.lfoRate} min={0} max={10} onChange={(v) => onChange({ ringModulator: { ...rm, lfoRate: v } })} label="LFO" unit=" Hz" disabled={!rm.enabled} />
            <Knob value={rm.lfoDepth} min={0} max={100} onChange={(v) => onChange({ ringModulator: { ...rm, lfoDepth: v } })} label="Depth" unit="%" disabled={!rm.enabled} />
            <Knob value={rm.mix} min={0} max={100} onChange={(v) => onChange({ ringModulator: { ...rm, mix: v } })} label="Mix" unit="%" disabled={!rm.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function FrequencyShifterUI({ settings, onChange }: EffectProps) {
  const fshift = settings.frequencyShifter;
  const [expanded, setExpanded] = useState(fshift?.enabled ?? false);
  if (!fshift) return null;

  const directions = [{ value: 'up', label: 'Up' }, { value: 'down', label: 'Down' }, { value: 'both', label: 'Both' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Freq Shifter" icon={ArrowLeftRight} enabled={fshift.enabled} onToggle={() => onChange({ frequencyShifter: { ...fshift, enabled: !fshift.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="sky" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {directions.map((d) => <button key={d.value} onClick={() => onChange({ frequencyShifter: { ...fshift, direction: d.value as typeof fshift.direction } })} disabled={!fshift.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', fshift.direction === d.value ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !fshift.enabled && 'opacity-50')}>{d.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={fshift.shift} min={-2000} max={2000} onChange={(v) => onChange({ frequencyShifter: { ...fshift, shift: v } })} label="Shift" unit=" Hz" disabled={!fshift.enabled} />
            <Knob value={fshift.feedback} min={0} max={100} onChange={(v) => onChange({ frequencyShifter: { ...fshift, feedback: v } })} label="Fdbk" unit="%" disabled={!fshift.enabled} />
            <Knob value={fshift.mix} min={0} max={100} onChange={(v) => onChange({ frequencyShifter: { ...fshift, mix: v } })} label="Mix" unit="%" disabled={!fshift.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function GranularDelayUI({ settings, onChange }: EffectProps) {
  const gd = settings.granularDelay;
  const [expanded, setExpanded] = useState(gd?.enabled ?? false);
  if (!gd) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Granular Delay" icon={Grid3X3} enabled={gd.enabled} onToggle={() => onChange({ granularDelay: { ...gd, enabled: !gd.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="orange" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={gd.grainSize} min={10} max={500} onChange={(v) => onChange({ granularDelay: { ...gd, grainSize: v } })} label="Grain" unit=" ms" disabled={!gd.enabled} color="orange" />
            <Knob value={gd.density} min={0} max={100} onChange={(v) => onChange({ granularDelay: { ...gd, density: v } })} label="Density" unit="%" disabled={!gd.enabled} color="orange" />
            <Knob value={gd.pitch} min={-24} max={24} onChange={(v) => onChange({ granularDelay: { ...gd, pitch: v } })} label="Pitch" unit=" st" disabled={!gd.enabled} color="orange" />
            <Knob value={gd.feedback} min={0} max={100} onChange={(v) => onChange({ granularDelay: { ...gd, feedback: v } })} label="Fdbk" unit="%" disabled={!gd.enabled} color="orange" />
            <Knob value={gd.spread} min={0} max={100} onChange={(v) => onChange({ granularDelay: { ...gd, spread: v } })} label="Spread" unit="%" disabled={!gd.enabled} color="orange" />
            <Knob value={gd.mix} min={0} max={100} onChange={(v) => onChange({ granularDelay: { ...gd, mix: v } })} label="Mix" unit="%" disabled={!gd.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXTENDED MODULATION EFFECTS UI COMPONENTS
// ============================================================================

function RotarySpeakerUI({ settings, onChange }: EffectProps) {
  const rs = settings.rotarySpeaker;
  const [expanded, setExpanded] = useState(rs?.enabled ?? false);
  if (!rs) return null;

  const speeds = [{ value: 'slow', label: 'Slow' }, { value: 'fast', label: 'Fast' }, { value: 'brake', label: 'Brake' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Rotary Speaker" icon={RotateCw} enabled={rs.enabled} onToggle={() => onChange({ rotarySpeaker: { ...rs, enabled: !rs.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="amber" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {speeds.map((s) => <button key={s.value} onClick={() => onChange({ rotarySpeaker: { ...rs, speed: s.value as typeof rs.speed } })} disabled={!rs.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', rs.speed === s.value ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !rs.enabled && 'opacity-50')}>{s.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={rs.hornLevel} min={0} max={100} onChange={(v) => onChange({ rotarySpeaker: { ...rs, hornLevel: v } })} label="Horn" unit="%" disabled={!rs.enabled} color="orange" />
            <Knob value={rs.drumLevel} min={0} max={100} onChange={(v) => onChange({ rotarySpeaker: { ...rs, drumLevel: v } })} label="Drum" unit="%" disabled={!rs.enabled} color="orange" />
            <Knob value={rs.drive} min={0} max={100} onChange={(v) => onChange({ rotarySpeaker: { ...rs, drive: v } })} label="Drive" unit="%" disabled={!rs.enabled} color="orange" />
            <Knob value={rs.mix} min={0} max={100} onChange={(v) => onChange({ rotarySpeaker: { ...rs, mix: v } })} label="Mix" unit="%" disabled={!rs.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function AutoPanUI({ settings, onChange }: EffectProps) {
  const ap = settings.autoPan;
  const [expanded, setExpanded] = useState(ap?.enabled ?? false);
  if (!ap) return null;

  const waveforms = [{ value: 'sine', label: 'Sine' }, { value: 'triangle', label: 'Tri' }, { value: 'square', label: 'Sqr' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Auto-Pan" icon={PanelLeftClose} enabled={ap.enabled} onToggle={() => onChange({ autoPan: { ...ap, enabled: !ap.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="cyan" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {waveforms.map((w) => <button key={w.value} onClick={() => onChange({ autoPan: { ...ap, waveform: w.value as typeof ap.waveform } })} disabled={!ap.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', ap.waveform === w.value ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !ap.enabled && 'opacity-50')}>{w.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={ap.rate} min={0.1} max={20} onChange={(v) => onChange({ autoPan: { ...ap, rate: v } })} label="Rate" unit=" Hz" disabled={!ap.enabled} />
            <Knob value={ap.depth} min={0} max={100} onChange={(v) => onChange({ autoPan: { ...ap, depth: v } })} label="Depth" unit="%" disabled={!ap.enabled} />
            <Knob value={ap.width} min={0} max={100} onChange={(v) => onChange({ autoPan: { ...ap, width: v } })} label="Width" unit="%" disabled={!ap.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function MultiFilterUI({ settings, onChange }: EffectProps) {
  const mf = settings.multiFilter;
  const [expanded, setExpanded] = useState(mf?.enabled ?? false);
  if (!mf) return null;

  const types = [
    { value: 'lowpass', label: 'LP' },
    { value: 'highpass', label: 'HP' },
    { value: 'bandpass', label: 'BP' },
    { value: 'notch', label: 'Notch' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Multi Filter" icon={SlidersHorizontal} enabled={mf.enabled} onToggle={() => onChange({ multiFilter: { ...mf, enabled: !mf.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="blue" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {types.map((t) => <button key={t.value} onClick={() => onChange({ multiFilter: { ...mf, type: t.value as typeof mf.type } })} disabled={!mf.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', mf.type === t.value ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !mf.enabled && 'opacity-50')}>{t.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={mf.frequency} min={20} max={20000} onChange={(v) => onChange({ multiFilter: { ...mf, frequency: v } })} label="Freq" unit=" Hz" disabled={!mf.enabled} />
            <Knob value={mf.resonance} min={0.1} max={30} onChange={(v) => onChange({ multiFilter: { ...mf, resonance: v } })} label="Reso" disabled={!mf.enabled} />
            <Knob value={mf.lfoRate} min={0} max={20} onChange={(v) => onChange({ multiFilter: { ...mf, lfoRate: v } })} label="LFO" unit=" Hz" disabled={!mf.enabled} />
            <Knob value={mf.lfoDepth} min={0} max={100} onChange={(v) => onChange({ multiFilter: { ...mf, lfoDepth: v } })} label="Depth" unit="%" disabled={!mf.enabled} />
            <Knob value={mf.mix} min={0} max={100} onChange={(v) => onChange({ multiFilter: { ...mf, mix: v } })} label="Mix" unit="%" disabled={!mf.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function VibratoUI({ settings, onChange }: EffectProps) {
  const vib = settings.vibrato;
  const [expanded, setExpanded] = useState(vib?.enabled ?? false);
  if (!vib) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Vibrato" icon={Wand2} enabled={vib.enabled} onToggle={() => onChange({ vibrato: { ...vib, enabled: !vib.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="violet" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={vib.rate} min={0.1} max={20} onChange={(v) => onChange({ vibrato: { ...vib, rate: v } })} label="Rate" unit=" Hz" disabled={!vib.enabled} />
            <Knob value={vib.depth} min={0} max={100} onChange={(v) => onChange({ vibrato: { ...vib, depth: v } })} label="Depth" unit="%" disabled={!vib.enabled} />
            <Knob value={vib.stereo} min={0} max={180} onChange={(v) => onChange({ vibrato: { ...vib, stereo: v } })} label="Stereo" unit="°" disabled={!vib.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DYNAMICS/UTILITY EFFECTS UI COMPONENTS
// ============================================================================

function TransientShaperUI({ settings, onChange }: EffectProps) {
  const ts = settings.transientShaper;
  const [expanded, setExpanded] = useState(ts?.enabled ?? false);
  if (!ts) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Transient Shaper" icon={Activity} enabled={ts.enabled} onToggle={() => onChange({ transientShaper: { ...ts, enabled: !ts.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="orange" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={ts.attack} min={-100} max={100} onChange={(v) => onChange({ transientShaper: { ...ts, attack: v } })} label="Attack" unit="%" disabled={!ts.enabled} color="orange" />
            <Knob value={ts.sustain} min={-100} max={100} onChange={(v) => onChange({ transientShaper: { ...ts, sustain: v } })} label="Sustain" unit="%" disabled={!ts.enabled} color="orange" />
            <Knob value={ts.output} min={-12} max={12} onChange={(v) => onChange({ transientShaper: { ...ts, output: v } })} label="Output" unit=" dB" disabled={!ts.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function StereoImagerUI({ settings, onChange }: EffectProps) {
  const si = settings.stereoImager;
  const [expanded, setExpanded] = useState(si?.enabled ?? false);
  if (!si) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Stereo Imager" icon={Expand} enabled={si.enabled} onToggle={() => onChange({ stereoImager: { ...si, enabled: !si.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="purple" />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={si.width} min={0} max={200} onChange={(v) => onChange({ stereoImager: { ...si, width: v } })} label="Width" unit="%" disabled={!si.enabled} />
            <Knob value={si.midLevel} min={-12} max={12} onChange={(v) => onChange({ stereoImager: { ...si, midLevel: v } })} label="Mid" unit=" dB" disabled={!si.enabled} />
            <Knob value={si.sideLevel} min={-12} max={12} onChange={(v) => onChange({ stereoImager: { ...si, sideLevel: v } })} label="Side" unit=" dB" disabled={!si.enabled} />
            <Knob value={si.bassMonoFreq} min={20} max={500} onChange={(v) => onChange({ stereoImager: { ...si, bassMonoFreq: v } })} label="Bass Mono" unit=" Hz" disabled={!si.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function ExciterUI({ settings, onChange }: EffectProps) {
  const ex = settings.exciter;
  const [expanded, setExpanded] = useState(ex?.enabled ?? false);
  if (!ex) return null;

  const harmonics = [{ value: 'odd', label: 'Odd' }, { value: 'even', label: 'Even' }, { value: 'both', label: 'Both' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Exciter" icon={Sparkles} enabled={ex.enabled} onToggle={() => onChange({ exciter: { ...ex, enabled: !ex.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="yellow" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {harmonics.map((h) => <button key={h.value} onClick={() => onChange({ exciter: { ...ex, harmonics: h.value as typeof ex.harmonics } })} disabled={!ex.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', ex.harmonics === h.value ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !ex.enabled && 'opacity-50')}>{h.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={ex.frequency} min={1000} max={10000} onChange={(v) => onChange({ exciter: { ...ex, frequency: v } })} label="Freq" unit=" Hz" disabled={!ex.enabled} color="orange" />
            <Knob value={ex.amount} min={0} max={100} onChange={(v) => onChange({ exciter: { ...ex, amount: v } })} label="Amount" unit="%" disabled={!ex.enabled} color="orange" />
            <Knob value={ex.mix} min={0} max={100} onChange={(v) => onChange({ exciter: { ...ex, mix: v } })} label="Mix" unit="%" disabled={!ex.enabled} color="orange" />
          </div>
        </div>
      )}
    </div>
  );
}

function MultibandCompressorUI({ settings, onChange }: EffectProps) {
  const mbc = settings.multibandCompressor;
  const [expanded, setExpanded] = useState(mbc?.enabled ?? false);
  if (!mbc) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Multiband Comp" icon={Split} enabled={mbc.enabled} onToggle={() => onChange({ multibandCompressor: { ...mbc, enabled: !mbc.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="emerald" />
      {expanded && (
        <div className="pb-3 px-2 space-y-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={mbc.lowCrossover} min={20} max={500} onChange={(v) => onChange({ multibandCompressor: { ...mbc, lowCrossover: v } })} label="Lo X" unit=" Hz" disabled={!mbc.enabled} />
            <Knob value={mbc.highCrossover} min={500} max={10000} onChange={(v) => onChange({ multibandCompressor: { ...mbc, highCrossover: v } })} label="Hi X" unit=" Hz" disabled={!mbc.enabled} />
          </div>
          <div className="text-[9px] text-zinc-500 text-center">Low Band</div>
          <div className="flex flex-wrap justify-center gap-2">
            <Knob value={mbc.low.threshold} min={-60} max={0} onChange={(v) => onChange({ multibandCompressor: { ...mbc, low: { ...mbc.low, threshold: v } } })} label="Thresh" unit=" dB" size="sm" disabled={!mbc.enabled} />
            <Knob value={mbc.low.ratio} min={1} max={20} onChange={(v) => onChange({ multibandCompressor: { ...mbc, low: { ...mbc.low, ratio: v } } })} label="Ratio" unit=":1" size="sm" disabled={!mbc.enabled} />
            <Knob value={mbc.low.gain} min={-12} max={12} onChange={(v) => onChange({ multibandCompressor: { ...mbc, low: { ...mbc.low, gain: v } } })} label="Gain" unit=" dB" size="sm" disabled={!mbc.enabled} />
          </div>
          <div className="text-[9px] text-zinc-500 text-center">Mid Band</div>
          <div className="flex flex-wrap justify-center gap-2">
            <Knob value={mbc.mid.threshold} min={-60} max={0} onChange={(v) => onChange({ multibandCompressor: { ...mbc, mid: { ...mbc.mid, threshold: v } } })} label="Thresh" unit=" dB" size="sm" disabled={!mbc.enabled} />
            <Knob value={mbc.mid.ratio} min={1} max={20} onChange={(v) => onChange({ multibandCompressor: { ...mbc, mid: { ...mbc.mid, ratio: v } } })} label="Ratio" unit=":1" size="sm" disabled={!mbc.enabled} />
            <Knob value={mbc.mid.gain} min={-12} max={12} onChange={(v) => onChange({ multibandCompressor: { ...mbc, mid: { ...mbc.mid, gain: v } } })} label="Gain" unit=" dB" size="sm" disabled={!mbc.enabled} />
          </div>
          <div className="text-[9px] text-zinc-500 text-center">High Band</div>
          <div className="flex flex-wrap justify-center gap-2">
            <Knob value={mbc.high.threshold} min={-60} max={0} onChange={(v) => onChange({ multibandCompressor: { ...mbc, high: { ...mbc.high, threshold: v } } })} label="Thresh" unit=" dB" size="sm" disabled={!mbc.enabled} />
            <Knob value={mbc.high.ratio} min={1} max={20} onChange={(v) => onChange({ multibandCompressor: { ...mbc, high: { ...mbc.high, ratio: v } } })} label="Ratio" unit=":1" size="sm" disabled={!mbc.enabled} />
            <Knob value={mbc.high.gain} min={-12} max={12} onChange={(v) => onChange({ multibandCompressor: { ...mbc, high: { ...mbc.high, gain: v } } })} label="Gain" unit=" dB" size="sm" disabled={!mbc.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SPATIAL EFFECTS UI COMPONENTS
// ============================================================================

function StereoDelayUI({ settings, onChange }: EffectProps) {
  const sd = settings.stereoDelay;
  const [expanded, setExpanded] = useState(sd?.enabled ?? false);
  if (!sd) return null;

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Stereo Delay" icon={MonitorSpeaker} enabled={sd.enabled} onToggle={() => onChange({ stereoDelay: { ...sd, enabled: !sd.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="cyan" />
      {expanded && (
        <div className="pb-3 px-2 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input type="checkbox" checked={sd.pingPong} onChange={(e) => onChange({ stereoDelay: { ...sd, pingPong: e.target.checked } })} disabled={!sd.enabled} className="w-3 h-3" />
              Ping Pong
            </label>
            <label className="flex items-center gap-1 text-[9px] text-zinc-500">
              <input type="checkbox" checked={sd.tempoSync} onChange={(e) => onChange({ stereoDelay: { ...sd, tempoSync: e.target.checked } })} disabled={!sd.enabled} className="w-3 h-3" />
              Tempo Sync
            </label>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={sd.leftTime} min={0} max={2000} onChange={(v) => onChange({ stereoDelay: { ...sd, leftTime: v } })} label="L Time" unit=" ms" disabled={!sd.enabled} />
            <Knob value={sd.rightTime} min={0} max={2000} onChange={(v) => onChange({ stereoDelay: { ...sd, rightTime: v } })} label="R Time" unit=" ms" disabled={!sd.enabled} />
            <Knob value={sd.leftFeedback} min={0} max={100} onChange={(v) => onChange({ stereoDelay: { ...sd, leftFeedback: v } })} label="L Fdbk" unit="%" disabled={!sd.enabled} />
            <Knob value={sd.rightFeedback} min={0} max={100} onChange={(v) => onChange({ stereoDelay: { ...sd, rightFeedback: v } })} label="R Fdbk" unit="%" disabled={!sd.enabled} />
            <Knob value={sd.crossFeed} min={0} max={100} onChange={(v) => onChange({ stereoDelay: { ...sd, crossFeed: v } })} label="Cross" unit="%" disabled={!sd.enabled} />
            <Knob value={sd.mix} min={0} max={100} onChange={(v) => onChange({ stereoDelay: { ...sd, mix: v } })} label="Mix" unit="%" disabled={!sd.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function RoomSimulatorUI({ settings, onChange }: EffectProps) {
  const rs = settings.roomSimulator;
  const [expanded, setExpanded] = useState(rs?.enabled ?? false);
  if (!rs) return null;

  const sizes = [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }, { value: 'hall', label: 'Hall' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Room Simulator" icon={Home} enabled={rs.enabled} onToggle={() => onChange({ roomSimulator: { ...rs, enabled: !rs.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="blue" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {sizes.map((s) => <button key={s.value} onClick={() => onChange({ roomSimulator: { ...rs, size: s.value as typeof rs.size } })} disabled={!rs.enabled} className={cn('flex-1 px-2 py-1 text-[10px] font-medium rounded', rs.size === s.value ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !rs.enabled && 'opacity-50')}>{s.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={rs.decay} min={0.1} max={5} onChange={(v) => onChange({ roomSimulator: { ...rs, decay: v } })} label="Decay" unit=" s" disabled={!rs.enabled} />
            <Knob value={rs.damping} min={0} max={100} onChange={(v) => onChange({ roomSimulator: { ...rs, damping: v } })} label="Damp" unit="%" disabled={!rs.enabled} />
            <Knob value={rs.earlyLevel} min={0} max={100} onChange={(v) => onChange({ roomSimulator: { ...rs, earlyLevel: v } })} label="Early" unit="%" disabled={!rs.enabled} />
            <Knob value={rs.lateLevel} min={0} max={100} onChange={(v) => onChange({ roomSimulator: { ...rs, lateLevel: v } })} label="Late" unit="%" disabled={!rs.enabled} />
            <Knob value={rs.mix} min={0} max={100} onChange={(v) => onChange({ roomSimulator: { ...rs, mix: v } })} label="Mix" unit="%" disabled={!rs.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

function ShimmerReverbUI({ settings, onChange }: EffectProps) {
  const sr = settings.shimmerReverb;
  const [expanded, setExpanded] = useState(sr?.enabled ?? false);
  if (!sr) return null;

  const pitches = [{ value: 0, label: 'Uni' }, { value: 5, label: '4th' }, { value: 7, label: '5th' }, { value: 12, label: 'Oct' }, { value: 19, label: '12th' }, { value: 24, label: '2Oct' }];

  return (
    <div className="border-b border-white/5">
      <EffectHeader name="Shimmer Reverb" icon={Cloudy} enabled={sr.enabled} onToggle={() => onChange({ shimmerReverb: { ...sr, enabled: !sr.enabled } })} expanded={expanded} onExpandToggle={() => setExpanded(!expanded)} color="indigo" />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {pitches.map((p) => <button key={p.value} onClick={() => onChange({ shimmerReverb: { ...sr, pitch: p.value } })} disabled={!sr.enabled} className={cn('flex-1 px-1.5 py-1 text-[9px] font-medium rounded', sr.pitch === p.value ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10', !sr.enabled && 'opacity-50')}>{p.label}</button>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob value={sr.decay} min={0.5} max={10} onChange={(v) => onChange({ shimmerReverb: { ...sr, decay: v } })} label="Decay" unit=" s" disabled={!sr.enabled} />
            <Knob value={sr.shimmer} min={0} max={100} onChange={(v) => onChange({ shimmerReverb: { ...sr, shimmer: v } })} label="Shimmer" unit="%" disabled={!sr.enabled} />
            <Knob value={sr.damping} min={0} max={100} onChange={(v) => onChange({ shimmerReverb: { ...sr, damping: v } })} label="Damp" unit="%" disabled={!sr.enabled} />
            <Knob value={sr.tone} min={0} max={100} onChange={(v) => onChange({ shimmerReverb: { ...sr, tone: v } })} label="Tone" unit="%" disabled={!sr.enabled} />
            <Knob value={sr.mix} min={0} max={100} onChange={(v) => onChange({ shimmerReverb: { ...sr, mix: v } })} label="Mix" unit="%" disabled={!sr.enabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN EFFECTS RACK COMPONENT
// ============================================================================

interface EffectsRackProps {
  track: UserTrack;
  onClose?: () => void;
}

type EffectCategory = 'all' | 'standard' | 'guitar' | 'modulation' | 'dynamics' | 'amp' | 'vocal' | 'creative' | 'spatial';

export function EffectsRack({ track, onClose }: EffectsRackProps) {
  const { loadPreset, updateTrackEffects, loadGuitarPreset } = useUserTracksStore();
  const [showPresets, setShowPresets] = useState(false);
  const [category, setCategory] = useState<EffectCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [presetCategory, setPresetCategory] = useState<'standard' | 'guitar'>('standard');

  // Get the extended effects chain (35 effects total)
  const effectsSettings: ExtendedEffectsChain = { ...DEFAULT_FULL_EFFECTS, ...track.audioSettings.effects } as ExtendedEffectsChain;

  const handleEffectChange = (settings: Partial<ExtendedEffectsChain>) => {
    updateTrackEffects(track.id, settings);
  };

  const handleReset = () => {
    loadPreset(track.id, 'clean');
  };

  // All effects with metadata for search/filter
  const allEffects = useMemo(() => [
    // Standard effects
    { id: 'noiseGate', name: 'Noise Gate', category: 'dynamics', type: 'standard', keywords: ['gate', 'noise', 'reduction', 'threshold'] },
    { id: 'eq', name: 'Equalizer', category: 'standard', type: 'standard', keywords: ['eq', 'equalizer', 'frequency', 'bass', 'treble', 'mid'] },
    { id: 'compressor', name: 'Compressor', category: 'dynamics', type: 'standard', keywords: ['compressor', 'dynamics', 'threshold', 'ratio'] },
    { id: 'reverb', name: 'Reverb', category: 'modulation', type: 'standard', keywords: ['reverb', 'room', 'hall', 'ambient', 'space'] },
    { id: 'limiter', name: 'Limiter', category: 'dynamics', type: 'standard', keywords: ['limiter', 'ceiling', 'dynamics'] },
    // Guitar effects
    { id: 'wah', name: 'Wah', category: 'guitar', type: 'guitar', keywords: ['wah', 'filter', 'envelope', 'funk'] },
    { id: 'overdrive', name: 'Overdrive', category: 'amp', type: 'guitar', keywords: ['overdrive', 'tube', 'drive', 'saturation', 'warm'] },
    { id: 'distortion', name: 'Distortion', category: 'amp', type: 'guitar', keywords: ['distortion', 'fuzz', 'gain', 'metal', 'rock'] },
    { id: 'ampSimulator', name: 'Amp Simulator', category: 'amp', type: 'guitar', keywords: ['amp', 'amplifier', 'marshall', 'fender', 'mesa', 'cabinet'] },
    { id: 'cabinet', name: 'Cabinet', category: 'amp', type: 'guitar', keywords: ['cabinet', 'speaker', 'ir', 'impulse', 'mic'] },
    { id: 'chorus', name: 'Chorus', category: 'modulation', type: 'guitar', keywords: ['chorus', 'modulation', 'thick', 'wide'] },
    { id: 'flanger', name: 'Flanger', category: 'modulation', type: 'guitar', keywords: ['flanger', 'jet', 'sweep', 'modulation'] },
    { id: 'phaser', name: 'Phaser', category: 'modulation', type: 'guitar', keywords: ['phaser', 'phase', 'sweep', 'modulation'] },
    { id: 'delay', name: 'Delay', category: 'modulation', type: 'guitar', keywords: ['delay', 'echo', 'repeat', 'tempo', 'ping pong'] },
    { id: 'tremolo', name: 'Tremolo', category: 'modulation', type: 'guitar', keywords: ['tremolo', 'vibrato', 'amplitude', 'modulation'] },
    // Vocal effects
    { id: 'pitchCorrection', name: 'Pitch Correction', category: 'vocal', type: 'vocal', keywords: ['autotune', 'pitch', 'correction', 'tune', 'vocal', 'key', 'scale'] },
    { id: 'vocalDoubler', name: 'Vocal Doubler', category: 'vocal', type: 'vocal', keywords: ['doubler', 'double', 'thick', 'wide', 'vocal', 'stereo'] },
    { id: 'deEsser', name: 'De-Esser', category: 'vocal', type: 'vocal', keywords: ['de-esser', 'sibilance', 's', 'ess', 'vocal', 'harsh'] },
    { id: 'formantShifter', name: 'Formant Shifter', category: 'vocal', type: 'vocal', keywords: ['formant', 'gender', 'voice', 'character', 'vocal'] },
    { id: 'harmonizer', name: 'Harmonizer', category: 'vocal', type: 'vocal', keywords: ['harmony', 'harmonizer', 'third', 'fifth', 'octave', 'vocal', 'key'] },
    // Creative effects
    { id: 'bitcrusher', name: 'Bitcrusher', category: 'creative', type: 'creative', keywords: ['bitcrusher', 'lofi', 'retro', '8bit', 'distortion', 'digital'] },
    { id: 'ringModulator', name: 'Ring Modulator', category: 'creative', type: 'creative', keywords: ['ring', 'modulator', 'metallic', 'robot', 'bell'] },
    { id: 'frequencyShifter', name: 'Freq Shifter', category: 'creative', type: 'creative', keywords: ['frequency', 'shifter', 'bode', 'detuned', 'weird'] },
    { id: 'granularDelay', name: 'Granular Delay', category: 'creative', type: 'creative', keywords: ['granular', 'grain', 'texture', 'glitch', 'ambient', 'freeze'] },
    // Extended modulation
    { id: 'rotarySpeaker', name: 'Rotary Speaker', category: 'modulation', type: 'modulation', keywords: ['rotary', 'leslie', 'organ', 'spinning', 'doppler'] },
    { id: 'autoPan', name: 'Auto-Pan', category: 'modulation', type: 'modulation', keywords: ['pan', 'panner', 'stereo', 'auto', 'tremolo'] },
    { id: 'multiFilter', name: 'Multi Filter', category: 'modulation', type: 'modulation', keywords: ['filter', 'resonant', 'lowpass', 'highpass', 'bandpass', 'lfo'] },
    { id: 'vibrato', name: 'Vibrato', category: 'modulation', type: 'modulation', keywords: ['vibrato', 'pitch', 'wobble', 'modulation'] },
    // Dynamics/Utility
    { id: 'transientShaper', name: 'Transient Shaper', category: 'dynamics', type: 'dynamics', keywords: ['transient', 'attack', 'punch', 'snap', 'sustain'] },
    { id: 'stereoImager', name: 'Stereo Imager', category: 'dynamics', type: 'dynamics', keywords: ['stereo', 'width', 'mid', 'side', 'mono', 'imager'] },
    { id: 'exciter', name: 'Exciter', category: 'dynamics', type: 'dynamics', keywords: ['exciter', 'enhance', 'harmonic', 'bright', 'air', 'sparkle'] },
    { id: 'multibandCompressor', name: 'Multiband Comp', category: 'dynamics', type: 'dynamics', keywords: ['multiband', 'compressor', 'dynamics', 'mastering', 'crossover'] },
    // Spatial effects
    { id: 'stereoDelay', name: 'Stereo Delay', category: 'spatial', type: 'spatial', keywords: ['stereo', 'delay', 'ping pong', 'echo', 'wide'] },
    { id: 'roomSimulator', name: 'Room Simulator', category: 'spatial', type: 'spatial', keywords: ['room', 'space', 'early', 'reflections', 'ambient'] },
    { id: 'shimmerReverb', name: 'Shimmer Reverb', category: 'spatial', type: 'spatial', keywords: ['shimmer', 'reverb', 'ethereal', 'pitch', 'ambient', 'pad'] },
  ], []);

  // Filter effects based on category and search
  const filteredEffects = useMemo(() => {
    return allEffects.filter((effect) => {
      // Category filter
      if (category !== 'all') {
        if (category === 'standard' && effect.type !== 'standard') return false;
        if (category === 'guitar' && effect.type !== 'guitar') return false;
        if (category === 'modulation' && effect.category !== 'modulation') return false;
        if (category === 'dynamics' && effect.category !== 'dynamics') return false;
        if (category === 'amp' && effect.category !== 'amp') return false;
        if (category === 'vocal' && effect.category !== 'vocal') return false;
        if (category === 'creative' && effect.category !== 'creative') return false;
        if (category === 'spatial' && effect.category !== 'spatial') return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = effect.name.toLowerCase().includes(query);
        const matchesKeywords = effect.keywords.some((k) => k.includes(query));
        if (!matchesName && !matchesKeywords) return false;
      }

      return true;
    });
  }, [allEffects, category, searchQuery]);

  const renderEffect = (effectId: string) => {
    switch (effectId) {
      // Standard effects
      case 'noiseGate': return <NoiseGateUI key={effectId} track={track} />;
      case 'eq': return <EQUI key={effectId} track={track} />;
      case 'compressor': return <CompressorUI key={effectId} track={track} />;
      case 'reverb': return <ReverbUI key={effectId} track={track} />;
      case 'limiter': return <LimiterUI key={effectId} track={track} />;
      // Guitar effects
      case 'wah': return <WahUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'overdrive': return <OverdriveUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'distortion': return <DistortionUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'ampSimulator': return <AmpSimulatorUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'cabinet': return <CabinetUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'chorus': return <ChorusUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'flanger': return <FlangerUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'phaser': return <PhaserUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'delay': return <DelayUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'tremolo': return <TremoloUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      // Vocal effects
      case 'pitchCorrection': return <PitchCorrectionUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'vocalDoubler': return <VocalDoublerUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'deEsser': return <DeEsserUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'formantShifter': return <FormantShifterUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'harmonizer': return <HarmonizerUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      // Creative effects
      case 'bitcrusher': return <BitcrusherUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'ringModulator': return <RingModulatorUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'frequencyShifter': return <FrequencyShifterUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'granularDelay': return <GranularDelayUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      // Extended modulation
      case 'rotarySpeaker': return <RotarySpeakerUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'autoPan': return <AutoPanUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'multiFilter': return <MultiFilterUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'vibrato': return <VibratoUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      // Dynamics/Utility
      case 'transientShaper': return <TransientShaperUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'stereoImager': return <StereoImagerUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'exciter': return <ExciterUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'multibandCompressor': return <MultibandCompressorUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      // Spatial effects
      case 'stereoDelay': return <StereoDelayUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'roomSimulator': return <RoomSimulatorUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      case 'shimmerReverb': return <ShimmerReverbUI key={effectId} settings={effectsSettings} onChange={handleEffectChange} />;
      default: return null;
    }
  };

  const categories: { id: EffectCategory; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'All', icon: Sliders },
    { id: 'vocal', label: 'Vocal', icon: Mic2 },
    { id: 'guitar', label: 'Guitar', icon: Guitar },
    { id: 'amp', label: 'Amp/Gain', icon: Volume2 },
    { id: 'modulation', label: 'Modulation', icon: Waves },
    { id: 'dynamics', label: 'Dynamics', icon: Zap },
    { id: 'creative', label: 'Creative', icon: Palette },
    { id: 'spatial', label: 'Spatial', icon: Move3D },
    { id: 'standard', label: 'Standard', icon: SlidersHorizontal },
  ];

  // Count enabled effects
  const enabledCount = useMemo(() => {
    let count = 0;
    // Standard effects
    if (effectsSettings.noiseGate?.enabled) count++;
    if (effectsSettings.eq?.enabled) count++;
    if (effectsSettings.compressor?.enabled) count++;
    if (effectsSettings.reverb?.enabled) count++;
    if (effectsSettings.limiter?.enabled) count++;
    // Guitar effects
    if (effectsSettings.wah?.enabled) count++;
    if (effectsSettings.overdrive?.enabled) count++;
    if (effectsSettings.distortion?.enabled) count++;
    if (effectsSettings.ampSimulator?.enabled) count++;
    if (effectsSettings.cabinet?.enabled) count++;
    if (effectsSettings.chorus?.enabled) count++;
    if (effectsSettings.flanger?.enabled) count++;
    if (effectsSettings.phaser?.enabled) count++;
    if (effectsSettings.delay?.enabled) count++;
    if (effectsSettings.tremolo?.enabled) count++;
    // Vocal effects
    if (effectsSettings.pitchCorrection?.enabled) count++;
    if (effectsSettings.vocalDoubler?.enabled) count++;
    if (effectsSettings.deEsser?.enabled) count++;
    if (effectsSettings.formantShifter?.enabled) count++;
    if (effectsSettings.harmonizer?.enabled) count++;
    // Creative effects
    if (effectsSettings.bitcrusher?.enabled) count++;
    if (effectsSettings.ringModulator?.enabled) count++;
    if (effectsSettings.frequencyShifter?.enabled) count++;
    if (effectsSettings.granularDelay?.enabled) count++;
    // Extended modulation
    if (effectsSettings.rotarySpeaker?.enabled) count++;
    if (effectsSettings.autoPan?.enabled) count++;
    if (effectsSettings.multiFilter?.enabled) count++;
    if (effectsSettings.vibrato?.enabled) count++;
    // Dynamics/Utility
    if (effectsSettings.transientShaper?.enabled) count++;
    if (effectsSettings.stereoImager?.enabled) count++;
    if (effectsSettings.exciter?.enabled) count++;
    if (effectsSettings.multibandCompressor?.enabled) count++;
    // Spatial effects
    if (effectsSettings.stereoDelay?.enabled) count++;
    if (effectsSettings.roomSimulator?.enabled) count++;
    if (effectsSettings.shimmerReverb?.enabled) count++;
    return count;
  }, [effectsSettings]);

  return (
    <div className="w-96 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-orange-500/10">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Effects Rack</span>
          {enabledCount > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-indigo-500/20 text-indigo-400 rounded-full">
              {enabledCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowPresets(!showPresets)} className={cn('px-2 py-1 text-[10px] font-medium rounded transition-colors', showPresets ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white')}>Presets</button>
          <button onClick={handleReset} className="p-1.5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors" title="Reset all effects"><RotateCcw className="w-3.5 h-3.5" /></button>
          {onClose && <button onClick={onClose} className="p-1.5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {/* Presets Panel */}
      {showPresets && (
        <div className="p-3 border-b border-white/5 bg-white/[0.02] space-y-2">
          <div className="flex gap-1">
            <button onClick={() => setPresetCategory('standard')} className={cn('flex-1 px-2 py-1.5 text-[10px] font-medium rounded flex items-center justify-center gap-1', presetCategory === 'standard' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10')}><Mic2 className="w-3 h-3" /> Standard</button>
            <button onClick={() => setPresetCategory('guitar')} className={cn('flex-1 px-2 py-1.5 text-[10px] font-medium rounded flex items-center justify-center gap-1', presetCategory === 'guitar' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10')}><Guitar className="w-3 h-3" /> Guitar</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
            {presetCategory === 'standard' ? (
              EFFECT_PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => { loadPreset(track.id, preset.id); setShowPresets(false); }} className={cn('px-2 py-1.5 text-[10px] font-medium rounded transition-colors text-left', track.audioSettings.activePreset === preset.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{preset.name}</button>
              ))
            ) : (
              GUITAR_PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => { loadGuitarPreset(track.id, preset.id); setShowPresets(false); }} className={cn('px-2 py-1.5 text-[10px] font-medium rounded transition-colors text-left', (track.audioSettings as any).guitarPreset === preset.id ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{preset.name}</button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search effects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-3 py-2 border-b border-white/5 overflow-x-auto">
        <div className="flex gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                'px-2 py-1 text-[10px] font-medium rounded flex items-center gap-1 whitespace-nowrap transition-colors',
                category === cat.id
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-white/5 text-zinc-500 hover:bg-white/10'
              )}
            >
              <cat.icon className="w-3 h-3" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Effects List */}
      <div className="max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-2">
        {filteredEffects.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs">
            No effects match your search
          </div>
        ) : (
          filteredEffects.map((effect) => renderEffect(effect.id))
        )}
      </div>

      {/* Signal Flow Indicator */}
      <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5">
        <div className="text-[9px] text-zinc-600 mb-1">Signal Flow:</div>
        <div className="flex flex-wrap items-center gap-1 text-[9px] text-zinc-600">
          <span className={effectsSettings.wah.enabled ? 'text-purple-400' : ''}>Wah</span>
          <span>→</span>
          <span className={effectsSettings.overdrive.enabled ? 'text-yellow-400' : ''}>OD</span>
          <span>→</span>
          <span className={effectsSettings.distortion.enabled ? 'text-red-400' : ''}>Dist</span>
          <span>→</span>
          <span className={effectsSettings.ampSimulator.enabled ? 'text-orange-400' : ''}>Amp</span>
          <span>→</span>
          <span className={effectsSettings.cabinet.enabled ? 'text-amber-400' : ''}>Cab</span>
          <span>→</span>
          <span className={effectsSettings.noiseGate.enabled ? 'text-emerald-400' : ''}>Gate</span>
          <span>→</span>
          <span className={effectsSettings.eq.enabled ? 'text-cyan-400' : ''}>EQ</span>
          <span>→</span>
          <span className={effectsSettings.compressor.enabled ? 'text-amber-400' : ''}>Comp</span>
          <span>→</span>
          <span className={effectsSettings.chorus.enabled || effectsSettings.flanger.enabled || effectsSettings.phaser.enabled ? 'text-indigo-400' : ''}>Mod</span>
          <span>→</span>
          <span className={effectsSettings.delay.enabled ? 'text-cyan-400' : ''}>Dly</span>
          <span>→</span>
          <span className={effectsSettings.tremolo.enabled ? 'text-amber-400' : ''}>Trem</span>
          <span>→</span>
          <span className={effectsSettings.reverb.enabled ? 'text-indigo-400' : ''}>Verb</span>
          <span>→</span>
          <span className={effectsSettings.limiter.enabled ? 'text-rose-400' : ''}>Limit</span>
        </div>
      </div>
    </div>
  );
}
