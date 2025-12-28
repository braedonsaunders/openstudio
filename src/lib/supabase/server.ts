// Server-side Supabase utilities for API routes
// Uses service role key for admin operations and validates user tokens from headers

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

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
