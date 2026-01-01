-- Lyria Usage Tracking and Rate Limiting
-- This migration adds tables for tracking Lyria AI music generation usage per user
-- and enforcing rate limits based on account type.

-- ============================================
-- LYRIA USAGE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS lyria_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  prompt_text TEXT,
  style TEXT,
  mood TEXT,
  bpm INTEGER,
  scale TEXT,
  bytes_streamed BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_lyria_usage_user_id ON lyria_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_lyria_usage_user_date ON lyria_usage(user_id, session_start DESC);
CREATE INDEX IF NOT EXISTS idx_lyria_usage_session_id ON lyria_usage(session_id);

-- ============================================
-- LYRIA RATE LIMITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS lyria_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  daily_seconds_used INTEGER DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_lyria_rate_limits_reset ON lyria_rate_limits(daily_reset_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE lyria_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE lyria_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own lyria usage"
  ON lyria_usage FOR SELECT
  USING (auth.uid() = user_id);

-- System (service role) can insert/update usage
CREATE POLICY "Service role can manage lyria usage"
  ON lyria_usage FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own rate limits
CREATE POLICY "Users can view own rate limits"
  ON lyria_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage rate limits
CREATE POLICY "Service role can manage rate limits"
  ON lyria_rate_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get rate limit config for account type
CREATE OR REPLACE FUNCTION get_lyria_rate_limit_config(account_type TEXT)
RETURNS TABLE (
  daily_seconds_limit INTEGER,
  connections_per_minute INTEGER,
  max_session_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY SELECT
    CASE account_type
      WHEN 'admin' THEN 999999  -- Effectively unlimited
      WHEN 'pro' THEN 28800     -- 8 hours per day
      ELSE 1800                  -- 30 minutes per day (free)
    END AS daily_seconds_limit,
    CASE account_type
      WHEN 'admin' THEN 100
      WHEN 'pro' THEN 20
      ELSE 5
    END AS connections_per_minute,
    CASE account_type
      WHEN 'admin' THEN 999999  -- Effectively unlimited
      WHEN 'pro' THEN 3600      -- 1 hour max session
      ELSE 600                   -- 10 minute max session (free)
    END AS max_session_seconds;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user is within rate limits
CREATE OR REPLACE FUNCTION check_lyria_rate_limit(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  daily_seconds_remaining INTEGER,
  connections_remaining INTEGER,
  reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_account_type TEXT;
  v_rate_limit RECORD;
  v_limit_config RECORD;
  v_daily_limit INTEGER;
  v_conn_limit INTEGER;
BEGIN
  -- Get user's account type
  SELECT account_type INTO v_account_type
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_account_type IS NULL THEN
    v_account_type := 'free';
  END IF;

  -- Get limit config
  SELECT * INTO v_limit_config
  FROM get_lyria_rate_limit_config(v_account_type);

  v_daily_limit := v_limit_config.daily_seconds_limit;
  v_conn_limit := v_limit_config.connections_per_minute;

  -- Get or create rate limit record
  INSERT INTO lyria_rate_limits (user_id, request_count, window_start, daily_seconds_used, daily_reset_at)
  VALUES (p_user_id, 0, NOW(), 0, CURRENT_DATE + INTERVAL '1 day')
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current rate limit status
  SELECT * INTO v_rate_limit
  FROM lyria_rate_limits
  WHERE user_id = p_user_id;

  -- Reset daily usage if past reset time
  IF v_rate_limit.daily_reset_at <= NOW() THEN
    UPDATE lyria_rate_limits
    SET daily_seconds_used = 0,
        daily_reset_at = CURRENT_DATE + INTERVAL '1 day',
        updated_at = NOW()
    WHERE user_id = p_user_id;
    v_rate_limit.daily_seconds_used := 0;
    v_rate_limit.daily_reset_at := CURRENT_DATE + INTERVAL '1 day';
  END IF;

  -- Reset request count if window expired (1 minute)
  IF v_rate_limit.window_start + INTERVAL '1 minute' <= NOW() THEN
    UPDATE lyria_rate_limits
    SET request_count = 0,
        window_start = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    v_rate_limit.request_count := 0;
  END IF;

  RETURN QUERY SELECT
    (v_rate_limit.daily_seconds_used < v_daily_limit AND v_rate_limit.request_count < v_conn_limit) AS allowed,
    GREATEST(0, v_daily_limit - v_rate_limit.daily_seconds_used) AS daily_seconds_remaining,
    GREATEST(0, v_conn_limit - v_rate_limit.request_count) AS connections_remaining,
    v_rate_limit.daily_reset_at AS reset_at;
END;
$$ LANGUAGE plpgsql;

-- Function to increment connection count
CREATE OR REPLACE FUNCTION increment_lyria_connection(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE lyria_rate_limits
  SET request_count = request_count + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add usage seconds
CREATE OR REPLACE FUNCTION add_lyria_usage_seconds(p_user_id UUID, p_seconds INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE lyria_rate_limits
  SET daily_seconds_used = daily_seconds_used + p_seconds,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE lyria_usage IS 'Tracks individual Lyria session usage for billing and analytics';
COMMENT ON TABLE lyria_rate_limits IS 'Tracks current rate limit status per user for Lyria access';
COMMENT ON FUNCTION get_lyria_rate_limit_config IS 'Returns rate limit configuration based on account type';
COMMENT ON FUNCTION check_lyria_rate_limit IS 'Checks if a user is within their Lyria rate limits';
