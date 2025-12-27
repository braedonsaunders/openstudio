'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { EFFECT_PRESETS } from '@/lib/audio/effects/presets';
import { GUITAR_PRESETS } from '@/lib/audio/effects/guitar';
import { DEFAULT_GUITAR_EFFECTS } from '@/lib/audio/effects/guitar/guitar-effects-processor';
import type { UserTrack, GuitarEffectsChain } from '@/types';
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

interface GuitarEffectProps {
  settings: GuitarEffectsChain;
  onChange: (settings: Partial<GuitarEffectsChain>) => void;
}

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
// MAIN EFFECTS RACK COMPONENT
// ============================================================================

interface EffectsRackProps {
  track: UserTrack;
  onClose?: () => void;
}

type EffectCategory = 'all' | 'standard' | 'guitar' | 'modulation' | 'dynamics' | 'amp';

export function EffectsRack({ track, onClose }: EffectsRackProps) {
  const { loadPreset, updateTrackEffects, updateGuitarEffects, loadGuitarPreset } = useUserTracksStore();
  const [showPresets, setShowPresets] = useState(false);
  const [category, setCategory] = useState<EffectCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [presetCategory, setPresetCategory] = useState<'standard' | 'guitar'>('standard');

  // Initialize guitar effects if not present
  const guitarSettings: GuitarEffectsChain = (track.audioSettings as any).guitarEffects || DEFAULT_GUITAR_EFFECTS;

  const handleGuitarChange = (settings: Partial<GuitarEffectsChain>) => {
    if (updateGuitarEffects) {
      updateGuitarEffects(track.id, settings);
    }
  };

  const handleReset = () => {
    loadPreset(track.id, 'clean');
  };

  // All effects with metadata for search/filter
  const allEffects = useMemo(() => [
    { id: 'noiseGate', name: 'Noise Gate', category: 'dynamics', type: 'standard', keywords: ['gate', 'noise', 'reduction', 'threshold'] },
    { id: 'eq', name: 'Equalizer', category: 'standard', type: 'standard', keywords: ['eq', 'equalizer', 'frequency', 'bass', 'treble', 'mid'] },
    { id: 'compressor', name: 'Compressor', category: 'dynamics', type: 'standard', keywords: ['compressor', 'dynamics', 'threshold', 'ratio'] },
    { id: 'reverb', name: 'Reverb', category: 'modulation', type: 'standard', keywords: ['reverb', 'room', 'hall', 'ambient', 'space'] },
    { id: 'limiter', name: 'Limiter', category: 'dynamics', type: 'standard', keywords: ['limiter', 'ceiling', 'dynamics'] },
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
      case 'noiseGate': return <NoiseGateUI key={effectId} track={track} />;
      case 'eq': return <EQUI key={effectId} track={track} />;
      case 'compressor': return <CompressorUI key={effectId} track={track} />;
      case 'reverb': return <ReverbUI key={effectId} track={track} />;
      case 'limiter': return <LimiterUI key={effectId} track={track} />;
      case 'wah': return <WahUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'overdrive': return <OverdriveUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'distortion': return <DistortionUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'ampSimulator': return <AmpSimulatorUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'cabinet': return <CabinetUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'chorus': return <ChorusUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'flanger': return <FlangerUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'phaser': return <PhaserUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'delay': return <DelayUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      case 'tremolo': return <TremoloUI key={effectId} settings={guitarSettings} onChange={handleGuitarChange} />;
      default: return null;
    }
  };

  const categories: { id: EffectCategory; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'All', icon: Sliders },
    { id: 'standard', label: 'Standard', icon: Mic2 },
    { id: 'guitar', label: 'Guitar', icon: Guitar },
    { id: 'amp', label: 'Amp/Gain', icon: Volume2 },
    { id: 'modulation', label: 'Modulation', icon: Waves },
    { id: 'dynamics', label: 'Dynamics', icon: Zap },
  ];

  // Count enabled effects
  const enabledCount = useMemo(() => {
    let count = 0;
    if (track.audioSettings.effects?.noiseGate.enabled) count++;
    if (track.audioSettings.effects?.eq.enabled) count++;
    if (track.audioSettings.effects?.compressor.enabled) count++;
    if (track.audioSettings.effects?.reverb.enabled) count++;
    if (track.audioSettings.effects?.limiter.enabled) count++;
    if (guitarSettings.wah.enabled) count++;
    if (guitarSettings.overdrive.enabled) count++;
    if (guitarSettings.distortion.enabled) count++;
    if (guitarSettings.ampSimulator.enabled) count++;
    if (guitarSettings.cabinet.enabled) count++;
    if (guitarSettings.chorus.enabled) count++;
    if (guitarSettings.flanger.enabled) count++;
    if (guitarSettings.phaser.enabled) count++;
    if (guitarSettings.delay.enabled) count++;
    if (guitarSettings.tremolo.enabled) count++;
    return count;
  }, [track.audioSettings.effects, guitarSettings]);

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
          <span className={guitarSettings.wah.enabled ? 'text-purple-400' : ''}>Wah</span>
          <span>→</span>
          <span className={guitarSettings.overdrive.enabled ? 'text-yellow-400' : ''}>OD</span>
          <span>→</span>
          <span className={guitarSettings.distortion.enabled ? 'text-red-400' : ''}>Dist</span>
          <span>→</span>
          <span className={guitarSettings.ampSimulator.enabled ? 'text-orange-400' : ''}>Amp</span>
          <span>→</span>
          <span className={guitarSettings.cabinet.enabled ? 'text-amber-400' : ''}>Cab</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.noiseGate.enabled ? 'text-emerald-400' : ''}>Gate</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.eq.enabled ? 'text-cyan-400' : ''}>EQ</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.compressor.enabled ? 'text-amber-400' : ''}>Comp</span>
          <span>→</span>
          <span className={guitarSettings.chorus.enabled || guitarSettings.flanger.enabled || guitarSettings.phaser.enabled ? 'text-indigo-400' : ''}>Mod</span>
          <span>→</span>
          <span className={guitarSettings.delay.enabled ? 'text-cyan-400' : ''}>Dly</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.reverb.enabled ? 'text-indigo-400' : ''}>Verb</span>
          <span>→</span>
          <span className={guitarSettings.tremolo.enabled ? 'text-amber-400' : ''}>Trem</span>
          <span>→</span>
          <span className={track.audioSettings.effects?.limiter.enabled ? 'text-rose-400' : ''}>Limit</span>
        </div>
      </div>
    </div>
  );
}
