function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveCloudflareTrackName(
  requestedTrackName: string | null | undefined,
  effectiveUserId: string
): string | null {
  const primaryTrackName = `audio-${effectiveUserId}`;

  if (!requestedTrackName || requestedTrackName === primaryTrackName) {
    return primaryTrackName;
  }

  if (requestedTrackName.length > 200 || !/^[A-Za-z0-9_-]+$/.test(requestedTrackName)) {
    return null;
  }

  const userScopedTrack = new RegExp(
    `^[A-Za-z][A-Za-z0-9_-]*-${escapeRegExp(effectiveUserId)}-[A-Za-z0-9]+$`
  );

  return userScopedTrack.test(requestedTrackName) ? requestedTrackName : null;
}
