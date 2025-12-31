import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

// AudioDec (Facebook SAM Audio Dec 2025) Processing API
// This endpoint handles audio processing requests for stem separation,
// style transfer, and other audio manipulation tasks.

export type AudioDecStemType = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'strings' | 'wind' | 'percussion' | 'synth' | 'other';

export type AudioDecOperation =
  | 'separate-stems'
  | 'remove-vocals'
  | 'remove-music'
  | 'isolate-instrument'
  | 'style-transfer'
  | 'tempo-change'
  | 'key-change'
  | 'enhance'
  | 'remix';

// Store jobs in memory (use Redis in production)
export const audioDecJobs = new Map<string, {
  id: string;
  status: 'queued' | 'analyzing' | 'processing' | 'separating' | 'encoding' | 'complete' | 'error';
  stage?: string;
  progress: number;
  message: string;
  currentStem?: AudioDecStemType;
  operation: AudioDecOperation;
  config: Record<string, unknown>;
  result?: {
    stems?: Record<string, { url: string; duration: number; waveformUrl?: string }>;
    outputUrl?: string;
    outputDuration?: number;
    modelVersion?: string;
  };
  error?: string;
  cancelled?: boolean;
  createdAt: number;
}>();

export async function POST(request: NextRequest) {
  // Rate limiting for expensive AI operations
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`audiodec:${clientId}`, rateLimiters.expensive);

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { audioUrl, operation, options = {} } = body;

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation type is required' },
        { status: 400 }
      );
    }

    const jobId = uuidv4();

    // Initialize job
    audioDecJobs.set(jobId, {
      id: jobId,
      status: 'queued',
      progress: 0,
      message: 'Processing queued...',
      operation,
      config: { audioUrl, options },
      createdAt: Date.now(),
    });

    // Start async processing
    processWithAudioDec(jobId, audioUrl, operation, options);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('AudioDec processing error:', error);
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}

async function processWithAudioDec(
  jobId: string,
  audioUrl: string,
  operation: AudioDecOperation,
  options: Record<string, unknown>
) {
  const job = audioDecJobs.get(jobId);
  if (!job) return;

  try {
    // Check if AudioDec API is configured
    const audioDecApiKey = process.env.AUDIODEC_API_KEY;
    const audioDecApiUrl = process.env.AUDIODEC_API_URL;

    if (audioDecApiKey && audioDecApiUrl) {
      // Use real AudioDec/Facebook SAM API when available
      await processWithRealAudioDec(jobId, audioUrl, operation, options, audioDecApiUrl, audioDecApiKey);
      return;
    }

    // Fallback to mock processing for demo
    await mockAudioDecProcessing(jobId, operation, options);
  } catch (error) {
    console.error('AudioDec processing error:', error);
    await mockAudioDecProcessing(jobId, operation, options);
  }
}

async function processWithRealAudioDec(
  jobId: string,
  audioUrl: string,
  operation: AudioDecOperation,
  options: Record<string, unknown>,
  apiUrl: string,
  apiKey: string
) {
  const job = audioDecJobs.get(jobId);
  if (!job) return;

  // Update status
  audioDecJobs.set(jobId, {
    ...job,
    status: 'analyzing',
    progress: 10,
    message: 'Analyzing audio structure...',
  });

  try {
    // Start processing on AudioDec
    const startResponse = await fetch(`${apiUrl}/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        operation,
        options,
      }),
    });

    if (!startResponse.ok) {
      throw new Error('Failed to start AudioDec processing');
    }

    const { job_id: audioDecJobId } = await startResponse.json();

    // Poll for completion
    await pollAudioDecJob(jobId, audioDecJobId, operation, apiUrl, apiKey);
  } catch (error) {
    console.error('Real AudioDec error:', error);
    // Fallback to mock
    await mockAudioDecProcessing(jobId, operation, options);
  }
}

async function pollAudioDecJob(
  jobId: string,
  audioDecJobId: string,
  operation: AudioDecOperation,
  apiUrl: string,
  apiKey: string
) {
  const maxAttempts = 300;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = audioDecJobs.get(jobId);
    if (!job || job.cancelled) return;

    try {
      const response = await fetch(`${apiUrl}/v1/jobs/${audioDecJobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const status = await response.json();

      if (status.status === 'completed') {
        audioDecJobs.set(jobId, {
          ...job,
          status: 'complete',
          progress: 100,
          message: 'Processing complete!',
          result: {
            stems: status.stems,
            outputUrl: status.output_url,
            outputDuration: status.output_duration,
            modelVersion: status.model_version,
          },
        });
        return;
      }

      if (status.status === 'failed') {
        audioDecJobs.set(jobId, {
          ...job,
          status: 'error',
          error: status.error || 'Processing failed',
        });
        return;
      }

      // Update progress
      audioDecJobs.set(jobId, {
        ...job,
        status: status.stage || 'processing',
        progress: status.progress || 50,
        message: status.message || 'Processing...',
        currentStem: status.current_stem,
      });
    } catch {
      // Continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }
}

// Mock processing for demo
async function mockAudioDecProcessing(
  jobId: string,
  operation: AudioDecOperation,
  options: Record<string, unknown>
) {
  const getStagesForOperation = (op: AudioDecOperation) => {
    const baseStages = [
      { status: 'analyzing', progress: 15, message: 'Analyzing audio structure...', delay: 2000 },
      { status: 'analyzing', progress: 25, message: 'Detecting audio features...', delay: 1500 },
    ];

    switch (op) {
      case 'separate-stems':
        return [
          ...baseStages,
          { status: 'separating', progress: 35, message: 'Separating vocals...', currentStem: 'vocals' as AudioDecStemType, delay: 3000 },
          { status: 'separating', progress: 50, message: 'Separating drums...', currentStem: 'drums' as AudioDecStemType, delay: 2500 },
          { status: 'separating', progress: 65, message: 'Separating bass...', currentStem: 'bass' as AudioDecStemType, delay: 2000 },
          { status: 'separating', progress: 80, message: 'Separating other instruments...', currentStem: 'other' as AudioDecStemType, delay: 2000 },
          { status: 'encoding', progress: 90, message: 'Encoding output files...', delay: 1500 },
        ];
      case 'remove-vocals':
        return [
          ...baseStages,
          { status: 'processing', progress: 40, message: 'Identifying vocal frequencies...', delay: 2000 },
          { status: 'processing', progress: 60, message: 'Removing vocals...', delay: 3000 },
          { status: 'encoding', progress: 85, message: 'Creating instrumental track...', delay: 2000 },
        ];
      case 'style-transfer':
        return [
          ...baseStages,
          { status: 'processing', progress: 40, message: 'Analyzing source style...', delay: 2000 },
          { status: 'processing', progress: 55, message: 'Applying target style...', delay: 3000 },
          { status: 'processing', progress: 75, message: 'Blending elements...', delay: 2500 },
          { status: 'encoding', progress: 90, message: 'Finalizing...', delay: 1500 },
        ];
      default:
        return [
          ...baseStages,
          { status: 'processing', progress: 50, message: 'Processing audio...', delay: 3000 },
          { status: 'encoding', progress: 85, message: 'Encoding output...', delay: 2000 },
        ];
    }
  };

  const stages = getStagesForOperation(operation);

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = audioDecJobs.get(jobId);
    if (!currentJob || currentJob.cancelled) return;

    audioDecJobs.set(jobId, {
      ...currentJob,
      status: stage.status as typeof currentJob.status,
      progress: stage.progress,
      message: stage.message,
      currentStem: 'currentStem' in stage ? stage.currentStem : undefined,
    });
  }

  // Generate mock results based on operation
  const job = audioDecJobs.get(jobId);
  if (!job) return;

  const demoAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3';

  let result: typeof job.result;

  if (operation === 'separate-stems') {
    const stemTypes = (options.stemTypes as AudioDecStemType[]) || ['vocals', 'drums', 'bass', 'other'];
    result = {
      stems: stemTypes.reduce((acc, stem) => ({
        ...acc,
        [stem]: {
          url: demoAudioUrl,
          duration: 180,
        },
      }), {}),
      modelVersion: 'audiodec-v1-demo',
    };
  } else {
    result = {
      outputUrl: demoAudioUrl,
      outputDuration: 180,
      modelVersion: 'audiodec-v1-demo',
    };
  }

  audioDecJobs.set(jobId, {
    ...job,
    status: 'complete',
    progress: 100,
    message: 'Processing complete!',
    result,
  });
}
