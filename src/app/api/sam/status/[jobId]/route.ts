import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Mock response for demo purposes
  // In production, would fetch from shared storage
  const mockProgress = Math.min(100, Math.floor(Math.random() * 30) + 70);

  if (mockProgress >= 100) {
    return NextResponse.json({
      status: 'completed',
      progress: 100,
      stems: {
        vocals: `/api/tracks/${jobId}/stems/vocals`,
        drums: `/api/tracks/${jobId}/stems/drums`,
        bass: `/api/tracks/${jobId}/stems/bass`,
        other: `/api/tracks/${jobId}/stems/other`,
      },
    });
  }

  return NextResponse.json({
    status: 'processing',
    progress: mockProgress,
  });
}
