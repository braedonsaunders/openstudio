import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest, getServerUserProfile } from '@/lib/supabase/server';
import { checkRateLimit, incrementConnectionCount, startUsageSession } from '@/lib/lyria/rate-limit';
import { v4 as uuidv4 } from 'uuid';

const LYRIA_WS_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';

/**
 * POST /api/lyria/connect
 *
 * Validates user authentication and rate limits, then returns the WebSocket URL
 * with the API key for connecting to Google Lyria.
 *
 * This keeps the API key server-side and only provides it to authenticated users
 * who are within their rate limits.
 *
 * Request body:
 * - style?: string - Music style for tracking
 * - mood?: string - Music mood for tracking
 * - bpm?: number - BPM for tracking
 * - scale?: string - Scale for tracking
 * - prompt?: string - Custom prompt for tracking
 *
 * Returns:
 * - wsUrl: string - WebSocket URL with API key
 * - sessionId: string - Session ID for tracking usage
 * - limits: object - Current rate limit status
 */
export async function POST(request: NextRequest) {
  const supabase = getAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // 1. Validate authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // 2. Get user profile to check verification and ban status
  const profile = await getServerUserProfile(user.id);
  if (!profile) {
    return NextResponse.json(
      { error: 'User profile not found', code: 'PROFILE_NOT_FOUND' },
      { status: 403 }
    );
  }

  // 3. Check user profile for bans (need full profile for this)
  const { data: fullProfile } = await supabase
    .from('user_profiles')
    .select('is_banned, is_verified')
    .eq('id', user.id)
    .single();

  if (fullProfile?.is_banned) {
    return NextResponse.json(
      { error: 'Account suspended', code: 'ACCOUNT_BANNED' },
      { status: 403 }
    );
  }

  // Note: We allow unverified users to use Lyria, but could restrict if needed
  // if (!fullProfile?.is_verified) {
  //   return NextResponse.json(
  //     { error: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' },
  //     { status: 403 }
  //   );
  // }

  // 4. Check rate limits
  const rateLimit = await checkRateLimit(supabase, user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limits: {
          dailySecondsRemaining: rateLimit.dailySecondsRemaining,
          connectionsRemaining: rateLimit.connectionsRemaining,
          resetAt: rateLimit.resetAt.toISOString(),
          accountType: rateLimit.accountType,
        },
      },
      { status: 429 }
    );
  }

  // 5. Get API key from server-side environment
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_GEMINI_API_KEY not configured');
    return NextResponse.json(
      { error: 'Lyria service not configured', code: 'SERVICE_NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  // 6. Parse request body for session tracking
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine
  }

  // 7. Generate session ID and start tracking
  const sessionId = uuidv4();
  try {
    await startUsageSession(supabase, user.id, sessionId, {
      promptText: body.prompt as string,
      style: body.style as string,
      mood: body.mood as string,
      bpm: body.bpm as number,
      scale: body.scale as string,
    });
  } catch (error) {
    console.error('Failed to start usage session:', error);
    // Continue anyway - tracking failure shouldn't block usage
  }

  // 8. Increment connection count
  try {
    await incrementConnectionCount(supabase, user.id);
  } catch (error) {
    console.error('Failed to increment connection count:', error);
    // Continue anyway
  }

  // 9. Return WebSocket URL with API key
  const wsUrl = `${LYRIA_WS_ENDPOINT}?key=${apiKey}`;

  return NextResponse.json({
    wsUrl,
    sessionId,
    limits: {
      dailySecondsRemaining: rateLimit.dailySecondsRemaining,
      connectionsRemaining: rateLimit.connectionsRemaining - 1,
      resetAt: rateLimit.resetAt.toISOString(),
      accountType: rateLimit.accountType,
      maxSessionSeconds: rateLimit.limits.maxSessionSeconds,
    },
  });
}

/**
 * GET /api/lyria/connect
 *
 * Get current rate limit status without creating a session.
 * Used by the UI to show remaining time before attempting to connect.
 */
export async function GET(request: NextRequest) {
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
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Check rate limits
  const rateLimit = await checkRateLimit(supabase, user.id);

  return NextResponse.json({
    allowed: rateLimit.allowed,
    limits: {
      dailySecondsRemaining: rateLimit.dailySecondsRemaining,
      connectionsRemaining: rateLimit.connectionsRemaining,
      resetAt: rateLimit.resetAt.toISOString(),
      accountType: rateLimit.accountType,
      dailySecondsLimit: rateLimit.limits.dailySecondsLimit,
      maxSessionSeconds: rateLimit.limits.maxSessionSeconds,
    },
  });
}
