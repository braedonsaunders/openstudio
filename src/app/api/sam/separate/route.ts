import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';

// Store separation jobs in memory (use Redis in production)
const separations = new Map<string, {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  stems?: {
    vocals?: string;
    drums?: string;
    bass?: string;
    other?: string;
  };
  error?: string;
}>();

// Export for status endpoint
export { separations };

// Replicate client for Demucs fallback
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, trackUrl, provider = 'auto' } = body;

    if (!trackId || !trackUrl) {
      return NextResponse.json(
        { error: 'Track ID and URL are required' },
        { status: 400 }
      );
    }

    const jobId = uuidv4();

    // Initialize separation job
    separations.set(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
      message: 'Starting stem separation...',
    });

    // Determine which provider to use
    const selectedProvider = provider === 'auto'
      ? (process.env.SAM_AUDIO_API_URL ? 'sam' :
         process.env.REPLICATE_API_TOKEN ? 'demucs' : 'mock')
      : provider;

    // Start async separation based on provider
    switch (selectedProvider) {
      case 'sam':
        separateWithSAMAudio(jobId, trackId, trackUrl);
        break;
      case 'demucs':
        separateWithDemucs(jobId, trackId, trackUrl);
        break;
      default:
        mockSeparation(jobId, trackId);
    }

    return NextResponse.json({ jobId, provider: selectedProvider });
  } catch (error) {
    console.error('Separation error:', error);
    return NextResponse.json(
      { error: 'Failed to start separation' },
      { status: 500 }
    );
  }
}

/**
 * Meta SAM Audio Separation
 * Uses Meta's Segment Anything for Audio model
 * Requires SAM_AUDIO_API_URL environment variable pointing to self-hosted or AudioGhost API
 *
 * API Options:
 * 1. Self-hosted: Deploy facebookresearch/sam-audio with FastAPI wrapper
 * 2. AudioGhost AI: Use community API at 0x0funky/audioghost-ai
 *
 * Model sizes: sam-audio-small (~4GB VRAM), sam-audio-base, sam-audio-large (12GB+ VRAM)
 */
async function separateWithSAMAudio(
  jobId: string,
  trackId: string,
  trackUrl: string
) {
  const job = separations.get(jobId);
  if (!job) return;

  try {
    const apiUrl = process.env.SAM_AUDIO_API_URL;
    const apiKey = process.env.SAM_API_KEY;

    if (!apiUrl) {
      console.log('SAM Audio API URL not configured, falling back to Demucs');
      await separateWithDemucs(jobId, trackId, trackUrl);
      return;
    }

    // Stem descriptions for SAM Audio text prompting
    const stemDescriptions = {
      vocals: 'singing voice, vocals, human voice',
      drums: 'drums, percussion, cymbals, hi-hat, snare, kick drum',
      bass: 'bass guitar, bass, low frequency instruments',
      other: 'guitar, piano, synthesizer, other instruments',
    };

    const stems: Record<string, string> = {};
    const stemKeys = Object.keys(stemDescriptions) as (keyof typeof stemDescriptions)[];

    for (let i = 0; i < stemKeys.length; i++) {
      const stemKey = stemKeys[i];
      const description = stemDescriptions[stemKey];
      const progress = 15 + (i * 20);

      separations.set(jobId, {
        ...separations.get(jobId)!,
        progress,
        message: `Extracting ${stemKey}...`,
      });

      // Call SAM Audio API for each stem
      const response = await fetch(`${apiUrl}/api/separate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          audio_url: trackUrl,
          description: description,
          predict_spans: true,
          reranking_candidates: 4, // Balance between quality and speed
        }),
      });

      if (!response.ok) {
        throw new Error(`SAM Audio API error: ${response.statusText}`);
      }

      const result = await response.json();

      // Handle async task-based API (like AudioGhost)
      if (result.task_id) {
        const stemUrl = await pollSAMTask(apiUrl, result.task_id, apiKey);
        stems[stemKey] = stemUrl;
      } else if (result.target_url) {
        stems[stemKey] = result.target_url;
      }
    }

    separations.set(jobId, {
      id: jobId,
      status: 'completed',
      progress: 100,
      message: 'Stem separation complete!',
      stems: stems as { vocals?: string; drums?: string; bass?: string; other?: string },
    });
  } catch (error) {
    console.error('SAM Audio separation error:', error);
    // Fallback to Demucs if SAM fails
    await separateWithDemucs(jobId, trackId, trackUrl);
  }
}

/**
 * Poll SAM Audio async task until completion (for task-based APIs like AudioGhost)
 */
async function pollSAMTask(
  apiUrl: string,
  taskId: string,
  apiKey?: string
): Promise<string> {
  const maxAttempts = 60; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`${apiUrl}/api/separate/${taskId}/status`, {
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to check SAM task status: ${response.statusText}`);
    }

    const status = await response.json();

    if (status.status === 'completed') {
      // Download the target stem
      const downloadUrl = `${apiUrl}/api/separate/${taskId}/download/target`;
      return downloadUrl;
    } else if (status.status === 'failed') {
      throw new Error(status.error || 'SAM separation failed');
    }

    // Wait 5 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('SAM separation timed out');
}

/**
 * Demucs Separation via Replicate
 * Uses the Demucs model for high-quality stem separation
 * Fallback when SAM Audio is not available
 */
async function separateWithDemucs(
  jobId: string,
  trackId: string,
  trackUrl: string
) {
  const job = separations.get(jobId);
  if (!job) return;

  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.log('Replicate API token not configured, using mock separation');
      await mockSeparation(jobId, trackId);
      return;
    }

    separations.set(jobId, {
      ...separations.get(jobId)!,
      progress: 15,
      message: 'Analyzing audio with Demucs...',
    });

    // Use Demucs model on Replicate for stem separation
    const output = await replicate.run(
      "cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81b7a0f3b7571398",
      {
        input: {
          audio: trackUrl,
          stems: "drums,bass,vocals,other",
          output_format: "mp3",
        }
      }
    );

    separations.set(jobId, {
      ...separations.get(jobId)!,
      progress: 85,
      message: 'Processing separated stems...',
    });

    // Parse the output - Demucs returns URLs for each stem
    const stems = output as unknown as {
      vocals?: string;
      drums?: string;
      bass?: string;
      other?: string;
    };

    separations.set(jobId, {
      id: jobId,
      status: 'completed',
      progress: 100,
      message: 'Stem separation complete!',
      stems: {
        vocals: stems.vocals,
        drums: stems.drums,
        bass: stems.bass,
        other: stems.other,
      },
    });
  } catch (error) {
    console.error('Demucs separation error:', error);
    await mockSeparation(jobId, trackId);
  }
}

/**
 * Mock separation for demo/development
 * Returns sample audio URLs to demonstrate the UI flow
 */
async function mockSeparation(jobId: string, trackId: string) {
  const stages = [
    { progress: 20, message: 'Analyzing audio structure...', delay: 1500 },
    { progress: 40, message: 'Isolating vocals...', delay: 2000 },
    { progress: 55, message: 'Extracting drums...', delay: 2000 },
    { progress: 70, message: 'Separating bass...', delay: 2000 },
    { progress: 85, message: 'Processing other instruments...', delay: 1500 },
    { progress: 95, message: 'Finalizing stems...', delay: 1000 },
  ];

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = separations.get(jobId);
    if (!currentJob) return;

    separations.set(jobId, {
      ...currentJob,
      progress: stage.progress,
      message: stage.message,
    });
  }

  // Demo audio URLs
  const demoStems = {
    vocals: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    drums: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    bass: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    other: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  };

  separations.set(jobId, {
    id: jobId,
    status: 'completed',
    progress: 100,
    message: 'Stem separation complete! (Demo mode)',
    stems: demoStems,
  });
}
