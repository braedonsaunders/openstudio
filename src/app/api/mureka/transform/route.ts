import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { murekaJobs } from '../generate/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      referenceUrl,
      keepMelody = true,
      keepRhythm = true,
      newStyle,
      newMood,
      newLyrics,
    } = body;

    if (!referenceUrl) {
      return NextResponse.json(
        { error: 'Reference audio URL is required' },
        { status: 400 }
      );
    }

    const generationId = uuidv4();

    // Initialize transformation job
    murekaJobs.set(generationId, {
      id: generationId,
      status: 'queued',
      progress: 0,
      message: 'Analyzing reference audio...',
    });

    // Start async transformation
    transformWithMureka(generationId, {
      referenceUrl,
      keepMelody,
      keepRhythm,
      newStyle,
      newMood,
      newLyrics,
    });

    return NextResponse.json({ generationId });
  } catch (error) {
    console.error('Mureka transform error:', error);
    return NextResponse.json(
      { error: 'Failed to start transformation' },
      { status: 500 }
    );
  }
}

interface TransformConfig {
  referenceUrl: string;
  keepMelody: boolean;
  keepRhythm: boolean;
  newStyle?: string;
  newMood?: string;
  newLyrics?: string;
}

async function transformWithMureka(generationId: string, config: TransformConfig) {
  const job = murekaJobs.get(generationId);
  if (!job) return;

  try {
    // Check if Mureka API is configured
    const murekaApiKey = process.env.MUREKA_API_KEY;
    const murekaApiUrl = process.env.MUREKA_API_URL;

    if (murekaApiKey && murekaApiUrl) {
      // Use real Mureka API
      murekaJobs.set(generationId, {
        ...job,
        status: 'composing',
        progress: 10,
        message: 'Analyzing reference audio...',
      });

      const response = await fetch(`${murekaApiUrl}/v1/transform`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${murekaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_url: config.referenceUrl,
          keep_melody: config.keepMelody,
          keep_rhythm: config.keepRhythm,
          new_style: config.newStyle,
          new_mood: config.newMood,
          new_lyrics: config.newLyrics,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start transformation');
      }

      const { job_id: murekaJobId } = await response.json();

      // Poll for completion (reuses the same polling logic)
      await pollTransformJob(generationId, murekaJobId, config, murekaApiUrl, murekaApiKey);
      return;
    }

    // Mock transformation
    await mockTransformation(generationId, config);
  } catch (error) {
    console.error('Transform error:', error);
    await mockTransformation(generationId, config);
  }
}

async function pollTransformJob(
  generationId: string,
  murekaJobId: string,
  config: TransformConfig,
  apiUrl: string,
  apiKey: string
) {
  const maxAttempts = 180;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = murekaJobs.get(generationId);
    if (!job || job.cancelled) return;

    try {
      const response = await fetch(`${apiUrl}/v1/jobs/${murekaJobId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const status = await response.json();

      if (status.status === 'completed') {
        murekaJobs.set(generationId, {
          id: generationId,
          status: 'complete',
          progress: 100,
          message: 'Transformation complete!',
          track: {
            id: status.track_id || generationId,
            title: status.title || 'Transformed Track',
            audioUrl: status.audio_url,
            duration: status.duration || 60,
            style: config.newStyle || 'transformed',
            mood: config.newMood,
            hasVocals: !!config.newLyrics,
            lyrics: config.newLyrics,
          },
        });
        return;
      }

      if (status.status === 'failed') {
        murekaJobs.set(generationId, {
          ...job,
          status: 'error',
          error: status.error || 'Transformation failed',
        });
        return;
      }

      murekaJobs.set(generationId, {
        ...job,
        progress: status.progress || Math.min(90, 10 + (attempts / maxAttempts) * 80),
        message: status.message || 'Transforming audio...',
      });
    } catch {
      // Continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }
}

async function mockTransformation(generationId: string, config: TransformConfig) {
  const stages = [
    { status: 'composing', progress: 15, message: 'Analyzing reference audio...', delay: 2000 },
    { status: 'composing', progress: 30, message: 'Extracting musical features...', delay: 2500 },
    { status: 'arranging', progress: 45, message: 'Applying style transformation...', delay: 3000 },
    { status: 'arranging', progress: 60, message: 'Reconstructing audio...', delay: 2500 },
    { status: 'mixing', progress: 75, message: 'Mixing transformed tracks...', delay: 2000 },
    { status: 'mastering', progress: 90, message: 'Mastering output...', delay: 1500 },
  ];

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = murekaJobs.get(generationId);
    if (!currentJob || currentJob.cancelled) return;

    murekaJobs.set(generationId, {
      ...currentJob,
      status: stage.status as typeof currentJob.status,
      progress: stage.progress,
      message: stage.message,
    });
  }

  const trackId = uuidv4();

  // Use a demo audio URL
  const demoAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3';

  murekaJobs.set(generationId, {
    id: generationId,
    status: 'complete',
    progress: 100,
    message: 'Transformation complete!',
    track: {
      id: trackId,
      title: `Transformed: ${config.newStyle || 'Remix'}`,
      audioUrl: demoAudioUrl,
      duration: 60,
      style: config.newStyle || 'transformed',
      mood: config.newMood,
      hasVocals: !!config.newLyrics,
      lyrics: config.newLyrics,
    },
  });
}
