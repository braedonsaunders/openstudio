import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import { generateVariedPrompts, generateAvatarImages, buildPromptFromPreset } from '@/lib/avatar/generator';
import { getGenerationPresets, getAllCategories } from '@/lib/avatar/supabase';

interface BatchGenerateBody {
  theme: string;
  categoryId: string;
  categoryName: string;
  count: number;
  model: string;
  presetId?: string;
}

// POST /api/admin/avatar/generate/batch - Generate batch of varied images
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as BatchGenerateBody;
    const { theme, categoryId, categoryName, count, model, presetId } = body;

    if (!theme || !categoryId || !categoryName || !count || !model) {
      return NextResponse.json(
        { error: 'theme, categoryId, categoryName, count, and model are required' },
        { status: 400 }
      );
    }

    // Get style suffix from preset if specified
    let styleSuffix: string | undefined;
    if (presetId) {
      const presets = await getGenerationPresets();
      const preset = presets.find((p) => p.id === presetId);
      styleSuffix = preset?.styleSuffix;
    }

    // Get category's custom prompt addition
    let categoryPromptAddition: string | undefined;
    try {
      const categories = await getAllCategories();
      const category = categories.find((c) => c.id === categoryId);
      categoryPromptAddition = category?.promptAddition;
    } catch (e) {
      console.warn('Failed to load category prompt addition:', e);
    }

    // Step 1: Generate varied prompts using LLM
    const { prompts, error: promptError } = await generateVariedPrompts(
      theme,
      categoryName,
      count,
      styleSuffix,
      categoryPromptAddition
    );

    if (promptError || prompts.length === 0) {
      return NextResponse.json(
        { error: promptError || 'Failed to generate prompts' },
        { status: 500 }
      );
    }

    // Step 2: Generate images for each prompt
    const results: Array<{
      prompt: string;
      image: string;
      componentIdBase: string;
      suggestedName: string;
    }> = [];

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      // Build full prompt with asset requirements (white bg, front view, etc)
      const fullPromptData = buildPromptFromPreset(
        prompt,
        '{component}',
        styleSuffix
      );

      try {
        const imageResult = await generateAvatarImages({
          prompt: fullPromptData.prompt,
          negativePrompt: fullPromptData.negativePrompt,
          model,
          count: 1, // One image per prompt for variety
        });

        if (imageResult.images.length > 0) {
          // Generate a component ID from the prompt
          const componentIdBase = prompt
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 30);

          // Generate a display name from the prompt
          const suggestedName = prompt
            .split(',')[0] // Take first part before any comma
            .replace(/^(a|an|the)\s+/i, '') // Remove articles
            .split(' ')
            .slice(0, 4) // Take first 4 words
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          results.push({
            prompt,
            image: imageResult.images[0],
            componentIdBase: `${categoryId}_${componentIdBase}_${i + 1}`,
            suggestedName,
          });
        }
      } catch (error) {
        console.warn(`Failed to generate image for prompt: ${prompt}`, error);
        // Continue with other prompts
      }
    }

    return NextResponse.json({
      prompts,
      results,
      generatedCount: results.length,
      requestedCount: count,
    });
  } catch (error) {
    console.error('Batch generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch generation failed' },
      { status: 500 }
    );
  }
}
