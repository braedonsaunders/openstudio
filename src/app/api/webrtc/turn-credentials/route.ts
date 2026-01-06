// Server-side TURN credential provider
// This keeps TURN credentials secure by never exposing them to client-side code

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/server';
import { validateGuestId } from '@/lib/auth/guest';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

// TURN credentials are kept server-side only
const TURN_USERNAME = process.env.CLOUDFLARE_TURN_USERNAME || '';
const TURN_CREDENTIAL = process.env.CLOUDFLARE_TURN_CREDENTIAL || '';

// Credential validity period (in seconds)
const CREDENTIAL_TTL = 3600; // 1 hour

export async function GET(request: NextRequest) {
  // Check authentication (user or validated guest)
  const user = await getUserFromRequest(request);
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');

  // Require either authenticated user or valid guest ID
  if (!user && !validateGuestId(guestId)) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const userId = user?.id || guestId;

  // Rate limit credential requests
  const rateLimit = checkRateLimit(`turn:${userId}`, rateLimiters.api);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  // If TURN credentials are not configured, return empty (client will use STUN only)
  if (!TURN_USERNAME || !TURN_CREDENTIAL) {
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    });
  }

  // Return TURN credentials with expiration
  const expiresAt = Date.now() + CREDENTIAL_TTL * 1000;

  return NextResponse.json({
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turn:turn.cloudflare.com:3478?transport=tcp',
          'turns:turn.cloudflare.com:5349?transport=tcp',
        ],
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      },
    ],
    expiresAt,
    ttl: CREDENTIAL_TTL,
  });
}
