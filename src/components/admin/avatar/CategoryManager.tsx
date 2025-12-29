'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import {
  Plus,
  GripVertical,
  Edit2,
  Trash2,
  RefreshCw,
  Save,
  Layers,
  Check,
} from 'lucide-react';
import type { AvatarCategory } from '@/types/avatar';
import { adminPatch, adminPost, adminDelete } from '@/lib/api/admin';

interface CategoryManagerProps {
  categories: AvatarCategory[];
  colorPalettes: Record<string, string[]>;
  onRefresh: () => void;
}

export function CategoryManager({ categories, colorPalettes, onRefresh }: CategoryManagerProps) {
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AvatarCategory | null>(null);
  const [formId, setFormId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formIsRequired, setFormIsRequired] = useState(false);
  const [formMaxSelections, setFormMaxSelections] = useState(1);
  const [formSupportsColorVariants, setFormSupportsColorVariants] = useState(false);
  const [formDefaultPalette, setFormDefaultPalette] = useState<string>('');
  const [formPromptAddition, setFormPromptAddition] = useState('');
  const [formRenderX, setFormRenderX] = useState(0);
  const [formRenderY, setFormRenderY] = useState(0);
  const [formRenderWidth, setFormRenderWidth] = useState(512);
  const [formRenderHeight, setFormRenderHeight] = useState(512);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deletingCategory, setDeletingCategory] = useState<AvatarCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...orderedCategories];
    const [dragged] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, dragged);

    setOrderedCategories(newOrder);
    setDraggedIndex(index);
    setHasOrderChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const orderedIds = orderedCategories.map((c) => c.id);
      const response = await adminPatch('/api/admin/avatar/categories?action=reorder', { orderedIds });

      if (response.ok) {
        setHasOrderChanges(false);
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to save order:', error);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormId('');
    setFormDisplayName('');
    setFormIsRequired(false);
    setFormMaxSelections(1);
    setFormSupportsColorVariants(false);
    setFormDefaultPalette('');
    setFormPromptAddition('');
    setFormRenderX(0);
    setFormRenderY(0);
    setFormRenderWidth(512);
    setFormRenderHeight(512);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: AvatarCategory) => {
    setEditingCategory(category);
    setFormId(category.id);
    setFormDisplayName(category.displayName);
    setFormIsRequired(category.isRequired);
    setFormMaxSelections(category.maxSelections);
    setFormSupportsColorVariants(category.supportsColorVariants);
    setFormDefaultPalette(category.defaultColorPalette || '');
    setFormPromptAddition(category.promptAddition || '');
    setFormRenderX(category.renderX);
    setFormRenderY(category.renderY);
    setFormRenderWidth(category.renderWidth);
    setFormRenderHeight(category.renderHeight);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formId || !formDisplayName) return;
    setIsSaving(true);

    try {
      if (editingCategory) {
        // Update existing
        const response = await adminPatch(`/api/admin/avatar/categories?id=${editingCategory.id}`, {
          displayName: formDisplayName,
          isRequired: formIsRequired,
          maxSelections: formMaxSelections,
          supportsColorVariants: formSupportsColorVariants,
          defaultColorPalette: formDefaultPalette || null,
          promptAddition: formPromptAddition || null,
          renderX: formRenderX,
          renderY: formRenderY,
          renderWidth: formRenderWidth,
          renderHeight: formRenderHeight,
        });

        if (response.ok) {
          // Update local state instead of reloading
          setOrderedCategories(prev => prev.map(c =>
            c.id === editingCategory.id ? {
              ...c,
              displayName: formDisplayName,
              isRequired: formIsRequired,
              maxSelections: formMaxSelections,
              supportsColorVariants: formSupportsColorVariants,
              defaultColorPalette: formDefaultPalette || null,
              promptAddition: formPromptAddition || null,
              renderX: formRenderX,
              renderY: formRenderY,
              renderWidth: formRenderWidth,
              renderHeight: formRenderHeight,
            } : c
          ));
          setIsModalOpen(false);
        }
      } else {
        // Create new
        const newId = formId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const response = await adminPost('/api/admin/avatar/categories', {
          id: newId,
          displayName: formDisplayName,
          layerOrder: orderedCategories.length,
          isRequired: formIsRequired,
          maxSelections: formMaxSelections,
          supportsColorVariants: formSupportsColorVariants,
          defaultColorPalette: formDefaultPalette || undefined,
          promptAddition: formPromptAddition || undefined,
          renderX: formRenderX,
          renderY: formRenderY,
          renderWidth: formRenderWidth,
          renderHeight: formRenderHeight,
        });

        if (response.ok) {
          // Add to local state instead of reloading
          const newCategory: AvatarCategory = {
            id: newId,
            displayName: formDisplayName,
            layerOrder: orderedCategories.length,
            isRequired: formIsRequired,
            maxSelections: formMaxSelections,
            supportsColorVariants: formSupportsColorVariants,
            defaultColorPalette: formDefaultPalette || null,
            promptAddition: formPromptAddition || null,
            renderX: formRenderX,
            renderY: formRenderY,
            renderWidth: formRenderWidth,
            renderHeight: formRenderHeight,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setOrderedCategories(prev => [...prev, newCategory]);
          setIsModalOpen(false);
        }
      }
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);

    try {
      const response = await adminDelete(`/api/admin/avatar/categories?id=${deletingCategory.id}`);

      if (response.ok) {
        // Update local state immediately to avoid reload
        setOrderedCategories(prev => prev.filter(c => c.id !== deletingCategory.id));
        setDeletingCategory(null);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Component Categories
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {hasOrderChanges && (
            <Button
              onClick={handleSaveOrder}
              disabled={isSavingOrder}
              className="bg-green-500 hover:bg-green-600"
            >
              {isSavingOrder ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Order
            </Button>
          )}

          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Drag to reorder layers. Lower layers are rendered first (behind).
      </p>

      {/* Categories List */}
      <Card className="divide-y divide-gray-200 dark:divide-gray-700">
        {[...orderedCategories].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((category) => {
          const actualIndex = orderedCategories.findIndex(c => c.id === category.id);
          return (
          <div
            key={category.id}
            draggable
            onDragStart={() => handleDragStart(actualIndex)}
            onDragOver={(e) => handleDragOver(e, actualIndex)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-move ${
              draggedIndex === actualIndex ? 'opacity-50 bg-indigo-50 dark:bg-indigo-900/20' : ''
            }`}
          >
            <GripVertical className="w-5 h-5 text-gray-400" />

            <div className="w-12 text-center">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                {category.layerOrder}
              </span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {category.displayName}
                </span>
                {category.isRequired && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                    Required
                  </span>
                )}
                {category.supportsColorVariants && (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                    Colors
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ID: {category.id} | Max: {category.maxSelections} | Pos: ({category.renderX}, {category.renderY}) {category.renderWidth}×{category.renderHeight}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(category)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingCategory(category)}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
        })}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category ID
            </label>
            <Input
              value={formId}
              onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="e.g., hair_front"
              disabled={!!editingCategory}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in code. Lowercase, underscores only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <Input
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="e.g., Hair (Front)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Selections
              </label>
              <Input
                type="number"
                min={1}
                max={10}
                value={formMaxSelections}
                onChange={(e) => setFormMaxSelections(parseInt(e.target.value) || 1)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Palette
              </label>
              <select
                value={formDefaultPalette}
                onChange={(e) => setFormDefaultPalette(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {Object.keys(colorPalettes).sort((a, b) => a.localeCompare(b)).map((paletteId) => (
                  <option key={paletteId} value={paletteId}>
                    {paletteId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Prompt Addition for AI Generation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              AI Generation Prompt Rules
            </label>
            <textarea
              value={formPromptAddition}
              onChange={(e) => setFormPromptAddition(e.target.value)}
              placeholder="e.g., Always show the full hat shape. Include decorative details like ribbons or buttons. Use pastel colors for cute styles."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Custom rules passed to AI when generating components for this category.
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formIsRequired}
                onChange={(e) => setFormIsRequired(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Required (user must select one)
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formSupportsColorVariants}
                onChange={(e) => setFormSupportsColorVariants(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Supports color variants
              </span>
            </label>
          </div>

          {/* Render Position */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Render Position (on 512×512 canvas)
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  X Position
                </label>
                <Input
                  type="number"
                  min={0}
                  max={512}
                  value={formRenderX}
                  onChange={(e) => setFormRenderX(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Y Position
                </label>
                <Input
                  type="number"
                  min={0}
                  max={512}
                  value={formRenderY}
                  onChange={(e) => setFormRenderY(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Width
                </label>
                <Input
                  type="number"
                  min={1}
                  max={512}
                  value={formRenderWidth}
                  onChange={(e) => setFormRenderWidth(parseInt(e.target.value) || 512)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Height
                </label>
                <Input
                  type="number"
                  min={1}
                  max={512}
                  value={formRenderHeight}
                  onChange={(e) => setFormRenderHeight(parseInt(e.target.value) || 512)}
                />
              </div>
            </div>

            {/* Visual Preview */}
            <div className="mt-4">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
                Position Preview
              </label>
              <div className="relative w-32 h-32 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                <div
                  className="absolute bg-indigo-500/50 border border-indigo-500 rounded"
                  style={{
                    left: `${(formRenderX / 512) * 100}%`,
                    top: `${(formRenderY / 512) * 100}%`,
                    width: `${(formRenderWidth / 512) * 100}%`,
                    height: `${(formRenderHeight / 512) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formId || !formDisplayName}>
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        title="Delete Category"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="text-gray-900 dark:text-white font-medium">
              {deletingCategory?.displayName}
            </span>
            ?
          </p>
          <p className="text-sm text-red-500">
            This will also delete all components in this category!
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingCategory(null)}>
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
