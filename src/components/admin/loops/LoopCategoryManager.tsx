'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminGet, adminPost, adminPatch, adminDelete } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import type { LoopCategoryInfo, LoopSubcategory } from '@/types/loops';
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Save,
} from 'lucide-react';

interface LoopCategoryManagerProps {
  categories: LoopCategoryInfo[];
  onRefresh: () => void;
}

const EMOJI_OPTIONS = ['🥁', '🎸', '🎹', '🎵', '🎤', '🎺', '🎻', '🎧', '🔊', '⚡', '✨', '🎶'];

export function LoopCategoryManager({ categories, onRefresh }: LoopCategoryManagerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)));
  const [editingCategory, setEditingCategory] = useState<LoopCategoryInfo | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{ categoryId: string; subcategory: LoopSubcategory | null } | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ type: 'category' | 'subcategory'; id: string; parentId?: string } | null>(null);

  // Category form state
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('🎵');

  // Subcategory form state
  const [subcategoryId, setSubcategoryId] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCategoryModal = (category?: LoopCategoryInfo) => {
    if (category) {
      setEditingCategory(category);
      setCategoryId(category.id);
      setCategoryName(category.name);
      setCategoryIcon(category.icon);
    } else {
      setEditingCategory(null);
      setCategoryId('');
      setCategoryName('');
      setCategoryIcon('🎵');
    }
    setShowCategoryModal(true);
  };

  const openSubcategoryModal = (categoryId: string, subcategory?: LoopSubcategory) => {
    if (subcategory) {
      setEditingSubcategory({ categoryId, subcategory });
      setSubcategoryId(subcategory.id);
      setSubcategoryName(subcategory.name);
    } else {
      setEditingSubcategory({ categoryId, subcategory: null });
      setSubcategoryId('');
      setSubcategoryName('');
    }
    setShowSubcategoryModal(true);
  };

  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await adminPatch(`/api/admin/loops/categories?id=${editingCategory.id}`, {
          name: categoryName,
          icon: categoryIcon,
        });
      } else {
        const id = categoryId || categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        await adminPost('/api/admin/loops/categories', {
          id,
          name: categoryName,
          icon: categoryIcon,
        });
      }
      setShowCategoryModal(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  };

  const handleSaveSubcategory = async () => {
    if (!editingSubcategory) return;

    try {
      if (editingSubcategory.subcategory) {
        await adminPatch(`/api/admin/loops/subcategories?id=${editingSubcategory.subcategory.id}`, {
          name: subcategoryName,
        });
      } else {
        const id = subcategoryId || subcategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        await adminPost('/api/admin/loops/subcategories', {
          id,
          category_id: editingSubcategory.categoryId,
          name: subcategoryName,
        });
      }
      setShowSubcategoryModal(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to save subcategory:', error);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;

    try {
      if (showDeleteModal.type === 'category') {
        await adminDelete(`/api/admin/loops/categories?id=${showDeleteModal.id}`);
      } else {
        await adminDelete(`/api/admin/loops/subcategories?id=${showDeleteModal.id}`);
      }
      setShowDeleteModal(null);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Loop Categories
        </h3>
        <Button onClick={() => openCategoryModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Category List */}
      <div className="space-y-4">
        {categories.map((category, catIndex) => (
          <Card key={category.id} className="overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex items-center gap-3"
              >
                {expandedCategories.has(category.id) ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <span className="text-2xl">{category.icon}</span>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{category.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {category.subcategories.length} subcategories
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openCategoryModal(category)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteModal({ type: 'category', id: category.id })}
                  className="text-red-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {expandedCategories.has(category.id) && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {category.subcategories.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No subcategories
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {category.subcategories.map((sub, subIndex) => (
                      <li key={sub.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <div className="flex items-center gap-3 pl-8">
                          <GripVertical className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{sub.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {sub.loopCount} loops
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSubcategoryModal(category.id, sub)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteModal({ type: 'subcategory', id: sub.id, parentId: category.id })}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSubcategoryModal(category.id)}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Subcategory
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category ID
            </label>
            <Input
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="e.g., drums, bass, keys"
              disabled={!!editingCategory}
            />
            <p className="text-xs text-gray-500 mt-1">
              {editingCategory ? 'ID cannot be changed' : 'Leave blank to auto-generate from name'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Category name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setCategoryIcon(emoji)}
                  className={`text-2xl p-2 rounded-lg border-2 transition-colors ${
                    categoryIcon === emoji
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={!categoryName.trim()}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Subcategory Modal */}
      <Modal
        isOpen={showSubcategoryModal}
        onClose={() => setShowSubcategoryModal(false)}
        title={editingSubcategory?.subcategory ? 'Edit Subcategory' : 'Add Subcategory'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subcategory ID
            </label>
            <Input
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              placeholder="e.g., rock-drums, synth-bass"
              disabled={!!editingSubcategory?.subcategory}
            />
            <p className="text-xs text-gray-500 mt-1">
              {editingSubcategory?.subcategory ? 'ID cannot be changed' : 'Leave blank to auto-generate from name'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <Input
              value={subcategoryName}
              onChange={(e) => setSubcategoryName(e.target.value)}
              placeholder="Subcategory name..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowSubcategoryModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubcategory} disabled={!subcategoryName.trim()}>
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
        title={`Delete ${showDeleteModal?.type === 'category' ? 'Category' : 'Subcategory'}`}
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this {showDeleteModal?.type}?
            {showDeleteModal?.type === 'category' && ' All subcategories will also be deleted.'}
            This action cannot be undone.
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
