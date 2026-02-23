/**
 * Shared auth and HTTP utilities for Edge Functions.
 *
 * Pattern: every Edge Function uses two Supabase clients:
 *   - anonClient  (user JWT): SQL calls that need auth.uid(), respects RLS
 *   - adminClient (service role): reads/writes that need to bypass RLS after validation
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export type EdgeClients = {
  anonClient: SupabaseClient;
  adminClient: SupabaseClient;
  user: { id: string };
};

/**
 * Validate Authorization header and return both Supabase clients.
 * Throws a Response (to return directly) on auth failure.
 */
export async function createEdgeClients(authHeader: string | null): Promise<EdgeClients> {
  if (!authHeader) {
    throw jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    throw jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return { anonClient, adminClient, user };
}

/**
 * Verify that `userId` is a member of `gameId`.
 * Uses the anon client so RLS is enforced.
 * Throws a Response on failure.
 */
export async function verifyMembership(
  anonClient: SupabaseClient,
  gameId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await anonClient
    .from('game_players')
    .select('player_id')
    .eq('game_id', gameId)
    .eq('player_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw jsonResponse({ error: 'Forbidden' }, 403);
  }
}
