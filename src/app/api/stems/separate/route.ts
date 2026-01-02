import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

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

// Replicate client for Demucs
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  // Rate limiting for expensive AI operations
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`stems:${clientId}`, rateLimiters.expensive);

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { trackId, trackUrl } = body;

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

    // Determine if we have Replicate API token
    const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN;

    // Start async separation
    if (hasReplicateToken) {
      separateWithDemucs(jobId, trackId, trackUrl);
    } else {
      mockSeparation(jobId, trackId);
    }

    return NextResponse.json({
      jobId,
      provider: hasReplicateToken ? 'demucs' : 'mock'
    });
  } catch (error) {
    console.error('Separation error:', error);
    return NextResponse.json(
      { error: 'Failed to start separation' },
      { status: 500 }
    );
  }
}

/**
 * Demucs Stem Separation via Replicate
 * Uses the Demucs model for high-quality stem separation
 * Output format: MP3 (compressed, not WAV)
 */
async function separateWithDemucs(
  jobId: string,
  trackId: string,
  trackUrl: string
) {
  const job = separations.get(jobId);
  if (!job) return;

  try {
    separations.set(jobId, {
      ...separations.get(jobId)!,
      progress: 10,
      message: 'Uploading audio to Demucs...',
    });

    // Use Demucs model on Replicate for stem separation
    // Output format is MP3 to keep file sizes reasonable
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

    // Set error state instead of falling back to mock
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    separations.set(jobId, {
      id: jobId,
      status: 'failed',
      progress: 0,
      message: 'Stem separation failed',
      error: errorMessage,
    });
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

  // Demo audio URLs (these are just placeholders for the demo)
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
