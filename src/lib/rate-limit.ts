/**
 * Simple in-memory rate limiter for API endpoints
 * For production, consider using Redis-based rate limiting (e.g., @upstash/ratelimit)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a given identifier (usually IP or user ID)
 * @param identifier - Unique identifier for the client (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // If no entry or entry has expired, create new one
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowSeconds * 1000;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a generic identifier
  return 'unknown';
}

/**
 * Pre-configured rate limiters for different endpoint types
 */
export const rateLimiters = {
  // Expensive AI operations: 10 requests per minute
  expensive: { limit: 10, windowSeconds: 60 },

  // File uploads: 30 requests per minute
  upload: { limit: 30, windowSeconds: 60 },

  // Search/query operations: 60 requests per minute
  search: { limit: 60, windowSeconds: 60 },

  // General API: 100 requests per minute
  general: { limit: 100, windowSeconds: 60 },

  // Standard API endpoints: 120 requests per minute
  api: { limit: 120, windowSeconds: 60 },

  // Room operations: 20 per minute (creation, joining)
  room: { limit: 20, windowSeconds: 60 },

  // WebRTC session operations: 60 per minute
  webrtc: { limit: 60, windowSeconds: 60 },

  // Guest ID generation: 10 per hour per IP (prevent abuse)
  guest: { limit: 10, windowSeconds: 3600 },
};

/**
 * Helper to create rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
      },
    }
  );
}
