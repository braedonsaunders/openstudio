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

export function ComponentGenerator({ categories, onComponentCreated }: ComponentGeneratorProps) {
  const [config, setConfig] = useState<GeneratorConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Generation inputs
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [componentDescription, setComponentDescription] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [imageCount, setImageCount] = useState(4);

  // Generated images
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());

  // Save form
  const [saveCategory, setSaveCategory] = useState<string>('');
  const [saveComponentId, setSaveComponentId] = useState('');
  const [saveComponentName, setSaveComponentName] = useState('');
  const [saveTags, setSaveTags] = useState('');
  const [saveRarity, setSaveRarity] = useState<ComponentRarity>('common');

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
    setSelectedImages(new Set());

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
        setGeneratedImages(result.images);
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
    const newSelection = new Set(selectedImages);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedImages(newSelection);
  };

  const handleSaveSelected = async () => {
    if (selectedImages.size === 0) return;
    if (!saveCategory || !saveComponentId || !saveComponentName) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);

    try {
      // Save each selected image as a component
      let savedCount = 0;
      const selectedIndices = Array.from(selectedImages);

      for (let i = 0; i < selectedIndices.length; i++) {
        const imageIndex = selectedIndices[i];
        const imageData = generatedImages[imageIndex];
        const suffix = selectedIndices.length > 1 ? `_${i + 1}` : '';
        const componentId = `${saveComponentId}${suffix}`;
        const componentName = selectedIndices.length > 1 ? `${saveComponentName} ${i + 1}` : saveComponentName;

        // Upload the image
        const uploadResponse = await adminPost('/api/admin/avatar/upload', {
          imageData,
          categoryId: saveCategory,
          componentId,
        });

        if (!uploadResponse.ok) {
          console.error('Failed to upload image');
          continue;
        }

        const uploadResult = await uploadResponse.json();

        // Create the component
        const componentResponse = await adminPost('/api/admin/avatar/components', {
          id: componentId,
          categoryId: saveCategory,
          name: componentName,
          imageUrl: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          r2Key: uploadResult.key,
          tags: saveTags.split(',').map((t) => t.trim()).filter(Boolean),
          rarity: saveRarity,
          generationPrompt: useCustomPrompt ? customPrompt : `${selectedPreset}: ${componentDescription}`,
          generationModel: selectedModel,
        });

        if (componentResponse.ok) {
          savedCount++;
        }
      }

      alert(`Saved ${savedCount} component(s)`);
      setGeneratedImages([]);
      setSelectedImages(new Set());
      setSaveComponentId('');
      setSaveComponentName('');
      setSaveTags('');
      onComponentCreated();
    } catch (error) {
      console.error('Failed to save:', error);
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
      {/* Generation Controls */}
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

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-green-500" />
            Generated Images
            <span className="text-sm font-normal text-gray-500">
              (Click to select)
            </span>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {generatedImages.map((image, index) => (
              <div
                key={index}
                onClick={() => toggleImageSelection(index)}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  selectedImages.has(index)
                    ? 'border-green-500 ring-2 ring-green-500/50'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                }`}
              >
                <img
                  src={image}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {selectedImages.has(index) && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save Form */}
          {selectedImages.size > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                Save {selectedImages.size} Selected Image{selectedImages.size > 1 ? 's' : ''}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value)}
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
                    Component ID *
                  </label>
                  <Input
                    value={saveComponentId}
                    onChange={(e) => setSaveComponentId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                    placeholder="e.g., hair_spiky_01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name *
                  </label>
                  <Input
                    value={saveComponentName}
                    onChange={(e) => setSaveComponentName(e.target.value)}
                    placeholder="e.g., Spiky Hair"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rarity
                  </label>
                  <select
                    value={saveRarity}
                    onChange={(e) => setSaveRarity(e.target.value as ComponentRarity)}
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
                    Tags (comma-separated)
                  </label>
                  <Input
                    value={saveTags}
                    onChange={(e) => setSaveTags(e.target.value)}
                    placeholder="e.g., spiky, short, anime, trendy"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSaveSelected}
                  disabled={isSaving || !saveCategory || !saveComponentId || !saveComponentName}
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
                      Save Component{selectedImages.size > 1 ? 's' : ''}
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedImages(new Set());
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
