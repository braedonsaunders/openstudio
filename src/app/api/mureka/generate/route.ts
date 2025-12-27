import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Store generation jobs in memory (use Redis in production)
export const murekaJobs = new Map<string, {
  id: string;
  status: 'queued' | 'composing' | 'arranging' | 'vocals' | 'mixing' | 'mastering' | 'complete' | 'error';
  stage?: string;
  progress: number;
  message: string;
  currentStep?: string;
  track?: {
    id: string;
    title: string;
    audioUrl: string;
    duration: number;
    style: string;
    mood?: string;
    lyrics?: string;
    hasVocals: boolean;
    waveformUrl?: string;
    coverArtUrl?: string;
    stems?: {
      vocals?: string;
      instrumental?: string;
    };
  };
  error?: string;
  cancelled?: boolean;
}>();

const MUREKA_API_URL = process.env.MUREKA_API_URL || 'https://api.mureka.ai';
const MUREKA_API_KEY = process.env.MUREKA_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      lyrics,
      style = 'pop',
      mood,
      tempo = 'medium',
      duration = 60,
      instrumental = false,
      model = 'auto',
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!MUREKA_API_KEY) {
      return NextResponse.json(
        { error: 'MUREKA_API_KEY environment variable is not configured' },
        { status: 500 }
      );
    }

    const generationId = uuidv4();

    // Initialize generation job
    murekaJobs.set(generationId, {
      id: generationId,
      status: 'queued',
      progress: 0,
      message: 'Starting generation...',
    });

    // Start async generation
    generateWithMureka(generationId, {
      prompt,
      lyrics,
      style,
      mood,
      tempo,
      duration,
      instrumental,
      model,
    });

    return NextResponse.json({ generationId });
  } catch (error) {
    console.error('Mureka generation error:', error);
    return NextResponse.json(
      { error: 'Failed to start generation' },
      { status: 500 }
    );
  }
}

interface GenerationConfig {
  prompt: string;
  lyrics?: string;
  style: string;
  mood?: string;
  tempo: string;
  duration: number;
  instrumental: boolean;
  model: string;
}

async function generateWithMureka(generationId: string, config: GenerationConfig) {
  const job = murekaJobs.get(generationId);
  if (!job) return;

  try {
    // Build style/mood prompt
    const stylePrompt = [
      config.style,
      config.mood,
      config.tempo !== 'medium' ? `${config.tempo} tempo` : null,
      `${config.duration} seconds`,
    ].filter(Boolean).join(', ');

    const fullPrompt = `${config.prompt}. Style: ${stylePrompt}`;

    if (config.instrumental) {
      // Use instrumental endpoint for instrumental tracks
      await generateInstrumental(generationId, fullPrompt, config);
    } else {
      // For songs with vocals, first generate lyrics if not provided
      let lyricsToUse = config.lyrics;

      if (!lyricsToUse) {
        murekaJobs.set(generationId, {
          ...job,
          status: 'composing',
          progress: 10,
          message: 'Generating lyrics...',
          currentStep: 'AI is writing lyrics',
        });

        // Generate lyrics first
        const lyricsResponse = await fetch(`${MUREKA_API_URL}/v1/lyrics/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MUREKA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: fullPrompt }),
        });

        if (!lyricsResponse.ok) {
          const errorText = await lyricsResponse.text();
          console.error('Lyrics generation failed:', errorText);
          throw new Error(`Lyrics generation failed: ${lyricsResponse.status}`);
        }

        const lyricsData = await lyricsResponse.json();
        lyricsToUse = lyricsData.lyrics;
        console.log('Generated lyrics:', lyricsToUse);
      }

      // Now generate song with lyrics
      await generateSong(generationId, lyricsToUse!, fullPrompt, config);
    }
  } catch (error) {
    console.error('Mureka generation error:', error);
    const currentJob = murekaJobs.get(generationId);
    if (currentJob) {
      murekaJobs.set(generationId, {
        ...currentJob,
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Generation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

async function generateSong(generationId: string, lyrics: string, prompt: string, config: GenerationConfig) {
  const job = murekaJobs.get(generationId);
  if (!job || job.cancelled) return;

  // Update status
  murekaJobs.set(generationId, {
    ...job,
    status: 'composing',
    progress: 20,
    message: 'Composing your song...',
    currentStep: 'Starting music generation',
  });

  // Start song generation
  console.log('Starting song generation with Mureka API...');
  const response = await fetch(`${MUREKA_API_URL}/v1/song/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MUREKA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lyrics,
      prompt,
      model: config.model || 'auto',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Song generation start failed:', errorText);
    throw new Error(`Failed to start song generation: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const taskId = data.task_id || data.taskId || data.id;
  console.log('Song generation started, task ID:', taskId);

  if (!taskId) {
    throw new Error('No task ID returned from Mureka API');
  }

  // Poll for completion
  await pollSongStatus(generationId, taskId, config, lyrics);
}

async function generateInstrumental(generationId: string, prompt: string, config: GenerationConfig) {
  const job = murekaJobs.get(generationId);
  if (!job || job.cancelled) return;

  // Update status
  murekaJobs.set(generationId, {
    ...job,
    status: 'composing',
    progress: 15,
    message: 'Composing instrumental track...',
    currentStep: 'Starting instrumental generation',
  });

  // Start instrumental generation
  console.log('Starting instrumental generation with Mureka API...');
  const response = await fetch(`${MUREKA_API_URL}/v1/instrumental/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MUREKA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      model: config.model || 'auto',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Instrumental generation start failed:', errorText);
    throw new Error(`Failed to start instrumental generation: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const taskId = data.task_id || data.taskId || data.id;
  console.log('Instrumental generation started, task ID:', taskId);

  if (!taskId) {
    throw new Error('No task ID returned from Mureka API');
  }

  // Poll for completion
  await pollInstrumentalStatus(generationId, taskId, config);
}

async function pollSongStatus(generationId: string, taskId: string, config: GenerationConfig, lyrics: string) {
  const maxAttempts = 300; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = murekaJobs.get(generationId);
    if (!job || job.cancelled) return;

    try {
      const response = await fetch(`${MUREKA_API_URL}/v1/song/query/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${MUREKA_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('Poll failed:', response.status);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const status = await response.json();
      console.log('Song status:', JSON.stringify(status).slice(0, 200));

      // Check for completion
      if (status.status === 'completed' || status.status === 'complete' || status.state === 'completed') {
        // Get the audio URL - Mureka returns audio URLs in various formats
        const audioUrl = status.audio_url || status.audioUrl ||
                        status.songs?.[0]?.audio_url || status.songs?.[0]?.audioUrl ||
                        status.result?.audio_url || status.result?.audioUrl ||
                        status.output?.audio_url || status.output?.audioUrl ||
                        status.url;

        if (!audioUrl) {
          console.error('No audio URL in response:', status);
          throw new Error('No audio URL returned from Mureka');
        }

        murekaJobs.set(generationId, {
          id: generationId,
          status: 'complete',
          progress: 100,
          message: 'Your track is ready!',
          track: {
            id: status.id || generationId,
            title: status.title || `${config.style} song`,
            audioUrl,
            duration: status.duration || config.duration,
            style: config.style,
            mood: config.mood,
            lyrics,
            hasVocals: true,
          },
        });
        return;
      }

      if (status.status === 'failed' || status.status === 'error' || status.state === 'failed') {
        throw new Error(status.error || status.message || 'Generation failed');
      }

      // Update progress based on status
      const progress = status.progress || Math.min(20 + attempts * 2, 90);
      const stage = status.stage || status.state || 'composing';

      murekaJobs.set(generationId, {
        ...job,
        status: mapStage(stage),
        progress,
        message: status.message || `Processing... ${progress}%`,
        currentStep: status.current_step || status.currentStep,
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('Generation failed')) {
        throw error;
      }
      console.error('Poll error:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Generation timed out');
}

async function pollInstrumentalStatus(generationId: string, taskId: string, config: GenerationConfig) {
  const maxAttempts = 300; // 5 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = murekaJobs.get(generationId);
    if (!job || job.cancelled) return;

    try {
      const response = await fetch(`${MUREKA_API_URL}/v1/instrumental/query/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${MUREKA_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error('Poll failed:', response.status);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const status = await response.json();
      console.log('Instrumental status:', JSON.stringify(status).slice(0, 200));

      // Check for completion
      if (status.status === 'completed' || status.status === 'complete' || status.state === 'completed') {
        // Get the audio URL
        const audioUrl = status.audio_url || status.audioUrl ||
                        status.songs?.[0]?.audio_url || status.songs?.[0]?.audioUrl ||
                        status.result?.audio_url || status.result?.audioUrl ||
                        status.output?.audio_url || status.output?.audioUrl ||
                        status.url;

        if (!audioUrl) {
          console.error('No audio URL in response:', status);
          throw new Error('No audio URL returned from Mureka');
        }

        murekaJobs.set(generationId, {
          id: generationId,
          status: 'complete',
          progress: 100,
          message: 'Your track is ready!',
          track: {
            id: status.id || generationId,
            title: status.title || `${config.style} instrumental`,
            audioUrl,
            duration: status.duration || config.duration,
            style: config.style,
            mood: config.mood,
            hasVocals: false,
          },
        });
        return;
      }

      if (status.status === 'failed' || status.status === 'error' || status.state === 'failed') {
        throw new Error(status.error || status.message || 'Generation failed');
      }

      // Update progress
      const progress = status.progress || Math.min(15 + attempts * 2, 90);
      const stage = status.stage || status.state || 'composing';

      murekaJobs.set(generationId, {
        ...job,
        status: mapStage(stage),
        progress,
        message: status.message || `Processing... ${progress}%`,
        currentStep: status.current_step || status.currentStep,
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('Generation failed')) {
        throw error;
      }
      console.error('Poll error:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Generation timed out');
}

function mapStage(stage: string): 'queued' | 'composing' | 'arranging' | 'vocals' | 'mixing' | 'mastering' | 'complete' | 'error' {
  const stageMap: Record<string, 'queued' | 'composing' | 'arranging' | 'vocals' | 'mixing' | 'mastering' | 'complete' | 'error'> = {
    'pending': 'queued',
    'queued': 'queued',
    'processing': 'composing',
    'composing': 'composing',
    'generating': 'composing',
    'arranging': 'arranging',
    'vocals': 'vocals',
    'mixing': 'mixing',
    'mastering': 'mastering',
    'complete': 'complete',
    'completed': 'complete',
    'error': 'error',
    'failed': 'error',
  };
  return stageMap[stage.toLowerCase()] || 'composing';
}
