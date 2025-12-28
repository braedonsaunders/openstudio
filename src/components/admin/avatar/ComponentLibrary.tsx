'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import {
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Star,
  Gem,
  Crown,
  Filter,
  Save,
  ZoomIn,
  Settings2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import type { AvatarComponent, AvatarCategory, AvatarUnlockRule, ComponentRarity } from '@/types/avatar';
import { adminGet, adminPatch, adminDelete, adminPost } from '@/lib/api/admin';

interface ComponentLibraryProps {
  categories: AvatarCategory[];
  unlockRules: AvatarUnlockRule[];
  onRefresh: () => void;
}

const rarityIcons: Record<ComponentRarity, React.ReactNode> = {
  common: null,
  rare: <Star className="w-3 h-3 text-blue-500" />,
  epic: <Gem className="w-3 h-3 text-purple-500" />,
  legendary: <Crown className="w-3 h-3 text-yellow-500" />,
};

const rarityColors: Record<ComponentRarity, string> = {
  common: 'border-gray-300 dark:border-gray-600',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500',
};

export function ComponentLibrary({ categories, unlockRules, onRefresh }: ComponentLibraryProps) {
  const [components, setComponents] = useState<AvatarComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterRarity, setFilterRarity] = useState<ComponentRarity | ''>('');
  const [showInactive, setShowInactive] = useState(false);

  // Edit modal
  const [editingComponent, setEditingComponent] = useState<AvatarComponent | null>(null);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRarity, setEditRarity] = useState<ComponentRarity>('common');
  const [editRuleIds, setEditRuleIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deletingComponent, setDeletingComponent] = useState<AvatarComponent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Image editor modal
  const [editingImage, setEditingImage] = useState<AvatarComponent | null>(null);
  const [bgThreshold, setBgThreshold] = useState(240);
  const [specThreshold, setSpecThreshold] = useState(50);
  const [cleanupSpecs, setCleanupSpecs] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    setIsLoading(true);
    try {
      const response = await adminGet('/api/admin/avatar/components');
      if (response.ok) {
        const data = await response.json();
        setComponents(data);
      }
    } catch (error) {
      console.error('Failed to load components:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredComponents = useMemo(() => {
    return components.filter((comp) => {
      if (!showInactive && !comp.isActive) return false;
      if (filterCategory && comp.categoryId !== filterCategory) return false;
      if (filterRarity && comp.rarity !== filterRarity) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          comp.name.toLowerCase().includes(searchLower) ||
          comp.id.toLowerCase().includes(searchLower) ||
          comp.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      }
      return true;
    });
  }, [components, search, filterCategory, filterRarity, showInactive]);

  const componentsByCategory = useMemo(() => {
    const grouped: Record<string, AvatarComponent[]> = {};
    for (const comp of filteredComponents) {
      if (!grouped[comp.categoryId]) {
        grouped[comp.categoryId] = [];
      }
      grouped[comp.categoryId].push(comp);
    }
    return grouped;
  }, [filteredComponents]);

  const handleEdit = (component: AvatarComponent) => {
    setEditingComponent(component);
    setEditId(component.id);
    setEditName(component.name);
    setEditTags(component.tags.join(', '));
    setEditRarity(component.rarity);
    setEditRuleIds([]); // TODO: Load existing rules
  };

  const handleSaveEdit = async () => {
    if (!editingComponent) return;
    setIsSaving(true);

    try {
      const newId = editId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const response = await adminPatch(`/api/admin/avatar/components?id=${editingComponent.id}`, {
        newId: newId !== editingComponent.id ? newId : undefined,
        name: editName,
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        rarity: editRarity,
        unlockRuleIds: editRuleIds,
      });

      if (response.ok) {
        setEditingComponent(null);
        loadComponents();
        onRefresh();
        toast.success('Component updated successfully');
      } else {
        const error = await response.json();
        toast.error(`Failed to update: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update component:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (component: AvatarComponent) => {
    try {
      const response = await adminPatch(`/api/admin/avatar/components?id=${component.id}`, {
        isActive: !component.isActive,
      });

      if (response.ok) {
        loadComponents();
      }
    } catch (error) {
      console.error('Failed to toggle component:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingComponent) return;
    setIsDeleting(true);

    try {
      const response = await adminDelete(`/api/admin/avatar/components?id=${deletingComponent.id}`);

      if (response.ok) {
        setDeletingComponent(null);
        loadComponents();
        onRefresh();
        toast.success('Component deleted');
      }
    } catch (error) {
      console.error('Failed to delete component:', error);
      toast.error('Failed to delete component');
    } finally {
      setIsDeleting(false);
    }
  };

  // Image editor handlers
  const handleOpenImageEditor = (component: AvatarComponent) => {
    setEditingImage(component);
    setBgThreshold(240);
    setSpecThreshold(50);
    setCleanupSpecs(true);
    setPreviewImage(null);
  };

  const handlePreviewProcessing = async () => {
    if (!editingImage) return;
    setIsProcessing(true);

    try {
      const response = await adminPost('/api/admin/avatar/reprocess', {
        componentId: editingImage.id,
        backgroundThreshold: bgThreshold,
        specSizeThreshold: specThreshold,
        cleanupSpecs,
        previewOnly: true,
      });

      if (response.ok) {
        const result = await response.json();
        setPreviewImage(result.previewUrl);
      } else {
        const error = await response.json();
        toast.error(`Processing failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Processing failed:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveProcessedImage = async () => {
    if (!editingImage) return;
    setIsSavingImage(true);

    try {
      const response = await adminPost('/api/admin/avatar/reprocess', {
        componentId: editingImage.id,
        backgroundThreshold: bgThreshold,
        specSizeThreshold: specThreshold,
        cleanupSpecs,
        previewOnly: false,
      });

      if (response.ok) {
        toast.success('Image updated successfully');
        setEditingImage(null);
        setPreviewImage(null);
        loadComponents();
      } else {
        const error = await response.json();
        toast.error(`Failed to save: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save processed image');
    } finally {
      setIsSavingImage(false);
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
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components..."
              className="pl-10"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.displayName}
              </option>
            ))}
          </select>

          <select
            value={filterRarity}
            onChange={(e) => setFilterRarity(e.target.value as ComponentRarity | '')}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Rarities</option>
            <option value="common">Common</option>
            <option value="rare">Rare</option>
            <option value="epic">Epic</option>
            <option value="legendary">Legendary</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show Inactive
          </label>

          <Button variant="ghost" size="sm" onClick={loadComponents}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Component Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{filteredComponents.length} components</span>
        <span>|</span>
        <span>{Object.keys(componentsByCategory).length} categories</span>
      </div>

      {/* Components by Category */}
      {categories
        .filter((cat) => componentsByCategory[cat.id]?.length > 0)
        .map((category) => (
          <Card key={category.id} className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {category.displayName}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({componentsByCategory[category.id].length})
              </span>
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {componentsByCategory[category.id].map((component) => (
                <div
                  key={component.id}
                  className={`relative group aspect-square rounded-lg overflow-hidden border-2 ${
                    rarityColors[component.rarity]
                  } ${!component.isActive ? 'opacity-50' : ''}`}
                >
                  <img
                    src={component.thumbnailUrl || component.imageUrl}
                    alt={component.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Rarity indicator */}
                  {rarityIcons[component.rarity] && (
                    <div className="absolute top-1 left-1">
                      {rarityIcons[component.rarity]}
                    </div>
                  )}

                  {/* Inactive indicator */}
                  {!component.isActive && (
                    <div className="absolute top-1 right-1">
                      <EyeOff className="w-3 h-3 text-gray-500" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <p className="text-xs text-white text-center px-1 truncate w-full">
                      {component.name}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenImageEditor(component)}
                        className="p-1 bg-white/20 rounded hover:bg-white/40"
                        title="View & Edit Image"
                      >
                        <ZoomIn className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={() => handleEdit(component)}
                        className="p-1 bg-white/20 rounded hover:bg-white/40"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(component)}
                        className="p-1 bg-white/20 rounded hover:bg-white/40"
                        title={component.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {component.isActive ? (
                          <EyeOff className="w-3 h-3 text-white" />
                        ) : (
                          <Eye className="w-3 h-3 text-white" />
                        )}
                      </button>
                      <button
                        onClick={() => setDeletingComponent(component)}
                        className="p-1 bg-red-500/50 rounded hover:bg-red-500/80"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

      {filteredComponents.length === 0 && (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No components found</p>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingComponent}
        onClose={() => setEditingComponent(null)}
        title={`Edit: ${editingComponent?.name}`}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <img
              src={editingComponent?.imageUrl}
              alt={editingComponent?.name}
              className="w-32 h-32 object-cover rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Component ID (slug)
            </label>
            <Input
              value={editId}
              onChange={(e) => setEditId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
              placeholder="e.g., hair_spiky_01"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lowercase letters, numbers, underscores and hyphens only
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (comma-separated)
            </label>
            <Input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rarity
            </label>
            <select
              value={editRarity}
              onChange={(e) => setEditRarity(e.target.value as ComponentRarity)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unlock Rules
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {unlockRules.map((rule) => (
                <label key={rule.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editRuleIds.includes(rule.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditRuleIds([...editRuleIds, rule.id]);
                      } else {
                        setEditRuleIds(editRuleIds.filter((id) => id !== rule.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {rule.displayName}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditingComponent(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deletingComponent}
        onClose={() => setDeletingComponent(null)}
        title="Delete Component"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="text-gray-900 dark:text-white font-medium">
              {deletingComponent?.name}
            </span>
            ?
          </p>
          <p className="text-sm text-red-500">
            This will permanently delete the component and its images. This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingComponent(null)}>
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

      {/* Image Editor Modal */}
      <Modal
        isOpen={!!editingImage}
        onClose={() => {
          setEditingImage(null);
          setPreviewImage(null);
        }}
        title={`Edit Image: ${editingImage?.name}`}
      >
        <div className="space-y-6">
          {/* Image comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                Original
              </p>
              <div
                className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              >
                <img
                  src={editingImage?.imageUrl}
                  alt="Original"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                Preview
              </p>
              <div
                className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              >
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800">
                    <Settings2 className="w-8 h-8" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Background Removal Settings */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Background Removal Settings
            </h4>

            <div>
              <Slider
                label="Background Threshold"
                showValue
                min={200}
                max={255}
                value={bgThreshold}
                onChange={(e) => setBgThreshold(parseInt(e.target.value))}
                formatValue={(v) => `${v}`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher = only remove pure white. Lower = remove off-white too.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanupSpecs}
                  onChange={(e) => setCleanupSpecs(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Clean up white specs
                </span>
              </label>
            </div>

            {cleanupSpecs && (
              <div>
                <Slider
                  label="Spec Size Threshold"
                  showValue
                  min={10}
                  max={200}
                  value={specThreshold}
                  onChange={(e) => setSpecThreshold(parseInt(e.target.value))}
                  formatValue={(v) => `${v}px`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Remove isolated white regions smaller than this (in pixels).
                </p>
              </div>
            )}

            <Button
              onClick={handlePreviewProcessing}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Preview Changes
                </>
              )}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setEditingImage(null);
                setPreviewImage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProcessedImage}
              disabled={isSavingImage || !previewImage}
              className="bg-green-500 hover:bg-green-600"
            >
              {isSavingImage ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save & Update
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
