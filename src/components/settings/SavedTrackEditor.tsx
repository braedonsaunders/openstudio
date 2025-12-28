'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InstrumentIcon, InstrumentSelector } from '@/components/ui/instrument-icon';
import { INSTRUMENTS, type SavedTrackPreset, type InstrumentCategory } from '@/types/user';
import { useSavedTracksStore } from '@/stores/saved-tracks-store';
import { EFFECT_PRESETS } from '@/lib/audio/effects/presets';
import { GUITAR_PRESETS } from '@/lib/audio/effects/guitar';
import { DEFAULT_UNIFIED_EFFECTS } from '@/lib/audio/effects/unified-effects-processor';
import type { UnifiedEffectsChain } from '@/types';
import {
  Mic,
  Music,
  Sliders,
  Volume2,
  Headphones,
  Settings2,
  Sparkles,
  ChevronDown,
  Power,
  RotateCcw,
  Waves,
  BarChart3,
  Wind,
  Shield,
  Play,
  Square,
  Guitar,
  Speaker,
  Radio,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type EditorTab = 'basic' | 'input' | 'effects' | 'preview';

type EffectCategory = 'guitar' | 'mixing' | 'modulation' | 'time' | 'output';

interface SavedTrackEditorProps {
  preset?: SavedTrackPreset;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (preset: SavedTrackPreset) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

const SAMPLE_RATES = [
  { value: 48000, label: '48 kHz' },
  { value: 44100, label: '44.1 kHz' },
];

const BUFFER_SIZES = [
  { value: 32, label: '32 (ultra low)' },
  { value: 64, label: '64 (very low)' },
  { value: 128, label: '128 (low latency)' },
  { value: 256, label: '256' },
  { value: 512, label: '512' },
  { value: 1024, label: '1024 (stable)' },
];

const EFFECT_CATEGORIES: { id: EffectCategory; label: string; icon: typeof Sparkles }[] = [
  { id: 'guitar', label: 'Guitar', icon: Guitar },
  { id: 'mixing', label: 'Mixing', icon: Sliders },
  { id: 'modulation', label: 'Modulation', icon: Waves },
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'output', label: 'Output', icon: Speaker },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function Knob({
  value,
  min,
  max,
  onChange,
  label,
  unit = '',
  size = 'sm',
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

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = (startY - e.clientY) * ((max - min) / 100);
      const newValue = Math.max(min, Math.min(max, startValue + delta));
      onChange(newValue);
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY, startValue, min, max, onChange]);

  const sizeClasses = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          sizeClasses,
          'rounded-full bg-gray-200 dark:bg-gray-700 relative cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute inset-1 rounded-full bg-gray-100 dark:bg-gray-800"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-indigo-500 rounded-full" />
        </div>
      </div>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center">{label}</span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500">
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </span>
    </div>
  );
}

function EffectToggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
        enabled
          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
      )}
    >
      <Power className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function SliderControl({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit = '',
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
        <span className="text-xs text-gray-400">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
      />
    </div>
  );
}

// ============================================================================
// EFFECT PANELS
// ============================================================================

function NoiseGatePanel({
  settings,
  onChange,
}: {
  settings: UnifiedEffectsChain['noiseGate'];
  onChange: (settings: UnifiedEffectsChain['noiseGate']) => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Noise Gate</span>
        </div>
        <EffectToggle
          enabled={settings.enabled}
          onChange={(enabled) => onChange({ ...settings, enabled })}
          label={settings.enabled ? 'On' : 'Off'}
        />
      </div>
      {settings.enabled && (
        <div className="grid grid-cols-2 gap-4">
          <SliderControl
            label="Threshold"
            value={settings.threshold}
            min={-80}
            max={0}
            onChange={(threshold) => onChange({ ...settings, threshold })}
            unit=" dB"
          />
          <SliderControl
            label="Attack"
            value={settings.attack}
            min={0.1}
            max={50}
            step={0.1}
            onChange={(attack) => onChange({ ...settings, attack })}
            unit=" ms"
          />
          <SliderControl
            label="Hold"
            value={settings.hold}
            min={0}
            max={500}
            onChange={(hold) => onChange({ ...settings, hold })}
            unit=" ms"
          />
          <SliderControl
            label="Release"
            value={settings.release}
            min={5}
            max={500}
            onChange={(release) => onChange({ ...settings, release })}
            unit=" ms"
          />
        </div>
      )}
    </div>
  );
}

function EQPanel({
  settings,
  onChange,
}: {
  settings: UnifiedEffectsChain['eq'];
  onChange: (settings: UnifiedEffectsChain['eq']) => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Equalizer</span>
        </div>
        <EffectToggle
          enabled={settings.enabled}
          onChange={(enabled) => onChange({ ...settings, enabled })}
          label={settings.enabled ? 'On' : 'Off'}
        />
      </div>
      {settings.enabled && (
        <div className="space-y-3">
          {settings.bands.map((band, index) => (
            <div key={index} className="flex items-center gap-4">
              <span className="text-xs text-gray-500 w-16">{band.frequency} Hz</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={band.gain}
                onChange={(e) => {
                  const newBands = [...settings.bands];
                  newBands[index] = { ...band, gain: parseFloat(e.target.value) };
                  onChange({ ...settings, bands: newBands });
                }}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-12">
                {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)} dB
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompressorPanel({
  settings,
  onChange,
}: {
  settings: UnifiedEffectsChain['compressor'];
  onChange: (settings: UnifiedEffectsChain['compressor']) => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Compressor</span>
        </div>
        <EffectToggle
          enabled={settings.enabled}
          onChange={(enabled) => onChange({ ...settings, enabled })}
          label={settings.enabled ? 'On' : 'Off'}
        />
      </div>
      {settings.enabled && (
        <div className="grid grid-cols-2 gap-4">
          <SliderControl
            label="Threshold"
            value={settings.threshold}
            min={-60}
            max={0}
            onChange={(threshold) => onChange({ ...settings, threshold })}
            unit=" dB"
          />
          <SliderControl
            label="Ratio"
            value={settings.ratio}
            min={1}
            max={20}
            step={0.5}
            onChange={(ratio) => onChange({ ...settings, ratio })}
            unit=":1"
          />
          <SliderControl
            label="Attack"
            value={settings.attack}
            min={0}
            max={100}
            onChange={(attack) => onChange({ ...settings, attack })}
            unit=" ms"
          />
          <SliderControl
            label="Release"
            value={settings.release}
            min={10}
            max={1000}
            onChange={(release) => onChange({ ...settings, release })}
            unit=" ms"
          />
          <SliderControl
            label="Knee"
            value={settings.knee}
            min={0}
            max={40}
            onChange={(knee) => onChange({ ...settings, knee })}
            unit=" dB"
          />
          <SliderControl
            label="Makeup Gain"
            value={settings.makeupGain}
            min={0}
            max={24}
            step={0.5}
            onChange={(makeupGain) => onChange({ ...settings, makeupGain })}
            unit=" dB"
          />
        </div>
      )}
    </div>
  );
}

function ReverbPanel({
  settings,
  onChange,
}: {
  settings: UnifiedEffectsChain['reverb'];
  onChange: (settings: UnifiedEffectsChain['reverb']) => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Reverb</span>
        </div>
        <EffectToggle
          enabled={settings.enabled}
          onChange={(enabled) => onChange({ ...settings, enabled })}
          label={settings.enabled ? 'On' : 'Off'}
        />
      </div>
      {settings.enabled && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Type</label>
            <select
              value={settings.type}
              onChange={(e) => onChange({ ...settings, type: e.target.value as typeof settings.type })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            >
              <option value="room">Room</option>
              <option value="hall">Hall</option>
              <option value="plate">Plate</option>
              <option value="spring">Spring</option>
              <option value="chamber">Chamber</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SliderControl
              label="Mix"
              value={settings.mix * 100}
              min={0}
              max={100}
              onChange={(mix) => onChange({ ...settings, mix: mix / 100 })}
              unit="%"
            />
            <SliderControl
              label="Decay"
              value={settings.decay}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(decay) => onChange({ ...settings, decay })}
              unit=" s"
            />
            <SliderControl
              label="Pre-Delay"
              value={settings.preDelay}
              min={0}
              max={100}
              onChange={(preDelay) => onChange({ ...settings, preDelay })}
              unit=" ms"
            />
            <SliderControl
              label="High Cut"
              value={settings.highCut}
              min={1000}
              max={20000}
              step={100}
              onChange={(highCut) => onChange({ ...settings, highCut })}
              unit=" Hz"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LimiterPanel({
  settings,
  onChange,
}: {
  settings: UnifiedEffectsChain['limiter'];
  onChange: (settings: UnifiedEffectsChain['limiter']) => void;
}) {
  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">Limiter</span>
        </div>
        <EffectToggle
          enabled={settings.enabled}
          onChange={(enabled) => onChange({ ...settings, enabled })}
          label={settings.enabled ? 'On' : 'Off'}
        />
      </div>
      {settings.enabled && (
        <div className="grid grid-cols-2 gap-4">
          <SliderControl
            label="Threshold"
            value={settings.threshold}
            min={-24}
            max={0}
            step={0.5}
            onChange={(threshold) => onChange({ ...settings, threshold })}
            unit=" dB"
          />
          <SliderControl
            label="Release"
            value={settings.release}
            min={10}
            max={500}
            onChange={(release) => onChange({ ...settings, release })}
            unit=" ms"
          />
          <SliderControl
            label="Ceiling"
            value={settings.ceiling}
            min={-6}
            max={0}
            step={0.1}
            onChange={(ceiling) => onChange({ ...settings, ceiling })}
            unit=" dB"
          />
        </div>
      )}
    </div>
  );
}

function GuitarEffectsPanel({
  effects,
  onChange,
}: {
  effects: UnifiedEffectsChain;
  onChange: (effects: UnifiedEffectsChain) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Overdrive */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Overdrive</span>
          </div>
          <EffectToggle
            enabled={effects.overdrive.enabled}
            onChange={(enabled) => onChange({ ...effects, overdrive: { ...effects.overdrive, enabled } })}
            label={effects.overdrive.enabled ? 'On' : 'Off'}
          />
        </div>
        {effects.overdrive.enabled && (
          <div className="grid grid-cols-3 gap-4">
            <SliderControl
              label="Drive"
              value={effects.overdrive.drive}
              min={0}
              max={100}
              onChange={(drive) => onChange({ ...effects, overdrive: { ...effects.overdrive, drive } })}
              unit="%"
            />
            <SliderControl
              label="Tone"
              value={effects.overdrive.tone}
              min={0}
              max={100}
              onChange={(tone) => onChange({ ...effects, overdrive: { ...effects.overdrive, tone } })}
              unit="%"
            />
            <SliderControl
              label="Level"
              value={effects.overdrive.level}
              min={0}
              max={100}
              onChange={(level) => onChange({ ...effects, overdrive: { ...effects.overdrive, level } })}
              unit="%"
            />
          </div>
        )}
      </div>

      {/* Distortion */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Distortion</span>
          </div>
          <EffectToggle
            enabled={effects.distortion.enabled}
            onChange={(enabled) => onChange({ ...effects, distortion: { ...effects.distortion, enabled } })}
            label={effects.distortion.enabled ? 'On' : 'Off'}
          />
        </div>
        {effects.distortion.enabled && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Type</label>
              <select
                value={effects.distortion.type}
                onChange={(e) => onChange({ ...effects, distortion: { ...effects.distortion, type: e.target.value as 'classic' | 'hard' | 'fuzz' | 'asymmetric' | 'rectifier' } })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value="classic">Classic</option>
                <option value="hard">Hard Clip</option>
                <option value="fuzz">Fuzz</option>
                <option value="asymmetric">Asymmetric</option>
                <option value="rectifier">Rectifier</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <SliderControl
                label="Amount"
                value={(effects.distortion.amount ?? 0) * 100}
                min={0}
                max={100}
                onChange={(amount) => onChange({ ...effects, distortion: { ...effects.distortion, amount: amount / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Tone"
                value={(effects.distortion.tone ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(tone) => onChange({ ...effects, distortion: { ...effects.distortion, tone: tone / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Level"
                value={(effects.distortion.level ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(level) => onChange({ ...effects, distortion: { ...effects.distortion, level: level / 100 } })}
                unit="%"
              />
            </div>
          </div>
        )}
      </div>

      {/* Amp Simulator */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Speaker className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Amp Simulator</span>
          </div>
          <EffectToggle
            enabled={effects.ampSimulator.enabled}
            onChange={(enabled) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, enabled } })}
            label={effects.ampSimulator.enabled ? 'On' : 'Off'}
          />
        </div>
        {effects.ampSimulator.enabled && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Amp Type</label>
              <select
                value={effects.ampSimulator.type}
                onChange={(e) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, type: e.target.value as 'clean' | 'crunch' | 'highgain' | 'british' | 'american' | 'modern' } })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
              >
                <option value="clean">Clean</option>
                <option value="crunch">Crunch</option>
                <option value="highgain">High Gain</option>
                <option value="british">British</option>
                <option value="american">American</option>
                <option value="modern">Modern</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SliderControl
                label="Gain"
                value={(effects.ampSimulator.gain ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(gain) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, gain: gain / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Bass"
                value={(effects.ampSimulator.bass ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(bass) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, bass: bass / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Mid"
                value={(effects.ampSimulator.mid ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(mid) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, mid: mid / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Treble"
                value={(effects.ampSimulator.treble ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(treble) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, treble: treble / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Presence"
                value={(effects.ampSimulator.presence ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(presence) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, presence: presence / 100 } })}
                unit="%"
              />
              <SliderControl
                label="Master"
                value={(effects.ampSimulator.master ?? 0.5) * 100}
                min={0}
                max={100}
                onChange={(master) => onChange({ ...effects, ampSimulator: { ...effects.ampSimulator, master: master / 100 } })}
                unit="%"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModulationEffectsPanel({
  effects,
  onChange,
}: {
  effects: UnifiedEffectsChain;
  onChange: (effects: UnifiedEffectsChain) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Chorus */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Chorus</span>
          </div>
          <EffectToggle
            enabled={effects.chorus.enabled}
            onChange={(enabled) => onChange({ ...effects, chorus: { ...effects.chorus, enabled } })}
            label={effects.chorus.enabled ? 'On' : 'Off'}
          />
        </div>
        {effects.chorus.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <SliderControl
              label="Rate"
              value={effects.chorus.rate}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(rate) => onChange({ ...effects, chorus: { ...effects.chorus, rate } })}
              unit=" Hz"
            />
            <SliderControl
              label="Depth"
              value={effects.chorus.depth * 100}
              min={0}
              max={100}
              onChange={(depth) => onChange({ ...effects, chorus: { ...effects.chorus, depth: depth / 100 } })}
              unit="%"
            />
            <SliderControl
              label="Delay"
              value={effects.chorus.delay}
              min={1}
              max={30}
              onChange={(delay) => onChange({ ...effects, chorus: { ...effects.chorus, delay } })}
              unit=" ms"
            />
            <SliderControl
              label="Mix"
              value={effects.chorus.mix * 100}
              min={0}
              max={100}
              onChange={(mix) => onChange({ ...effects, chorus: { ...effects.chorus, mix: mix / 100 } })}
              unit="%"
            />
          </div>
        )}
      </div>

      {/* Delay */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Delay</span>
          </div>
          <EffectToggle
            enabled={effects.delay.enabled}
            onChange={(enabled) => onChange({ ...effects, delay: { ...effects.delay, enabled } })}
            label={effects.delay.enabled ? 'On' : 'Off'}
          />
        </div>
        {effects.delay.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <SliderControl
              label="Time"
              value={effects.delay.time}
              min={10}
              max={2000}
              onChange={(time) => onChange({ ...effects, delay: { ...effects.delay, time } })}
              unit=" ms"
            />
            <SliderControl
              label="Feedback"
              value={effects.delay.feedback * 100}
              min={0}
              max={95}
              onChange={(feedback) => onChange({ ...effects, delay: { ...effects.delay, feedback: feedback / 100 } })}
              unit="%"
            />
            <SliderControl
              label="Mix"
              value={effects.delay.mix * 100}
              min={0}
              max={100}
              onChange={(mix) => onChange({ ...effects, delay: { ...effects.delay, mix: mix / 100 } })}
              unit="%"
            />
            <SliderControl
              label="Tone"
              value={(effects.delay.tone ?? 0.5) * 100}
              min={0}
              max={100}
              onChange={(tone) => onChange({ ...effects, delay: { ...effects.delay, tone: tone / 100 } })}
              unit="%"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SavedTrackEditor({
  preset,
  userId,
  isOpen,
  onClose,
  onSave,
}: SavedTrackEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('basic');
  const [effectCategory, setEffectCategory] = useState<EffectCategory>('mixing');

  // Basic settings
  const [name, setName] = useState(preset?.name || '');
  const [description, setDescription] = useState(preset?.description || '');
  const [instrumentId, setInstrumentId] = useState(preset?.instrumentId || 'other');
  const [color, setColor] = useState(preset?.color || '#6366f1');
  const [trackType, setTrackType] = useState<'audio' | 'midi'>(preset?.type || 'audio');

  // Volume settings
  const [volume, setVolume] = useState(preset?.volume ?? 1);
  const [isMuted, setIsMuted] = useState(preset?.isMuted ?? false);

  // Input settings
  const [inputMode, setInputMode] = useState<'microphone' | 'application'>(
    preset?.audioSettings?.inputMode || 'microphone'
  );
  const [inputDeviceId, setInputDeviceId] = useState(preset?.audioSettings?.inputDeviceId || 'default');
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [sampleRate, setSampleRate] = useState(preset?.audioSettings?.sampleRate || 48000);
  const [bufferSize, setBufferSize] = useState(preset?.audioSettings?.bufferSize || 256);
  const [inputGain, setInputGain] = useState(preset?.audioSettings?.inputGain || 0);
  const [noiseSuppression, setNoiseSuppression] = useState(preset?.audioSettings?.noiseSuppression ?? false);
  const [echoCancellation, setEchoCancellation] = useState(preset?.audioSettings?.echoCancellation ?? false);
  const [autoGainControl, setAutoGainControl] = useState(preset?.audioSettings?.autoGainControl ?? false);
  const [channelCount, setChannelCount] = useState(preset?.audioSettings?.channelConfig?.channelCount || 2);
  const [leftChannel, setLeftChannel] = useState(preset?.audioSettings?.channelConfig?.leftChannel ?? 0);
  const [rightChannel, setRightChannel] = useState(preset?.audioSettings?.channelConfig?.rightChannel ?? 1);
  const [deviceChannelCount, setDeviceChannelCount] = useState(
    preset?.audioSettings?.channelConfig?.deviceChannelCount ?? 2
  ); // Number of channels available on the selected device
  const [directMonitoring, setDirectMonitoring] = useState(preset?.audioSettings?.directMonitoring ?? true);
  const [monitoringVolume, setMonitoringVolume] = useState(preset?.audioSettings?.monitoringVolume ?? 1);

  // Effects
  const [effects, setEffects] = useState<UnifiedEffectsChain>(() => {
    if (preset?.effects && Object.keys(preset.effects).length > 0) {
      return preset.effects as unknown as UnifiedEffectsChain;
    }
    return DEFAULT_UNIFIED_EFFECTS;
  });
  const [activeEffectPreset, setActiveEffectPreset] = useState(preset?.activeEffectPreset || '');

  // Preview state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const { savePreset, updatePreset } = useSavedTracksStore();

  // Load available audio input devices
  useEffect(() => {
    if (!isOpen) return;

    const loadDevices = async () => {
      try {
        // Request permission first (needed to get device labels)
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          stream.getTracks().forEach(t => t.stop());
        }).catch(() => {
          // Permission denied, but we can still try to enumerate
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setInputDevices(audioInputs);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    };

    loadDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, [isOpen]);

  // Detect channel count of selected device
  useEffect(() => {
    if (!isOpen || inputMode !== 'microphone' || inputDeviceId === 'default') {
      setDeviceChannelCount(2); // Default to stereo
      return;
    }

    const detectChannels = async () => {
      try {
        // Try to get the device's capabilities
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: inputDeviceId },
            // Request maximum channels to detect device capabilities
          },
        });

        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();
        const channelCount = settings.channelCount || 2;

        // Many professional interfaces report higher channel counts
        // Common values: 2 (stereo), 4, 8, 16, 18, 24
        setDeviceChannelCount(Math.max(2, channelCount));

        // Clean up
        stream.getTracks().forEach(t => t.stop());
      } catch (err) {
        console.warn('Failed to detect device channels:', err);
        setDeviceChannelCount(2);
      }
    };

    detectChannels();
  }, [isOpen, inputDeviceId, inputMode]);

  // Reset state when preset changes
  useEffect(() => {
    if (isOpen) {
      setName(preset?.name || '');
      setDescription(preset?.description || '');
      setInstrumentId(preset?.instrumentId || 'other');
      setColor(preset?.color || '#6366f1');
      setTrackType(preset?.type || 'audio');
      setVolume(preset?.volume ?? 1);
      setIsMuted(preset?.isMuted ?? false);
      setInputMode(preset?.audioSettings?.inputMode || 'microphone');
      setInputDeviceId(preset?.audioSettings?.inputDeviceId || 'default');
      setSampleRate(preset?.audioSettings?.sampleRate || 48000);
      setBufferSize(preset?.audioSettings?.bufferSize || 256);
      setInputGain(preset?.audioSettings?.inputGain || 0);
      setNoiseSuppression(preset?.audioSettings?.noiseSuppression ?? false);
      setEchoCancellation(preset?.audioSettings?.echoCancellation ?? false);
      setAutoGainControl(preset?.audioSettings?.autoGainControl ?? false);
      setChannelCount(preset?.audioSettings?.channelConfig?.channelCount || 2);
      setLeftChannel(preset?.audioSettings?.channelConfig?.leftChannel ?? 0);
      setRightChannel(preset?.audioSettings?.channelConfig?.rightChannel ?? 1);
      setDeviceChannelCount(preset?.audioSettings?.channelConfig?.deviceChannelCount ?? 2);
      setDirectMonitoring(preset?.audioSettings?.directMonitoring ?? true);
      setMonitoringVolume(preset?.audioSettings?.monitoringVolume ?? 1);
      setActiveEffectPreset(preset?.activeEffectPreset || '');
      if (preset?.effects && Object.keys(preset.effects).length > 0) {
        setEffects(preset.effects as unknown as UnifiedEffectsChain);
      } else {
        setEffects(DEFAULT_UNIFIED_EFFECTS);
      }
    }
  }, [preset, isOpen]);

  // Cleanup on close
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      audioContextRef.current = null;
      setIsPreviewing(false);
      setInputLevel(0);
      return;
    }

    try {
      // Request more channels than needed to allow channel selection
      const requestedChannels = channelCount === 1
        ? Math.max(2, leftChannel + 1)
        : Math.max(2, Math.max(leftChannel, rightChannel) + 1);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined,
          sampleRate,
          channelCount: requestedChannels,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;

      // IMPORTANT: Resume the audio context (browser autoplay policy)
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);

      // Apply input gain
      const inputGainNode = audioContext.createGain();
      inputGainNode.gain.value = Math.pow(10, inputGain / 20); // Convert dB to linear

      // Create analyser for level metering
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;

      // Handle mono channel selection
      let processedSource: AudioNode = source;
      if (channelCount === 1 && leftChannel > 0) {
        const actualChannels = stream.getAudioTracks()[0]?.getSettings().channelCount || 2;
        if (leftChannel < actualChannels) {
          const splitter = audioContext.createChannelSplitter(actualChannels);
          const merger = audioContext.createChannelMerger(1);
          source.connect(splitter);
          splitter.connect(merger, leftChannel, 0);
          processedSource = merger;
        }
      }

      // Connect: source -> gain -> analyser
      processedSource.connect(inputGainNode);
      inputGainNode.connect(analyser);

      // Connect to output for monitoring
      if (directMonitoring) {
        const monitorGainNode = audioContext.createGain();
        monitorGainNode.gain.value = monitoringVolume;
        analyser.connect(monitorGainNode);
        monitorGainNode.connect(audioContext.destination);
      }

      // Use time domain data for accurate level metering (RMS)
      const dataArray = new Float32Array(analyser.fftSize);

      const updateLevel = () => {
        if (!audioContextRef.current) return;

        analyser.getFloatTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square) for accurate level
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Convert to dB and normalize (0 = -60dB, 1 = 0dB)
        const db = 20 * Math.log10(Math.max(rms, 0.000001));
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));

        setInputLevel(normalized);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();

      setIsPreviewing(true);
    } catch (err) {
      console.error('Failed to start preview:', err);
    }
  }, [isPreviewing, inputDeviceId, sampleRate, channelCount, leftChannel, rightChannel, echoCancellation, noiseSuppression, autoGainControl, directMonitoring, monitoringVolume, inputGain]);

  const handleApplyEffectPreset = (presetName: string) => {
    const effectPreset = EFFECT_PRESETS.find(p => p.name === presetName);
    if (effectPreset) {
      setEffects(prev => ({
        ...prev,
        noiseGate: effectPreset.effects.noiseGate || prev.noiseGate,
        eq: effectPreset.effects.eq || prev.eq,
        compressor: effectPreset.effects.compressor || prev.compressor,
        reverb: effectPreset.effects.reverb || prev.reverb,
        limiter: effectPreset.effects.limiter || prev.limiter,
      }));
      setActiveEffectPreset(presetName);
    }
  };

  const handleApplyGuitarPreset = (presetId: string) => {
    const guitarPreset = GUITAR_PRESETS.find(p => p.id === presetId);
    if (guitarPreset) {
      setEffects(prev => ({
        ...prev,
        ...guitarPreset.effects,
      }));
      setActiveEffectPreset(guitarPreset.name);
    }
  };

  const handleResetEffects = () => {
    setEffects(DEFAULT_UNIFIED_EFFECTS);
    setActiveEffectPreset('');
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const presetData = {
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        type: trackType,
        instrumentId,
        color,
        volume,
        isMuted,
        isSolo: false,
        audioSettings: trackType === 'audio' ? {
          inputMode,
          inputDeviceId,
          sampleRate,
          bufferSize,
          noiseSuppression,
          echoCancellation,
          autoGainControl,
          channelConfig: {
            channelCount,
            leftChannel,
            rightChannel,
            deviceChannelCount, // Remember the device's channel count for UI
          },
          inputGain,
          directMonitoring,
          monitoringVolume,
        } : undefined,
        effects: effects as unknown as Record<string, unknown>,
        activeEffectPreset: activeEffectPreset || undefined,
        isDefault: false,
      };

      if (preset) {
        await updatePreset(preset.id, presetData);
      } else {
        const newPreset = await savePreset(presetData);
        onSave?.(newPreset);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: EditorTab; label: string; icon: typeof Sliders }[] = [
    { id: 'basic', label: 'Basic', icon: Music },
    { id: 'input', label: 'Input', icon: Mic },
    { id: 'effects', label: 'Effects', icon: Sparkles },
    { id: 'preview', label: 'Preview', icon: Headphones },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={preset ? 'Edit Track Preset' : 'Create Track Preset'}
    >
      <div className="flex flex-col h-[70vh] max-h-[700px]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <Input
                label="Preset Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Guitar Setup"
              />

              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this track preset..."
                  className="w-full h-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={200}
                />
              </div>

              {/* Track Type */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Track Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTrackType('audio')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                      trackType === 'audio'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Mic className="w-4 h-4" />
                    <span className="text-sm font-medium">Audio</span>
                  </button>
                  <button
                    onClick={() => setTrackType('midi')}
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-lg border transition-all',
                      trackType === 'midi'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <Music className="w-4 h-4" />
                    <span className="text-sm font-medium">MIDI</span>
                  </button>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Track Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900' : ''
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div>
                <SliderControl
                  label="Volume"
                  value={Math.round(volume * 100)}
                  min={0}
                  max={100}
                  onChange={(v) => setVolume(v / 100)}
                  unit="%"
                />
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={isMuted}
                    onChange={(e) => setIsMuted(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Start muted</span>
                </label>
              </div>

              {/* Instrument */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-3">Instrument Type</label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <InstrumentSelector value={instrumentId} onChange={setInstrumentId} />
                </div>
              </div>
            </div>
          )}

          {/* Input Tab */}
          {activeTab === 'input' && trackType === 'audio' && (
            <div className="space-y-6">
              {/* Source Type */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Source Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setInputMode('microphone')}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border transition-all',
                      inputMode === 'microphone'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    )}
                  >
                    <Mic className={cn('w-4 h-4', inputMode === 'microphone' ? 'text-indigo-400' : 'text-gray-500')} />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Direct Input</div>
                      <div className="text-xs text-gray-500">Mic / Interface</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setInputMode('application')}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border transition-all',
                      inputMode === 'application'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    )}
                  >
                    <Settings2 className={cn('w-4 h-4', inputMode === 'application' ? 'text-indigo-400' : 'text-gray-500')} />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Application</div>
                      <div className="text-xs text-gray-500">System audio</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Input Device Selection (only for Direct Input) */}
              {inputMode === 'microphone' && (
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Input Device</label>
                  <select
                    value={inputDeviceId}
                    onChange={(e) => setInputDeviceId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  >
                    <option value="default">System Default</option>
                    {inputDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Input ${device.deviceId.slice(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                  {inputDevices.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">
                      No devices found. Grant microphone permission to see available devices.
                    </p>
                  )}
                </div>
              )}

              {/* Channel Config */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Channel Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setChannelCount(1);
                      // Reset to first channel when switching to mono
                      setRightChannel(leftChannel);
                    }}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium transition-all',
                      channelCount === 1
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    Mono
                  </button>
                  <button
                    onClick={() => {
                      setChannelCount(2);
                      // Set stereo pair when switching to stereo
                      setRightChannel(leftChannel + 1);
                    }}
                    className={cn(
                      'p-2 rounded-lg border text-sm font-medium transition-all',
                      channelCount === 2
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    Stereo
                  </button>
                </div>
              </div>

              {/* Channel Selection */}
              {inputMode === 'microphone' && (
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {channelCount === 1 ? 'Input Channel' : 'Input Channels'}
                  </label>
                  {channelCount === 1 ? (
                    // Mono: Single channel selector
                    <select
                      value={leftChannel}
                      onChange={(e) => {
                        const ch = parseInt(e.target.value);
                        setLeftChannel(ch);
                        setRightChannel(ch); // Same channel for mono
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                    >
                      {Array.from({ length: Math.max(deviceChannelCount, 8) }, (_, i) => (
                        <option key={i} value={i}>
                          Channel {i + 1}
                        </option>
                      ))}
                    </select>
                  ) : (
                    // Stereo: Channel pair selector
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Left Channel</label>
                        <select
                          value={leftChannel}
                          onChange={(e) => setLeftChannel(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                        >
                          {Array.from({ length: Math.max(deviceChannelCount, 8) }, (_, i) => (
                            <option key={i} value={i}>
                              Channel {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Right Channel</label>
                        <select
                          value={rightChannel}
                          onChange={(e) => setRightChannel(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                        >
                          {Array.from({ length: Math.max(deviceChannelCount, 8) }, (_, i) => (
                            <option key={i} value={i}>
                              Channel {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  {/* Quick stereo pair presets */}
                  {channelCount === 2 && deviceChannelCount > 2 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-gray-500 mr-1">Quick pairs:</span>
                      {Array.from({ length: Math.floor(Math.max(deviceChannelCount, 8) / 2) }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setLeftChannel(i * 2);
                            setRightChannel(i * 2 + 1);
                          }}
                          className={cn(
                            'px-2 py-0.5 text-xs rounded transition-colors',
                            leftChannel === i * 2 && rightChannel === i * 2 + 1
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          )}
                        >
                          {i * 2 + 1}/{i * 2 + 2}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {deviceChannelCount > 2
                        ? `Device reports ${deviceChannelCount} channels`
                        : 'Standard stereo device detected'}
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">Override:</label>
                      <select
                        value={deviceChannelCount}
                        onChange={(e) => setDeviceChannelCount(parseInt(e.target.value))}
                        className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                      >
                        <option value={2}>2 ch</option>
                        <option value={4}>4 ch</option>
                        <option value={8}>8 ch</option>
                        <option value={16}>16 ch</option>
                        <option value={18}>18 ch</option>
                        <option value={24}>24 ch</option>
                        <option value={32}>32 ch</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Rate & Buffer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Sample Rate</label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(parseInt(e.target.value) as 48000 | 44100)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  >
                    {SAMPLE_RATES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Buffer Size</label>
                  <select
                    value={bufferSize}
                    onChange={(e) => setBufferSize(parseInt(e.target.value) as 32 | 64 | 128 | 256 | 512 | 1024)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                  >
                    {BUFFER_SIZES.map(b => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Input Gain */}
              <SliderControl
                label="Input Gain"
                value={inputGain}
                min={-24}
                max={24}
                step={0.5}
                onChange={setInputGain}
                unit=" dB"
              />

              {/* Processing Options */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Browser Processing</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEchoCancellation(!echoCancellation)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      echoCancellation
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    Echo Cancel
                  </button>
                  <button
                    onClick={() => setNoiseSuppression(!noiseSuppression)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      noiseSuppression
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    Noise Suppress
                  </button>
                  <button
                    onClick={() => setAutoGainControl(!autoGainControl)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      autoGainControl
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    Auto Gain
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Disable all for audio interfaces & instruments</p>
              </div>

              {/* Direct Monitoring */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-500 dark:text-gray-400">Direct Monitoring</label>
                  <button
                    onClick={() => setDirectMonitoring(!directMonitoring)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded transition-colors',
                      directMonitoring
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {directMonitoring ? 'On' : 'Off'}
                  </button>
                </div>
                {directMonitoring && (
                  <SliderControl
                    label="Monitoring Volume"
                    value={Math.round(monitoringVolume * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => setMonitoringVolume(v / 100)}
                    unit="%"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'input' && trackType === 'midi' && (
            <div className="flex items-center justify-center h-48 text-gray-500">
              <div className="text-center">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>MIDI input settings will be configured when you join a room</p>
              </div>
            </div>
          )}

          {/* Effects Tab */}
          {activeTab === 'effects' && (
            <div className="space-y-4">
              {/* Effect Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Presets:</span>
                <select
                  value={activeEffectPreset}
                  onChange={(e) => handleApplyEffectPreset(e.target.value)}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                >
                  <option value="">Vocal Presets</option>
                  {EFFECT_PRESETS.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <select
                  onChange={(e) => handleApplyGuitarPreset(e.target.value)}
                  className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
                >
                  <option value="">Guitar Presets</option>
                  {GUITAR_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleResetEffects}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              {/* Effect Category Tabs */}
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                {EFFECT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setEffectCategory(cat.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      effectCategory === cat.id
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Effect Panels by Category */}
              {effectCategory === 'guitar' && (
                <GuitarEffectsPanel effects={effects} onChange={setEffects} />
              )}

              {effectCategory === 'mixing' && (
                <div className="space-y-4">
                  <NoiseGatePanel
                    settings={effects.noiseGate}
                    onChange={(noiseGate) => setEffects({ ...effects, noiseGate })}
                  />
                  <EQPanel
                    settings={effects.eq}
                    onChange={(eq) => setEffects({ ...effects, eq })}
                  />
                  <CompressorPanel
                    settings={effects.compressor}
                    onChange={(compressor) => setEffects({ ...effects, compressor })}
                  />
                </div>
              )}

              {effectCategory === 'modulation' && (
                <ModulationEffectsPanel effects={effects} onChange={setEffects} />
              )}

              {effectCategory === 'time' && (
                <ModulationEffectsPanel effects={effects} onChange={setEffects} />
              )}

              {effectCategory === 'output' && (
                <div className="space-y-4">
                  <ReverbPanel
                    settings={effects.reverb}
                    onChange={(reverb) => setEffects({ ...effects, reverb })}
                  />
                  <LimiterPanel
                    settings={effects.limiter}
                    onChange={(limiter) => setEffects({ ...effects, limiter })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <Headphones className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Audio Preview
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Test your input with the current settings
                </p>

                <Button
                  onClick={handlePreview}
                  variant={isPreviewing ? 'danger' : 'primary'}
                  className="gap-2"
                >
                  {isPreviewing ? (
                    <>
                      <Square className="w-4 h-4" />
                      Stop Preview
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Preview
                    </>
                  )}
                </Button>
              </div>

              {/* Input Level Meter */}
              <div className="space-y-2">
                <label className="text-sm text-gray-500 dark:text-gray-400">Input Level</label>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-75 rounded-full',
                      inputLevel > 0.8 ? 'bg-red-500' : inputLevel > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${inputLevel * 100}%` }}
                  />
                </div>
              </div>

              {/* Active Effects Summary */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Active Effects</h4>
                <div className="flex flex-wrap gap-2">
                  {effects.overdrive.enabled && (
                    <span className="px-2 py-1 text-xs bg-orange-500/10 text-orange-500 rounded">Overdrive</span>
                  )}
                  {effects.distortion.enabled && (
                    <span className="px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded">Distortion</span>
                  )}
                  {effects.ampSimulator.enabled && (
                    <span className="px-2 py-1 text-xs bg-amber-500/10 text-amber-500 rounded">Amp Sim</span>
                  )}
                  {effects.noiseGate.enabled && (
                    <span className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-500 rounded">Noise Gate</span>
                  )}
                  {effects.eq.enabled && (
                    <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded">EQ</span>
                  )}
                  {effects.compressor.enabled && (
                    <span className="px-2 py-1 text-xs bg-amber-500/10 text-amber-500 rounded">Compressor</span>
                  )}
                  {effects.chorus.enabled && (
                    <span className="px-2 py-1 text-xs bg-cyan-500/10 text-cyan-500 rounded">Chorus</span>
                  )}
                  {effects.delay.enabled && (
                    <span className="px-2 py-1 text-xs bg-indigo-500/10 text-indigo-500 rounded">Delay</span>
                  )}
                  {effects.reverb.enabled && (
                    <span className="px-2 py-1 text-xs bg-purple-500/10 text-purple-500 rounded">Reverb</span>
                  )}
                  {effects.limiter.enabled && (
                    <span className="px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded">Limiter</span>
                  )}
                  {!Object.values(effects).some(e => typeof e === 'object' && 'enabled' in e && e.enabled) && (
                    <span className="text-xs text-gray-500">No effects enabled</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={!name.trim()}>
            {preset ? 'Save Changes' : 'Create Preset'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default SavedTrackEditor;
