import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveUserId, validateGuestId } from '@/lib/auth/guest';
import { getUserFromRequest } from '@/lib/supabase/server';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';
import { createNativeBridgeToken, getNativeBridgeTokenSecret, type NativeBridgeTokenClaims } from '@/lib/native-bridge-auth';
import { resolveNativeBridgeAccess } from '@/lib/native-bridge-access';

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`native-bridge-token:${clientId}`, rateLimiters.api);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  const secret = getNativeBridgeTokenSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'Native bridge token signing is not configured' },
      { status: 503 }
    );
  }

  const user = await getUserFromRequest(request);
  const body = await request.json().catch(() => null) as {
    roomId?: string;
    userId?: string;
    userName?: string;
  } | null;

  const roomId = body?.roomId;
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const guestUserId = !user ? body?.userId : undefined;
  if (!user && (!guestUserId || !validateGuestId(guestUserId))) {
    return NextResponse.json(
      { error: 'Valid authentication or signed guest ID required' },
      { status: 401 }
    );
  }

  const effectiveUserId = getEffectiveUserId(user?.id, guestUserId);
  if (!effectiveUserId) {
    return NextResponse.json(
      { error: 'Valid authentication required' },
      { status: 401 }
    );
  }

  const access = await resolveNativeBridgeAccess(roomId, effectiveUserId, body?.userName);
  if (!access.allowed || !access.role) {
    return NextResponse.json(
      { error: access.reason || 'Native bridge access denied' },
      { status: 403 }
    );
  }

  const now = Date.now();
  const claims: NativeBridgeTokenClaims = {
    v: 1,
    roomId,
    userId: effectiveUserId,
    userName: access.userName || body?.userName || effectiveUserId,
    role: access.role,
    iat: now,
    exp: now + 10 * 60 * 1000,
  };

  const token = createNativeBridgeToken(claims, secret);
  const verifyUrl = new URL('/api/native-bridge/verify', request.url).toString();

  return NextResponse.json({
    token,
    verifyUrl,
    expiresAt: claims.exp,
  });
}
