'use client';

import { useState, useMemo } from 'react';
import { Search, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import type { AvatarCategory, AvatarComponent } from '@/types/avatar';

interface AssetLibraryPanelProps {
  categories: AvatarCategory[];
  components: AvatarComponent[];
  unlockedComponentIds: Set<string>;
  colorPalettes: Record<string, string[]>;
  onAddAsset: (component: AvatarComponent, category: AvatarCategory) => void;
}

export function AssetLibraryPanel({
  categories,
  components,
  unlockedComponentIds,
  colorPalettes,
  onAddAsset,
}: AssetLibraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );

  // Filter components by search
  const filteredComponents = useMemo(() => {
    if (!searchQuery.trim()) return components;

    const query = searchQuery.toLowerCase();
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.tags?.some((t) => t.toLowerCase().includes(query))
    );
  }, [components, searchQuery]);

  // Group components by category
  const componentsByCategory = useMemo(() => {
    const grouped: Record<string, AvatarComponent[]> = {};
    for (const component of filteredComponents) {
      if (!grouped[component.categoryId]) {
        grouped[component.categoryId] = [];
      }
      grouped[component.categoryId].push(component);
    }
    return grouped;
  }, [filteredComponents]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDragStart = (
    e: React.DragEvent,
    component: AvatarComponent,
    category: AvatarCategory
  ) => {
    if (!unlockedComponentIds.has(component.id)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ componentId: component.id, categoryId: category.id })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Assets
        </h3>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {categories
          .filter((category) => componentsByCategory[category.id]?.length > 0)
          .map((category) => {
            const categoryComponents = componentsByCategory[category.id] || [];
            const isExpanded = expandedCategories.has(category.id);

            return (
              <div key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {category.displayName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {categoryComponents.length}
                  </span>
                </button>

                {/* Category Components */}
                {isExpanded && (
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {categoryComponents.map((component) => {
                      const isUnlocked = unlockedComponentIds.has(component.id);
                      return (
                        <button
                          key={component.id}
                          onClick={() => isUnlocked && onAddAsset(component, category)}
                          draggable={isUnlocked}
                          onDragStart={(e) => handleDragStart(e, component, category)}
                          disabled={!isUnlocked}
                          className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                            isUnlocked
                              ? 'border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:shadow-md cursor-pointer'
                              : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                          }`}
                          title={component.name}
                        >
                          <img
                            src={component.thumbnailUrl || component.imageUrl}
                            alt={component.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            draggable={false}
                          />
                          {!isUnlocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <Lock className="w-4 h-4 text-white" />
                            </div>
                          )}
                          {/* Rarity indicator */}
                          {component.rarity !== 'common' && (
                            <div
                              className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
                                component.rarity === 'legendary'
                                  ? 'bg-yellow-400'
                                  : component.rarity === 'epic'
                                  ? 'bg-purple-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {filteredComponents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No assets found
          </div>
        )}
      </div>
    </div>
  );
}
