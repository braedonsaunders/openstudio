// Admin API helper with authentication
// Automatically includes the Authorization header with the user's access token

import { supabaseAuth } from '@/lib/supabase/auth';

/**
 * Get authorization headers for admin API requests
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabaseAuth.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make an authenticated admin API request
 */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();

  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
}

/**
 * GET request to admin API
 */
export async function adminGet(url: string): Promise<Response> {
  return adminFetch(url, { method: 'GET' });
}

/**
 * POST request to admin API
 */
export async function adminPost(url: string, body: unknown): Promise<Response> {
  return adminFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request to admin API
 */
export async function adminPatch(url: string, body: unknown): Promise<Response> {
  return adminFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request to admin API
 */
export async function adminDelete(url: string): Promise<Response> {
  return adminFetch(url, { method: 'DELETE' });
}
