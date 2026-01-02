import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';
import { getUserFromRequest } from '@/lib/supabase/server';

// Replicate client for Demucs
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// R2 client for storing stems
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'openstudio-tracks';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request: NextRequest) {
  // Check for Replicate API token first
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Stem separation is not configured. REPLICATE_API_TOKEN is required.' },
      { status: 503 }
    );
  }

  // Get user for ownership tracking
  const user = await getUserFromRequest(request);
  const userId = user?.id || 'anonymous';

  // Rate limiting for expensive AI operations
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`stems:${clientId}`, rateLimiters.expensive);

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { trackId, trackUrl, trackName, trackDuration } = body;

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
    const output = await replicate.run(
      "ryan5453/demucs:5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77",
      {
        input: {
          audio: dataUri,
        }
      }
    );

    console.log('[Stems] Demucs completed, raw output:', JSON.stringify(output, null, 2));

    // Parse the output - Demucs returns URLs for each stem
    // The output format may vary - could be direct URLs or objects
    const replicateOutput = output as Record<string, unknown>;

    // Download stems from Replicate and upload to R2
    const stemNames = ['vocals', 'drums', 'bass', 'guitar', 'other'] as const;
    const stems: Record<string, { id: string; url: string; name: string }> = {};

    for (const stemName of stemNames) {
      const stemOutput = replicateOutput[stemName];

      // Handle different output formats
      if (!stemOutput) continue;

      let replicateUrl: string | undefined;

      // Replicate SDK v1.x returns FileOutput objects
      // FileOutput has url() method and can be read as a Blob
      // See: https://github.com/replicate/replicate-javascript

      let stemBuffer: ArrayBuffer | undefined;

      if (typeof stemOutput === 'string') {
        // Direct string URL - fetch it
        replicateUrl = stemOutput;
        console.log(`[Stems] ${stemName} is a string URL: ${replicateUrl}`);
      } else if (stemOutput && typeof stemOutput === 'object') {
        // FileOutput object from Replicate SDK v1.x
        const fileOutput = stemOutput as {
          url?: () => string | URL;
          blob?: () => Promise<Blob>;
          arrayBuffer?: () => Promise<ArrayBuffer>;
        };

        console.log(`[Stems] ${stemName} FileOutput methods:`,
          'url:', typeof fileOutput.url,
          'blob:', typeof fileOutput.blob,
          'arrayBuffer:', typeof fileOutput.arrayBuffer
        );

        // Method 1: Try to get the URL
        try {
          if (typeof fileOutput.url === 'function') {
            const urlResult = fileOutput.url();
            // url() returns a URL object, not a string - get the href
            if (urlResult instanceof URL) {
              replicateUrl = urlResult.href;
            } else if (typeof urlResult === 'string') {
              replicateUrl = urlResult;
            } else if (urlResult && typeof urlResult === 'object' && 'href' in urlResult) {
              replicateUrl = (urlResult as { href: string }).href;
            }
            console.log(`[Stems] ${stemName} URL:`, replicateUrl);
          }
        } catch (e) {
          console.error(`[Stems] Error calling url() on ${stemName}:`, e);
        }

        // Method 2: Read directly as ArrayBuffer (preferred - avoids extra network request)
        if (!replicateUrl && typeof fileOutput.arrayBuffer === 'function') {
          try {
            console.log(`[Stems] ${stemName} reading as arrayBuffer...`);
            stemBuffer = await fileOutput.arrayBuffer();
            console.log(`[Stems] ${stemName} arrayBuffer size:`, stemBuffer.byteLength);
          } catch (e) {
            console.error(`[Stems] Error reading arrayBuffer from ${stemName}:`, e);
          }
        }

        // Method 3: Read as Blob then convert
        if (!stemBuffer && !replicateUrl && typeof fileOutput.blob === 'function') {
          try {
            console.log(`[Stems] ${stemName} reading as blob...`);
            const blob = await fileOutput.blob();
            stemBuffer = await blob.arrayBuffer();
            console.log(`[Stems] ${stemName} blob size:`, stemBuffer.byteLength);
          } catch (e) {
            console.error(`[Stems] Error reading blob from ${stemName}:`, e);
          }
        }
      }

      // Either need a URL to fetch or already have the buffer
      if (!replicateUrl && !stemBuffer) {
        console.error(`[Stems] ${stemName} - Could not extract URL or data from:`,
          typeof stemOutput,
          stemOutput?.constructor?.name
        );
        continue;
      }

      try {
        console.log(`[Stems] Processing ${stemName}...`);

        let finalBuffer: ArrayBuffer;

        if (stemBuffer) {
          // Already have the buffer from FileOutput
          finalBuffer = stemBuffer;
          console.log(`[Stems] Using direct buffer for ${stemName}, size: ${finalBuffer.byteLength}`);
        } else if (replicateUrl) {
          // Fetch from URL
          console.log(`[Stems] Fetching ${stemName} from: ${replicateUrl}`);
          const stemResponse = await fetch(replicateUrl);
          if (!stemResponse.ok) {
            console.error(`Failed to download ${stemName} stem: ${stemResponse.status}`);
            continue;
          }
          finalBuffer = await stemResponse.arrayBuffer();
        } else {
          console.error(`[Stems] No buffer or URL for ${stemName}`);
          continue;
        }

        const stemId = uuidv4();

        // Demucs outputs MP3 files - always use audio/mpeg
        const extension = 'mp3';
        const stemContentType = 'audio/mpeg';

        // Upload to R2 with user subdirectory (same structure as regular uploads)
        const key = `tracks/${userId}/${stemId}.${extension}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: Buffer.from(finalBuffer),
          ContentType: stemContentType,
        }));

        console.log(`[Stems] Uploaded ${stemName} to R2: ${key}`);

        // Store stem info with the proxy URL format
        // Put stem name at front for clarity
        const baseName = trackName || 'Track';
        const stemLabel = stemName.charAt(0).toUpperCase() + stemName.slice(1);
        stems[stemName] = {
          id: stemId,
          url: `/api/audio/${stemId}`,
          name: `${stemLabel} - ${baseName}`,
        };
      } catch (error) {
        console.error(`Error processing ${stemName} stem:`, error);
      }
    }

    return NextResponse.json({
      status: 'completed',
      stems,
      duration: trackDuration || 0,
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
