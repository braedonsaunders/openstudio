// Lyria Rate Limiting
// Handles rate limit checking and usage tracking for Lyria AI music generation

import { SupabaseClient } from '@supabase/supabase-js';

// Rate limit configuration by account type
export interface RateLimitConfig {
  dailySecondsLimit: number;      // Total seconds allowed per day
  connectionsPerMinute: number;   // Max WebSocket connections per minute
  maxSessionSeconds: number;      // Max duration of a single session
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    dailySecondsLimit: 1800,      // 30 minutes per day
    connectionsPerMinute: 5,
    maxSessionSeconds: 600,        // 10 minute max session
  },
  pro: {
    dailySecondsLimit: 28800,     // 8 hours per day
    connectionsPerMinute: 20,
    maxSessionSeconds: 3600,       // 1 hour max session
  },
  admin: {
    dailySecondsLimit: 999999,    // Effectively unlimited
    connectionsPerMinute: 100,
    maxSessionSeconds: 999999,     // Effectively unlimited
  },
};

export interface RateLimitStatus {
  allowed: boolean;
  dailySecondsRemaining: number;
  connectionsRemaining: number;
  resetAt: Date;
  accountType: string;
  limits: RateLimitConfig;
}

export interface LyriaUsageRecord {
  id: string;
  userId: string;
  sessionId: string;
  sessionStart: Date;
  sessionEnd: Date | null;
  durationSeconds: number;
  promptText: string | null;
  style: string | null;
  mood: string | null;
  bpm: number | null;
  scale: string | null;
  bytesStreamed: number;
}

/**
 * Check if a user is within their Lyria rate limits
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<RateLimitStatus> {
  // Get user's account type
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('account_type')
    .eq('id', userId)
    .single();

  const accountType = profile?.account_type || 'free';
  const limits = RATE_LIMITS[accountType] || RATE_LIMITS.free;

  // Get or create rate limit record
  const { data: rateLimit, error } = await supabase
    .from('lyria_rate_limits')
    .select('*')
    .eq('user_id', userId)
    .single();

  const now = new Date();
  let dailySecondsUsed = 0;
  let requestCount = 0;
  let windowStart = now;
  let dailyResetAt = new Date(now);
  dailyResetAt.setHours(24, 0, 0, 0); // Next midnight

  if (error?.code === 'PGRST116') {
    // No record exists, create one
    await supabase
      .from('lyria_rate_limits')
      .insert({
        user_id: userId,
        request_count: 0,
        window_start: now.toISOString(),
        daily_seconds_used: 0,
        daily_reset_at: dailyResetAt.toISOString(),
      });
  } else if (rateLimit) {
    dailySecondsUsed = rateLimit.daily_seconds_used || 0;
    requestCount = rateLimit.request_count || 0;
    windowStart = new Date(rateLimit.window_start);
    dailyResetAt = new Date(rateLimit.daily_reset_at);

    // Reset daily usage if past reset time
    if (dailyResetAt <= now) {
      dailySecondsUsed = 0;
      dailyResetAt = new Date(now);
      dailyResetAt.setHours(24, 0, 0, 0);

      await supabase
        .from('lyria_rate_limits')
        .update({
          daily_seconds_used: 0,
          daily_reset_at: dailyResetAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId);
    }

    // Reset request count if window expired (1 minute)
    const windowExpiry = new Date(windowStart.getTime() + 60000);
    if (windowExpiry <= now) {
      requestCount = 0;
      windowStart = now;

      await supabase
        .from('lyria_rate_limits')
        .update({
          request_count: 0,
          window_start: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId);
    }
  }

  const dailySecondsRemaining = Math.max(0, limits.dailySecondsLimit - dailySecondsUsed);
  const connectionsRemaining = Math.max(0, limits.connectionsPerMinute - requestCount);
  const allowed = dailySecondsRemaining > 0 && connectionsRemaining > 0;

  return {
    allowed,
    dailySecondsRemaining,
    connectionsRemaining,
    resetAt: dailyResetAt,
    accountType,
    limits,
  };
}

/**
 * Increment the connection count for rate limiting
 */
export async function incrementConnectionCount(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date();

  // Upsert to handle case where record doesn't exist
  const { data: existing } = await supabase
    .from('lyria_rate_limits')
    .select('request_count, window_start')
    .eq('user_id', userId)
    .single();

  if (!existing) {
    // Create new record
    await supabase
      .from('lyria_rate_limits')
      .insert({
        user_id: userId,
        request_count: 1,
        window_start: now.toISOString(),
        daily_seconds_used: 0,
        daily_reset_at: new Date(now.setHours(24, 0, 0, 0)).toISOString(),
      });
  } else {
    // Check if window needs reset
    const windowStart = new Date(existing.window_start);
    const windowExpiry = new Date(windowStart.getTime() + 60000);

    if (windowExpiry <= now) {
      // Reset window and set count to 1
      await supabase
        .from('lyria_rate_limits')
        .update({
          request_count: 1,
          window_start: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Increment count
      await supabase
        .from('lyria_rate_limits')
        .update({
          request_count: existing.request_count + 1,
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId);
    }
  }
}

/**
 * Add usage seconds to daily total
 */
export async function addUsageSeconds(
  supabase: SupabaseClient,
  userId: string,
  seconds: number
): Promise<void> {
  await supabase.rpc('add_lyria_usage_seconds', {
    p_user_id: userId,
    p_seconds: seconds,
  });
}

/**
 * Start a new usage session
 */
export async function startUsageSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  config?: {
    promptText?: string;
    style?: string;
    mood?: string;
    bpm?: number;
    scale?: string;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('lyria_usage')
    .insert({
      user_id: userId,
      session_id: sessionId,
      session_start: new Date().toISOString(),
      prompt_text: config?.promptText || null,
      style: config?.style || null,
      mood: config?.mood || null,
      bpm: config?.bpm || null,
      scale: config?.scale || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to start usage session:', error);
    throw error;
  }

  return data.id;
}

/**
 * End a usage session and calculate duration
 */
export async function endUsageSession(
  supabase: SupabaseClient,
  sessionId: string,
  bytesStreamed?: number
): Promise<number> {
  const now = new Date();

  // Get the session start time
  const { data: session } = await supabase
    .from('lyria_usage')
    .select('session_start, user_id')
    .eq('session_id', sessionId)
    .is('session_end', null)
    .single();

  if (!session) {
    console.warn('No active session found for:', sessionId);
    return 0;
  }

  const sessionStart = new Date(session.session_start);
  const durationSeconds = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);

  // Update the session
  await supabase
    .from('lyria_usage')
    .update({
      session_end: now.toISOString(),
      duration_seconds: durationSeconds,
      bytes_streamed: bytesStreamed || 0,
    })
    .eq('session_id', sessionId)
    .is('session_end', null);

  // Add to daily usage
  await addUsageSeconds(supabase, session.user_id, durationSeconds);

  return durationSeconds;
}

/**
 * Get usage statistics for a user
 */
export async function getUsageStats(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  today: { sessions: number; secondsUsed: number; secondsRemaining: number };
  thisMonth: { sessions: number; secondsUsed: number };
  lifetime: { sessions: number; secondsUsed: number };
}> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get rate limit status for remaining time
  const rateLimit = await checkRateLimit(supabase, userId);

  // Today's usage
  const { data: todayData } = await supabase
    .from('lyria_usage')
    .select('id, duration_seconds')
    .eq('user_id', userId)
    .gte('session_start', startOfDay.toISOString());

  const todaySessions = todayData?.length || 0;
  const todaySeconds = todayData?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0;

  // This month's usage
  const { data: monthData } = await supabase
    .from('lyria_usage')
    .select('id, duration_seconds')
    .eq('user_id', userId)
    .gte('session_start', startOfMonth.toISOString());

  const monthSessions = monthData?.length || 0;
  const monthSeconds = monthData?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0;

  // Lifetime usage
  const { data: lifetimeData } = await supabase
    .from('lyria_usage')
    .select('id, duration_seconds')
    .eq('user_id', userId);

  const lifetimeSessions = lifetimeData?.length || 0;
  const lifetimeSeconds = lifetimeData?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0;

  return {
    today: {
      sessions: todaySessions,
      secondsUsed: todaySeconds,
      secondsRemaining: rateLimit.dailySecondsRemaining,
    },
    thisMonth: {
      sessions: monthSessions,
      secondsUsed: monthSeconds,
    },
    lifetime: {
      sessions: lifetimeSessions,
      secondsUsed: lifetimeSeconds,
    },
  };
}
