'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  GripVertical,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { adminGet, adminPost, adminPatch, adminDelete, adminPut } from '@/lib/api/admin';
import type {
  HomepageCharacter,
  CreateHomepageCharacterRequest,
  UpdateHomepageCharacterRequest,
  CanvasData,
  CharacterPersonality,
  IdleAnimation,
  HomepageSceneType,
} from '@/types/avatar';

// Dynamically import the canvas editor to avoid SSR issues
const CharacterCanvasEditor = dynamic(
  () => import('./CharacterCanvasEditor').then((mod) => mod.CharacterCanvasEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    )
  }
);

const PERSONALITY_OPTIONS: { value: CharacterPersonality; label: string; emoji: string }[] = [
  { value: 'energetic', label: 'Energetic', emoji: '⚡' },
  { value: 'calm', label: 'Calm', emoji: '😌' },
  { value: 'quirky', label: 'Quirky', emoji: '🎭' },
  { value: 'mysterious', label: 'Mysterious', emoji: '🌙' },
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
];

const IDLE_ANIMATION_OPTIONS: { value: IdleAnimation; label: string }[] = [
  { value: 'bounce', label: 'Bounce' },
  { value: 'sway', label: 'Sway' },
  { value: 'still', label: 'Still' },
  { value: 'dance', label: 'Dance' },
];

const SCENE_OPTIONS: { value: HomepageSceneType; label: string }[] = [
  { value: 'campfire', label: 'Campfire' },
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'beach', label: 'Beach' },
  { value: 'studio', label: 'Studio' },
  { value: 'space', label: 'Space' },
  { value: 'forest', label: 'Forest' },
];

interface CharacterFormData {
  name: string;
  description: string;
  personality: CharacterPersonality | '';
  preferredScenes: HomepageSceneType[];
  walkSpeed: number;
  idleAnimation: IdleAnimation;
  canvasData: CanvasData;
}

const DEFAULT_CANVAS_DATA: CanvasData = {
  version: 1,
  layers: [],
  background: { type: 'transparent', value: null },
};

export function CharacterManager() {
  const [characters, setCharacters] = useState<HomepageCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<HomepageCharacter | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    description: '',
    personality: '',
    preferredScenes: [],
    walkSpeed: 1.0,
    idleAnimation: 'bounce',
    canvasData: DEFAULT_CANVAS_DATA,
  });
  const [isSaving, setSaving] = useState(false);

  const loadCharacters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminGet('/api/admin/homepage/characters');
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      } else {
        throw new Error('Failed to load characters');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load characters');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      personality: '',
      preferredScenes: [],
      walkSpeed: 1.0,
      idleAnimation: 'bounce',
      canvasData: DEFAULT_CANVAS_DATA,
    });
    setShowCreateModal(true);
  };

  const handleEdit = (character: HomepageCharacter) => {
    setFormData({
      name: character.name,
      description: character.description || '',
      personality: character.personality || '',
      preferredScenes: character.preferredScenes || [],
      walkSpeed: character.walkSpeed,
      idleAnimation: character.idleAnimation,
      canvasData: character.canvasData,
    });
    setEditingCharacter(character);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a name for the character');
      return;
    }

    if (formData.canvasData.layers.length === 0) {
      alert('Please add at least one component to the character');
      return;
    }

    setSaving(true);
    try {
      if (editingCharacter) {
        // Update existing character
        const updateData: UpdateHomepageCharacterRequest = {
          name: formData.name,
          description: formData.description || undefined,
          personality: formData.personality || undefined,
          preferredScenes: formData.preferredScenes.length > 0 ? formData.preferredScenes : undefined,
          walkSpeed: formData.walkSpeed,
          idleAnimation: formData.idleAnimation,
          canvasData: formData.canvasData,
        };

        const res = await adminPatch(`/api/admin/homepage/characters?id=${editingCharacter.id}`, updateData);
        if (!res.ok) {
          throw new Error('Failed to update character');
        }
        setEditingCharacter(null);
      } else {
        // Create new character
        const createData: CreateHomepageCharacterRequest = {
          name: formData.name,
          description: formData.description || undefined,
          personality: formData.personality || undefined,
          preferredScenes: formData.preferredScenes.length > 0 ? formData.preferredScenes : undefined,
          walkSpeed: formData.walkSpeed,
          idleAnimation: formData.idleAnimation,
          canvasData: formData.canvasData,
        };

        const res = await adminPost('/api/admin/homepage/characters', createData);
        if (!res.ok) {
          throw new Error('Failed to create character');
        }
        setShowCreateModal(false);
      }
      loadCharacters();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save character');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await adminDelete(`/api/admin/homepage/characters?id=${id}`);
      if (!res.ok) {
        throw new Error('Failed to delete character');
      }
      setDeleteConfirmId(null);
      loadCharacters();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete character');
    }
  };

  const handleToggleActive = async (character: HomepageCharacter) => {
    try {
      const res = await adminPatch(`/api/admin/homepage/characters?id=${character.id}`, {
        isActive: !character.isActive,
      });
      if (!res.ok) {
        throw new Error('Failed to toggle character');
      }
      loadCharacters();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle character');
    }
  };

  const handleCanvasChange = (canvasData: CanvasData) => {
    setFormData(prev => ({ ...prev, canvasData }));
  };

  const handleSceneToggle = (scene: HomepageSceneType) => {
    setFormData(prev => ({
      ...prev,
      preferredScenes: prev.preferredScenes.includes(scene)
        ? prev.preferredScenes.filter(s => s !== scene)
        : [...prev.preferredScenes, scene],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-500 dark:text-gray-400">
            Create and manage characters that appear on the homepage animation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadCharacters}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Character
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {/* Characters Grid */}
      {characters.length === 0 ? (
        <Card className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No characters yet</p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Character
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((character) => (
            <Card
              key={character.id}
              className={`overflow-hidden transition-opacity ${
                !character.isActive ? 'opacity-50' : ''
              }`}
            >
              {/* Character Preview */}
              <div className="h-40 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center relative">
                {character.fullBodyUrl ? (
                  <img
                    src={character.fullBodyUrl}
                    alt={character.name}
                    className="h-full object-contain"
                  />
                ) : (
                  <div className="text-gray-400 text-sm">No preview</div>
                )}
                {!character.isActive && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-gray-800/80 rounded text-xs text-gray-300">
                    Hidden
                  </div>
                )}
              </div>

              {/* Character Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {character.name}
                    </h3>
                    {character.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {character.description}
                      </p>
                    )}
                  </div>
                  {character.personality && (
                    <span className="text-lg">
                      {PERSONALITY_OPTIONS.find(p => p.value === character.personality)?.emoji}
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {character.idleAnimation}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    {character.walkSpeed}x speed
                  </span>
                  {character.preferredScenes?.map(scene => (
                    <span
                      key={scene}
                      className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    >
                      {scene}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(character)}
                    className={character.isActive ? 'text-green-500' : 'text-gray-400'}
                  >
                    {character.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(character)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmId(character.id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || editingCharacter !== null}
        onClose={() => {
          setShowCreateModal(false);
          setEditingCharacter(null);
        }}
        title={editingCharacter ? `Edit ${editingCharacter.name}` : 'Create Character'}
        size="xl"
      >
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Character name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Personality
              </label>
              <select
                value={formData.personality}
                onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value as CharacterPersonality }))}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {PERSONALITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.emoji} {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Idle Animation
              </label>
              <select
                value={formData.idleAnimation}
                onChange={(e) => setFormData(prev => ({ ...prev, idleAnimation: e.target.value as IdleAnimation }))}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {IDLE_ANIMATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Walk Speed ({formData.walkSpeed}x)
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={formData.walkSpeed}
                onChange={(e) => setFormData(prev => ({ ...prev, walkSpeed: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>

          {/* Scene Preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Scenes (leave empty for all scenes)
            </label>
            <div className="flex flex-wrap gap-2">
              {SCENE_OPTIONS.map(scene => (
                <button
                  key={scene.value}
                  onClick={() => handleSceneToggle(scene.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.preferredScenes.includes(scene.value)
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {scene.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Character Appearance
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <CharacterCanvasEditor
                initialCanvasData={formData.canvasData}
                onChange={handleCanvasChange}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setEditingCharacter(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingCharacter ? 'Update' : 'Create'} Character
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Character"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this character? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-500 hover:bg-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
