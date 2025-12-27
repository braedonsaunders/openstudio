import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Mock generation jobs
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

    // Simulate async generation (in production, this would call Suno API)
    simulateGeneration(generationId, prompt, duration, style);

    return NextResponse.json({ generationId });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}

// Simulate generation process
async function simulateGeneration(
  generationId: string,
  prompt: string,
  duration: number,
  style?: string
) {
  const job = generations.get(generationId);
  if (!job) return;

  // Simulate stages
  const stages = [
    { status: 'generating', progress: 20, message: 'AI is composing your track...', delay: 2000 },
    { status: 'generating', progress: 40, message: 'Creating melody and harmony...', delay: 3000 },
    { status: 'generating', progress: 60, message: 'Adding instruments...', delay: 3000 },
    { status: 'processing', progress: 80, message: 'Rendering audio...', delay: 2000 },
    { status: 'processing', progress: 95, message: 'Finalizing...', delay: 1000 },
  ];

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = generations.get(generationId);
    if (!currentJob) return;

    generations.set(generationId, {
      ...currentJob,
      status: stage.status as 'generating' | 'processing',
      progress: stage.progress,
      message: stage.message,
    });
  }

  // Complete with mock track
  const trackId = uuidv4();
  generations.set(generationId, {
    id: generationId,
    status: 'complete',
    progress: 100,
    message: 'Track generated successfully!',
    track: {
      id: trackId,
      title: `AI Track: ${prompt.slice(0, 30)}...`,
      audioUrl: `/api/tracks/${trackId}/audio`,
      duration,
      style: style || 'generated',
    },
  });
}
