import { NextRequest, NextResponse } from 'next/server';
import {
  createNativeBridgeNetworkSecret,
  getNativeBridgeTokenSecret,
  verifyNativeBridgeToken,
} from '@/lib/native-bridge-auth';
import { resolveNativeBridgeAccess } from '@/lib/native-bridge-access';
import { checkRateLimit, getClientIdentifier, rateLimiters, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`native-bridge-verify:${clientId}`, rateLimiters.api);
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  const secret = getNativeBridgeTokenSecret();
  if (!secret) {
    return NextResponse.json({ valid: false, error: 'Native bridge token verification is not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    token?: string;
    roomId?: string;
  } | null;

  if (!body?.token || !body.roomId) {
    return NextResponse.json({ valid: false, error: 'token and roomId are required' }, { status: 400 });
  }

  const claims = verifyNativeBridgeToken(body.token, secret);
  if (!claims || claims.roomId !== body.roomId) {
    return NextResponse.json({ valid: false, error: 'Invalid native bridge token' }, { status: 401 });
  }

  const access = await resolveNativeBridgeAccess(claims.roomId, claims.userId, claims.userName);
  if (!access.allowed || !access.role) {
    return NextResponse.json(
      { valid: false, error: access.reason || 'Native bridge access denied' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    valid: true,
    roomId: claims.roomId,
    userId: claims.userId,
    userName: access.userName || claims.userName,
    role: access.role,
    networkSecret: createNativeBridgeNetworkSecret(claims.roomId, secret),
  });
}
