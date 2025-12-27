import { NextRequest, NextResponse } from 'next/server';
import { audioDecJobs } from '../../process/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = audioDecJobs.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    stage: job.stage || job.status,
    progress: job.progress,
    message: job.message,
    currentStem: job.currentStem,
    operation: job.operation,
    stems: job.result?.stems,
    outputUrl: job.result?.outputUrl,
    outputDuration: job.result?.outputDuration,
    modelVersion: job.result?.modelVersion,
    error: job.error,
  });
}
