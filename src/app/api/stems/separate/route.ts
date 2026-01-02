import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

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

    // Check for blob URLs which can't be fetched server-side
    if (trackUrl.startsWith('blob:')) {
      return NextResponse.json(
        { error: 'Blob URLs are not supported. Please use an uploaded audio file.' },
        { status: 400 }
      );
    }

    // Get the base URL for resolving relative URLs
    const baseUrl = request.headers.get('origin') ||
                    request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
                    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Resolve relative URLs to absolute
    let absoluteUrl = trackUrl;
    if (trackUrl.startsWith('/')) {
      absoluteUrl = `${baseUrl}${trackUrl}`;
    } else if (!trackUrl.startsWith('http://') && !trackUrl.startsWith('https://')) {
      absoluteUrl = `${baseUrl}/${trackUrl}`;
    }

    console.log(`[Stems] Fetching audio from: ${absoluteUrl} (original: ${trackUrl})`);

    // Fetch the audio file and convert to data URI for Replicate
    const audioResponse = await fetch(absoluteUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}` },
        { status: 400 }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const dataUri = `data:${contentType};base64,${base64Audio}`;

    console.log(`[Stems] Audio fetched (${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB), sending to Demucs...`);

    // Use ryan5453/demucs model on Replicate for stem separation
    // This is synchronous - waits for completion
    const output = await replicate.run(
      "ryan5453/demucs:5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77",
      {
        input: {
          audio: dataUri,
        }
      }
    );

    console.log('[Stems] Demucs completed:', output);

    // Parse the output - Demucs returns URLs for each stem
    const stems = output as unknown as {
      vocals?: string;
      drums?: string;
      bass?: string;
      guitar?: string;
      other?: string;
    };

    return NextResponse.json({
      status: 'completed',
      stems: {
        vocals: stems.vocals,
        drums: stems.drums,
        bass: stems.bass,
        guitar: stems.guitar,
        other: stems.other,
      },
    });
  } catch (error) {
    console.error('Stem separation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Stem separation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
