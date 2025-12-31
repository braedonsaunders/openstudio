import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/supabase/server';
import { generateAvatarImages, getAvailableModels, buildPromptFromPreset, getConfiguredProviders } from '@/lib/avatar/generator';
import { getGenerationPresets } from '@/lib/avatar/supabase';
import type { GenerateImageRequest } from '@/types/avatar';

// GET /api/admin/avatar/generate - Get available models and presets
export const GET = withAdminAuth(async (req, user) => {
  try {
    const [presets, providers] = await Promise.all([
      getGenerationPresets(),
      Promise.resolve(getConfiguredProviders()),
    ]);

    const models = getAvailableModels().filter((model) => {
      if (model.provider === 'Cloudflare') return providers.cloudflare;
      if (model.provider === 'Replicate') return providers.replicate;
      if (model.provider === 'Google') return providers.gemini;
      return false;
    });

    return NextResponse.json({
      models,
      presets,
      providers,
    });
  } catch (error) {
    console.error('Failed to get generation config:', error);
    return NextResponse.json(
      { error: 'Failed to get generation config' },
      { status: 500 }
    );
  }
});

// POST /api/admin/avatar/generate - Generate images
export const POST = withAdminAuth(async (req, user) => {
  try {
    const body = await req.json();

    // Check if using a preset
    if (body.presetId && body.component) {
      const presets = await getGenerationPresets();
      const preset = presets.find((p) => p.id === body.presetId);

      if (!preset) {
        return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
      }

      const { prompt, negativePrompt } = buildPromptFromPreset(
        body.component,
        preset.promptTemplate,
        preset.styleSuffix,
        preset.negativePrompt
      );

      const request: GenerateImageRequest = {
        prompt,
        negativePrompt,
        model: body.model || preset.model,
        count: body.count || 4,
        seed: body.seed,
      };

      const result = await generateAvatarImages(request);
      return NextResponse.json(result);
    }

    // Direct prompt mode
    if (!body.prompt) {
      return NextResponse.json(
        { error: 'Either prompt or (presetId + component) is required' },
        { status: 400 }
      );
    }

    const request: GenerateImageRequest = {
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      model: body.model,
      count: body.count || 4,
      seed: body.seed,
    };

    const result = await generateAvatarImages(request);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to generate images:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate images' },
      { status: 500 }
    );
  }
});
