'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Undo2,
  Redo2,
  Save,
  RotateCcw,
  Loader2,
  Check,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetLibraryPanel } from './AssetLibraryPanel';
import { LayerPanel } from './LayerPanel';
import { TransformControls } from './TransformControls';
import { useCanvasState } from './hooks/useCanvasState';
import { useCanvasExport } from './hooks/useCanvasExport';
import { supabaseAuth } from '@/lib/supabase/auth';
import type {
  AvatarCategory,
  AvatarComponent,
  CanvasData,
  CanvasBackground,
} from '@/types/avatar';

// Helper to get auth headers for API calls
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (session?.access_token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  }
  return { 'Content-Type': 'application/json' };
}

// Dynamically import CanvasWorkspace to avoid SSR issues with Konva
const CanvasWorkspace = dynamic(
  () => import('./CanvasWorkspace').then((mod) => mod.CanvasWorkspace),
  { ssr: false, loading: () => <CanvasPlaceholder /> }
);

function CanvasPlaceholder() {
  return (
    <div className="w-[512px] h-[512px] bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
    </div>
  );
}

interface AvatarCanvasEditorProps {
  userId: string;
  onSave?: (fullBodyUrl: string, headshotUrl: string) => void;
}

interface LibraryData {
  categories: AvatarCategory[];
  components: AvatarComponent[];
  colorPalettes: Record<string, string[]>; // API returns Record, not array
  unlockedComponentIds: string[];
}

export function AvatarCanvasEditor({ userId, onSave }: AvatarCanvasEditorProps) {
  const [libraryData, setLibraryData] = useState<LibraryData | null>(null);
  const [initialCanvasData, setInitialCanvasData] = useState<CanvasData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);

  // Canvas export - use stageRef from export hook directly
  const { stageRef, exportFromStage } = useCanvasExport();

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
  } = useCanvasState(initialCanvasData || undefined);

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
    // colorPalettes is already a Record<string, string[]> from the API
    return libraryData.colorPalettes || {};
  }, [libraryData]);

  const unlockedSet = useMemo(() => {
    if (!libraryData) return new Set<string>();
    return new Set(libraryData.unlockedComponentIds);
  }, [libraryData]);

  // Load library and existing canvas data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load library first (required)
        const libraryResponse = await fetch('/api/avatar/library');

        if (!libraryResponse.ok) {
          throw new Error('Failed to load avatar library');
        }

        const library = await libraryResponse.json();
        console.log('[AvatarCanvasEditor] Library loaded:', {
          categories: library.categories?.length,
          components: library.components?.length,
          componentUnlocks: library.componentUnlocks?.length,
          unlockRules: library.unlockRules?.length,
        });

        // Evaluate unlocks using library data (components without rules are unlocked by default)
        // Build a set of component IDs that have unlock rules
        const componentUnlocks = library.componentUnlocks || [];
        const lockedComponentIds = new Set<string>();

        for (const unlock of componentUnlocks) {
          // Only add to locked if there's an actual unlock rule attached
          if (unlock.componentId && unlock.unlockRuleId) {
            lockedComponentIds.add(unlock.componentId);
          }
        }

        // All components without rules are unlocked by default
        const unlockedComponentIds: string[] = (library.components || [])
          .filter((c: { id: string; isActive: boolean }) => c.isActive && !lockedComponentIds.has(c.id))
          .map((c: { id: string }) => c.id);

        console.log('[AvatarCanvasEditor] Evaluated unlocks:', {
          total: library.components?.length || 0,
          locked: lockedComponentIds.size,
          unlocked: unlockedComponentIds.length,
        });

        // Merge library data with unlocked components
        setLibraryData({
          ...library,
          unlockedComponentIds,
        });

        // Try to load existing canvas data (optional - may not exist yet)
        try {
          const headers = await getAuthHeaders();
          const canvasResponse = await fetch('/api/avatar/canvas', { headers });
          if (canvasResponse.ok) {
            const canvasResult = await canvasResponse.json();
            if (canvasResult.canvasData) {
              setInitialCanvasData(canvasResult.canvasData);
              loadCanvas(canvasResult.canvasData);
            }
          }
          // Ignore 401/404 - user just doesn't have canvas data yet
        } catch {
          // Canvas load failed, continue without it
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [loadCanvas]);

  // Handle adding asset from library
  const handleAddAsset = useCallback(
    (component: AvatarComponent, category: AvatarCategory, position?: { x: number; y: number }) => {
      addLayer(component, category, position);
    },
    [addLayer]
  );

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Use Konva's native export - it handles all transforms correctly
      const exported = await exportFromStage();

      if (!exported) {
        throw new Error('Failed to generate avatar images');
      }

      // Save to server with auth
      const headers = await getAuthHeaders();
      const response = await fetch('/api/avatar/canvas', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          canvasData,
          fullBodyImage: exported.fullBodyDataUrl,
          headshotImage: exported.headshotDataUrl,
          thumbnails: exported.thumbnails,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Please log in to save your avatar');
        }
        throw new Error(errorData.error || 'Failed to save avatar');
      }

      const result = await response.json();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      onSave?.(result.fullBodyUrl, result.headshotUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle background change
  const handleSetBackground = (bg: CanvasBackground) => {
    setBackground(bg);
    setShowBackgroundPicker(false);
  };

  // Background color options
  const backgroundColors = [
    { value: null, label: 'Transparent', type: 'transparent' as const },
    { value: '#ffffff', label: 'White', type: 'color' as const },
    { value: '#f3f4f6', label: 'Light Gray', type: 'color' as const },
    { value: '#1f2937', label: 'Dark Gray', type: 'color' as const },
    { value: '#000000', label: 'Black', type: 'color' as const },
    { value: '#fef3c7', label: 'Warm', type: 'color' as const },
    { value: '#dbeafe', label: 'Cool', type: 'color' as const },
    { value: '#dcfce7', label: 'Mint', type: 'color' as const },
    { value: '#fce7f3', label: 'Pink', type: 'color' as const },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error && !libraryData) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!libraryData) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <p className="text-gray-500">No avatar assets available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
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
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
              title="Background"
            >
              <Palette className="w-4 h-4 mr-1" />
              Background
            </Button>
            {showBackgroundPicker && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="grid grid-cols-3 gap-2">
                  {backgroundColors.map((bg) => (
                    <button
                      key={bg.value || 'transparent'}
                      onClick={() =>
                        handleSetBackground({
                          type: bg.type,
                          value: bg.value,
                        })
                      }
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        (background.type === bg.type && background.value === bg.value)
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                      style={{
                        backgroundColor: bg.value || 'transparent',
                        backgroundImage: !bg.value
                          ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                          : undefined,
                        backgroundSize: !bg.value ? '8px 8px' : undefined,
                        backgroundPosition: !bg.value ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
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
            title="Clear canvas"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>

        <Button onClick={handleSave} disabled={isSaving || layers.length === 0}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saveSuccess ? 'Saved!' : 'Save Avatar'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Main Editor Layout */}
      <div className="flex flex-col lg:flex-row gap-4 w-full">
        {/* Asset Library */}
        <div className="w-full lg:w-80 lg:flex-1 lg:max-w-sm h-[300px] lg:h-[520px] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <AssetLibraryPanel
            categories={libraryData.categories}
            components={libraryData.components}
            unlockedComponentIds={unlockedSet}
            colorPalettes={colorPalettesRecord}
            onAddAsset={(component, category) => handleAddAsset(component, category)}
          />
        </div>

        {/* Canvas */}
        <div className="flex-shrink-0 flex justify-center">
          <CanvasWorkspace
            layers={sortedLayers}
            selectedLayerId={selectedLayerId}
            background={background}
            components={componentsMap}
            categories={categoriesMap}
            onSelectLayer={selectLayer}
            onUpdateTransform={updateTransform}
            onAddAsset={handleAddAsset}
            stageRef={stageRef}
          />
        </div>

        {/* Right Panel: Layers + Transform */}
        <div className="w-full lg:w-80 lg:flex-1 lg:max-w-sm flex flex-col h-[400px] lg:h-[520px] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex-1 overflow-hidden">
            <LayerPanel
              layers={layers}
              selectedLayerId={selectedLayerId}
              components={componentsMap}
              categories={categoriesMap}
              colorPalettes={colorPalettesRecord}
              onSelectLayer={selectLayer}
              onRemoveLayer={removeLayer}
              onDuplicateLayer={duplicateLayer}
              onReorderLayers={reorderLayers}
              onSetColorVariant={setColorVariant}
              onUpdateTransform={updateTransform}
            />
          </div>
          <TransformControls
            selectedLayer={selectedLayer}
            onUpdateTransform={updateTransform}
            onRemoveLayer={removeLayer}
            onDuplicateLayer={duplicateLayer}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>
          <strong>Tip:</strong> Click an asset to add it, or drag and drop onto the canvas.
          Drag corners to resize, use the top handle to rotate.
        </p>
      </div>
    </div>
  );
}
