import { NextRequest, NextResponse } from 'next/server';
import { generations } from '../../generate/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params;

  // Get job from shared storage
  const job = generations.get(generationId);

  if (!job) {
    return NextResponse.json(
      { error: 'Generation not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    track: job.track,
    error: job.error,
  });
}
