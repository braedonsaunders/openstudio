'use client';

import { useCallback, useState } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Palette,
  ChevronDown,
} from 'lucide-react';
import type { CanvasLayer, AvatarComponent, AvatarCategory } from '@/types/avatar';

interface LayerPanelProps {
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  components: Map<string, AvatarComponent>;
  categories: Map<string, AvatarCategory>;
  colorPalettes: Record<string, string[]>;
  onSelectLayer: (layerId: string | null) => void;
  onRemoveLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onSetColorVariant: (layerId: string, variant: string) => void;
  onUpdateTransform: (layerId: string, transform: { opacity: number }) => void;
}

export function LayerPanel({
  layers,
  selectedLayerId,
  components,
  categories,
  colorPalettes,
  onSelectLayer,
  onRemoveLayer,
  onDuplicateLayer,
  onReorderLayers,
  onSetColorVariant,
  onUpdateTransform,
}: LayerPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedColorPicker, setExpandedColorPicker] = useState<string | null>(null);

  // Reverse order so top layer is at top of list
  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    // Convert display order indices to actual layer indices
    const fromLayer = sortedLayers[draggedIndex];
    const toLayer = sortedLayers[dropIndex];

    const fromActualIndex = layers.findIndex((l) => l.id === fromLayer.id);
    const toActualIndex = layers.findIndex((l) => l.id === toLayer.id);

    onReorderLayers(fromActualIndex, toActualIndex);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const toggleColorPicker = useCallback((layerId: string) => {
    setExpandedColorPicker((prev) => (prev === layerId ? null : layerId));
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Layers
        </h3>
        <span className="text-xs text-gray-400">{layers.length}</span>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto">
        {sortedLayers.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No layers yet
          </div>
        ) : (
          sortedLayers.map((layer, displayIndex) => {
            const component = components.get(layer.componentId);
            const category = categories.get(layer.categoryId);
            const isSelected = layer.id === selectedLayerId;
            const hasColorVariants =
              category?.supportsColorVariants && category.defaultColorPalette;
            const palette = category?.defaultColorPalette
              ? colorPalettes[category.defaultColorPalette]
              : null;

            return (
              <div key={layer.id}>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, displayIndex)}
                  onDragOver={(e) => handleDragOver(e, displayIndex)}
                  onDrop={(e) => handleDrop(e, displayIndex)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`flex items-center gap-2 p-2 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  } ${draggedIndex === displayIndex ? 'opacity-50' : ''}`}
                >
                  {/* Drag Handle */}
                  <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                    {component && (
                      <img
                        src={
                          layer.colorVariant && component.colorVariants?.[layer.colorVariant]
                            ? component.colorVariants[layer.colorVariant]
                            : component.thumbnailUrl || component.imageUrl
                        }
                        alt={component.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {component?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {category?.displayName || 'Unknown'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Color Picker Toggle */}
                    {hasColorVariants && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleColorPicker(layer.id);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          expandedColorPicker === layer.id
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600'
                        }`}
                        title="Change color"
                      >
                        <Palette className="w-4 h-4" />
                      </button>
                    )}

                    {/* Duplicate */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateLayer(layer.id);
                      }}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Duplicate layer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveLayer(layer.id);
                      }}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete layer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Color Picker Expansion */}
                {expandedColorPicker === layer.id && palette && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex flex-wrap gap-2">
                      {palette.map((color) => {
                        const isActive = layer.colorVariant === color;
                        return (
                          <button
                            key={color}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetColorVariant(layer.id, color);
                            }}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              isActive
                                ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-110'
                                : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        );
                      })}
                    </div>

                    {/* Opacity Slider */}
                    <div className="mt-3">
                      <label className="text-xs text-gray-500 mb-1 block">
                        Opacity: {Math.round(layer.transform.opacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={layer.transform.opacity * 100}
                        onChange={(e) => {
                          onUpdateTransform(layer.id, {
                            opacity: parseInt(e.target.value) / 100,
                          });
                        }}
                        className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
