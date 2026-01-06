// Input validation schemas using Zod
// SECURITY: All API inputs should be validated against these schemas

import { z } from 'zod';

// Common patterns
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shortIdPattern = /^[0-9a-f]{8}$/i;
const guestIdPattern = /^guest-[0-9a-f-]+-[0-9a-z]+-[0-9a-f]{12}$/i;

// Sanitize string by removing dangerous characters
function sanitizeString(str: string): string {
  return str
    .trim()
    .slice(0, 1000) // Limit length
    .replace(/[<>]/g, ''); // Remove HTML brackets
}

// Room schemas
export const roomIdSchema = z.string().regex(shortIdPattern, 'Invalid room ID format');

export const createRoomSchema = z.object({
  id: z.string().regex(shortIdPattern).optional(),
  name: z.string()
    .min(1, 'Room name is required')
    .max(100, 'Room name must be under 100 characters')
    .transform(sanitizeString),
  description: z.string()
    .max(500, 'Description must be under 500 characters')
    .transform(sanitizeString)
    .optional(),
  isPublic: z.boolean().default(true),
  maxUsers: z.number().int().min(2).max(50).default(8),
  genre: z.string()
    .max(50)
    .transform(sanitizeString)
    .optional(),
  tags: z.array(z.string().max(30).transform(sanitizeString))
    .max(10)
    .optional(),
  settings: z.object({
    sampleRate: z.number().int().refine(val => [44100, 48000].includes(val)).default(48000),
    bitDepth: z.number().int().refine(val => [16, 24].includes(val)).default(16),
    bufferSize: z.number().int().min(32).max(4096).default(256),
    autoJitterBuffer: z.boolean().default(true),
    backingTrackVolume: z.number().min(0).max(1).default(0.8),
    masterVolume: z.number().min(0).max(1).default(1),
    networkMode: z.enum(['auto', 'sfu']).default('sfu'),
    maxPerformers: z.number().int().min(1).max(20).default(8),
    allowListeners: z.boolean().default(true),
  }).optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

// User schemas
export const userIdSchema = z.string().uuid('Invalid user ID format');
export const guestIdSchema = z.string().regex(guestIdPattern, 'Invalid guest ID format');

export const updateProfileSchema = z.object({
  displayName: z.string()
    .min(1)
    .max(50)
    .transform(sanitizeString)
    .optional(),
  bio: z.string()
    .max(500)
    .transform(sanitizeString)
    .optional(),
  location: z.string()
    .max(100)
    .transform(sanitizeString)
    .optional(),
  website: z.string()
    .url()
    .max(200)
    .optional()
    .or(z.literal('')),
  socialLinks: z.record(z.string(), z.string().url().max(200)).optional(),
});

// Track schemas
export const trackSchema = z.object({
  name: z.string()
    .min(1)
    .max(255)
    .transform(sanitizeString),
  artist: z.string()
    .max(100)
    .transform(sanitizeString)
    .optional(),
  roomId: z.string().regex(shortIdPattern),
});

// Chat message schema
export const chatMessageSchema = z.object({
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long')
    .transform(sanitizeString),
  roomId: z.string().regex(shortIdPattern),
});

// Search query schema
export const searchQuerySchema = z.object({
  q: z.string()
    .min(1)
    .max(100)
    .transform(str => str.replace(/[%_'"\\;,()]/g, '')), // Remove SQL-like chars
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// WebRTC session schemas
export const webrtcSessionSchema = z.object({
  action: z.enum([
    'create',
    'pushTrack',
    'pullTrack',
    'renegotiate',
    'close',
    'getRoomTracks',
    'syncClock',
    'removeTrack',
    'initSession',
  ]),
  roomId: z.string().regex(shortIdPattern).optional(),
  sessionId: z.string().optional(),
  trackName: z.string().max(200).optional(),
  sdp: z.string().max(50000).optional(), // SDP can be large
  mid: z.string().max(50).optional(),
  userId: z.string().max(200).optional(), // Can be UUID or guest ID
});

// Invitation schemas
export const createInvitationSchema = z.object({
  email: z.string().email().optional(),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInHours: z.number().int().min(1).max(168).default(24), // Max 1 week
});

// Validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Return first error message
  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError?.message || 'Invalid input',
  };
}

// Export types
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type TrackInput = z.infer<typeof trackSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type WebRTCSessionInput = z.infer<typeof webrtcSessionSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
