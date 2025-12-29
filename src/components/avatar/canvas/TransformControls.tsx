'use client';

import {
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  Trash2,
  Copy,
} from 'lucide-react';
import type { CanvasLayer, LayerTransform } from '@/types/avatar';

interface TransformControlsProps {
  selectedLayer: CanvasLayer | null;
  onUpdateTransform: (layerId: string, transform: Partial<LayerTransform>) => void;
  onRemoveLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
}

export function TransformControls({
  selectedLayer,
  onUpdateTransform,
  onRemoveLayer,
  onDuplicateLayer,
}: TransformControlsProps) {
  if (!selectedLayer) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <p className="text-sm text-gray-400 text-center">
          Select a layer to transform
        </p>
      </div>
    );
  }

  const { transform } = selectedLayer;

  const handleInputChange = (field: keyof LayerTransform, value: number) => {
    onUpdateTransform(selectedLayer.id, { [field]: value });
  };

  const handleFlipX = () => {
    onUpdateTransform(selectedLayer.id, { flipX: !transform.flipX });
  };

  const handleFlipY = () => {
    onUpdateTransform(selectedLayer.id, { flipY: !transform.flipY });
  };

  const handleResetRotation = () => {
    onUpdateTransform(selectedLayer.id, { rotation: 0 });
  };

  const handleResetTransform = () => {
    onUpdateTransform(selectedLayer.id, {
      rotation: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
    });
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      {/* Position & Size */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">X</label>
          <input
            type="number"
            value={Math.round(transform.x)}
            onChange={(e) => handleInputChange('x', parseInt(e.target.value) || 0)}
            className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Y</label>
          <input
            type="number"
            value={Math.round(transform.y)}
            onChange={(e) => handleInputChange('y', parseInt(e.target.value) || 0)}
            className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">W</label>
          <input
            type="number"
            value={Math.round(transform.width)}
            onChange={(e) => handleInputChange('width', parseInt(e.target.value) || 20)}
            min={20}
            className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">H</label>
          <input
            type="number"
            value={Math.round(transform.height)}
            onChange={(e) => handleInputChange('height', parseInt(e.target.value) || 20)}
            min={20}
            className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">Rotation</label>
          <span className="text-xs text-gray-400">{Math.round(transform.rotation)}°</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="-180"
            max="180"
            value={transform.rotation}
            onChange={(e) => handleInputChange('rotation', parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <button
            onClick={handleResetRotation}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
            title="Reset rotation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transform Buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleFlipX}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
            transform.flipX
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <FlipHorizontal className="w-4 h-4" />
          <span className="text-sm">Flip H</span>
        </button>
        <button
          onClick={handleFlipY}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
            transform.flipY
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <FlipVertical className="w-4 h-4" />
          <span className="text-sm">Flip V</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleResetTransform}
          className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => onDuplicateLayer(selectedLayer.id)}
          className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={() => onRemoveLayer(selectedLayer.id)}
          className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
