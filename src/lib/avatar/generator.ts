// AI image generation for avatar components
// Supports Cloudflare Workers AI, Replicate, and Google Gemini/Imagen
// Also supports text generation for varied prompt creation

import type { GenerateImageRequest, GenerateImageResponse } from '@/types/avatar';

// Text generation models
const CF_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';

// Available models - now includes Gemini Nano Banana
export type AIModel =
  | 'cf-sdxl-lightning'
  | 'cf-sdxl-base'
  | 'cf-flux-schnell'
  | 'replicate-flux-schnell'
  | 'replicate-sdxl'
  | 'gemini-nano-banana'
  | 'gemini-nano-banana-pro';

// Server-side only - this file should only be imported in API routes
export async function generateAvatarImages(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  const model = request.model || 'cf-flux-schnell';

  // Route to appropriate provider
  if (model.startsWith('cf-')) {
    return generateWithCloudflare(request, model);
  } else if (model.startsWith('replicate-')) {
    return generateWithReplicate(request, model);
  } else if (model.startsWith('gemini-')) {
    return generateWithGemini(request, model);
  }

  throw new Error(`Unknown model: ${model}`);
}

/**
 * Generate images using Cloudflare Workers AI
 */
async function generateWithCloudflare(
  request: GenerateImageRequest,
  model: string
): Promise<GenerateImageResponse> {
  // Use the same account ID as R2
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  // For Workers AI, prefer CLOUDFLARE_API_TOKEN, fallback to CLOUDFLARE_R2_ACCESS_KEY_ID (if it has AI permissions)
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured. Ensure CLOUDFLARE_R2_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or CLOUDFLARE_R2_ACCESS_KEY_ID with AI permissions) are set.');
  }

  // Map model names to Cloudflare model IDs
  const modelMap: Record<string, string> = {
    'cf-sdxl-lightning': '@cf/bytedance/stable-diffusion-xl-lightning',
    'cf-sdxl-base': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    'cf-flux-schnell': '@cf/black-forest-labs/flux-1-schnell',
  };

  const cfModel = modelMap[model];
  if (!cfModel) {
    throw new Error(`Unknown Cloudflare model: ${model}`);
  }

  const seed = request.seed || Math.floor(Math.random() * 2147483647);
  const count = request.count || 4;

  // Build prompt with negative prompt handling
  let prompt = request.prompt;
  if (request.negativePrompt) {
    prompt = `${prompt}. Avoid: ${request.negativePrompt}`;
  }

  // Generate multiple images (Cloudflare generates one at a time)
  const imagePromises = Array.from({ length: count }, async (_, i) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          num_steps: model === 'cf-sdxl-lightning' ? 4 : 20,
          guidance: 7.5,
          seed: seed + i, // Different seed for each image
          width: 1024,
          height: 1024,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare AI error: ${error}`);
    }

    // Cloudflare returns either raw binary PNG or JSON with base64 image
    // Check content-type to determine format
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('image/')) {
      // Raw binary image response
      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      return `data:image/png;base64,${base64}`;
    } else {
      // JSON response with base64-encoded image
      const result = await response.json() as { result?: { image?: string }; success?: boolean; errors?: string[] };

      if (!result.success || !result.result?.image) {
        throw new Error(`Cloudflare AI error: ${result.errors?.join(', ') || 'No image in response'}`);
      }

      return `data:image/png;base64,${result.result.image}`;
    }
  });

  const images = await Promise.all(imagePromises);

  return {
    images,
    seed,
    model,
  };
}

/**
 * Generate images using Replicate API
 */
async function generateWithReplicate(
  request: GenerateImageRequest,
  model: string
): Promise<GenerateImageResponse> {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN is not configured');
  }

  const modelVersions: Record<string, string> = {
    'replicate-flux-schnell': 'black-forest-labs/flux-schnell',
    'replicate-sdxl': 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
  };

  const modelId = modelVersions[model];
  if (!modelId) {
    throw new Error(`Unknown Replicate model: ${model}`);
  }

  const seed = request.seed || Math.floor(Math.random() * 2147483647);
  let fullPrompt = request.prompt;

  // Build input based on model
  let input: Record<string, unknown>;

  if (model === 'replicate-flux-schnell') {
    input = {
      prompt: request.negativePrompt ? `${fullPrompt}. Avoid: ${request.negativePrompt}` : fullPrompt,
      num_outputs: request.count || 4,
      aspect_ratio: '1:1',
      output_format: 'png',
      output_quality: 90,
      seed,
    };
  } else {
    input = {
      prompt: fullPrompt,
      negative_prompt: request.negativePrompt || 'blurry, low quality, distorted',
      num_outputs: request.count || 4,
      width: 1024,
      height: 1024,
      scheduler: 'K_EULER',
      num_inference_steps: 25,
      guidance_scale: 7.5,
      seed,
    };
  }

  // Call Replicate API
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: modelId.includes(':') ? modelId.split(':')[1] : undefined,
      model: modelId.includes(':') ? undefined : modelId,
      input,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await response.json();

  // Poll for completion
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pollResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${result.id}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    if (!pollResponse.ok) {
      throw new Error('Failed to poll prediction status');
    }

    result = await pollResponse.json();
  }

  if (result.status === 'failed') {
    throw new Error(`Generation failed: ${result.error || 'Unknown error'}`);
  }

  const images = Array.isArray(result.output) ? result.output : [result.output];

  return {
    images: images.filter((url: unknown): url is string => typeof url === 'string'),
    seed,
    model,
  };
}

/**
 * Generate images using Google Gemini Nano Banana
 * Uses Gemini's native image generation capabilities:
 * - gemini-2.5-flash-image (Nano Banana): Fast and efficient
 * - gemini-3-pro-image-preview (Nano Banana Pro): Professional asset production with advanced reasoning
 */
async function generateWithGemini(
  request: GenerateImageRequest,
  model: string
): Promise<GenerateImageResponse> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
  }

  // Map model names to Gemini model IDs
  const modelMap: Record<string, string> = {
    'gemini-nano-banana': 'gemini-2.5-flash-image',
    'gemini-nano-banana-pro': 'gemini-3-pro-image-preview',
  };

  const geminiModel = modelMap[model];
  if (!geminiModel) {
    throw new Error(`Unknown Gemini model: ${model}`);
  }

  const seed = request.seed || Math.floor(Math.random() * 2147483647);
  const count = request.count || 4;

  // Build prompt - include negative prompt as instructions
  let prompt = request.prompt;
  if (request.negativePrompt) {
    prompt = `${prompt}\n\nIMPORTANT: Do NOT include any of the following: ${request.negativePrompt}`;
  }

  // Gemini generateContent API endpoint
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  // Generate images one at a time (Gemini returns one image per request)
  const allImages: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate an image: ${prompt}\n\nThis should be a square 1:1 aspect ratio image. Variation seed: ${seed + i}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['image', 'text'],
            temperature: 1.0,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini Nano Banana error response:', errorText);
        // Continue to try other images even if one fails
        continue;
      }

      const result = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              inlineData?: {
                mimeType: string;
                data: string;
              };
            }>;
          };
        }>;
        error?: { message: string };
      };

      if (result.error) {
        console.error('Gemini error:', result.error.message);
        continue;
      }

      // Extract images from response parts
      const parts = result.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          allImages.push(`data:${mimeType};base64,${data}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to generate image ${i + 1}:`, error);
      // Continue with other images
    }
  }

  if (allImages.length === 0) {
    throw new Error('Gemini Nano Banana returned no images');
  }

  return {
    images: allImages,
    seed,
    model,
  };
}

/**
 * Get available AI models
 */
export function getAvailableModels(): Array<{ id: AIModel; name: string; provider: string; speed: string; cost: string }> {
  return [
    { id: 'gemini-nano-banana', name: 'Nano Banana (2.5 Flash)', provider: 'Google', speed: 'Fast', cost: 'Low' },
    { id: 'gemini-nano-banana-pro', name: 'Nano Banana Pro (2.5 Pro)', provider: 'Google', speed: 'Medium', cost: 'Medium' },
    { id: 'cf-flux-schnell', name: 'FLUX Schnell', provider: 'Cloudflare', speed: 'Fast', cost: 'Very Low' },
    { id: 'cf-sdxl-lightning', name: 'SDXL Lightning', provider: 'Cloudflare', speed: 'Very Fast', cost: 'Very Low' },
    { id: 'cf-sdxl-base', name: 'SDXL Base', provider: 'Cloudflare', speed: 'Medium', cost: 'Very Low' },
    { id: 'replicate-flux-schnell', name: 'FLUX Schnell', provider: 'Replicate', speed: 'Fast', cost: 'Low' },
    { id: 'replicate-sdxl', name: 'SDXL', provider: 'Replicate', speed: 'Medium', cost: 'Low' },
  ];
}

// Default requirements for avatar asset generation - EXTREMELY UNIFORM style
// All assets must be identical in format: centered, white bg, same visual style
const ASSET_PROMPT_SUFFIX = `, isolated single object, pure white background #FFFFFF, perfectly centered in frame, front-facing symmetric view, no shadows, no gradients, flat solid colors, clean vector-style illustration, 2D game asset sprite, uniform consistent art style, same scale as other assets, crisp clean edges, no anti-aliasing artifacts, professional game art quality`;

const ASSET_NEGATIVE_PROMPT = `photorealistic, photograph, photo, realistic, hyperrealistic, 3D render, 3D, CGI, person, human, character, body, face, hands, portrait, background scenery, complex background, colored background, gradient background, textured background, shadows, drop shadow, cast shadow, ambient occlusion, multiple objects, additional items, side view, three-quarter view, angled view, perspective, depth, depth of field, bokeh, film grain, noise, blur, blurry, watermark, signature, text, logo, frame, border, vignette, lighting effects, lens flare, glow, reflection, glossy, shiny highlights, metallic sheen, transparency issues, cropped, cut off, partial object, off-center`;

/**
 * Build a full prompt from a preset template
 * Automatically adds white background and front-facing requirements for avatar assets
 */
export function buildPromptFromPreset(
  component: string,
  promptTemplate: string,
  styleSuffix?: string,
  negativePrompt?: string
): { prompt: string; negativePrompt?: string } {
  let prompt = promptTemplate.replace('{component}', component);

  if (styleSuffix) {
    prompt = `${prompt}, ${styleSuffix}`;
  }

  // Add asset-specific requirements
  prompt = `${prompt}${ASSET_PROMPT_SUFFIX}`;

  // Combine negative prompts
  const finalNegativePrompt = negativePrompt
    ? `${negativePrompt}, ${ASSET_NEGATIVE_PROMPT}`
    : ASSET_NEGATIVE_PROMPT;

  return {
    prompt,
    negativePrompt: finalNegativePrompt,
  };
}

/**
 * Check which AI providers are configured
 */
export function getConfiguredProviders(): { cloudflare: boolean; replicate: boolean; gemini: boolean } {
  const hasCloudflareToken = !!(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  return {
    cloudflare: !!(process.env.CLOUDFLARE_R2_ACCOUNT_ID && hasCloudflareToken),
    replicate: !!process.env.REPLICATE_API_TOKEN,
    gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
  };
}

/**
 * Generate varied prompts for a theme/category using Gemini or Cloudflare LLM
 * Prefers Gemini when available for better prompt quality
 * @param categoryPromptAddition - Optional category-specific prompt rules/guidelines
 */
export async function generateVariedPrompts(
  theme: string,
  categoryName: string,
  count: number = 10,
  styleSuffix?: string,
  categoryPromptAddition?: string
): Promise<{ prompts: string[]; error?: string }> {
  // Prefer Gemini for text generation when available
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (geminiApiKey) {
    return generateVariedPromptsWithGemini(
      theme,
      categoryName,
      count,
      styleSuffix,
      categoryPromptAddition,
      geminiApiKey
    );
  }

  // Fallback to Cloudflare
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;

  if (!accountId || !apiToken) {
    return { prompts: [], error: 'No AI text provider configured (need GOOGLE_GEMINI_API_KEY or Cloudflare)' };
  }

  const systemPrompt = `You are a professional 2D game asset prompt engineer. You create EXTREMELY UNIFORM and CONSISTENT image generation prompts for avatar customization items.

CRITICAL UNIFORMITY RULES - ALL prompts MUST follow these EXACTLY:
1. Every item is a SINGLE ISOLATED OBJECT - never a person, never worn/held
2. PURE WHITE BACKGROUND (#FFFFFF) - no exceptions, no gradients, no textures
3. PERFECTLY CENTERED - object fills 70-80% of frame, equal margins
4. FRONT-FACING SYMMETRIC VIEW - no angles, no 3/4 views, no perspective
5. FLAT SOLID COLORS - no gradients, no shading, no highlights, no shadows
6. CLEAN VECTOR STYLE - crisp edges, no anti-aliasing artifacts, professional quality
7. CONSISTENT ART STYLE - all items look like they belong in the same game
8. 2D ILLUSTRATION ONLY - never 3D, never photorealistic, never rendered

You generate prompts that will create assets looking like professional mobile game UI elements.`;

  const userPrompt = `Generate exactly ${count} unique image prompts for "${categoryName}" avatar components with theme: "${theme}"

MANDATORY FORMAT for EVERY prompt:
- Start with "a" or "an" + the item name
- Include 1-2 distinctive visual features (color, pattern, material)
- End with "flat vector illustration style" or "clean 2D game art style"
- Keep under 20 words total

UNIFORMITY REQUIREMENTS:
- All prompts describe the ISOLATED ITEM ONLY (e.g., "a red cap" NOT "person wearing cap")
- Vary colors, patterns, and details - but maintain the SAME art style across all
- Use flat, solid colors - no gradients or shading descriptions
- Describe simple, clean designs suitable for small avatar display
${styleSuffix ? `- Apply this visual style to all: ${styleSuffix}` : ''}
${categoryPromptAddition ? `\nCATEGORY-SPECIFIC RULES:\n${categoryPromptAddition}` : ''}

Return ONLY a valid JSON array of prompt strings. Example format:
["a bright red baseball cap with white stitching, flat vector illustration style", "an elegant black top hat with gold band, clean 2D game art style", "a cozy purple beanie with pom-pom, flat vector illustration style"]`;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_TEXT_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2048,
          temperature: 0.8,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { prompts: [], error: `Cloudflare AI error: ${error}` };
    }

    const result = await response.json() as {
      result?: { response?: string };
      success?: boolean;
      errors?: string[];
    };

    if (!result.success || !result.result?.response) {
      return { prompts: [], error: `AI error: ${result.errors?.join(', ') || 'No response'}` };
    }

    // Parse JSON array from response
    const responseText = result.result.response.trim();
    // Extract JSON array from response (may have extra text around it)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { prompts: [], error: 'Failed to parse prompts from AI response' };
    }

    const prompts = JSON.parse(jsonMatch[0]) as string[];
    return { prompts: prompts.slice(0, count) };
  } catch (error) {
    return { prompts: [], error: error instanceof Error ? error.message : 'Failed to generate prompts' };
  }
}

/**
 * Generate varied prompts using Google Gemini
 * Uses Gemini 2.0 Flash for fast, high-quality prompt generation
 */
async function generateVariedPromptsWithGemini(
  theme: string,
  categoryName: string,
  count: number,
  styleSuffix: string | undefined,
  categoryPromptAddition: string | undefined,
  apiKey: string
): Promise<{ prompts: string[]; error?: string }> {
  const systemPrompt = `You are a professional 2D game asset prompt engineer. You create EXTREMELY UNIFORM and CONSISTENT image generation prompts for avatar customization items.

CRITICAL UNIFORMITY RULES - ALL prompts MUST follow these EXACTLY:
1. Every item is a SINGLE ISOLATED OBJECT - never a person, never worn/held
2. PURE WHITE BACKGROUND (#FFFFFF) - no exceptions, no gradients, no textures
3. PERFECTLY CENTERED - object fills 70-80% of frame, equal margins
4. FRONT-FACING SYMMETRIC VIEW - no angles, no 3/4 views, no perspective
5. FLAT SOLID COLORS - no gradients, no shading, no highlights, no shadows
6. CLEAN VECTOR STYLE - crisp edges, no anti-aliasing artifacts, professional quality
7. CONSISTENT ART STYLE - all items look like they belong in the same game
8. 2D ILLUSTRATION ONLY - never 3D, never photorealistic, never rendered

You generate prompts that will create assets looking like professional mobile game UI elements.`;

  const userPrompt = `Generate exactly ${count} unique image prompts for "${categoryName}" avatar components with theme: "${theme}"

MANDATORY FORMAT for EVERY prompt:
- Start with "a" or "an" + the item name
- Include 1-2 distinctive visual features (color, pattern, material)
- End with "flat vector illustration style" or "clean 2D game art style"
- Keep under 20 words total

UNIFORMITY REQUIREMENTS:
- All prompts describe the ISOLATED ITEM ONLY (e.g., "a red cap" NOT "person wearing cap")
- Vary colors, patterns, and details - but maintain the SAME art style across all
- Use flat, solid colors - no gradients or shading descriptions
- Describe simple, clean designs suitable for small avatar display
${styleSuffix ? `- Apply this visual style to all: ${styleSuffix}` : ''}
${categoryPromptAddition ? `\nCATEGORY-SPECIFIC RULES:\n${categoryPromptAddition}` : ''}

Return ONLY a valid JSON array of prompt strings. Example format:
["a bright red baseball cap with white stitching, flat vector illustration style", "an elegant black top hat with gold band, clean 2D game art style", "a cozy purple beanie with pom-pom, flat vector illustration style"]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt + '\n\n' + userPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini text generation error:', error);
      return { prompts: [], error: `Gemini AI error: ${response.status}` };
    }

    const result = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      error?: { message: string };
    };

    if (result.error) {
      return { prompts: [], error: `Gemini error: ${result.error.message}` };
    }

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!responseText) {
      return { prompts: [], error: 'Gemini returned no response' };
    }

    // Parse JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { prompts: [], error: 'Failed to parse prompts from Gemini response' };
    }

    const prompts = JSON.parse(jsonMatch[0]) as string[];
    return { prompts: prompts.slice(0, count) };
  } catch (error) {
    console.error('Gemini text generation failed:', error);
    return { prompts: [], error: error instanceof Error ? error.message : 'Failed to generate prompts with Gemini' };
  }
}

export interface BatchGenerateRequest {
  theme: string;
  categoryId: string;
  categoryName: string;
  count: number;
  model: string;
  presetId?: string;
  styleSuffix?: string;
}

export interface BatchGenerateResult {
  prompt: string;
  images: string[];
  componentIdBase: string;
}

/**
 * Generate a batch of varied components for a category
 */
export async function generateBatch(
  request: BatchGenerateRequest
): Promise<{ results: BatchGenerateResult[]; error?: string }> {
  // First, generate varied prompts using LLM
  const { prompts, error: promptError } = await generateVariedPrompts(
    request.theme,
    request.categoryName,
    request.count,
    request.styleSuffix
  );

  if (promptError || prompts.length === 0) {
    return { results: [], error: promptError || 'No prompts generated' };
  }

  // Now generate images for each prompt
  const results: BatchGenerateResult[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    // Build full prompt with asset requirements
    const fullPromptData = buildPromptFromPreset(
      prompt,
      '{component}', // Simple template that just uses the component as-is
      request.styleSuffix
    );

    try {
      const imageResult = await generateAvatarImages({
        prompt: fullPromptData.prompt,
        negativePrompt: fullPromptData.negativePrompt,
        model: request.model,
        count: 1, // One image per prompt for variety
      });

      if (imageResult.images.length > 0) {
        // Generate a component ID from the prompt
        const componentIdBase = prompt
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 30);

        results.push({
          prompt,
          images: imageResult.images,
          componentIdBase: `${request.categoryId}_${componentIdBase}_${i + 1}`,
        });
      }
    } catch (error) {
      console.warn(`Failed to generate image for prompt: ${prompt}`, error);
      // Continue with other prompts
    }
  }

  return { results };
}
