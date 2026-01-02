/**
 * Authenticated fetch utility for client-side API calls.
 *
 * This module provides a fetch wrapper that automatically includes
 * the user's JWT token in the Authorization header for authenticated
 * API endpoints.
 */

import { supabaseAuth } from '@/lib/supabase/auth';

/**
 * Get the current user's access token from Supabase session.
 * Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    console.error('[authFetch] Failed to get access token:', error);
    return null;
  }
}

/**
 * Build auth headers with Bearer token if available.
 * Can be merged with other headers for fetch calls.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Authenticated fetch wrapper.
 * Automatically includes the Authorization header with the user's JWT token.
 * Falls back to unauthenticated request if no session exists.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Fetch response
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);

  // Add auth header if we have a token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Authenticated fetch with JSON body.
 * Convenience wrapper that sets Content-Type and stringifies the body.
 *
 * @param url - The URL to fetch
 * @param method - HTTP method (POST, PATCH, PUT, DELETE)
 * @param body - Object to send as JSON body
 * @param options - Additional fetch options
 * @returns Fetch response
 */
export async function authFetchJson(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: unknown,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    method,
    headers,
    body: JSON.stringify(body),
  });
}
