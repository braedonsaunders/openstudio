'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteGridEditor } from '@/components/loops/note-grid-editor';
import type { LoopDefinition, LoopCategoryInfo, LoopCategory, MidiNote } from '@/types/loops';
import { getAllInstruments } from '@/lib/audio/instrument-registry';
import { Play, Square, Save, X, Plus, Minus } from 'lucide-react';

interface LoopEditorProps {
  loop: LoopDefinition | null;
  categories: LoopCategoryInfo[];
  onSave: (loop: Partial<LoopDefinition>) => void;
  onClose: () => void;
}

export function LoopEditor({ loop, categories, onSave, onClose }: LoopEditorProps) {
  const [name, setName] = useState(loop?.name || '');
  const [category, setCategory] = useState(loop?.category || 'drums');
  const [subcategory, setSubcategory] = useState(loop?.subcategory || '');
  const [bpm, setBpm] = useState(loop?.bpm || 120);
  const [bars, setBars] = useState(loop?.bars || 1);
  const [timeSignature, setTimeSignature] = useState<[number, number]>(loop?.timeSignature || [4, 4]);
  const [key, setKey] = useState(loop?.key || '');
  const [soundPreset, setSoundPreset] = useState(loop?.soundPreset || 'drums/acoustic-kit');
  const [tags, setTags] = useState<string[]>(loop?.tags || []);
  const [intensity, setIntensity] = useState(loop?.intensity || 3);
  const [complexity, setComplexity] = useState(loop?.complexity || 2);
  const [midiData, setMidiData] = useState<MidiNote[]>(loop?.midiData || []);
  const [tagInput, setTagInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const instruments = getAllInstruments();
  const selectedCategory = categories.find(c => c.id === category);
  const subcategories = selectedCategory?.subcategories || [];

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a loop name');
      return;
    }

    onSave({
      name: name.trim(),
      category: category as LoopDefinition['category'],
      subcategory,
      bpm,
      bars,
      timeSignature,
      key: key || undefined,
      soundPreset,
      tags,
      intensity: intensity as LoopDefinition['intensity'],
      complexity: complexity as LoopDefinition['complexity'],
      midiData,
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

  const intensityStars = (n: number) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => setIntensity(i as LoopDefinition['intensity'])}
          className={`text-lg ${i <= n ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
        >
          ★
        </button>
      ))}
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={loop ? `Edit: ${loop.name}` : 'Create New Loop'}
      className="max-w-5xl"
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
              placeholder="Loop name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sound Preset
            </label>
            <select
              value={soundPreset}
              onChange={(e) => setSoundPreset(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              {instruments.map(inst => (
                <option key={inst.id} value={inst.id}>
                  {inst.icon} {inst.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category & Subcategory */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as LoopCategory);
                setSubcategory('');
              }}
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
              Subcategory
            </label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">Select subcategory...</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Musical Properties */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              BPM
            </label>
            <Input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
              min={40}
              max={240}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bars
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBars(Math.max(1, bars - 1))}
                disabled={bars <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium w-8 text-center">{bars}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBars(Math.min(8, bars + 1))}
                disabled={bars >= 8}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Signature
            </label>
            <select
              value={`${timeSignature[0]}/${timeSignature[1]}`}
              onChange={(e) => {
                const [n, d] = e.target.value.split('/').map(Number);
                setTimeSignature([n, d]);
              }}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
              <option value="5/4">5/4</option>
              <option value="7/8">7/8</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Key
            </label>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">No key</option>
              <option value="C">C Major</option>
              <option value="G">G Major</option>
              <option value="D">D Major</option>
              <option value="A">A Major</option>
              <option value="E">E Major</option>
              <option value="B">B Major</option>
              <option value="F">F Major</option>
              <option value="Bb">Bb Major</option>
              <option value="Eb">Eb Major</option>
              <option value="Am">A Minor</option>
              <option value="Em">E Minor</option>
              <option value="Dm">D Minor</option>
              <option value="Bm">B Minor</option>
              <option value="Fm">F Minor</option>
              <option value="Cm">C Minor</option>
              <option value="Gm">G Minor</option>
            </select>
          </div>
        </div>

        {/* Note Grid Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            MIDI Pattern
          </label>
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            <NoteGridEditor
              instrumentId={soundPreset}
              notes={midiData}
              bars={bars}
              timeSignature={timeSignature}
              bpm={bpm}
              onChange={setMidiData}
              isDark={true}
            />
          </div>
        </div>

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
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-indigo-300"
                >
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

        {/* Intensity & Complexity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Intensity
            </label>
            {intensityStars(intensity)}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Complexity
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  onClick={() => setComplexity(i as LoopDefinition['complexity'])}
                  className={`text-lg ${i <= complexity ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'}`}
                >
                  ●
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {loop ? 'Save Changes' : 'Create Loop'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
