'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { GUITAR_PRESETS, getPresetsByCategory } from '@/lib/audio/effects/guitar';
import type {
  GuitarEffectsChain,
  GuitarEffectPreset,
  OverdriveSettings,
  DistortionSettings,
  AmpSimulatorSettings,
  CabinetSimulatorSettings,
  DelaySettings,
  ChorusSettings,
  FlangerSettings,
  PhaserSettings,
  WahSettings,
  TremoloSettings,
} from '@/types';
import {
  Guitar,
  ChevronDown,
  ChevronRight,
  Power,
  RotateCcw,
  Zap,
  Waves,
  Speaker,
  Clock,
  Sparkles,
  Wind,
  Radio,
  Filter,
  Volume2,
  X,
} from 'lucide-react';

// Reusable Knob component
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
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-orange-400 rounded-full" />
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
            className="text-orange-500/30"
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

// Effect Header component
function EffectHeader({
  name,
  icon: Icon,
  enabled,
  onToggle,
  expanded,
  onExpandToggle,
  color = 'orange',
}: {
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpandToggle: () => void;
  color?: 'orange' | 'amber' | 'red' | 'yellow' | 'emerald' | 'cyan' | 'indigo' | 'purple';
}) {
  const colorClasses = {
    orange: 'text-orange-400 bg-orange-500/20',
    amber: 'text-amber-400 bg-amber-500/20',
    red: 'text-red-400 bg-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/20',
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
        <div className={cn('p-1.5 rounded', enabled ? colorClasses[color] : 'text-zinc-600 bg-white/5')}>
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

// Wah Effect UI
function WahUI({
  settings,
  onChange,
}: {
  settings: WahSettings;
  onChange: (settings: Partial<WahSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const modes = [
    { value: 'manual', label: 'Manual' },
    { value: 'auto', label: 'Auto' },
    { value: 'envelope', label: 'Envelope' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Wah"
        icon={Filter}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="purple"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {modes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onChange({ mode: mode.value as WahSettings['mode'] })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.mode === mode.value
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10',
                  !settings.enabled && 'opacity-50'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {settings.mode === 'manual' && (
              <Knob
                value={settings.frequency * 100}
                min={0}
                max={100}
                onChange={(v) => onChange({ frequency: v / 100 })}
                label="Position"
                unit="%"
                disabled={!settings.enabled}
              />
            )}
            {settings.mode === 'auto' && (
              <Knob
                value={settings.rate}
                min={0.1}
                max={10}
                onChange={(v) => onChange({ rate: v })}
                label="Rate"
                unit=" Hz"
                disabled={!settings.enabled}
              />
            )}
            {settings.mode === 'envelope' && (
              <Knob
                value={settings.sensitivity * 100}
                min={0}
                max={100}
                onChange={(v) => onChange({ sensitivity: v / 100 })}
                label="Sens"
                unit="%"
                disabled={!settings.enabled}
              />
            )}
            <Knob
              value={settings.depth * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ depth: v / 100 })}
              label="Depth"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.q}
              min={1}
              max={20}
              onChange={(v) => onChange({ q: v })}
              label="Q"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Overdrive Effect UI
function OverdriveUI({
  settings,
  onChange,
}: {
  settings: OverdriveSettings;
  onChange: (settings: Partial<OverdriveSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Overdrive"
        icon={Zap}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="yellow"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.drive * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ drive: v / 100 })}
              label="Drive"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.tone * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ tone: v / 100 })}
              label="Tone"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.level * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ level: v / 100 })}
              label="Level"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Distortion Effect UI
function DistortionUI({
  settings,
  onChange,
}: {
  settings: DistortionSettings;
  onChange: (settings: Partial<DistortionSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const types = [
    { value: 'classic', label: 'Classic' },
    { value: 'hard', label: 'Hard' },
    { value: 'fuzz', label: 'Fuzz' },
    { value: 'rectifier', label: 'Rect' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Distortion"
        icon={Zap}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="red"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {types.map((type) => (
              <button
                key={type.value}
                onClick={() => onChange({ type: type.value as DistortionSettings['type'] })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.type === type.value
                    ? 'bg-red-500/20 text-red-400'
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
              value={settings.amount * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ amount: v / 100 })}
              label="Gain"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.tone * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ tone: v / 100 })}
              label="Tone"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.level * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ level: v / 100 })}
              label="Level"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Amp Simulator UI
function AmpSimulatorUI({
  settings,
  onChange,
}: {
  settings: AmpSimulatorSettings;
  onChange: (settings: Partial<AmpSimulatorSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const types = [
    { value: 'clean', label: 'Clean' },
    { value: 'crunch', label: 'Crunch' },
    { value: 'british', label: 'British' },
    { value: 'american', label: 'American' },
    { value: 'highgain', label: 'Hi-Gain' },
    { value: 'modern', label: 'Modern' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Amp"
        icon={Volume2}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="orange"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex flex-wrap gap-1">
            {types.map((type) => (
              <button
                key={type.value}
                onClick={() => onChange({ type: type.value as AmpSimulatorSettings['type'] })}
                disabled={!settings.enabled}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.type === type.value
                    ? 'bg-orange-500/20 text-orange-400'
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
              value={settings.gain * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ gain: v / 100 })}
              label="Gain"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.bass * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ bass: v / 100 })}
              label="Bass"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.mid * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ mid: v / 100 })}
              label="Mid"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.treble * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ treble: v / 100 })}
              label="Treble"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.presence * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ presence: v / 100 })}
              label="Pres"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.master * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ master: v / 100 })}
              label="Master"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Cabinet Simulator UI
function CabinetUI({
  settings,
  onChange,
}: {
  settings: CabinetSimulatorSettings;
  onChange: (settings: Partial<CabinetSimulatorSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const cabTypes = [
    { value: '1x12', label: '1x12' },
    { value: '2x12', label: '2x12' },
    { value: '4x12', label: '4x12' },
    { value: '1x15', label: '1x15' },
    { value: '2x10', label: '2x10' },
  ];

  const micPositions = [
    { value: 'center', label: 'Center' },
    { value: 'edge', label: 'Edge' },
    { value: 'room', label: 'Room' },
    { value: 'blend', label: 'Blend' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Cabinet"
        icon={Speaker}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="amber"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {cabTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => onChange({ type: type.value as CabinetSimulatorSettings['type'] })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.type === type.value
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10',
                  !settings.enabled && 'opacity-50'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {micPositions.map((pos) => (
              <button
                key={pos.value}
                onClick={() => onChange({ micPosition: pos.value as CabinetSimulatorSettings['micPosition'] })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.micPosition === pos.value
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10',
                  !settings.enabled && 'opacity-50'
                )}
              >
                {pos.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ mix: v / 100 })}
              label="Mix"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.roomLevel * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ roomLevel: v / 100 })}
              label="Room"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Delay Effect UI
function DelayUI({
  settings,
  onChange,
}: {
  settings: DelaySettings;
  onChange: (settings: Partial<DelaySettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const types = [
    { value: 'digital', label: 'Digital' },
    { value: 'analog', label: 'Analog' },
    { value: 'tape', label: 'Tape' },
    { value: 'pingpong', label: 'Ping Pong' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Delay"
        icon={Clock}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="cyan"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {types.map((type) => (
              <button
                key={type.value}
                onClick={() => onChange({ type: type.value as DelaySettings['type'] })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.type === type.value
                    ? 'bg-cyan-500/20 text-cyan-400'
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
              value={settings.time * 1000}
              min={10}
              max={2000}
              onChange={(v) => onChange({ time: v / 1000 })}
              label="Time"
              unit=" ms"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.feedback * 100}
              min={0}
              max={95}
              onChange={(v) => onChange({ feedback: v / 100 })}
              label="Fdbk"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ mix: v / 100 })}
              label="Mix"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.tone * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ tone: v / 100 })}
              label="Tone"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Chorus Effect UI
function ChorusUI({
  settings,
  onChange,
}: {
  settings: ChorusSettings;
  onChange: (settings: Partial<ChorusSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Chorus"
        icon={Waves}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="indigo"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.rate}
              min={0.1}
              max={10}
              onChange={(v) => onChange({ rate: v })}
              label="Rate"
              unit=" Hz"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.depth * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ depth: v / 100 })}
              label="Depth"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ mix: v / 100 })}
              label="Mix"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Flanger Effect UI
function FlangerUI({
  settings,
  onChange,
}: {
  settings: FlangerSettings;
  onChange: (settings: Partial<FlangerSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Flanger"
        icon={Wind}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="emerald"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.rate}
              min={0.05}
              max={5}
              onChange={(v) => onChange({ rate: v })}
              label="Rate"
              unit=" Hz"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.depth * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ depth: v / 100 })}
              label="Depth"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.feedback * 100}
              min={0}
              max={95}
              onChange={(v) => onChange({ feedback: v / 100 })}
              label="Fdbk"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ mix: v / 100 })}
              label="Mix"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Phaser Effect UI
function PhaserUI({
  settings,
  onChange,
}: {
  settings: PhaserSettings;
  onChange: (settings: Partial<PhaserSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Phaser"
        icon={Radio}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="purple"
      />
      {expanded && (
        <div className="pb-3 px-2">
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.rate}
              min={0.1}
              max={8}
              onChange={(v) => onChange({ rate: v })}
              label="Rate"
              unit=" Hz"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.depth * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ depth: v / 100 })}
              label="Depth"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.feedback * 100}
              min={0}
              max={95}
              onChange={(v) => onChange({ feedback: v / 100 })}
              label="Fdbk"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ mix: v / 100 })}
              label="Mix"
              unit="%"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Tremolo Effect UI
function TremoloUI({
  settings,
  onChange,
}: {
  settings: TremoloSettings;
  onChange: (settings: Partial<TremoloSettings>) => void;
}) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const waveforms = [
    { value: 'sine', label: 'Sine' },
    { value: 'triangle', label: 'Tri' },
    { value: 'square', label: 'Sqr' },
  ];

  return (
    <div className="border-b border-white/5">
      <EffectHeader
        name="Tremolo"
        icon={Sparkles}
        enabled={settings.enabled}
        onToggle={() => onChange({ enabled: !settings.enabled })}
        expanded={expanded}
        onExpandToggle={() => setExpanded(!expanded)}
        color="amber"
      />
      {expanded && (
        <div className="pb-3 px-2 space-y-3">
          <div className="flex gap-1">
            {waveforms.map((wf) => (
              <button
                key={wf.value}
                onClick={() => onChange({ waveform: wf.value as TremoloSettings['waveform'] })}
                disabled={!settings.enabled}
                className={cn(
                  'flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors',
                  settings.waveform === wf.value
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10',
                  !settings.enabled && 'opacity-50'
                )}
              >
                {wf.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Knob
              value={settings.rate}
              min={0.1}
              max={20}
              onChange={(v) => onChange({ rate: v })}
              label="Rate"
              unit=" Hz"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.depth * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ depth: v / 100 })}
              label="Depth"
              unit="%"
              disabled={!settings.enabled}
            />
            <Knob
              value={settings.spread}
              min={0}
              max={180}
              onChange={(v) => onChange({ spread: v })}
              label="Stereo"
              unit="°"
              disabled={!settings.enabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Main Guitar Effects Rack Component
interface GuitarEffectsRackProps {
  settings: GuitarEffectsChain;
  onChange: (settings: Partial<GuitarEffectsChain>) => void;
  onPresetSelect?: (preset: GuitarEffectPreset) => void;
  onReset?: () => void;
  onClose?: () => void;
  activePresetId?: string;
}

export function GuitarEffectsRack({
  settings,
  onChange,
  onPresetSelect,
  onReset,
  onClose,
  activePresetId,
}: GuitarEffectsRackProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: 'clean', label: 'Clean' },
    { id: 'crunch', label: 'Crunch' },
    { id: 'high-gain', label: 'High Gain' },
    { id: 'metal', label: 'Metal' },
    { id: 'blues', label: 'Blues' },
    { id: 'ambient', label: 'Ambient' },
    { id: 'classic-rock', label: 'Classic' },
    { id: 'modern-rock', label: 'Modern' },
  ];

  const filteredPresets = selectedCategory
    ? getPresetsByCategory(selectedCategory as GuitarEffectPreset['category'])
    : GUITAR_PRESETS;

  const activePreset = GUITAR_PRESETS.find((p) => p.id === activePresetId);

  return (
    <div className="w-96 bg-white dark:bg-[#16161f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-red-500/10">
        <div className="flex items-center gap-2">
          <Guitar className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Guitar Effects</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className={cn(
              'px-2 py-1 text-[10px] font-medium rounded transition-colors',
              showPresets ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white'
            )}
          >
            Presets
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="p-1.5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors"
              title="Reset all effects"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Presets Panel */}
      {showPresets && (
        <div className="p-3 border-b border-white/5 bg-white/[0.02] space-y-2">
          {/* Category filters */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'px-2 py-1 text-[9px] font-medium rounded transition-colors',
                !selectedCategory
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-white/5 text-zinc-500 hover:bg-white/10'
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-2 py-1 text-[9px] font-medium rounded transition-colors',
                  selectedCategory === cat.id
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {/* Preset grid */}
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onPresetSelect?.(preset);
                  setShowPresets(false);
                }}
                className={cn(
                  'px-2 py-1.5 text-[10px] font-medium rounded transition-colors text-left',
                  activePresetId === preset.id
                    ? 'bg-orange-500/20 text-orange-400'
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
      {activePreset && (
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20">
          <span className="text-[10px] text-orange-400">
            Preset: {activePreset.name}
          </span>
        </div>
      )}

      {/* Effects Chain */}
      <div className="max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <WahUI
          settings={settings.wah}
          onChange={(wah) => onChange({ wah: { ...settings.wah, ...wah } })}
        />
        <OverdriveUI
          settings={settings.overdrive}
          onChange={(overdrive) => onChange({ overdrive: { ...settings.overdrive, ...overdrive } })}
        />
        <DistortionUI
          settings={settings.distortion}
          onChange={(distortion) => onChange({ distortion: { ...settings.distortion, ...distortion } })}
        />
        <AmpSimulatorUI
          settings={settings.ampSimulator}
          onChange={(ampSimulator) => onChange({ ampSimulator: { ...settings.ampSimulator, ...ampSimulator } })}
        />
        <CabinetUI
          settings={settings.cabinet}
          onChange={(cabinet) => onChange({ cabinet: { ...settings.cabinet, ...cabinet } })}
        />
        <ChorusUI
          settings={settings.chorus}
          onChange={(chorus) => onChange({ chorus: { ...settings.chorus, ...chorus } })}
        />
        <FlangerUI
          settings={settings.flanger}
          onChange={(flanger) => onChange({ flanger: { ...settings.flanger, ...flanger } })}
        />
        <PhaserUI
          settings={settings.phaser}
          onChange={(phaser) => onChange({ phaser: { ...settings.phaser, ...phaser } })}
        />
        <DelayUI
          settings={settings.delay}
          onChange={(delay) => onChange({ delay: { ...settings.delay, ...delay } })}
        />
        <TremoloUI
          settings={settings.tremolo}
          onChange={(tremolo) => onChange({ tremolo: { ...settings.tremolo, ...tremolo } })}
        />
      </div>

      {/* Signal Flow Indicator */}
      <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5">
        <div className="flex flex-wrap items-center gap-1 text-[9px] text-zinc-600">
          <span>Signal:</span>
          <span className={settings.wah.enabled ? 'text-purple-400' : ''}>Wah</span>
          <span>→</span>
          <span className={settings.overdrive.enabled ? 'text-yellow-400' : ''}>OD</span>
          <span>→</span>
          <span className={settings.distortion.enabled ? 'text-red-400' : ''}>Dist</span>
          <span>→</span>
          <span className={settings.ampSimulator.enabled ? 'text-orange-400' : ''}>Amp</span>
          <span>→</span>
          <span className={settings.cabinet.enabled ? 'text-amber-400' : ''}>Cab</span>
          <span>→</span>
          <span className={settings.chorus.enabled ? 'text-indigo-400' : ''}>Chor</span>
          <span>→</span>
          <span className={settings.flanger.enabled ? 'text-emerald-400' : ''}>Flng</span>
          <span>→</span>
          <span className={settings.phaser.enabled ? 'text-purple-400' : ''}>Phas</span>
          <span>→</span>
          <span className={settings.delay.enabled ? 'text-cyan-400' : ''}>Dly</span>
          <span>→</span>
          <span className={settings.tremolo.enabled ? 'text-amber-400' : ''}>Trem</span>
        </div>
      </div>
    </div>
  );
}
