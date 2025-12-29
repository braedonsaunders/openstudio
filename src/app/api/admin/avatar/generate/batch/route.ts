import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/supabase/server';
import { generateVariedPrompts, generateAvatarImages, buildPromptFromPreset } from '@/lib/avatar/generator';
import { getGenerationPresets, getAllCategories } from '@/lib/avatar/supabase';

// Enable streaming and set max duration for Vercel
// Streaming keeps the connection alive, avoiding Cloudflare's 100s timeout
export const maxDuration = 300; // 5 minutes max for Pro plan
export const dynamic = 'force-dynamic';

interface BatchGenerateBody {
  theme: string;
  categoryId: string;
  categoryName: string;
  count: number;
  model: string;
  presetId?: string;
}

// Helper to create SSE message
function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// POST /api/admin/avatar/generate/batch - Generate batch of varied images with streaming
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

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Step 1: Generate varied prompts using LLM
          controller.enqueue(encoder.encode(sseMessage('status', {
            message: 'Generating varied prompts with AI...',
            phase: 'prompts'
          })));

          const { prompts, error: promptError } = await generateVariedPrompts(
            theme,
            categoryName,
            count,
            styleSuffix,
            categoryPromptAddition
          );

          if (promptError || prompts.length === 0) {
            controller.enqueue(encoder.encode(sseMessage('error', {
              error: promptError || 'Failed to generate prompts'
            })));
            controller.close();
            return;
          }

          // Send prompts to client
          controller.enqueue(encoder.encode(sseMessage('prompts', {
            prompts,
            total: prompts.length
          })));

          // Step 2: Generate images one at a time, streaming each result
          let generatedCount = 0;

          for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];

            // Send progress update
            controller.enqueue(encoder.encode(sseMessage('status', {
              message: `Generating image ${i + 1} of ${prompts.length}...`,
              phase: 'generating',
              current: i + 1,
              total: prompts.length
            })));

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

                generatedCount++;

                // Stream this result immediately to the client
                controller.enqueue(encoder.encode(sseMessage('result', {
                  prompt,
                  image: imageResult.images[0],
                  componentIdBase: `${categoryId}_${componentIdBase}_${i + 1}`,
                  suggestedName,
                  index: i,
                  generatedCount,
                  totalRequested: prompts.length
                })));
              }
            } catch (error) {
              console.warn(`Failed to generate image for prompt: ${prompt}`, error);
              // Send error for this specific image but continue
              controller.enqueue(encoder.encode(sseMessage('image_error', {
                prompt,
                index: i,
                error: error instanceof Error ? error.message : 'Generation failed'
              })));
            }
          }

          // Send completion event
          controller.enqueue(encoder.encode(sseMessage('complete', {
            generatedCount,
            requestedCount: count
          })));

        } catch (error) {
          console.error('Batch generation failed:', error);
          controller.enqueue(encoder.encode(sseMessage('error', {
            error: error instanceof Error ? error.message : 'Batch generation failed'
          })));
        } finally {
          controller.close();
        }
      }
    });

    // Return streaming response with SSE headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('Batch generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch generation failed' },
      { status: 500 }
    );
  }
}
