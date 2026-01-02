import { NextRequest, NextResponse } from 'next/server';
import { separations } from '../../separate/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Get job from shared storage
  const job = separations.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    stems: job.stems,
    error: job.error,
  });
}
