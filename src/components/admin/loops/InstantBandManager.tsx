'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminGet, adminPost, adminPatch, adminDelete } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import type { LoopDefinition, InstantBandPreset } from '@/types/loops';
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  Music,
  X,
} from 'lucide-react';

interface InstantBandManagerProps {
  loops: LoopDefinition[];
  onRefresh: () => void;
}

export function InstantBandManager({ loops, onRefresh }: InstantBandManagerProps) {
  const [presets, setPresets] = useState<InstantBandPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPreset, setEditingPreset] = useState<InstantBandPreset | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  // Form state
  const [presetId, setPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [presetLoopIds, setPresetLoopIds] = useState<string[]>([]);
  const [presetBpmMin, setPresetBpmMin] = useState(80);
  const [presetBpmMax, setPresetBpmMax] = useState(140);
  const [presetGenre, setPresetGenre] = useState('');

  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminGet('/api/admin/loops/presets?active=false');
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const openEditor = (preset?: InstantBandPreset) => {
    if (preset) {
      setEditingPreset(preset);
      setPresetId(preset.id);
      setPresetName(preset.name);
      setPresetDescription(preset.description);
      setPresetLoopIds(preset.loops);
      setPresetBpmMin(preset.bpmRange[0]);
      setPresetBpmMax(preset.bpmRange[1]);
      setPresetGenre(preset.genre);
    } else {
      setEditingPreset(null);
      setPresetId('');
      setPresetName('');
      setPresetDescription('');
      setPresetLoopIds([]);
      setPresetBpmMin(80);
      setPresetBpmMax(140);
      setPresetGenre('');
    }
    setShowEditor(true);
  };

  const handleSave = async () => {
    try {
      if (editingPreset) {
        await adminPatch(`/api/admin/loops/presets?id=${editingPreset.id}`, {
          name: presetName,
          description: presetDescription,
          loop_ids: presetLoopIds,
          bpm_range: [presetBpmMin, presetBpmMax],
          genre: presetGenre,
        });
      } else {
        const id = presetId || presetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        await adminPost('/api/admin/loops/presets', {
          id,
          name: presetName,
          description: presetDescription,
          loop_ids: presetLoopIds,
          bpm_range: [presetBpmMin, presetBpmMax],
          genre: presetGenre,
        });
      }
      setShowEditor(false);
      loadPresets();
      onRefresh();
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    try {
      await adminDelete(`/api/admin/loops/presets?id=${showDeleteModal}`);
      setShowDeleteModal(null);
      loadPresets();
      onRefresh();
    } catch (error) {
      console.error('Failed to delete preset:', error);
    }
  };

  const toggleLoop = (loopId: string) => {
    if (presetLoopIds.includes(loopId)) {
      setPresetLoopIds(presetLoopIds.filter(id => id !== loopId));
    } else {
      setPresetLoopIds([...presetLoopIds, loopId]);
    }
  };

  const getLoopName = (loopId: string) => {
    const loop = loops.find(l => l.id === loopId);
    return loop?.name || loopId;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Instant Band Presets ({presets.length})
        </h3>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={loadPresets}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => openEditor()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Preset
          </Button>
        </div>
      </div>

      {/* Preset List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : presets.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No instant band presets</p>
          <Button onClick={() => openEditor()} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Create First Preset
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {presets.map(preset => (
            <Card key={preset.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{preset.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{preset.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditor(preset)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteModal(preset.id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {preset.loops.map(loopId => (
                  <span
                    key={loopId}
                    className="px-2 py-1 bg-indigo-500/20 text-indigo-500 rounded text-xs"
                  >
                    {getLoopName(loopId)}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>BPM: {preset.bpmRange[0]}-{preset.bpmRange[1]}</span>
                <span>Genre: {preset.genre}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Modal
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        title={editingPreset ? 'Edit Preset' : 'Create Preset'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preset ID
              </label>
              <Input
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                placeholder="e.g., rock-trio"
                disabled={!!editingPreset}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <Input
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder="Short description..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                BPM Min
              </label>
              <Input
                type="number"
                value={presetBpmMin}
                onChange={(e) => setPresetBpmMin(parseInt(e.target.value) || 80)}
                min={40}
                max={240}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                BPM Max
              </label>
              <Input
                type="number"
                value={presetBpmMax}
                onChange={(e) => setPresetBpmMax(parseInt(e.target.value) || 140)}
                min={40}
                max={240}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Genre
              </label>
              <Input
                value={presetGenre}
                onChange={(e) => setPresetGenre(e.target.value)}
                placeholder="e.g., Rock, Electronic"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Loops ({presetLoopIds.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {loops.map(loop => (
                <label
                  key={loop.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    presetLoopIds.includes(loop.id)
                      ? 'bg-indigo-500/20 text-indigo-500'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={presetLoopIds.includes(loop.id)}
                    onChange={() => toggleLoop(loop.id)}
                    className="rounded"
                  />
                  <span className="font-medium">{loop.name}</span>
                  <span className="text-xs text-gray-500">({loop.category})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!presetName.trim() || presetLoopIds.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Delete Preset"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this preset? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
