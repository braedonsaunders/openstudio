import { NextRequest, NextResponse } from 'next/server';
import { murekaJobs } from '../../generate/route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = murekaJobs.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: 'Generation not found' },
      { status: 404 }
    );
  }

  // Mark as cancelled
  murekaJobs.set(jobId, {
    ...job,
    cancelled: true,
    status: 'error',
    message: 'Generation cancelled by user',
    error: 'Cancelled',
  });

  // If using real Mureka API, also cancel there
  const murekaApiKey = process.env.MUREKA_API_KEY;
  const murekaApiUrl = process.env.MUREKA_API_URL;

  if (murekaApiKey && murekaApiUrl) {
    try {
      await fetch(`${murekaApiUrl}/v1/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${murekaApiKey}`,
        },
      });
    } catch {
      // Ignore cancellation errors
    }
  }

  return NextResponse.json({ success: true, message: 'Generation cancelled' });
}
