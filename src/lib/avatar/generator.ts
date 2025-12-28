// AI image generation for avatar components
// Supports Cloudflare Workers AI (primary) and Replicate (fallback)

import type { GenerateImageRequest, GenerateImageResponse } from '@/types/avatar';

// Available models
export type AIModel = 'cf-sdxl-lightning' | 'cf-sdxl-base' | 'cf-flux-schnell' | 'replicate-flux-schnell' | 'replicate-sdxl';

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
 * Get available AI models
 */
export function getAvailableModels(): Array<{ id: AIModel; name: string; provider: string; speed: string; cost: string }> {
  return [
    { id: 'cf-flux-schnell', name: 'FLUX Schnell', provider: 'Cloudflare', speed: 'Fast', cost: 'Very Low' },
    { id: 'cf-sdxl-lightning', name: 'SDXL Lightning', provider: 'Cloudflare', speed: 'Very Fast', cost: 'Very Low' },
    { id: 'cf-sdxl-base', name: 'SDXL Base', provider: 'Cloudflare', speed: 'Medium', cost: 'Very Low' },
    { id: 'replicate-flux-schnell', name: 'FLUX Schnell', provider: 'Replicate', speed: 'Fast', cost: 'Low' },
    { id: 'replicate-sdxl', name: 'SDXL', provider: 'Replicate', speed: 'Medium', cost: 'Low' },
  ];
}

/**
 * Build a full prompt from a preset template
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

  return {
    prompt,
    negativePrompt,
  };
}

/**
 * Check which AI providers are configured
 */
export function getConfiguredProviders(): { cloudflare: boolean; replicate: boolean } {
  const hasCloudflareToken = !!(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  return {
    cloudflare: !!(process.env.CLOUDFLARE_R2_ACCOUNT_ID && hasCloudflareToken),
    replicate: !!process.env.REPLICATE_API_TOKEN,
  };
}
