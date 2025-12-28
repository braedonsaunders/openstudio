import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserProfile } from '@/lib/supabase/auth';
import { generateAvatarImages, getAvailableModels, buildPromptFromPreset, getConfiguredProviders } from '@/lib/avatar/generator';
import { getGenerationPresets } from '@/lib/avatar/supabase';
import type { GenerateImageRequest } from '@/types/avatar';

// Check if user is admin
async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const profile = await getUserProfile(user.id);
  return profile?.accountType === 'admin';
}

// GET /api/admin/avatar/generate - Get available models and presets
export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [presets, providers] = await Promise.all([
      getGenerationPresets(),
      Promise.resolve(getConfiguredProviders()),
    ]);

    const models = getAvailableModels().filter((model) => {
      if (model.provider === 'Cloudflare') return providers.cloudflare;
      if (model.provider === 'Replicate') return providers.replicate;
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
}

// POST /api/admin/avatar/generate - Generate images
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
}
