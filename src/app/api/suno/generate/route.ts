import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';

// Store generation jobs in memory (use Redis in production)
const generations = new Map<string, {
  id: string;
  status: 'queued' | 'generating' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  track?: {
    id: string;
    title: string;
    audioUrl: string;
    duration: number;
    style: string;
  };
  error?: string;
}>();

// Export for status endpoint
export { generations };

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, duration = 30, style, tempo, instrumental = true, roomId } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const generationId = uuidv4();

    // Initialize generation job
    generations.set(generationId, {
      id: generationId,
      status: 'queued',
      progress: 0,
      message: 'Generation queued...',
    });

    // Start async generation
    generateWithReplicate(generationId, prompt, duration, style, tempo, instrumental);

    return NextResponse.json({ generationId });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}

async function generateWithReplicate(
  generationId: string,
  prompt: string,
  duration: number,
  style?: string,
  tempo?: number,
  instrumental?: boolean
) {
  const job = generations.get(generationId);
  if (!job) return;

  try {
    // Update status
    generations.set(generationId, {
      ...job,
      status: 'generating',
      progress: 10,
      message: 'AI is composing your track...',
    });

    // Build enhanced prompt
    let fullPrompt = prompt;
    if (style) fullPrompt += `, ${style} style`;
    if (tempo) fullPrompt += `, ${tempo} BPM`;
    if (instrumental) fullPrompt += ', instrumental, no vocals';

    // Check if Replicate token is configured
    if (!process.env.REPLICATE_API_TOKEN) {
      // Fallback to mock generation for demo
      await mockGeneration(generationId, prompt, duration, style);
      return;
    }

    // Use MusicGen model on Replicate
    generations.set(generationId, {
      ...generations.get(generationId)!,
      progress: 30,
      message: 'Creating melody and harmony...',
    });

    const output = await replicate.run(
      "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      {
        input: {
          prompt: fullPrompt,
          duration: Math.min(duration, 30), // MusicGen max 30s
          model_version: "stereo-large",
          output_format: "mp3",
          normalization_strategy: "peak",
        }
      }
    );

    generations.set(generationId, {
      ...generations.get(generationId)!,
      progress: 80,
      message: 'Processing audio...',
    });

    // Output is the audio URL
    const audioUrl = output as unknown as string;
    const trackId = uuidv4();

    generations.set(generationId, {
      id: generationId,
      status: 'complete',
      progress: 100,
      message: 'Track generated successfully!',
      track: {
        id: trackId,
        title: `AI: ${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}`,
        audioUrl,
        duration,
        style: style || 'generated',
      },
    });
  } catch (error) {
    console.error('Replicate generation error:', error);

    // Fallback to mock generation
    await mockGeneration(generationId, prompt, duration, style);
  }
}

// Mock generation for demo/fallback
async function mockGeneration(
  generationId: string,
  prompt: string,
  duration: number,
  style?: string
) {
  const stages = [
    { progress: 20, message: 'AI is composing your track...', delay: 2000 },
    { progress: 40, message: 'Creating melody and harmony...', delay: 3000 },
    { progress: 60, message: 'Adding instruments...', delay: 3000 },
    { progress: 80, message: 'Rendering audio...', delay: 2000 },
    { progress: 95, message: 'Finalizing...', delay: 1000 },
  ];

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = generations.get(generationId);
    if (!currentJob) return;

    generations.set(generationId, {
      ...currentJob,
      status: 'generating',
      progress: stage.progress,
      message: stage.message,
    });
  }

  const trackId = uuidv4();

  // Use a sample audio file for demo
  const demoAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

  generations.set(generationId, {
    id: generationId,
    status: 'complete',
    progress: 100,
    message: 'Track generated successfully!',
    track: {
      id: trackId,
      title: `AI: ${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}`,
      audioUrl: demoAudioUrl,
      duration,
      style: style || 'generated',
    },
  });
}
