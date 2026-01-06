// Server-side Supabase utilities for API routes
// Uses service role key for admin operations and validates user tokens from headers
//
// SECURITY NOTE: Most API routes should use getAnonSupabase() which respects RLS.
// Only use getAdminSupabase() for operations that genuinely require bypassing RLS
// (e.g., looking up user profiles to verify admin status).

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAnon: SupabaseClient | null = null;

/**
 * Get Supabase client with anon key for API routes
 * This respects RLS policies and should be used for most operations
 * Returns null if configuration is missing
 */
export function getAnonSupabase(): SupabaseClient | null {
  if (!supabaseAnon) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      supabaseAnon = createClient(url, key);
    }
  }
  return supabaseAnon;
}

/**
 * Get Supabase client for API routes
 * DEPRECATED: Use getAnonSupabase() for RLS-respecting operations
 * or getAdminSupabase() for admin-only operations with proper auth checks.
 * This function now returns the anon client to enforce RLS by default.
 */
export function getSupabase(): SupabaseClient | null {
  // SECURITY FIX: Return anon client by default to respect RLS
  // Previously this returned service role key, bypassing all security
  return getAnonSupabase();
}

/**
 * Get Supabase client with service role key for admin operations
 * This bypasses RLS and should only be used in API routes with proper auth checks
 */
export function getAdminSupabase(): SupabaseClient | null {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      supabaseAdmin = createClient(url, key);
    }
  }
  return supabaseAdmin;
}

/**
 * Get user from Authorization header (Bearer token)
 * This is for API routes where we can't use cookie-based auth
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getAdminSupabase();
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Check if a user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = getAdminSupabase();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('account_type')
      .eq('id', userId)
      .single();

    if (error || !data) return false;
    return data.account_type === 'admin';
  } catch {
    return false;
  }
}

/**
 * Get user profile from database
 */
export async function getServerUserProfile(userId: string) {
  const supabase = getAdminSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id as string,
      username: data.username as string,
      displayName: data.display_name as string,
      accountType: (data.account_type as 'free' | 'pro' | 'admin') || 'free',
    };
  } catch {
    return null;
  }
}

/**
 * Verify admin access from request
 * Returns the user if they are an admin, null otherwise
 */
export async function verifyAdminRequest(request: Request): Promise<User | null> {
  const user = await getUserFromRequest(request);
  if (!user) return null;

  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) return null;

  return user;
}

/**
 * Higher-order function that wraps an API route handler with admin authentication
 * Eliminates boilerplate auth checks in admin routes
 */
export function withAdminAuth(
  handler: (req: NextRequest, user: User) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const user = await verifyAdminRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, user);
  };
}

/**
 * Higher-order function that wraps an API route handler with user authentication
 * Use this for endpoints that require a logged-in user
 */
export function withAuth(
  handler: (req: NextRequest, user: User) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return handler(req, user);
  };
}

/**
 * Higher-order function that wraps an API route handler with optional authentication
 * The handler receives the user if authenticated, or null if not
 * Use this for endpoints that work for both authenticated and anonymous users
 */
export function withOptionalAuth(
  handler: (req: NextRequest, user: User | null) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const user = await getUserFromRequest(req);
    return handler(req, user);
  };
}

/**
 * Check if a user is a member of a room and get their role
 * Returns null if not a member, otherwise returns the membership info
 */
export async function getRoomMembership(
  roomId: string,
  userId: string
): Promise<{ role: string; isOwner: boolean; isModerator: boolean } | null> {
  const supabase = getAdminSupabase();
  if (!supabase) return null;

  try {
    // Check if user is room creator
    const { data: room } = await supabase
      .from('rooms')
      .select('created_by')
      .eq('id', roomId)
      .single();

    if (room?.created_by === userId) {
      return { role: 'owner', isOwner: true, isModerator: true };
    }

    // Check room_members table
    const { data: member } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (!member) return null;

    const role = member.role as string;
    const isOwner = role === 'owner';
    const isModerator = isOwner || role === 'co-host';

    return { role, isOwner, isModerator };
  } catch {
    return null;
  }
}

/**
 * Verify that a user has at least a specific role in a room
 * Role hierarchy: owner > co_host > performer > member > listener
 */
export async function verifyRoomRole(
  roomId: string,
  userId: string,
  requiredRole: 'owner' | 'co_host' | 'performer' | 'member' | 'listener'
): Promise<boolean> {
  const membership = await getRoomMembership(roomId, userId);
  if (!membership) return false;

  const roleHierarchy = ['listener', 'member', 'performer', 'co_host', 'owner'];
  const userRoleIndex = roleHierarchy.indexOf(membership.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
}

/**
 * Higher-order function that wraps an API route handler with room membership verification
 * Extracts roomId from the URL params and verifies the user is a member
 */
export function withRoomAuth(
  handler: (req: NextRequest, user: User, roomId: string) => Promise<NextResponse>,
  options: { requiredRole?: 'owner' | 'co_host' | 'performer' | 'member' | 'listener' } = {}
): (req: NextRequest, context: { params: Promise<{ roomId: string }> }) => Promise<NextResponse> {
  return async (req: NextRequest, context: { params: Promise<{ roomId: string }> }) => {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { roomId } = await context.params;
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    }

    // Verify room membership if a role is required
    if (options.requiredRole) {
      const hasRole = await verifyRoomRole(roomId, user.id, options.requiredRole);
      if (!hasRole) {
        return NextResponse.json(
          { error: 'Insufficient permissions for this room' },
          { status: 403 }
        );
      }
    } else {
      // At minimum, verify user is a member
      const membership = await getRoomMembership(roomId, user.id);
      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this room' },
          { status: 403 }
        );
      }
    }

    return handler(req, user, roomId);
  };
}
