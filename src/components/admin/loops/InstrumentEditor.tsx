'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { InstrumentDefinition, InstrumentCategory } from '@/lib/audio/instrument-registry';
import { GM_DRUM_MAP } from '@/lib/audio/instrument-registry';
import { Save, X, Plus, Minus } from 'lucide-react';

interface InstrumentEditorProps {
  instrument: InstrumentDefinition | null;
  categories: InstrumentCategory[];
  onSave: (instrument: Partial<InstrumentDefinition>) => void;
  onClose: () => void;
}

const ICON_OPTIONS = ['🥁', '🎸', '🎹', '🎵', '🔊', '⚡', '🔈', '✨', '🎤', '🎺', '🎻', '🎧'];
const OSCILLATOR_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const FILTER_TYPES: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];

interface OscillatorConfig {
  type: OscillatorType;
  detune: number;
  gain: number;
}

interface FilterConfig {
  type: BiquadFilterType;
  cutoff: number;
  resonance: number;
  envAmount: number;
}

interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface SynthConfig {
  oscillators: OscillatorConfig[];
  filter: FilterConfig;
  ampEnvelope: EnvelopeConfig;
  filterEnvelope?: EnvelopeConfig;
}

export function InstrumentEditor({ instrument, categories, onSave, onClose }: InstrumentEditorProps) {
  const [name, setName] = useState(instrument?.name || '');
  const [category, setCategory] = useState(instrument?.category || 'keys');
  const [type, setType] = useState<'synth' | 'drums' | 'sampler'>(instrument?.type || 'synth');
  const [icon, setIcon] = useState(instrument?.icon || '🎹');
  const [description, setDescription] = useState(instrument?.description || '');
  const [tags, setTags] = useState<string[]>(instrument?.tags || []);
  const [layout, setLayout] = useState<'piano' | 'drums' | 'pads'>(instrument?.layout || 'piano');
  const [noteRangeMin, setNoteRangeMin] = useState(instrument?.noteRange?.min || 36);
  const [noteRangeMax, setNoteRangeMax] = useState(instrument?.noteRange?.max || 84);
  const [tagInput, setTagInput] = useState('');

  // Synth config
  const defaultSynthConfig: SynthConfig = {
    oscillators: [{ type: 'sawtooth', detune: 0, gain: 0.5 }],
    filter: { type: 'lowpass', cutoff: 2000, resonance: 2, envAmount: 1000 },
    ampEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
  };

  const [synthConfig, setSynthConfig] = useState<SynthConfig>(
    (instrument?.synthConfig as SynthConfig) || defaultSynthConfig
  );

  // Use GM drum map for drums
  const [useDrumMap, setUseDrumMap] = useState(instrument?.type === 'drums');

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter an instrument name');
      return;
    }

    onSave({
      name: name.trim(),
      category,
      type,
      icon,
      description: description || undefined,
      tags,
      layout,
      noteRange: { min: noteRangeMin, max: noteRangeMax },
      synthConfig: type === 'synth' ? synthConfig : undefined,
      drumMap: type === 'drums' ? GM_DRUM_MAP : undefined,
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const addOscillator = () => {
    setSynthConfig({
      ...synthConfig,
      oscillators: [...synthConfig.oscillators, { type: 'sawtooth', detune: 0, gain: 0.3 }],
    });
  };

  const removeOscillator = (index: number) => {
    setSynthConfig({
      ...synthConfig,
      oscillators: synthConfig.oscillators.filter((_, i) => i !== index),
    });
  };

  const updateOscillator = (index: number, updates: Partial<OscillatorConfig>) => {
    setSynthConfig({
      ...synthConfig,
      oscillators: synthConfig.oscillators.map((osc, i) =>
        i === index ? { ...osc, ...updates } : osc
      ),
    });
  };

  const updateFilter = (updates: Partial<FilterConfig>) => {
    setSynthConfig({
      ...synthConfig,
      filter: { ...synthConfig.filter, ...updates },
    });
  };

  const updateEnvelope = (key: 'ampEnvelope' | 'filterEnvelope', updates: Partial<EnvelopeConfig>) => {
    const envelope = synthConfig[key] || { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 };
    setSynthConfig({
      ...synthConfig,
      [key]: { ...envelope, ...updates },
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={instrument ? `Edit: ${instrument.name}` : 'Create New Instrument'}
      className="max-w-4xl"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Instrument name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-1">
              {ICON_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`text-xl p-1.5 rounded border transition-colors ${
                    icon === emoji
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category, Type, Layout */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as typeof type;
                setType(newType);
                if (newType === 'drums') {
                  setLayout('drums');
                  setNoteRangeMin(36);
                  setNoteRangeMax(56);
                }
              }}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="synth">Synth</option>
              <option value="drums">Drums</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Layout
            </label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as typeof layout)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="piano">Piano</option>
              <option value="drums">Drums</option>
              <option value="pads">Pads</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description..."
          />
        </div>

        {/* Note Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note Range Min
            </label>
            <Input
              type="number"
              value={noteRangeMin}
              onChange={(e) => setNoteRangeMin(parseInt(e.target.value) || 36)}
              min={0}
              max={127}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note Range Max
            </label>
            <Input
              type="number"
              value={noteRangeMax}
              onChange={(e) => setNoteRangeMax(parseInt(e.target.value) || 84)}
              min={0}
              max={127}
            />
          </div>
        </div>

        {/* Synth Config (only for synth type) */}
        {type === 'synth' && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white">Synth Configuration</h4>

            {/* Oscillators */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Oscillators
                </label>
                <Button variant="ghost" size="sm" onClick={addOscillator}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {synthConfig.oscillators.map((osc, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                    <select
                      value={osc.type}
                      onChange={(e) => updateOscillator(i, { type: e.target.value as OscillatorType })}
                      className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800"
                    >
                      {OSCILLATOR_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      value={osc.detune}
                      onChange={(e) => updateOscillator(i, { detune: parseFloat(e.target.value) || 0 })}
                      placeholder="Detune"
                      className="w-20"
                    />
                    <Input
                      type="number"
                      value={osc.gain}
                      onChange={(e) => updateOscillator(i, { gain: parseFloat(e.target.value) || 0.5 })}
                      placeholder="Gain"
                      className="w-20"
                      step="0.1"
                      min="0"
                      max="1"
                    />
                    {synthConfig.oscillators.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeOscillator(i)}>
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Filter
              </label>
              <div className="grid grid-cols-4 gap-2">
                <select
                  value={synthConfig.filter.type}
                  onChange={(e) => updateFilter({ type: e.target.value as BiquadFilterType })}
                  className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800"
                >
                  {FILTER_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={synthConfig.filter.cutoff}
                  onChange={(e) => updateFilter({ cutoff: parseFloat(e.target.value) || 2000 })}
                  placeholder="Cutoff"
                />
                <Input
                  type="number"
                  value={synthConfig.filter.resonance}
                  onChange={(e) => updateFilter({ resonance: parseFloat(e.target.value) || 0 })}
                  placeholder="Resonance"
                  step="0.5"
                />
                <Input
                  type="number"
                  value={synthConfig.filter.envAmount}
                  onChange={(e) => updateFilter({ envAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="Env Amount"
                />
              </div>
            </div>

            {/* Amp Envelope */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Amp Envelope (ADSR)
              </label>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  type="number"
                  value={synthConfig.ampEnvelope.attack}
                  onChange={(e) => updateEnvelope('ampEnvelope', { attack: parseFloat(e.target.value) || 0.01 })}
                  placeholder="Attack"
                  step="0.01"
                  min="0"
                />
                <Input
                  type="number"
                  value={synthConfig.ampEnvelope.decay}
                  onChange={(e) => updateEnvelope('ampEnvelope', { decay: parseFloat(e.target.value) || 0.2 })}
                  placeholder="Decay"
                  step="0.01"
                  min="0"
                />
                <Input
                  type="number"
                  value={synthConfig.ampEnvelope.sustain}
                  onChange={(e) => updateEnvelope('ampEnvelope', { sustain: parseFloat(e.target.value) || 0.7 })}
                  placeholder="Sustain"
                  step="0.1"
                  min="0"
                  max="1"
                />
                <Input
                  type="number"
                  value={synthConfig.ampEnvelope.release}
                  onChange={(e) => updateEnvelope('ampEnvelope', { release: parseFloat(e.target.value) || 0.3 })}
                  placeholder="Release"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/20 text-indigo-500 rounded-full text-sm"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-indigo-300">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add tag..."
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addTag}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {instrument ? 'Save Changes' : 'Create Instrument'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
