'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Settings2,
  Eraser,
  Undo2,
  Paintbrush,
  Check,
  Palette,
  ToggleLeft,
  ToggleRight,
  Layers,
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

type BackgroundType = 'checkerboard' | 'black' | 'white' | 'gray' | 'magenta';

const backgroundStyles: Record<BackgroundType, React.CSSProperties> = {
  checkerboard: {
    backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  },
  black: { backgroundColor: '#000' },
  white: { backgroundColor: '#fff' },
  gray: { backgroundColor: '#808080' },
  magenta: { backgroundColor: '#ff00ff' },
};

type EditTab = 'info' | 'image';

export function ComponentLibrary({ categories, unlockRules, onRefresh }: ComponentLibraryProps) {
  const [components, setComponents] = useState<AvatarComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterRarity, setFilterRarity] = useState<ComponentRarity | ''>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'category' | 'model'>('category');
  const [showInactive, setShowInactive] = useState(false);

  // Edit modal
  const [editingComponent, setEditingComponent] = useState<AvatarComponent | null>(null);
  const [editTab, setEditTab] = useState<EditTab>('info');
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRarity, setEditRarity] = useState<ComponentRarity>('common');
  const [editRuleIds, setEditRuleIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Image editor state
  const [bgThreshold, setBgThreshold] = useState(220);
  const [specThreshold, setSpecThreshold] = useState(100);
  const [cleanupSpecs, setCleanupSpecs] = useState(true);
  const [feathering, setFeathering] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [bgType, setBgType] = useState<BackgroundType>('checkerboard');

  // Advanced background removal options
  const [bgColor, setBgColor] = useState({ r: 255, g: 255, b: 255 });
  const [colorTolerance, setColorTolerance] = useState(30);
  const [useFloodFill, setUseFloodFill] = useState(true);
  const [removeBackground, setRemoveBackground] = useState(true);

  // Eraser state
  const [isErasing, setIsErasing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [eraserMask, setEraserMask] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [pendingEraserMask, setPendingEraserMask] = useState(false);

  // Delete modal
  const [deletingComponent, setDeletingComponent] = useState<AvatarComponent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce timer for real-time preview
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Get unique models for filter dropdown
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    for (const comp of components) {
      if (comp.generationModel) {
        models.add(comp.generationModel);
      }
    }
    return Array.from(models).sort();
  }, [components]);

  const filteredComponents = useMemo(() => {
    return components.filter((comp) => {
      if (!showInactive && !comp.isActive) return false;
      if (filterCategory && comp.categoryId !== filterCategory) return false;
      if (filterRarity && comp.rarity !== filterRarity) return false;
      if (filterModel && comp.generationModel !== filterModel) return false;
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
  }, [components, search, filterCategory, filterRarity, filterModel, showInactive]);

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

  const componentsByModel = useMemo(() => {
    const grouped: Record<string, AvatarComponent[]> = {};
    for (const comp of filteredComponents) {
      const model = comp.generationModel || 'Unknown';
      if (!grouped[model]) {
        grouped[model] = [];
      }
      grouped[model].push(comp);
    }
    return grouped;
  }, [filteredComponents]);

  const handleEdit = (component: AvatarComponent) => {
    setEditingComponent(component);
    setEditTab('info');
    setEditId(component.id);
    setEditName(component.name);
    setEditTags(component.tags.join(', '));
    setEditRarity(component.rarity);
    setEditRuleIds([]);
    // Reset image editor state
    setBgThreshold(220);
    setSpecThreshold(100);
    setCleanupSpecs(true);
    setFeathering(0);
    setPreviewImage(null);
    setEraserMask(null);
    setIsErasing(false);
    setCanvasReady(false);
    setBgColor({ r: 255, g: 255, b: 255 });
    setColorTolerance(30);
    setUseFloodFill(true);
    setRemoveBackground(true);
    setPendingEraserMask(false);
  };

  const handleCloseEdit = () => {
    setEditingComponent(null);
    setPreviewImage(null);
    setEraserMask(null);
    setIsErasing(false);
    setCanvasReady(false);
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
        // Update local state instead of reloading all data
        setComponents(prev => prev.map(c =>
          c.id === editingComponent.id ? {
            ...c,
            id: newId !== editingComponent.id ? newId : c.id,
            name: editName,
            tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
            rarity: editRarity,
          } : c
        ));
        handleCloseEdit();
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
        // Update local state instead of reloading all data
        setComponents(prev => prev.map(c =>
          c.id === component.id ? { ...c, isActive: !c.isActive } : c
        ));
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
        // Update local state instead of reloading all data
        setComponents(prev => prev.filter(c => c.id !== deletingComponent.id));
        setDeletingComponent(null);
        toast.success('Component deleted');
      }
    } catch (error) {
      console.error('Failed to delete component:', error);
      toast.error('Failed to delete component');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle image processing preview
  const handlePreviewProcessing = useCallback(async () => {
    if (!editingComponent) return;
    setIsProcessing(true);
    setPendingEraserMask(false);

    try {
      const response = await adminPost('/api/admin/avatar/reprocess', {
        componentId: editingComponent.id,
        removeBackground,
        backgroundThreshold: bgThreshold,
        specSizeThreshold: specThreshold,
        cleanupSpecs,
        feathering,
        eraserMask,
        bgColor,
        colorTolerance,
        useFloodFill,
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
  }, [editingComponent, removeBackground, bgThreshold, specThreshold, cleanupSpecs, feathering, eraserMask, bgColor, colorTolerance, useFloodFill]);

  // Real-time preview with debouncing
  const triggerPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = setTimeout(() => {
      handlePreviewProcessing();
    }, 500);
  }, [handlePreviewProcessing]);

  // Auto-preview when settings change
  useEffect(() => {
    if (editTab === 'image' && editingComponent && !isErasing) {
      triggerPreview();
    }
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [bgThreshold, specThreshold, cleanupSpecs, feathering, editTab, editingComponent, triggerPreview, removeBackground, bgColor, colorTolerance, useFloodFill, isErasing]);

  // Apply eraser mask when user clicks apply
  const applyEraserMask = useCallback(() => {
    if (eraserMask && !isProcessing) {
      setIsErasing(false);
      triggerPreview();
    }
  }, [eraserMask, isProcessing, triggerPreview]);

  const handleSaveProcessedImage = async () => {
    if (!editingComponent) return;
    setIsSavingImage(true);

    try {
      const response = await adminPost('/api/admin/avatar/reprocess', {
        componentId: editingComponent.id,
        removeBackground,
        backgroundThreshold: bgThreshold,
        specSizeThreshold: specThreshold,
        cleanupSpecs,
        feathering,
        eraserMask,
        bgColor,
        colorTolerance,
        useFloodFill,
        previewOnly: false,
      });

      if (response.ok) {
        toast.success('Image updated successfully');
        setPreviewImage(null);
        setEraserMask(null);
        // Update the editing component and local state with new image
        const updatedComponent = await response.json();
        if (updatedComponent.imageUrl) {
          setEditingComponent(prev => prev ? { ...prev, imageUrl: updatedComponent.imageUrl } : null);
          // Update local state instead of reloading all data
          setComponents(prev => prev.map(c =>
            c.id === editingComponent.id ? { ...c, imageUrl: updatedComponent.imageUrl, thumbnailUrl: updatedComponent.thumbnailUrl || c.thumbnailUrl } : c
          ));
        }
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

  // Initialize eraser canvas
  const initCanvas = useCallback(() => {
    if (!canvasRef.current || !maskCanvasRef.current || !editingComponent) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');

    if (!ctx || !maskCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;

      ctx.drawImage(img, 0, 0);
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      setCanvasReady(true);
    };
    img.src = previewImage || editingComponent.imageUrl;
  }, [editingComponent, previewImage]);

  useEffect(() => {
    if (isErasing && editingComponent) {
      initCanvas();
    }
  }, [isErasing, editingComponent, initCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isErasing) return;
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isErasing) return;
    draw(e);
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Save mask as base64
      if (maskCanvasRef.current) {
        setEraserMask(maskCanvasRef.current.toDataURL('image/png'));
        setPendingEraserMask(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !maskCanvasRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');

    if (!ctx || !maskCtx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Draw on visible canvas (show erased area)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // Draw on mask canvas (white = erase)
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushSize * scaleX, 0, Math.PI * 2);
    maskCtx.fill();
  };

  const clearEraserMask = () => {
    if (maskCanvasRef.current) {
      const maskCtx = maskCanvasRef.current.getContext('2d');
      if (maskCtx) {
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      }
    }
    setEraserMask(null);
    setPendingEraserMask(false);
    initCanvas();
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
            {[...categories].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((cat) => (
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

          {availableModels.length > 0 && (
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Styles</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          )}

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

        {/* Group By Toggle */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">Group by:</span>
          <button
            onClick={() => setGroupBy('category')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              groupBy === 'category'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Category
          </button>
          <button
            onClick={() => setGroupBy('model')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              groupBy === 'model'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            Style/Model
          </button>
        </div>
      </Card>

      {/* Component Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{filteredComponents.length} components</span>
        <span>|</span>
        <span>
          {groupBy === 'category'
            ? `${Object.keys(componentsByCategory).length} categories`
            : `${Object.keys(componentsByModel).length} styles`}
        </span>
      </div>

      {/* Components grouped by Category */}
      {groupBy === 'category' && [...categories]
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
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
                        onClick={() => handleEdit(component)}
                        className="p-1 bg-white/20 rounded hover:bg-white/40"
                        title="Edit Component"
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

      {/* Components grouped by Style/Model */}
      {groupBy === 'model' && Object.keys(componentsByModel)
        .sort()
        .map((model) => (
          <Card key={model} className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <span className="inline-flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-500" />
                {model}
              </span>
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({componentsByModel[model].length})
              </span>
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {componentsByModel[model].map((component) => (
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
                    <p className="text-xs text-gray-300 truncate w-full text-center">
                      {categories.find(c => c.id === component.categoryId)?.displayName}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(component)}
                        className="p-1 bg-white/20 rounded hover:bg-white/40"
                        title="Edit Component"
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

      {/* Combined Edit Modal */}
      <Modal
        isOpen={!!editingComponent}
        onClose={handleCloseEdit}
        title={`Edit: ${editingComponent?.name}`}
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setEditTab('info')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editTab === 'info'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setEditTab('image')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                editTab === 'image'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Image Editor
            </button>
          </div>

          {/* Info Tab */}
          {editTab === 'info' && (
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
                <Button variant="ghost" onClick={handleCloseEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Info
                </Button>
              </div>
            </div>
          )}

          {/* Image Editor Tab */}
          {editTab === 'image' && (
            <div className="space-y-4">
              {/* Background selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Background:</span>
                {(Object.keys(backgroundStyles) as BackgroundType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBgType(type)}
                    className={`w-6 h-6 rounded border-2 ${
                      bgType === type ? 'border-purple-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    style={backgroundStyles[type]}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                  />
                ))}
              </div>

              {/* Image preview area */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                    Original
                  </p>
                  <div
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                    style={backgroundStyles[bgType]}
                  >
                    <img
                      src={editingComponent?.imageUrl}
                      alt="Original"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                    {isErasing ? 'Eraser Mode' : 'Preview'} {isProcessing && '(processing...)'}
                  </p>
                  <div
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 relative"
                    style={backgroundStyles[bgType]}
                  >
                    {isErasing && canvasReady ? (
                      <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        className="w-full h-full object-contain cursor-crosshair"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : previewImage ? (
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
                    <canvas ref={maskCanvasRef} className="hidden" />
                  </div>
                </div>
              </div>

              {/* Eraser controls */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <Button
                  variant={isErasing ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setIsErasing(!isErasing)}
                  className={isErasing ? 'bg-orange-500 hover:bg-orange-600' : ''}
                >
                  <Eraser className="w-4 h-4 mr-1" />
                  {isErasing ? 'Erasing' : 'Eraser'}
                </Button>
                {isErasing && (
                  <>
                    <div className="flex-1">
                      <Slider
                        label="Brush"
                        showValue
                        min={5}
                        max={100}
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        formatValue={(v) => `${v}px`}
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearEraserMask}>
                      <Undo2 className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                    {pendingEraserMask && (
                      <Button
                        size="sm"
                        onClick={applyEraserMask}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Apply
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Background Removal Settings */}
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Paintbrush className="w-4 h-4" />
                    Background Removal
                  </h4>
                  <button
                    onClick={() => setRemoveBackground(!removeBackground)}
                    className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${
                      removeBackground
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {removeBackground ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {removeBackground ? 'On' : 'Off'}
                  </button>
                </div>

                {removeBackground && (
                  <>
                    {/* Background Color */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Target Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={`#${bgColor.r.toString(16).padStart(2, '0')}${bgColor.g.toString(16).padStart(2, '0')}${bgColor.b.toString(16).padStart(2, '0')}`}
                            onChange={(e) => {
                              const hex = e.target.value.slice(1);
                              setBgColor({
                                r: parseInt(hex.slice(0, 2), 16),
                                g: parseInt(hex.slice(2, 4), 16),
                                b: parseInt(hex.slice(4, 6), 16),
                              });
                            }}
                            className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                          />
                          <button
                            onClick={() => setBgColor({ r: 255, g: 255, b: 255 })}
                            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                          >
                            White
                          </button>
                          <button
                            onClick={() => setBgColor({ r: 0, g: 0, b: 0 })}
                            className="text-xs px-2 py-1 bg-black text-white border border-gray-600 rounded hover:bg-gray-900"
                          >
                            Black
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Select the background color to remove.
                      </p>
                    </div>

                    {/* Color Tolerance */}
                    <div>
                      <Slider
                        label="Color Tolerance"
                        showValue
                        min={5}
                        max={100}
                        value={colorTolerance}
                        onChange={(e) => setColorTolerance(parseInt(e.target.value))}
                        formatValue={(v) => `${v}`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Higher = remove more similar colors. Lower = exact match only.
                      </p>
                    </div>

                    {/* Brightness Threshold (for white-like colors) */}
                    <div>
                      <Slider
                        label="Brightness Threshold"
                        showValue
                        min={150}
                        max={255}
                        value={bgThreshold}
                        onChange={(e) => setBgThreshold(parseInt(e.target.value))}
                        formatValue={(v) => `${v}`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        For white backgrounds: pixels brighter than this are removed.
                      </p>
                    </div>

                    {/* Flood Fill Toggle */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useFloodFill}
                          onChange={(e) => setUseFloodFill(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Only remove from edges (flood fill)
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 -mt-2">
                      {useFloodFill
                        ? 'Only removes background connected to image edges.'
                        : 'Removes all matching pixels anywhere in image.'}
                    </p>

                    {/* Spec Cleanup */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cleanupSpecs}
                          onChange={(e) => setCleanupSpecs(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Remove isolated specs
                        </span>
                      </label>
                    </div>

                    {cleanupSpecs && (
                      <div>
                        <Slider
                          label="Max Spec Size"
                          showValue
                          min={10}
                          max={500}
                          value={specThreshold}
                          onChange={(e) => setSpecThreshold(parseInt(e.target.value))}
                          formatValue={(v) => `${v}px`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Remove isolated matching areas smaller than this.
                        </p>
                      </div>
                    )}

                    {/* Edge Feathering */}
                    <div>
                      <Slider
                        label="Edge Feathering"
                        showValue
                        min={0}
                        max={10}
                        value={feathering}
                        onChange={(e) => setFeathering(parseInt(e.target.value))}
                        formatValue={(v) => `${v}px`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Soften edges for smoother transparency.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={handleCloseEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProcessedImage}
                  disabled={isSavingImage || (!previewImage && !eraserMask)}
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
                      Save Image
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
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
    </div>
  );
}
