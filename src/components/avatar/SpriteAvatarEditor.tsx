'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  RefreshCw,
  Save,
  RotateCcw,
  Check,
  Lock,
} from 'lucide-react';
import { AvatarCompositor, useAvatarCompositor } from './AvatarCompositor';
import type {
  AvatarCategory,
  AvatarComponent,
  AvatarColorPalette,
  UserAvatarConfig,
} from '@/types/avatar';

interface SpriteAvatarEditorProps {
  userId: string;
  initialConfig?: UserAvatarConfig | null;
  onSave?: (config: UserAvatarConfig, previewUrl: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}

interface ComponentLibraryData {
  categories: AvatarCategory[];
  components: AvatarComponent[];
  colorPalettes: AvatarColorPalette[];
  unlockedComponentIds: string[];
}

export function SpriteAvatarEditor({
  userId,
  initialConfig,
  onSave,
  onCancel,
  compact = false,
}: SpriteAvatarEditorProps) {
  const [libraryData, setLibraryData] = useState<ComponentLibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current config state
  const [selectedComponents, setSelectedComponents] = useState<Record<string, string[]>>({});
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});

  // UI state
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { generateAvatarDataUrl } = useAvatarCompositor();

  // Load library data
  useEffect(() => {
    async function loadLibrary() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/avatar/library');
        if (!response.ok) throw new Error('Failed to load avatar library');
        const data = await response.json();
        setLibraryData(data);

        // Set initial category
        if (data.categories.length > 0) {
          setActiveCategory(data.categories[0].id);
        }

        // Initialize config
        if (initialConfig) {
          setSelectedComponents(initialConfig.selectedComponents || {});
          setSelectedColors(initialConfig.selectedColors || {});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }
    loadLibrary();
  }, [initialConfig]);

  // Current config object
  const currentConfig: UserAvatarConfig | null = useMemo(() => {
    if (!libraryData) return null;
    return {
      userId,
      selectedComponents,
      selectedColors,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [userId, selectedComponents, selectedColors, libraryData]);

  // Get components for active category
  const categoryComponents = useMemo(() => {
    if (!libraryData || !activeCategory) return [];
    return libraryData.components.filter(
      (c) => c.categoryId === activeCategory && c.isActive
    );
  }, [libraryData, activeCategory]);

  // Check if component is unlocked
  const isUnlocked = useCallback(
    (componentId: string) => {
      if (!libraryData) return false;
      // If no unlock rules, all components are unlocked
      const component = libraryData.components.find((c) => c.id === componentId);
      if (!component) return false;
      // Check if in unlocked list or has no rules
      return libraryData.unlockedComponentIds.includes(componentId);
    },
    [libraryData]
  );

  // Handle component selection
  const handleSelectComponent = useCallback(
    (categoryId: string, componentId: string) => {
      if (!isUnlocked(componentId)) return;

      const category = libraryData?.categories.find((c) => c.id === categoryId);
      if (!category) return;

      setSelectedComponents((prev) => {
        const current = prev[categoryId] || [];
        const isSelected = current.includes(componentId);

        if (isSelected) {
          // Deselect (but keep at least one if required)
          if (category.isRequired && current.length === 1) return prev;
          return {
            ...prev,
            [categoryId]: current.filter((id) => id !== componentId),
          };
        } else {
          // Select
          if (category.maxSelections === 1) {
            return { ...prev, [categoryId]: [componentId] };
          } else if (current.length < category.maxSelections) {
            return { ...prev, [categoryId]: [...current, componentId] };
          }
          return prev;
        }
      });
    },
    [libraryData, isUnlocked]
  );

  // Handle color selection
  const handleSelectColor = useCallback((categoryId: string, color: string) => {
    setSelectedColors((prev) => ({
      ...prev,
      [categoryId]: color,
    }));
  }, []);

  // Reset to initial config
  const handleReset = useCallback(() => {
    if (initialConfig) {
      setSelectedComponents(initialConfig.selectedComponents || {});
      setSelectedColors(initialConfig.selectedColors || {});
    } else {
      setSelectedComponents({});
      setSelectedColors({});
    }
  }, [initialConfig]);

  // Save config
  const handleSave = async () => {
    if (!currentConfig || !libraryData) return;
    setIsSaving(true);

    try {
      // Generate preview image
      const previewUrl = await generateAvatarDataUrl(
        currentConfig,
        libraryData.categories,
        libraryData.components,
        256
      );

      // Save to server
      const response = await fetch('/api/avatar/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedComponents,
          selectedColors,
          previewUrl,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      onSave?.(currentConfig, previewUrl || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Get color palette for active category
  const activeCategoryPalette = useMemo(() => {
    if (!libraryData || !activeCategory) return null;
    const category = libraryData.categories.find((c) => c.id === activeCategory);
    if (!category?.supportsColorVariants || !category.defaultColorPalette) return null;
    return libraryData.colorPalettes.find((p) => p.id === category.defaultColorPalette);
  }, [libraryData, activeCategory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!libraryData || libraryData.categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No avatar components available</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-6'}`}>
      {/* Preview */}
      <div className="flex flex-col items-center gap-4">
        <AvatarCompositor
          config={currentConfig}
          categories={libraryData.categories}
          components={libraryData.components}
          size={compact ? 128 : 192}
          className="shadow-lg"
        />

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {libraryData.categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === category.id
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {category.displayName}
            {category.isRequired && (
              <span className="ml-1 text-xs opacity-75">*</span>
            )}
          </button>
        ))}
      </div>

      {/* Component Grid */}
      <Card className="p-4">
        {categoryComponents.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No components in this category
          </p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {categoryComponents.map((component) => {
              const isSelected = selectedComponents[activeCategory!]?.includes(component.id);
              const unlocked = isUnlocked(component.id);
              const selectedColor = selectedColors[activeCategory!];
              const imageUrl =
                selectedColor && component.colorVariants?.[selectedColor]
                  ? component.colorVariants[selectedColor]
                  : component.thumbnailUrl || component.imageUrl;

              return (
                <button
                  key={component.id}
                  onClick={() => handleSelectComponent(activeCategory!, component.id)}
                  disabled={!unlocked}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${!unlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <img
                    src={imageUrl}
                    alt={component.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Color Palette */}
        {activeCategoryPalette && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {activeCategoryPalette.displayName}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCategoryPalette.colors.map((color) => {
                const isSelected = selectedColors[activeCategory!] === color;
                return (
                  <button
                    key={color}
                    onClick={() => handleSelectColor(activeCategory!, color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-110'
                        : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Avatar
        </Button>
      </div>
    </div>
  );
}

// Compact avatar picker for quick selection
interface QuickSpriteAvatarPickerProps {
  userId: string;
  currentConfig?: UserAvatarConfig | null;
  onSelect?: (config: UserAvatarConfig) => void;
}

export function QuickSpriteAvatarPicker({
  userId,
  currentConfig,
  onSelect,
}: QuickSpriteAvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [libraryData, setLibraryData] = useState<ComponentLibraryData | null>(null);

  useEffect(() => {
    async function loadLibrary() {
      try {
        const response = await fetch('/api/avatar/library');
        if (response.ok) {
          const data = await response.json();
          setLibraryData(data);
        }
      } catch {
        // Silently fail
      }
    }
    loadLibrary();
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {libraryData ? (
          <AvatarCompositor
            config={currentConfig || null}
            categories={libraryData.categories}
            components={libraryData.components}
            size={48}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50">
          <SpriteAvatarEditor
            userId={userId}
            initialConfig={currentConfig}
            onSave={(config) => {
              onSelect?.(config);
              setIsOpen(false);
            }}
            onCancel={() => setIsOpen(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}
