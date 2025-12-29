'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminGet, adminPost, adminPatch, adminDelete } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { InstrumentEditor } from './InstrumentEditor';
import type { InstrumentDefinition, InstrumentCategory } from '@/lib/audio/instrument-registry';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface InstrumentLibraryProps {
  categories: InstrumentCategory[];
  onRefresh: () => void;
}

interface InstrumentWithMeta extends InstrumentDefinition {
  is_active?: boolean;
}

export function InstrumentLibrary({ categories, onRefresh }: InstrumentLibraryProps) {
  const [instruments, setInstruments] = useState<InstrumentWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentWithMeta | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instrumentToDelete, setInstrumentToDelete] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const loadInstruments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (!showInactive) params.set('active', 'true');

      const res = await adminGet(`/api/admin/instruments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInstruments(data);
      }
    } catch (error) {
      console.error('Failed to load instruments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, typeFilter, showInactive]);

  useEffect(() => {
    loadInstruments();
  }, [loadInstruments]);

  const handleCreate = () => {
    setSelectedInstrument(null);
    setShowEditor(true);
  };

  const handleEdit = (instrument: InstrumentWithMeta) => {
    setSelectedInstrument(instrument);
    setShowEditor(true);
  };

  const handleDuplicate = async (instrumentId: string) => {
    try {
      const newId = `${instrumentId}-copy-${Date.now()}`;
      const res = await adminPost(`/api/admin/instruments?action=duplicate&id=${instrumentId}&newId=${newId}`, {});
      if (res.ok) {
        // Get the duplicated instrument from response and add to state
        const duplicatedInstrument = await res.json();
        setInstruments(prev => [...prev, duplicatedInstrument]);
      }
    } catch (error) {
      console.error('Failed to duplicate instrument:', error);
    }
  };

  const handleDelete = async () => {
    if (!instrumentToDelete) return;
    try {
      const res = await adminDelete(`/api/admin/instruments?id=${instrumentToDelete}`);
      if (res.ok) {
        // Update local state instead of reloading
        setInstruments(prev => prev.filter(i => i.id !== instrumentToDelete));
        setShowDeleteModal(false);
        setInstrumentToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete instrument:', error);
    }
  };

  const handleToggleActive = async (instrument: InstrumentWithMeta) => {
    try {
      const res = await adminPatch(`/api/admin/instruments?id=${instrument.id}`, {
        is_active: !instrument.is_active,
      });
      if (res.ok) {
        // Update local state instead of reloading
        setInstruments(prev => prev.map(i =>
          i.id === instrument.id ? { ...i, is_active: !i.is_active } : i
        ));
      }
    } catch (error) {
      console.error('Failed to toggle instrument active state:', error);
    }
  };

  const handleSave = async (instrumentData: Partial<InstrumentWithMeta>) => {
    try {
      if (selectedInstrument) {
        // Update existing
        const res = await adminPatch(`/api/admin/instruments?id=${selectedInstrument.id}`, {
          name: instrumentData.name,
          category_id: instrumentData.category,
          type: instrumentData.type,
          icon: instrumentData.icon,
          description: instrumentData.description,
          tags: instrumentData.tags,
          layout: instrumentData.layout,
          note_range_min: instrumentData.noteRange?.min,
          note_range_max: instrumentData.noteRange?.max,
          synth_config: instrumentData.synthConfig,
          drum_map: instrumentData.drumMap,
        });
        if (res.ok) {
          // Update local state instead of reloading
          setInstruments(prev => prev.map(i =>
            i.id === selectedInstrument.id ? {
              ...i,
              name: instrumentData.name || i.name,
              category: instrumentData.category || i.category,
              type: instrumentData.type || i.type,
              icon: instrumentData.icon || i.icon,
              description: instrumentData.description || i.description,
              tags: instrumentData.tags || i.tags,
              layout: instrumentData.layout || i.layout,
              noteRange: instrumentData.noteRange || i.noteRange,
              synthConfig: instrumentData.synthConfig || i.synthConfig,
              drumMap: instrumentData.drumMap || i.drumMap,
            } : i
          ));
          setShowEditor(false);
        }
      } else {
        // Create new
        const id = instrumentData.category + '/' + (instrumentData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `inst-${Date.now()}`);
        const res = await adminPost('/api/admin/instruments', {
          id,
          name: instrumentData.name,
          category_id: instrumentData.category,
          type: instrumentData.type || 'synth',
          icon: instrumentData.icon || '🎵',
          description: instrumentData.description,
          tags: instrumentData.tags || [],
          layout: instrumentData.layout || 'piano',
          note_range_min: instrumentData.noteRange?.min || 36,
          note_range_max: instrumentData.noteRange?.max || 84,
          synth_config: instrumentData.synthConfig,
          drum_map: instrumentData.drumMap,
        });
        if (res.ok) {
          // Add to local state instead of reloading
          const newInstrument = await res.json();
          setInstruments(prev => [...prev, newInstrument]);
          setShowEditor(false);
        }
      }
    } catch (error) {
      console.error('Failed to save instrument:', error);
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

  // Filter instruments
  const filteredInstruments = instruments.filter(inst => {
    if (search) {
      const q = search.toLowerCase();
      return (
        inst.name.toLowerCase().includes(q) ||
        inst.tags.some(t => t.toLowerCase().includes(q)) ||
        inst.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by category
  const instrumentsByCategory = new Map<string, InstrumentWithMeta[]>();
  filteredInstruments.forEach(inst => {
    const cat = inst.category;
    if (!instrumentsByCategory.has(cat)) {
      instrumentsByCategory.set(cat, []);
    }
    instrumentsByCategory.get(cat)!.push(inst);
  });

  const typeLabel = (type: string) => {
    switch (type) {
      case 'synth': return 'Synth';
      case 'drums': return 'Drums';
      case 'sampler': return 'Sampler';
      default: return type;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Instrument Library ({filteredInstruments.length})
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
              placeholder="Search instruments..."
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">All Types</option>
            <option value="synth">Synth</option>
            <option value="drums">Drums</option>
            <option value="sampler">Sampler</option>
          </select>
          <Button variant="ghost" size="sm" onClick={loadInstruments}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Instrument
          </Button>
        </div>
      </div>

      {/* Instrument List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : filteredInstruments.length === 0 ? (
        <Card className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No instruments found</p>
          <Button onClick={handleCreate} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Create First Instrument
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.filter(cat => instrumentsByCategory.has(cat.id)).map(category => (
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
                    ({instrumentsByCategory.get(category.id)?.length || 0} instruments)
                  </span>
                </div>
              </button>

              {expandedCategories.has(category.id) && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Layout</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Note Range</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {instrumentsByCategory.get(category.id)?.map(inst => (
                        <tr key={inst.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{inst.icon}</span>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{inst.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{inst.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              inst.type === 'synth' ? 'bg-purple-500/20 text-purple-500' :
                              inst.type === 'drums' ? 'bg-orange-500/20 text-orange-500' :
                              'bg-blue-500/20 text-blue-500'
                            }`}>
                              {typeLabel(inst.type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {inst.layout}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {inst.noteRange ? `${inst.noteRange.min} - ${inst.noteRange.max}` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              inst.is_active !== false
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-gray-500/20 text-gray-500'
                            }`}>
                              {inst.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(inst)}
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicate(inst.id)}
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(inst)}
                                title={inst.is_active !== false ? 'Deactivate' : 'Activate'}
                              >
                                {inst.is_active !== false ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setInstrumentToDelete(inst.id);
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
        <InstrumentEditor
          instrument={selectedInstrument}
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
          setInstrumentToDelete(null);
        }}
        title="Delete Instrument"
      >
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this instrument? This action cannot be undone.
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
