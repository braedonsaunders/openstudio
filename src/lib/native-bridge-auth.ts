import { createHmac, timingSafeEqual } from 'crypto';

export interface NativeBridgeTokenClaims {
  v: 1;
  roomId: string;
  userId: string;
  userName: string;
  role: string;
  iat: number;
  exp: number;
}

export function getNativeBridgeTokenSecret(): string | null {
  const configured = process.env.NATIVE_BRIDGE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'openstudio-development-native-bridge-token-secret';
  }

  return null;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value: string): Buffer {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signPayload(payload: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(payload).digest());
}

export function createNativeBridgeToken(claims: NativeBridgeTokenClaims, secret: string): string {
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function verifyNativeBridgeToken(token: string, secret: string, nowMs: number = Date.now()): NativeBridgeTokenClaims | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return null;
  }

  try {
    const claims = JSON.parse(base64UrlDecode(payload).toString('utf8')) as NativeBridgeTokenClaims;
    if (claims.v !== 1 || !claims.roomId || !claims.userId || !claims.exp) {
      return null;
    }
    if (claims.exp <= nowMs) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function createNativeBridgeNetworkSecret(roomId: string, secret: string): string {
  return base64UrlEncode(
    createHmac('sha256', secret)
      .update(`openstudio-native-network-v1:${roomId}`)
      .digest()
  );
}
