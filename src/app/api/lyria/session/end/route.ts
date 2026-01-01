import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';
import { endUsageSession } from '@/lib/lyria/rate-limit';

/**
 * POST /api/lyria/session/end
 *
 * Ends a Lyria usage session and records the duration.
 * Called when the user disconnects from Lyria.
 *
 * Request body:
 * - sessionId: string - The session ID returned from /api/lyria/connect
 * - bytesStreamed?: number - Total bytes received during the session
 */
export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // Validate authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: { sessionId?: string; bytesStreamed?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { sessionId, bytesStreamed } = body;

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  try {
    const durationSeconds = await endUsageSession(supabase, sessionId, bytesStreamed);

    return NextResponse.json({
      success: true,
      durationSeconds,
    });
  } catch (error) {
    console.error('Failed to end usage session:', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}
