import { NextRequest, NextResponse } from 'next/server';

// Access the generations map from the generate route
// In production, this would be stored in a database or Redis
const generations = new Map<string, {
  id: string;
  status: 'queued' | 'generating' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  track?: {
    id: string;
    title: string;
    audioUrl: string;
    duration: number;
    style: string;
  };
  error?: string;
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params;

  // Mock response for demo purposes
  // In production, would fetch from shared storage
  const mockStatuses = [
    { stage: 'generating', progress: 30, message: 'AI is composing your track...' },
    { stage: 'generating', progress: 60, message: 'Adding instruments...' },
    { stage: 'processing', progress: 85, message: 'Rendering audio...' },
    {
      stage: 'complete',
      progress: 100,
      message: 'Track generated successfully!',
      track: {
        id: generationId,
        name: 'AI Generated Track',
        artist: 'Suno AI',
        duration: 30,
        url: `/api/tracks/${generationId}/audio`,
        uploadedBy: 'ai',
        uploadedAt: new Date().toISOString(),
        aiGenerated: true,
      },
    },
  ];

  // Randomly return a status for demo
  const status = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];

  return NextResponse.json(status);
}
