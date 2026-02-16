import { supabase } from './supabase'

/**
 * Fetch with Supabase auth token automatically included.
 * Use this for all /api/* calls that require requireDoctor/requireAuth.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  })
}
