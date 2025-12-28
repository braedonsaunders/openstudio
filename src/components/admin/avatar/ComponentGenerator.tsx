'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Sparkles,
  RefreshCw,
  Save,
  Wand2,
  Check,
  X,
  ImagePlus,
  Layers,
  Zap,
} from 'lucide-react';
import type { AvatarGenerationPreset, AvatarCategory, ComponentRarity } from '@/types/avatar';
import { adminGet, adminPost } from '@/lib/api/admin';

interface EnvDebug {
  hasAccountId: boolean;
  hasApiToken: boolean;
  hasR2AccessKey: boolean;
  hasReplicate: boolean;
  accountIdLength: number;
  apiTokenLength: number;
  r2AccessKeyLength: number;
}

interface GeneratorConfig {
  models: Array<{ id: string; name: string; provider: string; speed: string; cost: string }>;
  presets: AvatarGenerationPreset[];
  providers: { cloudflare: boolean; replicate: boolean };
  debug?: EnvDebug;
}

interface ComponentGeneratorProps {
  categories: AvatarCategory[];
  onComponentCreated: () => void;
}

interface ImageSaveInfo {
  image: string;
  selected: boolean;
  componentId: string;
  componentName: string;
  tags: string;
  rarity: ComponentRarity;
}

interface BatchResult {
  prompt: string;
  image: string;
  componentIdBase: string;
  suggestedName: string;
  selected: boolean;
}

export function ComponentGenerator({ categories, onComponentCreated }: ComponentGeneratorProps) {
  const [config, setConfig] = useState<GeneratorConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mode: 'single' or 'batch'
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Generation inputs
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [componentDescription, setComponentDescription] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [imageCount, setImageCount] = useState(4);

  // Generated images with per-image save info
  const [generatedImages, setGeneratedImages] = useState<ImageSaveInfo[]>([]);
  const [saveCategory, setSaveCategory] = useState<string>('');

  // Batch generation state
  const [batchTheme, setBatchTheme] = useState('');
  const [batchCategory, setBatchCategory] = useState<string>('');
  const [batchCount, setBatchCount] = useState(8);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchTags, setBatchTags] = useState('');
  const [batchRarity, setBatchRarity] = useState<ComponentRarity>('common');
  const [batchProgress, setBatchProgress] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await adminGet('/api/admin/avatar/generate');
        if (response.ok) {
          const data = await response.json();
          console.log('Generator config:', data);
          setConfig(data);
          if (data.models?.length > 0) {
            setSelectedModel(data.models[0].id);
          }
          if (data.presets?.length > 0) {
            setSelectedPreset(data.presets[0].id);
          }
        } else {
          const error = await response.json();
          console.error('Failed to load config:', error);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleGenerate = async () => {
    if (!selectedModel) return;
    if (!useCustomPrompt && !componentDescription) return;
    if (useCustomPrompt && !customPrompt) return;

    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      const body = useCustomPrompt
        ? {
            prompt: customPrompt,
            negativePrompt,
            model: selectedModel,
            count: imageCount,
          }
        : {
            presetId: selectedPreset,
            component: componentDescription,
            model: selectedModel,
            count: imageCount,
          };

      const response = await adminPost('/api/admin/avatar/generate', body);

      if (response.ok) {
        const result = await response.json();
        // Initialize each image with empty save info
        const baseId = componentDescription.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || 'component';
        setGeneratedImages(
          result.images.map((img: string, i: number) => ({
            image: img,
            selected: false,
            componentId: `${baseId}_${i + 1}`,
            componentName: componentDescription || `Component ${i + 1}`,
            tags: '',
            rarity: 'common' as ComponentRarity,
          }))
        );
      } else {
        const error = await response.json();
        alert(`Generation failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleImageSelection = (index: number) => {
    setGeneratedImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, selected: !img.selected } : img))
    );
  };

  const updateImageInfo = (index: number, field: keyof ImageSaveInfo, value: string) => {
    setGeneratedImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, [field]: value } : img))
    );
  };

  const handleSaveSelected = async () => {
    const selectedItems = generatedImages.filter((img) => img.selected);
    if (selectedItems.length === 0) return;
    if (!saveCategory) {
      alert('Please select a category');
      return;
    }

    // Validate each selected image has required fields
    for (const item of selectedItems) {
      if (!item.componentId || !item.componentName) {
        alert('Please fill in ID and Name for all selected images');
        return;
      }
    }

    setIsSaving(true);

    try {
      let savedCount = 0;

      for (const item of selectedItems) {
        // Upload the image
        const uploadResponse = await adminPost('/api/admin/avatar/upload', {
          imageData: item.image,
          categoryId: saveCategory,
          componentId: item.componentId,
        });

        if (!uploadResponse.ok) {
          console.error('Failed to upload image:', item.componentId);
          continue;
        }

        const uploadResult = await uploadResponse.json();

        // Create the component
        const componentResponse = await adminPost('/api/admin/avatar/components', {
          id: item.componentId,
          categoryId: saveCategory,
          name: item.componentName,
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          r2Key: uploadResult.key,
          tags: item.tags.split(',').map((t) => t.trim()).filter(Boolean),
          rarity: item.rarity,
          generationPrompt: useCustomPrompt ? customPrompt : `${selectedPreset}: ${componentDescription}`,
          generationModel: selectedModel,
        });

        if (componentResponse.ok) {
          savedCount++;
        }
      }

      alert(`Saved ${savedCount} component(s)`);
      // Remove saved images from the list
      setGeneratedImages((prev) => prev.filter((img) => !img.selected));
      onComponentCreated();
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save components');
    } finally {
      setIsSaving(false);
    }
  };

  // Batch generation handlers
  const handleBatchGenerate = async () => {
    if (!batchCategory || !batchTheme || !selectedModel) return;

    const category = categories.find((c) => c.id === batchCategory);
    if (!category) return;

    setIsGenerating(true);
    setBatchResults([]);
    setBatchProgress('Generating varied prompts with AI...');

    try {
      const response = await adminPost('/api/admin/avatar/generate/batch', {
        theme: batchTheme,
        categoryId: batchCategory,
        categoryName: category.displayName,
        count: batchCount,
        model: selectedModel,
        presetId: selectedPreset || undefined,
      });

      if (response.ok) {
        const result = await response.json();
        setBatchResults(
          result.results.map((r: Omit<BatchResult, 'selected'>) => ({
            ...r,
            selected: true, // Select all by default
          }))
        );
        setBatchProgress(`Generated ${result.generatedCount} of ${result.requestedCount} images`);
      } else {
        const error = await response.json();
        alert(`Batch generation failed: ${error.error}`);
        setBatchProgress('');
      }
    } catch (error) {
      console.error('Batch generation failed:', error);
      alert('Batch generation failed');
      setBatchProgress('');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleBatchSelection = (index: number) => {
    setBatchResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const selectAllBatch = () => {
    setBatchResults((prev) => prev.map((r) => ({ ...r, selected: true })));
  };

  const deselectAllBatch = () => {
    setBatchResults((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  const handleSaveBatch = async () => {
    const selectedResults = batchResults.filter((r) => r.selected);
    if (selectedResults.length === 0) return;

    setIsSaving(true);
    let savedCount = 0;

    try {
      for (const result of selectedResults) {
        // Upload the image
        const uploadResponse = await adminPost('/api/admin/avatar/upload', {
          imageData: result.image,
          categoryId: batchCategory,
          componentId: result.componentIdBase,
        });

        if (!uploadResponse.ok) {
          console.error('Failed to upload image:', result.componentIdBase);
          continue;
        }

        const uploadResult = await uploadResponse.json();

        // Create the component
        const componentResponse = await adminPost('/api/admin/avatar/components', {
          id: result.componentIdBase,
          categoryId: batchCategory,
          name: result.suggestedName,
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          r2Key: uploadResult.key,
          tags: batchTags.split(',').map((t) => t.trim()).filter(Boolean),
          rarity: batchRarity,
          generationPrompt: result.prompt,
          generationModel: selectedModel,
        });

        if (componentResponse.ok) {
          savedCount++;
        }
      }

      alert(`Saved ${savedCount} component(s)`);
      setBatchResults([]);
      setBatchTheme('');
      setBatchTags('');
      onComponentCreated();
    } catch (error) {
      console.error('Failed to save batch:', error);
      alert('Failed to save components');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!config?.providers.cloudflare && !config?.providers.replicate) {
    const debug = config?.debug;
    return (
      <Card className="p-8 text-center">
        <Wand2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No AI Providers Configured
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          For Cloudflare Workers AI: Set CLOUDFLARE_R2_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or CLOUDFLARE_R2_ACCESS_KEY_ID with AI permissions).
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          For Replicate: Set REPLICATE_API_TOKEN.
        </p>
        {debug && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left text-xs font-mono">
            <p className="font-bold mb-2">Debug Info (env vars detected on server):</p>
            <p>CLOUDFLARE_R2_ACCOUNT_ID: {debug.hasAccountId ? `✓ (${debug.accountIdLength} chars)` : '✗ missing'}</p>
            <p>CLOUDFLARE_API_TOKEN: {debug.hasApiToken ? `✓ (${debug.apiTokenLength} chars)` : '✗ missing'}</p>
            <p>CLOUDFLARE_R2_ACCESS_KEY_ID: {debug.hasR2AccessKey ? `✓ (${debug.r2AccessKeyLength} chars)` : '✗ missing'}</p>
            <p>REPLICATE_API_TOKEN: {debug.hasReplicate ? '✓' : '✗ missing'}</p>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Tabs */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'single' ? 'primary' : 'outline'}
          onClick={() => setMode('single')}
          className={mode === 'single' ? 'bg-purple-500 hover:bg-purple-600' : ''}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Single Generation
        </Button>
        <Button
          variant={mode === 'batch' ? 'primary' : 'outline'}
          onClick={() => setMode('batch')}
          className={mode === 'batch' ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          <Zap className="w-4 h-4 mr-2" />
          Batch Generate Category
        </Button>
      </div>

      {/* Batch Generation Mode */}
      {mode === 'batch' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            Batch Generate with AI-Varied Prompts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Enter a theme like &quot;hats&quot; or &quot;christmas accessories&quot; and AI will generate varied prompts and images automatically.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category *
              </label>
              <select
                value={batchCategory}
                onChange={(e) => setBatchCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {config?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider}) - {model.speed}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Theme / Description *
              </label>
              <Input
                value={batchTheme}
                onChange={(e) => setBatchTheme(e.target.value)}
                placeholder="e.g., hats, christmas stuff, sci-fi helmets, cute animals"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number to Generate
              </label>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value={4}>4</option>
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Style Preset (optional)
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">No preset</option>
                {config?.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={handleBatchGenerate}
            disabled={isGenerating || !batchCategory || !batchTheme}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {batchProgress || 'Generating...'}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Generate {batchCount} Varied Components
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Batch Results */}
      {mode === 'batch' && batchResults.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-green-500" />
              Generated Components ({batchResults.filter((r) => r.selected).length} selected)
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllBatch}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllBatch}>
                Deselect All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {batchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => toggleBatchSelection(index)}
                className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  result.selected
                    ? 'border-green-500 ring-2 ring-green-500/50'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 opacity-50'
                }`}
              >
                <div className="aspect-square">
                  <img
                    src={result.image}
                    alt={result.suggestedName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 bg-white dark:bg-gray-800">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {result.suggestedName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {result.prompt.slice(0, 40)}...
                  </p>
                </div>
                {result.selected && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Batch Save Options */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">
              Save {batchResults.filter((r) => r.selected).length} Selected Components
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rarity for All
                </label>
                <select
                  value={batchRarity}
                  onChange={(e) => setBatchRarity(e.target.value as ComponentRarity)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags for All (comma-separated)
                </label>
                <Input
                  value={batchTags}
                  onChange={(e) => setBatchTags(e.target.value)}
                  placeholder="e.g., holiday, festive, winter"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSaveBatch}
                disabled={isSaving || batchResults.filter((r) => r.selected).length === 0}
                className="bg-green-500 hover:bg-green-600"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save All Selected
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setBatchResults([]);
                  setBatchProgress('');
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Single Generation Controls */}
      {mode === 'single' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Generate Components
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {config?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.provider}) - {model.speed}
                  </option>
                ))}
              </select>
            </div>

            {/* Image Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Images
              </label>
              <select
                value={imageCount}
                onChange={(e) => setImageCount(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
              </select>
            </div>
          </div>

        {/* Prompt Mode Toggle */}
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!useCustomPrompt}
              onChange={() => setUseCustomPrompt(false)}
              className="text-purple-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Use Preset</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={useCustomPrompt}
              onChange={() => setUseCustomPrompt(true)}
              className="text-purple-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Custom Prompt</span>
          </label>
        </div>

        {/* Preset Mode */}
        {!useCustomPrompt && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Style Preset
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {config?.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Component Description
              </label>
              <Input
                value={componentDescription}
                onChange={(e) => setComponentDescription(e.target.value)}
                placeholder="e.g., short spiky anime hair, studio headphones, leather jacket"
              />
            </div>
          </div>
        )}

        {/* Custom Prompt Mode */}
        {useCustomPrompt && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter your full prompt..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Negative Prompt (optional)
              </label>
              <Input
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="e.g., blurry, low quality, background"
              />
            </div>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || (!useCustomPrompt && !componentDescription) || (useCustomPrompt && !customPrompt)}
          className="mt-4 bg-purple-500 hover:bg-purple-600"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate {imageCount} Image{imageCount > 1 ? 's' : ''}
            </>
          )}
        </Button>
        </Card>
      )}

      {/* Generated Images (Single mode only) */}
      {mode === 'single' && generatedImages.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-green-500" />
              Generated Images
              <span className="text-sm font-normal text-gray-500">
                ({generatedImages.filter((i) => i.selected).length} selected)
              </span>
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeneratedImages((prev) => prev.map((img) => ({ ...img, selected: true })))}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeneratedImages((prev) => prev.map((img) => ({ ...img, selected: false })))}
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Category selection - shared for all */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category (for all) *
            </label>
            <select
              value={saveCategory}
              onChange={(e) => setSaveCategory(e.target.value)}
              className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Image cards with per-image forms */}
          <div className="space-y-4 mb-6">
            {generatedImages.map((imgInfo, index) => (
              <div
                key={index}
                className={`flex gap-4 p-4 rounded-lg border-2 transition-all ${
                  imgInfo.selected
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                {/* Image with selection toggle */}
                <div
                  onClick={() => toggleImageSelection(index)}
                  className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer"
                >
                  <img
                    src={imgInfo.image}
                    alt={`Generated ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {imgInfo.selected && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs">
                      {imgInfo.selected ? 'Deselect' : 'Select'}
                    </span>
                  </div>
                </div>

                {/* Per-image form fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Component ID *
                    </label>
                    <Input
                      value={imgInfo.componentId}
                      onChange={(e) =>
                        updateImageInfo(index, 'componentId', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
                      }
                      placeholder="e.g., hair_spiky_01"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Display Name *
                    </label>
                    <Input
                      value={imgInfo.componentName}
                      onChange={(e) => updateImageInfo(index, 'componentName', e.target.value)}
                      placeholder="e.g., Spiky Hair"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Tags (comma-separated)
                    </label>
                    <Input
                      value={imgInfo.tags}
                      onChange={(e) => updateImageInfo(index, 'tags', e.target.value)}
                      placeholder="e.g., spiky, anime"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Rarity
                    </label>
                    <select
                      value={imgInfo.rarity}
                      onChange={(e) => updateImageInfo(index, 'rarity', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="common">Common</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSaveSelected}
              disabled={isSaving || !saveCategory || !generatedImages.some((i) => i.selected)}
              className="bg-green-500 hover:bg-green-600"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save {generatedImages.filter((i) => i.selected).length} Selected Component
                  {generatedImages.filter((i) => i.selected).length !== 1 ? 's' : ''}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setGeneratedImages([])}
            >
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
