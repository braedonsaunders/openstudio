'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminGet, adminPost, adminPatch, adminDelete } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { LoopEditor } from './LoopEditor';
import type { LoopDefinition, LoopCategoryInfo } from '@/types/loops';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Copy,
  Trash2,
  Play,
  Square,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface LoopLibraryProps {
  categories: LoopCategoryInfo[];
  onRefresh: () => void;
}

interface LoopWithMeta extends LoopDefinition {
  is_active?: boolean;
}

export function LoopLibrary({ categories, onRefresh }: LoopLibraryProps) {
  const [loops, setLoops] = useState<LoopWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedLoop, setSelectedLoop] = useState<LoopWithMeta | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loopToDelete, setLoopToDelete] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);

  const loadLoops = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (!showInactive) params.set('active', 'true');

      const res = await adminGet(`/api/admin/loops?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLoops(data);
      }
    } catch (error) {
      console.error('Failed to load loops:', error);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, showInactive]);

  useEffect(() => {
    loadLoops();
  }, [loadLoops]);

  const handleCreate = () => {
    setSelectedLoop(null);
    setShowEditor(true);
  };

  const handleEdit = (loop: LoopWithMeta) => {
    setSelectedLoop(loop);
    setShowEditor(true);
  };

  const handleDuplicate = async (loopId: string) => {
    try {
      const newId = `${loopId}-copy-${Date.now()}`;
      const res = await adminPost(`/api/admin/loops?action=duplicate&id=${loopId}&newId=${newId}`, {});
      if (res.ok) {
        loadLoops();
      }
    } catch (error) {
      console.error('Failed to duplicate loop:', error);
    }
  };

  const handleDelete = async () => {
    if (!loopToDelete) return;
    try {
      const res = await adminDelete(`/api/admin/loops?id=${loopToDelete}`);
      if (res.ok) {
        loadLoops();
        setShowDeleteModal(false);
        setLoopToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete loop:', error);
    }
  };

  const handleToggleActive = async (loop: LoopWithMeta) => {
    try {
      const res = await adminPatch(`/api/admin/loops?id=${loop.id}`, {
        is_active: !loop.is_active,
      });
      if (res.ok) {
        loadLoops();
      }
    } catch (error) {
      console.error('Failed to toggle loop active state:', error);
    }
  };

  const handleSave = async (loopData: Partial<LoopWithMeta>) => {
    try {
      if (selectedLoop) {
        // Update existing
        const res = await adminPatch(`/api/admin/loops?id=${selectedLoop.id}`, {
          name: loopData.name,
          category_id: loopData.category,
          subcategory_id: loopData.subcategory || null,
          bpm: loopData.bpm,
          bars: loopData.bars,
          time_signature: loopData.timeSignature,
          key: loopData.key || null,
          midi_data: loopData.midiData,
          sound_preset: loopData.soundPreset,
          tags: loopData.tags,
          intensity: loopData.intensity,
          complexity: loopData.complexity,
        });
        if (res.ok) {
          loadLoops();
          setShowEditor(false);
        }
      } else {
        // Create new
        const id = loopData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `loop-${Date.now()}`;
        const res = await adminPost('/api/admin/loops', {
          id,
          name: loopData.name,
          category_id: loopData.category,
          subcategory_id: loopData.subcategory || null,
          bpm: loopData.bpm || 120,
          bars: loopData.bars || 1,
          time_signature: loopData.timeSignature || [4, 4],
          key: loopData.key || null,
          midi_data: loopData.midiData || [],
          sound_preset: loopData.soundPreset || 'drums/acoustic-kit',
          tags: loopData.tags || [],
          intensity: loopData.intensity || 3,
          complexity: loopData.complexity || 2,
        });
        if (res.ok) {
          loadLoops();
          setShowEditor(false);
          onRefresh();
        }
      }
    } catch (error) {
      console.error('Failed to save loop:', error);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Filter loops
  const filteredLoops = loops.filter(loop => {
    if (search) {
      const q = search.toLowerCase();
      return (
        loop.name.toLowerCase().includes(q) ||
        loop.tags.some(t => t.toLowerCase().includes(q)) ||
        loop.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by category
  const loopsByCategory = new Map<string, LoopWithMeta[]>();
  filteredLoops.forEach(loop => {
    const cat = loop.category;
    if (!loopsByCategory.has(cat)) {
      loopsByCategory.set(cat, []);
    }
    loopsByCategory.get(cat)!.push(loop);
  });

  const intensityStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Loop Library ({filteredLoops.length})
          </h3>
          <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show inactive
          </label>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search loops..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={loadLoops}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Loop
          </Button>
        </div>
      </div>

      {/* Loop List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : filteredLoops.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No loops found</p>
          <Button onClick={handleCreate} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Create First Loop
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.filter(cat => loopsByCategory.has(cat.id)).map(category => (
            <Card key={category.id} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-xl">{category.icon}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({loopsByCategory.get(category.id)?.length || 0} loops)
                  </span>
                </div>
              </button>

              {expandedCategories.has(category.id) && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subcategory</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">BPM</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Intensity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {loopsByCategory.get(category.id)?.map(loop => (
                        <tr key={loop.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{loop.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{loop.id}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {loop.subcategory || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {loop.bpm}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {loop.key || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-yellow-500 text-sm" title={`Intensity: ${loop.intensity}/5`}>
                              {intensityStars(loop.intensity)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              loop.is_active !== false
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-gray-500/20 text-gray-500'
                            }`}>
                              {loop.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(loop)}
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicate(loop.id)}
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(loop)}
                                title={loop.is_active !== false ? 'Deactivate' : 'Activate'}
                              >
                                {loop.is_active !== false ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setLoopToDelete(loop.id);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-500 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditor && (
        <LoopEditor
          loop={selectedLoop}
          categories={categories}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setLoopToDelete(null);
        }}
        title="Delete Loop"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this loop? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
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
