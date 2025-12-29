'use client';

import { useState, useEffect } from 'react';
import { StaticAvatar } from './AvatarCompositor';

// Size mappings for different use cases
const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
  '2xl': 128,
} as const;

type AvatarSize = keyof typeof SIZE_MAP | number;

interface UserAvatarProps {
  /** User ID to fetch avatar for */
  userId?: string;
  /** Direct image URL (skips fetching) */
  imageUrl?: string | null;
  /** Username for fallback initials */
  username?: string;
  /** Size - either preset or pixel value */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show loading state */
  showLoading?: boolean;
}

interface AvatarUrls {
  fullBodyUrl: string | null;
  headshotUrl: string | null;
  thumbnailUrls: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  } | null;
}

// Cache for avatar URLs to avoid refetching
const avatarCache = new Map<string, AvatarUrls | null>();

/**
 * UserAvatar - Unified avatar component that displays canvas-based avatars
 *
 * Usage:
 * - With userId: Fetches and displays user's saved avatar
 * - With imageUrl: Displays the provided image directly
 * - Falls back to initials if no avatar available
 */
export function UserAvatar({
  userId,
  imageUrl,
  username,
  size = 'md',
  className = '',
  showLoading = false,
}: UserAvatarProps) {
  const [avatarUrls, setAvatarUrls] = useState<AvatarUrls | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Calculate pixel size
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];

  // Fetch avatar URLs if userId provided
  useEffect(() => {
    if (!userId || imageUrl) {
      setHasFetched(true);
      return;
    }

    // Check cache first
    if (avatarCache.has(userId)) {
      setAvatarUrls(avatarCache.get(userId) || null);
      setHasFetched(true);
      return;
    }

    async function fetchAvatar() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/avatar/public/${userId}`);
        if (response.ok) {
          const data = await response.json();
          avatarCache.set(userId, data);
          setAvatarUrls(data);
        } else {
          avatarCache.set(userId, null);
        }
      } catch {
        avatarCache.set(userId, null);
      } finally {
        setIsLoading(false);
        setHasFetched(true);
      }
    }

    fetchAvatar();
  }, [userId, imageUrl]);

  // Determine which image URL to use based on size
  const getOptimalImageUrl = (): string | null => {
    // Direct URL takes precedence
    if (imageUrl) return imageUrl;

    if (!avatarUrls) return null;

    // Use thumbnails for small sizes, headshot for medium, fullBody for large
    if (pixelSize <= 32 && avatarUrls.thumbnailUrls?.xs) {
      return avatarUrls.thumbnailUrls.xs;
    }
    if (pixelSize <= 48 && avatarUrls.thumbnailUrls?.sm) {
      return avatarUrls.thumbnailUrls.sm;
    }
    if (pixelSize <= 64 && avatarUrls.thumbnailUrls?.md) {
      return avatarUrls.thumbnailUrls.md;
    }
    if (pixelSize <= 128 && avatarUrls.thumbnailUrls?.lg) {
      return avatarUrls.thumbnailUrls.lg;
    }
    // For headshot sizes (face focus)
    if (pixelSize <= 256 && avatarUrls.headshotUrl) {
      return avatarUrls.headshotUrl;
    }
    // Full body for large displays
    return avatarUrls.fullBodyUrl;
  };

  // Show loading state
  if (isLoading && showLoading && !hasFetched) {
    return (
      <div
        className={`rounded-full bg-gray-700 animate-pulse ${className}`}
        style={{ width: pixelSize, height: pixelSize }}
      />
    );
  }

  const optimalUrl = getOptimalImageUrl();

  return (
    <StaticAvatar
      imageUrl={optimalUrl}
      username={username}
      size={pixelSize}
      className={className}
    />
  );
}

/**
 * Clear the avatar cache for a specific user or all users
 */
export function clearAvatarCache(userId?: string) {
  if (userId) {
    avatarCache.delete(userId);
  } else {
    avatarCache.clear();
  }
}

/**
 * Preload avatar for a user (useful for lists)
 */
export async function preloadAvatar(userId: string): Promise<void> {
  if (avatarCache.has(userId)) return;

  try {
    const response = await fetch(`/api/avatar/public/${userId}`);
    if (response.ok) {
      const data = await response.json();
      avatarCache.set(userId, data);
    } else {
      avatarCache.set(userId, null);
    }
  } catch {
    avatarCache.set(userId, null);
  }
}

export default UserAvatar;
