# Proposal: Secure Lyria Authentication Proxy

**Author:** Claude
**Date:** January 2026
**Status:** Draft
**Branch:** `claude/secure-lyria-auth-proxy-TLFaV`

---

## Executive Summary

This proposal addresses two critical security vulnerabilities in the current Lyria implementation:

1. **Client-exposed API key** - The Google Gemini API key (`NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY`) is directly accessible in the browser, allowing anyone to extract and abuse it.
2. **No authentication requirement** - Lyria can be used without a registered account, enabling anonymous abuse of expensive AI resources.

**Proposed Solution:** Implement a secure backend WebSocket proxy that:
- Requires authenticated users with valid Supabase sessions
- Keeps the API key server-side only
- Enables rate limiting and usage tracking per user
- Supports account-type restrictions (free/pro tier limits)

---

## Current Architecture (Insecure)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │  Lyria Store │───▶│ LyriaSession (src/lib/ai/lyria.ts)  │    │
│  └──────────────┘    │                                     │    │
│                      │ ⚠️ API Key exposed here:             │    │
│                      │ process.env.NEXT_PUBLIC_GOOGLE_...  │    │
│                      └───────────────┬─────────────────────┘    │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
                                       │ WebSocket (key in URL!)
                                       ▼
                    ┌────────────────────────────────────┐
                    │  Google Lyria API                   │
                    │  wss://generativelanguage.google... │
                    │  ?key=EXPOSED_API_KEY               │
                    └────────────────────────────────────┘
```

### Security Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| API key in `NEXT_PUBLIC_*` env var | **CRITICAL** | Key visible in browser, network traffic, source maps |
| Key passed in WebSocket URL | **CRITICAL** | Logged in browser dev tools, potentially in server logs |
| No user authentication check | **HIGH** | Anonymous users can consume expensive AI resources |
| No rate limiting | **HIGH** | Single user can run up unlimited API costs |
| No usage tracking | **MEDIUM** | Cannot bill users or detect abuse patterns |

---

## Proposed Architecture (Secure)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │  Auth Store  │    │ LyriaSession (modified)             │    │
│  │  (Supabase)  │───▶│                                     │    │
│  └──────────────┘    │ ✓ No API key here                   │    │
│                      │ ✓ Uses auth token only              │    │
│                      └───────────────┬─────────────────────┘    │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
                                       │ WebSocket + Auth Token
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  /api/lyria/proxy (WebSocket Proxy)                      │    │
│  │                                                          │    │
│  │  1. Validate Supabase JWT token                          │    │
│  │  2. Check user is registered + verified                  │    │
│  │  3. Check rate limits (by user ID)                       │    │
│  │  4. Log usage for billing                                │    │
│  │  5. Forward to Google with server-side API key           │    │
│  │                                                          │    │
│  │  ✓ GOOGLE_GEMINI_API_KEY (server-only, no NEXT_PUBLIC_)  │    │
│  └──────────────────────────┬───────────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              │ WebSocket (key hidden)
                              ▼
                    ┌────────────────────────────────────┐
                    │  Google Lyria API                   │
                    │  wss://generativelanguage.google... │
                    └────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Proxy Endpoint

#### 1.1 Create WebSocket Proxy Route

**File:** `src/app/api/lyria/proxy/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

const LYRIA_WS_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';

// Server-side only - NOT exposed to browser
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

export async function GET(request: Request) {
  // 1. Extract auth token from request
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized: Missing auth token', { status: 401 });
  }
  const token = authHeader.substring(7);

  // 2. Validate Supabase JWT
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side key
    { auth: { persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }

  // 3. Check user profile requirements
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('account_type, is_verified, is_banned')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return new Response('Forbidden: User profile not found', { status: 403 });
  }
  if (profile.is_banned) {
    return new Response('Forbidden: Account banned', { status: 403 });
  }
  if (!profile.is_verified) {
    return new Response('Forbidden: Email not verified', { status: 403 });
  }

  // 4. Check rate limits
  const isWithinLimits = await checkRateLimit(user.id, profile.account_type);
  if (!isWithinLimits) {
    return new Response('Too Many Requests: Rate limit exceeded', { status: 429 });
  }

  // 5. Upgrade to WebSocket and proxy
  // ... WebSocket upgrade handling
}
```

#### 1.2 Rate Limiting Implementation

**File:** `src/lib/rate-limit/lyria-limits.ts`

```typescript
import { Redis } from '@upstash/redis'; // or in-memory for dev

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  maxMinutesPerDay: number; // Total Lyria minutes per day
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,           // 5 connections per minute
    maxMinutesPerDay: 30,     // 30 minutes of Lyria per day
  },
  pro: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    maxMinutesPerDay: 480,    // 8 hours of Lyria per day
  },
  admin: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    maxMinutesPerDay: Infinity,
  },
};

export async function checkRateLimit(
  userId: string,
  accountType: string
): Promise<boolean> {
  const config = RATE_LIMITS[accountType] || RATE_LIMITS.free;
  // Implementation using Redis sliding window
}
```

#### 1.3 Usage Tracking

**Database Table:** `lyria_usage`

```sql
CREATE TABLE lyria_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  duration_seconds INTEGER,
  prompt_text TEXT,
  style TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rate limiting queries
CREATE INDEX idx_lyria_usage_user_day ON lyria_usage (user_id, session_start);

-- RLS policies
ALTER TABLE lyria_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON lyria_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage"
  ON lyria_usage FOR INSERT
  WITH CHECK (true); -- Controlled by service role key
```

---

### Phase 2: Client-Side Modifications

#### 2.1 Update LyriaSession Class

**File:** `src/lib/ai/lyria.ts` (modified)

```typescript
// REMOVE this line:
// const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY || '';

// ADD this:
export class LyriaSession {
  private authToken: string | null = null;

  constructor() {
    // No API key needed - proxy handles it
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  async connect(): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required for Lyria');
    }

    // Connect to our proxy instead of Google directly
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/lyria/proxy`;

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    // ... rest of connection logic
  }
}
```

#### 2.2 Update Lyria Store

**File:** `src/stores/lyria-store.ts` (modified)

```typescript
import { useAuthStore } from './auth-store';

// In initialize():
initialize: () => {
  const authState = useAuthStore.getState();

  // Require authenticated user
  if (!authState.user) {
    console.warn('Lyria requires authentication - please sign in');
    set({ error: 'Authentication required' });
    return;
  }

  const session = new LyriaSession();

  // Get fresh auth token
  const token = authState.session?.access_token;
  if (token) {
    session.setAuthToken(token);
  }

  set({ session, isInitialized: true });
}
```

#### 2.3 Update UI Components

**File:** `src/components/daw/ai-panel.tsx` (modified)

```tsx
function LyriaControls() {
  const { user, profile } = useAuthStore();
  const { session, error } = useLyriaStore();

  // Show auth requirement message
  if (!user) {
    return (
      <div className="lyria-auth-required">
        <LockIcon />
        <h3>Sign in Required</h3>
        <p>Create a free account to use AI music generation.</p>
        <Button onClick={() => openAuthModal('signup')}>
          Create Account
        </Button>
        <Button variant="ghost" onClick={() => openAuthModal('signin')}>
          Sign In
        </Button>
      </div>
    );
  }

  // Show verification requirement
  if (!profile?.is_verified) {
    return (
      <div className="lyria-verify-required">
        <MailIcon />
        <h3>Verify Your Email</h3>
        <p>Please verify your email address to use Lyria.</p>
        <Button onClick={resendVerificationEmail}>
          Resend Verification Email
        </Button>
      </div>
    );
  }

  // Show normal Lyria controls
  return <LyriaPlayer />;
}
```

---

### Phase 3: Environment Variable Migration

#### 3.1 Update Environment Files

**Before (.env.local):**
```env
NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY=your-api-key-here
```

**After (.env.local):**
```env
# Server-side only - NEVER expose to client
GOOGLE_GEMINI_API_KEY=your-api-key-here

# Required for server-side auth validation
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 3.2 Remove Exposed Key

**Files to update:**
- `src/lib/ai/lyria.ts` - Remove `NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY` reference
- `.env.example` - Update documentation
- `README.md` - Update setup instructions

---

## Database Schema Changes

### New Tables

```sql
-- Lyria usage tracking
CREATE TABLE lyria_usage (
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

-- Rate limit tracking (if not using Redis)
CREATE TABLE lyria_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  daily_minutes_used FLOAT DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lyria_usage_user_date ON lyria_usage (user_id, session_start DESC);
CREATE INDEX idx_lyria_rate_limits_reset ON lyria_rate_limits (daily_reset_at);
```

### Profile Updates

```sql
-- Add Lyria-specific fields to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  lyria_enabled BOOLEAN DEFAULT true;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  lyria_daily_limit_override INTEGER; -- NULL = use account type default
```

---

## API Endpoints

### New Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/lyria/proxy` | WS | Required | WebSocket proxy to Google Lyria |
| `/api/lyria/usage` | GET | Required | Get current user's Lyria usage stats |
| `/api/lyria/limits` | GET | Required | Get current rate limit status |

### Endpoint Details

#### GET `/api/lyria/usage`

**Response:**
```json
{
  "today": {
    "sessions": 5,
    "minutesUsed": 23.5,
    "minutesRemaining": 6.5
  },
  "thisMonth": {
    "sessions": 45,
    "minutesUsed": 312.7
  },
  "lifetime": {
    "sessions": 234,
    "minutesUsed": 1547.3
  }
}
```

#### GET `/api/lyria/limits`

**Response:**
```json
{
  "accountType": "free",
  "limits": {
    "dailyMinutes": 30,
    "connectionsPerMinute": 5
  },
  "current": {
    "dailyMinutesUsed": 23.5,
    "recentConnections": 2
  },
  "resetAt": "2026-01-02T00:00:00Z"
}
```

---

## Security Considerations

### Authentication Flow

```
1. User signs in → Supabase issues JWT
2. Client stores JWT in auth store
3. Client passes JWT to Lyria proxy via WebSocket header
4. Server validates JWT with Supabase
5. Server checks user profile (verified, not banned)
6. Server checks rate limits
7. Server proxies to Google with server-side API key
```

### Token Refresh Handling

```typescript
// In LyriaSession
async ensureValidToken(): Promise<string> {
  const authStore = useAuthStore.getState();
  const session = authStore.session;

  if (!session) {
    throw new Error('Not authenticated');
  }

  // Check if token expires within 5 minutes
  const expiresAt = new Date(session.expires_at! * 1000);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt < fiveMinutesFromNow) {
    // Refresh the token
    await authStore.refreshSession();
    return useAuthStore.getState().session!.access_token;
  }

  return session.access_token;
}
```

### Error Handling

| Error Code | Meaning | User Message |
|------------|---------|--------------|
| 401 | No/invalid auth token | "Please sign in to use Lyria" |
| 403 (banned) | User account banned | "Your account has been suspended" |
| 403 (unverified) | Email not verified | "Please verify your email first" |
| 429 | Rate limit exceeded | "Daily limit reached. Upgrade to Pro for more time" |
| 503 | Google API unavailable | "Lyria is temporarily unavailable" |

---

## Testing Plan

### Unit Tests

- [ ] JWT validation logic
- [ ] Rate limit calculations
- [ ] Usage tracking accumulation
- [ ] Token refresh handling

### Integration Tests

- [ ] Full WebSocket proxy flow (authenticated)
- [ ] Rejection of unauthenticated requests
- [ ] Rejection of unverified users
- [ ] Rate limit enforcement
- [ ] Usage tracking accuracy

### Manual Testing

- [ ] Sign up → verify email → use Lyria (happy path)
- [ ] Attempt Lyria without signing in (should show auth prompt)
- [ ] Attempt Lyria with unverified email (should show verify prompt)
- [ ] Hit rate limit → see appropriate message
- [ ] Check usage stats display correctly

---

## Migration Steps

### For Development

1. Add `GOOGLE_GEMINI_API_KEY` to `.env.local` (without `NEXT_PUBLIC_` prefix)
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
3. Run database migrations for new tables
4. Deploy proxy endpoint
5. Update client code to use proxy
6. Remove `NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY` from all environments
7. Test full flow

### For Production

1. **Before deployment:**
   - Set up rate limiting infrastructure (Redis recommended)
   - Create database tables
   - Add server-side env vars to production

2. **Deployment:**
   - Deploy with feature flag disabled
   - Enable feature flag for internal testing
   - Gradually roll out to users

3. **After deployment:**
   - Monitor error rates
   - Monitor rate limit hits
   - Monitor usage patterns
   - Remove old client-side API key references

---

## Cost Impact Analysis

### Current State (Insecure)
- No usage tracking = unknown costs
- No rate limiting = potential for abuse
- Anonymous usage = cannot attribute costs

### After Implementation
- Per-user usage tracking
- Rate limits prevent abuse
- Can implement usage-based billing
- Can detect anomalies

### Estimated Savings
- Prevention of abuse: **High** (single bad actor could run up significant costs)
- Better capacity planning: **Medium** (know actual usage patterns)
- Billing accuracy: **Medium** (can charge heavy users appropriately)

---

## Timeline Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | Backend proxy + rate limiting | 2-3 days |
| Phase 2 | Client modifications | 1-2 days |
| Phase 3 | Environment migration | 0.5 day |
| Testing | Unit + integration + manual | 1-2 days |
| **Total** | | **5-8 days** |

---

## Appendix A: Alternative Approaches Considered

### Option 1: API Route Proxy (Chosen)
**Pros:** Full control, works with current stack, easy to add features
**Cons:** Adds latency, requires WebSocket handling

### Option 2: Edge Function Proxy
**Pros:** Lower latency, scales automatically
**Cons:** Complex WebSocket handling at edge, vendor lock-in

### Option 3: Separate Microservice
**Pros:** Independent scaling, language flexibility
**Cons:** Additional infrastructure, more complex deployment

**Decision:** Option 1 selected for simplicity and integration with existing Next.js app.

---

## Appendix B: Account Type Limits

| Feature | Free | Pro | Admin |
|---------|------|-----|-------|
| Lyria daily minutes | 30 | 480 | Unlimited |
| Connections per minute | 5 | 20 | 100 |
| Max session length | 10 min | 60 min | Unlimited |
| Priority queue | No | Yes | Yes |
| Usage analytics | Basic | Detailed | Full |

---

## Approval

- [ ] Security review
- [ ] Architecture review
- [ ] Product approval
- [ ] Ready for implementation
