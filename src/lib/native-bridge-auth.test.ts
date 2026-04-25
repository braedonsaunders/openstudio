import { describe, expect, it } from 'vitest';
import {
  createNativeBridgeNetworkSecret,
  createNativeBridgeToken,
  verifyNativeBridgeToken,
  type NativeBridgeTokenClaims,
} from './native-bridge-auth';

describe('native bridge auth tokens', () => {
  const secret = 'test-secret';
  const claims: NativeBridgeTokenClaims = {
    v: 1,
    roomId: 'room-1',
    userId: 'user-1',
    userName: 'Ava',
    role: 'performer',
    iat: 1_700_000_000_000,
    exp: 1_700_000_600_000,
  };

  it('round-trips signed claims and rejects tampering', () => {
    const token = createNativeBridgeToken(claims, secret);

    expect(verifyNativeBridgeToken(token, secret, claims.iat)).toEqual(claims);

    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    expect(verifyNativeBridgeToken(tampered, secret, claims.iat)).toBeNull();
    expect(verifyNativeBridgeToken(token, 'wrong-secret', claims.iat)).toBeNull();
  });

  it('rejects expired tokens and creates stable per-room network secrets', () => {
    const token = createNativeBridgeToken(claims, secret);

    expect(verifyNativeBridgeToken(token, secret, claims.exp + 1)).toBeNull();
    expect(createNativeBridgeNetworkSecret('room-1', secret)).toBe(createNativeBridgeNetworkSecret('room-1', secret));
    expect(createNativeBridgeNetworkSecret('room-1', secret)).not.toBe(createNativeBridgeNetworkSecret('room-2', secret));
  });
});
