import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/supabase/server';
import { getUsageStats, checkRateLimit } from '@/lib/lyria/rate-limit';

/**
 * GET /api/lyria/usage
 *
 * Get Lyria usage statistics for the authenticated user.
 * Returns usage data for today, this month, and lifetime.
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
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const [stats, rateLimit] = await Promise.all([
      getUsageStats(supabase, user.id),
      checkRateLimit(supabase, user.id),
    ]);

    return NextResponse.json({
      usage: {
        today: {
          sessions: stats.today.sessions,
          minutesUsed: Math.round(stats.today.secondsUsed / 60 * 10) / 10,
          minutesRemaining: Math.round(stats.today.secondsRemaining / 60 * 10) / 10,
        },
        thisMonth: {
          sessions: stats.thisMonth.sessions,
          minutesUsed: Math.round(stats.thisMonth.secondsUsed / 60 * 10) / 10,
        },
        lifetime: {
          sessions: stats.lifetime.sessions,
          minutesUsed: Math.round(stats.lifetime.secondsUsed / 60 * 10) / 10,
        },
      },
      limits: {
        accountType: rateLimit.accountType,
        dailyMinutesLimit: Math.round(rateLimit.limits.dailySecondsLimit / 60),
        maxSessionMinutes: Math.round(rateLimit.limits.maxSessionSeconds / 60),
        resetAt: rateLimit.resetAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return NextResponse.json(
      { error: 'Failed to get usage statistics' },
      { status: 500 }
    );
  }
}
