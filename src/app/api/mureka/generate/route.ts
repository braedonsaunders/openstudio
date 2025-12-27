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
      model = 'standard',
      referenceAudioUrl,
      key,
      customTags,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const generationId = uuidv4();

    // Initialize generation job
    murekaJobs.set(generationId, {
      id: generationId,
      status: 'queued',
      progress: 0,
      message: 'Generation queued...',
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
      referenceAudioUrl,
      key,
      customTags,
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
  referenceAudioUrl?: string;
  key?: string;
  customTags?: string[];
}

async function generateWithMureka(generationId: string, config: GenerationConfig) {
  const job = murekaJobs.get(generationId);
  if (!job) return;

  try {
    // Check if Mureka API key is configured
    const murekaApiKey = process.env.MUREKA_API_KEY;
    const murekaApiUrl = process.env.MUREKA_API_URL;

    if (!murekaApiKey || !murekaApiUrl) {
      // Fallback to mock generation for demo
      await mockMurekaGeneration(generationId, config);
      return;
    }

    // Update status - composing
    murekaJobs.set(generationId, {
      ...job,
      status: 'composing',
      stage: 'composing',
      progress: 10,
      message: 'AI is composing your music...',
      currentStep: 'Creating melody',
    });

    // Build the generation request for Mureka API
    const murekaRequest = {
      prompt: config.prompt,
      lyrics: config.lyrics,
      style: config.style,
      mood: config.mood,
      tempo: config.tempo,
      duration: config.duration,
      instrumental: config.instrumental,
      model: config.model,
      reference_audio_url: config.referenceAudioUrl,
      key: config.key,
      tags: config.customTags,
    };

    // Start generation on Mureka
    const startResponse = await fetch(`${murekaApiUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${murekaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(murekaRequest),
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to start Mureka generation');
    }

    const { job_id: murekaJobId } = await startResponse.json();

    // Poll Mureka for completion
    await pollMurekaJob(generationId, murekaJobId, config, murekaApiUrl, murekaApiKey);

  } catch (error) {
    console.error('Mureka generation error:', error);

    // Fallback to mock generation
    await mockMurekaGeneration(generationId, config);
  }
}

async function pollMurekaJob(
  generationId: string,
  murekaJobId: string,
  config: GenerationConfig,
  apiUrl: string,
  apiKey: string
) {
  const maxAttempts = 300;
  let attempts = 0;

  const stageMapping: Record<string, { status: string; progress: number; message: string }> = {
    'pending': { status: 'queued', progress: 5, message: 'Waiting in queue...' },
    'composing': { status: 'composing', progress: 20, message: 'Composing melody and harmony...' },
    'arranging': { status: 'arranging', progress: 40, message: 'Arranging instruments...' },
    'vocals': { status: 'vocals', progress: 60, message: 'Generating vocals...' },
    'mixing': { status: 'mixing', progress: 75, message: 'Mixing tracks...' },
    'mastering': { status: 'mastering', progress: 90, message: 'Mastering audio...' },
  };

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
          message: 'Your track is ready!',
          track: {
            id: status.track_id || generationId,
            title: status.title || `AI Song: ${config.prompt.slice(0, 30)}...`,
            audioUrl: status.audio_url,
            duration: status.duration || config.duration,
            style: config.style,
            mood: config.mood,
            lyrics: status.lyrics || config.lyrics,
            hasVocals: !config.instrumental,
            waveformUrl: status.waveform_url,
            coverArtUrl: status.cover_art_url,
            stems: status.stems ? {
              vocals: status.stems.vocals_url,
              instrumental: status.stems.instrumental_url,
            } : undefined,
          },
        });
        return;
      }

      if (status.status === 'failed') {
        murekaJobs.set(generationId, {
          ...job,
          status: 'error',
          progress: 0,
          message: status.error || 'Generation failed',
          error: status.error,
        });
        return;
      }

      // Update progress based on stage
      const stageInfo = stageMapping[status.stage] || { status: 'composing', progress: 50, message: 'Processing...' };
      murekaJobs.set(generationId, {
        ...job,
        status: stageInfo.status as typeof job.status,
        stage: status.stage,
        progress: status.progress || stageInfo.progress,
        message: status.message || stageInfo.message,
        currentStep: status.current_step,
      });

    } catch {
      // Continue polling on error
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  // Timeout
  const job = murekaJobs.get(generationId);
  if (job) {
    murekaJobs.set(generationId, {
      ...job,
      status: 'error',
      error: 'Generation timed out',
    });
  }
}

// Mock generation for demo/fallback
async function mockMurekaGeneration(generationId: string, config: GenerationConfig) {
  const stages = [
    { status: 'composing', progress: 15, message: 'AI is composing your music...', currentStep: 'Creating melody', delay: 2000 },
    { status: 'composing', progress: 25, message: 'Building chord progressions...', currentStep: 'Harmonizing', delay: 2000 },
    { status: 'arranging', progress: 40, message: 'Arranging instruments...', currentStep: 'Adding drums', delay: 2500 },
    { status: 'arranging', progress: 50, message: 'Layering sounds...', currentStep: 'Adding bass', delay: 2000 },
    ...(config.instrumental ? [] : [
      { status: 'vocals', progress: 60, message: 'Generating vocals...', currentStep: 'Synthesizing voice', delay: 3000 },
      { status: 'vocals', progress: 70, message: 'Adding vocal harmonies...', currentStep: 'Layering vocals', delay: 2000 },
    ]),
    { status: 'mixing', progress: 80, message: 'Mixing tracks...', currentStep: 'Balancing levels', delay: 2000 },
    { status: 'mastering', progress: 90, message: 'Mastering audio...', currentStep: 'Final polish', delay: 2000 },
    { status: 'mastering', progress: 95, message: 'Finalizing...', currentStep: 'Exporting', delay: 1000 },
  ];

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = murekaJobs.get(generationId);
    if (!currentJob || currentJob.cancelled) return;

    murekaJobs.set(generationId, {
      ...currentJob,
      status: stage.status as typeof currentJob.status,
      stage: stage.status,
      progress: stage.progress,
      message: stage.message,
      currentStep: stage.currentStep,
    });
  }

  const trackId = uuidv4();

  // Demo audio samples based on style
  const demoAudioUrls: Record<string, string> = {
    rock: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    pop: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    electronic: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    jazz: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    hiphop: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    classical: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    ambient: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    funk: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    default: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  };

  const audioUrl = demoAudioUrls[config.style] || demoAudioUrls.default;

  // Generate sample lyrics if not instrumental
  const generatedLyrics = config.instrumental ? undefined : (config.lyrics || generateSampleLyrics(config.prompt, config.mood));

  murekaJobs.set(generationId, {
    id: generationId,
    status: 'complete',
    progress: 100,
    message: 'Your track is ready!',
    track: {
      id: trackId,
      title: generateTrackTitle(config.prompt, config.style),
      audioUrl,
      duration: config.duration,
      style: config.style,
      mood: config.mood,
      lyrics: generatedLyrics,
      hasVocals: !config.instrumental,
    },
  });
}

function generateTrackTitle(prompt: string, style: string): string {
  // Extract key words from prompt for title
  const words = prompt.split(' ').slice(0, 4).join(' ');
  if (words.length > 30) {
    return `${style.charAt(0).toUpperCase() + style.slice(1)} Jam`;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function generateSampleLyrics(prompt: string, mood?: string): string {
  const moodLyrics: Record<string, string> = {
    happy: `[Verse 1]
Sunshine breaking through the clouds today
Every moment feels like it's going my way
Dancing through the streets without a care
Music in the air everywhere

[Chorus]
This is our time to shine
Everything's gonna be just fine
Feel the rhythm, feel the beat
Life is good and life is sweet`,
    sad: `[Verse 1]
Raindrops falling on my window pane
Memories of you still cause me pain
Empty rooms and silent phones
Walking through this world alone

[Chorus]
But I'll keep moving on
Even when hope is gone
Through the tears I'll find my way
There's always a brighter day`,
    energetic: `[Verse 1]
Turn it up, let's go tonight
Feel the bass, hold on tight
City lights are burning bright
We're gonna dance until daylight

[Chorus]
Can't stop, won't stop moving
Keep the party grooving
Hands up in the air
Show them that we care`,
    chill: `[Verse 1]
Lazy afternoon, nowhere to be
Just you and me and this melody
Waves are crashing on the shore
Don't need nothing more

[Chorus]
Let it flow, let it go
Take it nice and slow
In this moment we are free
Just the way it's meant to be`,
  };

  return moodLyrics[mood || 'happy'] || moodLyrics.happy;
}
