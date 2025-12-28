'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Save,
  Paintbrush,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AvatarGenerationPreset } from '@/types/avatar';
import { adminGet, adminPatch, adminPost, adminDelete } from '@/lib/api/admin';

interface StyleManagerProps {
  onRefresh: () => void;
}

export function StyleManager({ onRefresh }: StyleManagerProps) {
  const [presets, setPresets] = useState<AvatarGenerationPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AvatarGenerationPreset | null>(null);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPromptTemplate, setFormPromptTemplate] = useState('');
  const [formNegativePrompt, setFormNegativePrompt] = useState('');
  const [formStyleSuffix, setFormStyleSuffix] = useState('');
  const [formModel, setFormModel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deletingPreset, setDeletingPreset] = useState<AvatarGenerationPreset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const response = await adminGet('/api/admin/avatar/presets');
      if (response.ok) {
        const data = await response.json();
        setPresets(data);
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
      toast.error('Failed to load styles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingPreset(null);
    setFormId('');
    setFormName('');
    setFormPromptTemplate('A {component}, high quality, centered, transparent background');
    setFormNegativePrompt('blurry, low quality, watermark, text, background');
    setFormStyleSuffix('');
    setFormModel('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (preset: AvatarGenerationPreset) => {
    setEditingPreset(preset);
    setFormId(preset.id);
    setFormName(preset.name);
    setFormPromptTemplate(preset.promptTemplate);
    setFormNegativePrompt(preset.negativePrompt || '');
    setFormStyleSuffix(preset.styleSuffix || '');
    setFormModel(preset.model || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formId || !formName || !formPromptTemplate) {
      toast.error('Please fill in required fields');
      return;
    }
    setIsSaving(true);

    try {
      if (editingPreset) {
        // Update existing
        const response = await adminPatch(`/api/admin/avatar/presets?id=${editingPreset.id}`, {
          name: formName,
          promptTemplate: formPromptTemplate,
          negativePrompt: formNegativePrompt || null,
          styleSuffix: formStyleSuffix || null,
          model: formModel || null,
        });

        if (response.ok) {
          toast.success('Style updated');
          setIsModalOpen(false);
          loadPresets();
          onRefresh();
        } else {
          const error = await response.json();
          toast.error(`Failed to update: ${error.error}`);
        }
      } else {
        // Create new
        const response = await adminPost('/api/admin/avatar/presets', {
          id: formId.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
          name: formName,
          promptTemplate: formPromptTemplate,
          negativePrompt: formNegativePrompt || undefined,
          styleSuffix: formStyleSuffix || undefined,
          model: formModel || undefined,
        });

        if (response.ok) {
          toast.success('Style created');
          setIsModalOpen(false);
          loadPresets();
          onRefresh();
        } else {
          const error = await response.json();
          toast.error(`Failed to create: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
      toast.error('Failed to save style');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (preset: AvatarGenerationPreset) => {
    try {
      const response = await adminPatch(`/api/admin/avatar/presets?id=${preset.id}`, {
        isActive: !preset.isActive,
      });

      if (response.ok) {
        loadPresets();
        toast.success(preset.isActive ? 'Style deactivated' : 'Style activated');
      }
    } catch (error) {
      console.error('Failed to toggle preset:', error);
      toast.error('Failed to update style');
    }
  };

  const handleDelete = async () => {
    if (!deletingPreset) return;
    setIsDeleting(true);

    try {
      const response = await adminDelete(`/api/admin/avatar/presets?id=${deletingPreset.id}`);

      if (response.ok) {
        toast.success('Style deleted');
        setDeletingPreset(null);
        loadPresets();
        onRefresh();
      } else {
        const error = await response.json();
        toast.error(`Failed to delete: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete preset:', error);
      toast.error('Failed to delete style');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paintbrush className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Generation Styles
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={loadPresets}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Style
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Define prompt templates and style presets for AI image generation.
        Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{component}'}</code> as a placeholder for the component description.
      </p>

      {/* Styles List */}
      {presets.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Paintbrush className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No styles defined yet</p>
          <p className="text-sm mt-2">Create your first style to get started</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {presets.map((preset) => (
            <Card
              key={preset.id}
              className={`p-4 ${!preset.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {preset.name}
                    </span>
                    {!preset.isActive && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">
                        Inactive
                      </span>
                    )}
                    {preset.model && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                        {preset.model}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    ID: {preset.id}
                  </p>
                  <div className="text-sm bg-gray-50 dark:bg-gray-800/50 p-2 rounded font-mono text-gray-600 dark:text-gray-300 truncate">
                    {preset.promptTemplate}
                  </div>
                  {preset.styleSuffix && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      Style suffix: {preset.styleSuffix}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(preset)}
                    title={preset.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {preset.isActive ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(preset)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingPreset(preset)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPreset ? 'Edit Style' : 'Add Style'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Style ID *
            </label>
            <Input
              value={formId}
              onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
              placeholder="e.g., pixel_art"
              disabled={!!editingPreset}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in code. Lowercase, underscores only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name *
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Pixel Art"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prompt Template *
            </label>
            <textarea
              value={formPromptTemplate}
              onChange={(e) => setFormPromptTemplate(e.target.value)}
              placeholder="A {component}, pixel art style, 8-bit, retro game aesthetic"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{component}'}</code> where the component description should be inserted.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Style Suffix
            </label>
            <Input
              value={formStyleSuffix}
              onChange={(e) => setFormStyleSuffix(e.target.value)}
              placeholder="e.g., chibi style, cute, kawaii"
            />
            <p className="text-xs text-gray-500 mt-1">
              Additional style keywords appended to all prompts.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Negative Prompt
            </label>
            <textarea
              value={formNegativePrompt}
              onChange={(e) => setFormNegativePrompt(e.target.value)}
              placeholder="blurry, low quality, watermark, text"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Model
            </label>
            <Input
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
              placeholder="e.g., cf-flux-schnell (optional)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use the selected model in the generator.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formId || !formName || !formPromptTemplate}>
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {editingPreset ? 'Save Changes' : 'Create Style'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deletingPreset}
        onClose={() => setDeletingPreset(null)}
        title="Delete Style"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="text-gray-900 dark:text-white font-medium">
              {deletingPreset?.name}
            </span>
            ?
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingPreset(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
