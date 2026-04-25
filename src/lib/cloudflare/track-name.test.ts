import { describe, expect, it } from 'vitest';
import { resolveCloudflareTrackName } from './track-name';

describe('resolveCloudflareTrackName', () => {
  const guestId = 'guest-71698d17-69e4-4c84-9118-9c82b6ed264a-modoj5uk-cef0fd9b04ac';

  it('keeps the primary user audio track stable', () => {
    expect(resolveCloudflareTrackName(undefined, guestId)).toBe(`audio-${guestId}`);
    expect(resolveCloudflareTrackName(`audio-${guestId}`, guestId)).toBe(`audio-${guestId}`);
  });

  it('allows additional tracks scoped to the effective user id', () => {
    expect(resolveCloudflareTrackName(`lyria-${guestId}-modok9`, guestId)).toBe(`lyria-${guestId}-modok9`);
    expect(resolveCloudflareTrackName(`metronome-${guestId}-abc123`, guestId)).toBe(`metronome-${guestId}-abc123`);
  });

  it('rejects tracks not scoped to the effective user id', () => {
    expect(resolveCloudflareTrackName('lyria-other-user-modok9', guestId)).toBeNull();
    expect(resolveCloudflareTrackName(`lyria-${guestId}-modok9/evil`, guestId)).toBeNull();
  });
});
