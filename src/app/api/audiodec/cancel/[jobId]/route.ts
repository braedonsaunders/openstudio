import { NextRequest, NextResponse } from 'next/server';
import { audioDecJobs } from '../../process/route';

export async function POST(
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

  // Mark as cancelled
  audioDecJobs.set(jobId, {
    ...job,
    cancelled: true,
    status: 'error',
    message: 'Processing cancelled by user',
    error: 'Cancelled',
  });

  // If using real AudioDec API, also cancel there
  const audioDecApiKey = process.env.AUDIODEC_API_KEY;
  const audioDecApiUrl = process.env.AUDIODEC_API_URL;

  if (audioDecApiKey && audioDecApiUrl) {
    try {
      await fetch(`${audioDecApiUrl}/v1/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${audioDecApiKey}`,
        },
      });
    } catch {
      // Ignore cancellation errors
    }
  }

  return NextResponse.json({ success: true, message: 'Processing cancelled' });
}
