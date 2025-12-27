import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Mock separation jobs
const separations = new Map<string, {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  stems?: {
    vocals?: string;
    drums?: string;
    bass?: string;
    other?: string;
  };
  error?: string;
}>();

export async function POST(request: NextRequest) {
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
    });

    // Simulate async separation (in production, this would call SAM API)
    simulateSeparation(jobId, trackId);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Separation error:', error);
    return NextResponse.json(
      { error: 'Failed to start separation' },
      { status: 500 }
    );
  }
}

// Simulate separation process
async function simulateSeparation(jobId: string, trackId: string) {
  const stages = [
    { progress: 10, delay: 1000 },
    { progress: 25, delay: 2000 },
    { progress: 40, delay: 2000 },
    { progress: 60, delay: 3000 },
    { progress: 80, delay: 2000 },
    { progress: 95, delay: 1000 },
  ];

  for (const stage of stages) {
    await new Promise((resolve) => setTimeout(resolve, stage.delay));

    const currentJob = separations.get(jobId);
    if (!currentJob) return;

    separations.set(jobId, {
      ...currentJob,
      progress: stage.progress,
    });
  }

  // Complete with mock stems
  separations.set(jobId, {
    id: jobId,
    status: 'completed',
    progress: 100,
    stems: {
      vocals: `/api/tracks/${trackId}/stems/vocals`,
      drums: `/api/tracks/${trackId}/stems/drums`,
      bass: `/api/tracks/${trackId}/stems/bass`,
      other: `/api/tracks/${trackId}/stems/other`,
    },
  });
}
