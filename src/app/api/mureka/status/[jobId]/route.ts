import { NextRequest, NextResponse } from 'next/server';
import { murekaJobs } from '../../generate/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Get job from shared storage
  const job = murekaJobs.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: 'Generation not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    currentStep: job.currentStep,
    track: job.track ? {
      trackId: job.track.id,
      title: job.track.title,
      audioUrl: job.track.audioUrl,
      duration: job.track.duration,
      style: job.track.style,
      mood: job.track.mood,
      lyrics: job.track.lyrics,
      hasVocals: job.track.hasVocals,
      waveformUrl: job.track.waveformUrl,
      coverArtUrl: job.track.coverArtUrl,
      stems: job.track.stems,
    } : undefined,
    error: job.error,
  });
}
