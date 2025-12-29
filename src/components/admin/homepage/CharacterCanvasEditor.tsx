'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Undo2,
  Redo2,
  RotateCcw,
  Loader2,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetLibraryPanel } from '@/components/avatar/canvas/AssetLibraryPanel';
import { LayerPanel } from '@/components/avatar/canvas/LayerPanel';
import { TransformControls } from '@/components/avatar/canvas/TransformControls';
import { useCanvasState } from '@/components/avatar/canvas/hooks/useCanvasState';
import type {
  AvatarCategory,
  AvatarComponent,
  CanvasData,
  CanvasBackground,
} from '@/types/avatar';

// Dynamically import CanvasWorkspace to avoid SSR issues with Konva
const CanvasWorkspace = dynamic(
  () => import('@/components/avatar/canvas/CanvasWorkspace').then((mod) => mod.CanvasWorkspace),
  { ssr: false, loading: () => <CanvasPlaceholder /> }
);

function CanvasPlaceholder() {
  return (
    <div className="w-[400px] h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
    </div>
  );
}

interface CharacterCanvasEditorProps {
  initialCanvasData?: CanvasData;
  onChange: (canvasData: CanvasData) => void;
}

interface LibraryData {
  categories: AvatarCategory[];
  components: AvatarComponent[];
  colorPalettes: Record<string, string[]>;
}

const BACKGROUND_COLORS = [
  { label: 'Transparent', value: null },
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Grass', value: '#22c55e' },
  { label: 'Sand', value: '#d4a853' },
  { label: 'Sunset', value: '#f97316' },
  { label: 'Night', value: '#1e1b4b' },
];

export function CharacterCanvasEditor({ initialCanvasData, onChange }: CharacterCanvasEditorProps) {
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  // Canvas state management
  const {
    layers,
    sortedLayers,
    selectedLayerId,
    selectedLayer,
    background,
    canvasData,
    canUndo,
    canRedo,
    addLayer,
    removeLayer,
    selectLayer,
    updateTransform,
    reorderLayers,
    setColorVariant,
    setBackground,
    duplicateLayer,
    loadCanvas,
    resetCanvas,
    undo,
    redo,
  } = useCanvasState(initialCanvasData);

  // Create lookup maps for components and categories
  const componentsMap = useMemo(() => {
    if (!libraryData) return new Map<string, AvatarComponent>();
    return new Map(libraryData.components.map((c) => [c.id, c]));
  }, [libraryData]);

  const categoriesMap = useMemo(() => {
    if (!libraryData) return new Map<string, AvatarCategory>();
    return new Map(libraryData.categories.map((c) => [c.id, c]));
  }, [libraryData]);

  const colorPalettesRecord = useMemo(() => {
    if (!libraryData) return {};
    return libraryData.colorPalettes || {};
  }, [libraryData]);

  // All components are unlocked for admin
  const unlockedSet = useMemo(() => {
    if (!libraryData) return new Set<string>();
    return new Set(libraryData.components.map(c => c.id));
  }, [libraryData]);

  // Load library data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const libraryResponse = await fetch('/api/avatar/library');

        if (!libraryResponse.ok) {
          throw new Error('Failed to load avatar library');
        }

        const library = await libraryResponse.json();
        setLibraryData({
          categories: library.categories || [],
          components: library.components || [],
          colorPalettes: library.colorPalettes || {},
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Notify parent of canvas changes
  useEffect(() => {
    onChange(canvasData);
  }, [canvasData, onChange]);

  // Handle adding asset from library (from AssetLibraryPanel)
  const handleAddAssetFromLibrary = useCallback(
    (component: AvatarComponent, _category: AvatarCategory) => {
      addLayer(component);
    },
    [addLayer]
  );

  // Handle adding asset from canvas drop
  const handleAddAssetFromDrop = useCallback(
    (component: AvatarComponent, _category: AvatarCategory, _position: { x: number; y: number }) => {
      addLayer(component);
    },
    [addLayer]
  );

  // Handle background change
  const handleBackgroundChange = useCallback(
    (color: string | null) => {
      const newBackground: CanvasBackground = color
        ? { type: 'color', value: color }
        : { type: 'transparent', value: null };
      setBackground(newBackground);
      setShowBackgroundPicker(false);
    },
    [setBackground]
  );

  if (isLoading) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!libraryData) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
              title="Background Color"
            >
              <Palette className="w-4 h-4" />
            </Button>
            {showBackgroundPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                <div className="grid grid-cols-3 gap-1.5">
                  {BACKGROUND_COLORS.map((bg) => (
                    <button
                      key={bg.label}
                      onClick={() => handleBackgroundChange(bg.value)}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                        (background.value === bg.value) ||
                        (bg.value === null && background.type === 'transparent')
                          ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                      style={{
                        background: bg.value
                          ? bg.value
                          : 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px',
                      }}
                      title={bg.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCanvas}
            title="Reset Canvas"
            className="text-red-500 hover:text-red-400"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {layers.length} layer{layers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Asset Library */}
        <div className="w-56 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto max-h-[500px]">
          <AssetLibraryPanel
            categories={libraryData.categories}
            components={libraryData.components}
            unlockedComponentIds={unlockedSet}
            colorPalettes={colorPalettesRecord}
            onAddAsset={handleAddAssetFromLibrary}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
          <div
            className="rounded-lg overflow-hidden shadow-lg"
            style={{
              background:
                background.type === 'color'
                  ? background.value || '#ffffff'
                  : 'repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 50% / 16px 16px',
            }}
          >
            <CanvasWorkspace
              layers={sortedLayers}
              selectedLayerId={selectedLayerId}
              background={background}
              components={componentsMap}
              categories={categoriesMap}
              onSelectLayer={selectLayer}
              onUpdateTransform={updateTransform}
              onAddAsset={handleAddAssetFromDrop}
            />
          </div>
        </div>

        {/* Layer Panel */}
        <div className="w-56 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto max-h-[500px]">
          <LayerPanel
            layers={sortedLayers}
            selectedLayerId={selectedLayerId}
            componentsMap={componentsMap}
            colorPalettes={colorPalettesRecord}
            onSelectLayer={selectLayer}
            onRemoveLayer={removeLayer}
            onDuplicateLayer={duplicateLayer}
            onReorderLayers={reorderLayers}
            onSetColorVariant={setColorVariant}
          />
        </div>
      </div>

      {/* Transform Controls */}
      {selectedLayer && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <TransformControls
            layer={selectedLayer}
            component={componentsMap.get(selectedLayer.componentId)}
            onUpdateTransform={(transform) => updateTransform(selectedLayer.id, transform)}
          />
        </div>
      )}
    </div>
  );
}
