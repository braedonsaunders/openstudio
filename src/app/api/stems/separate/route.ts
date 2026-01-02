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
    guitar?: string;
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
  // Check for Replicate API token first
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Stem separation is not configured. REPLICATE_API_TOKEN is required.' },
      { status: 503 }
    );
  }

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

    // Start async separation with Demucs
    separateWithDemucs(jobId, trackId, trackUrl);

    return NextResponse.json({ jobId });
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
 * Uses ryan5453/demucs model for high-quality stem separation
 * Returns: vocals, drums, bass, guitar, other
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

    // Use ryan5453/demucs model on Replicate for stem separation
    const output = await replicate.run(
      "ryan5453/demucs:5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77",
      {
        input: {
          audio: trackUrl,
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
      guitar?: string;
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
        guitar: stems.guitar,
        other: stems.other,
      },
    });
  } catch (error) {
    console.error('Demucs separation error:', error);

    // Set error state
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
