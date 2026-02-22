import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveDemagogery } from '../_shared/game-engine/demagogery.ts';
import type { BalancedFaction } from '../_shared/game-engine/balance.ts';
import type { Placement, WorkerType, OratorRole } from '../_shared/game-engine/workers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id } = await req.json();
    if (!game_id) {
      return new Response(JSON.stringify({ error: 'game_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Anon client with user JWT — respects RLS
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Verify caller is authenticated
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check that the caller is a member of this game (RLS enforced)
    const { data: membership, error: memberError } = await anonClient
      .from('game_players')
      .select('player_id')
      .eq('game_id', game_id)
      .eq('player_id', user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Switch to service-role client for all further DB access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify round is ready for resolution
    const { data: round, error: roundError } = await adminClient
      .from('game_rounds')
      .select('id, round_number, phase')
      .eq('game_id', game_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();

    if (roundError) throw roundError;
    if (round.phase !== 'completed') {
      return new Response(JSON.stringify({ error: 'Round is not ready for resolution' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all placements for this round (with faction_key via join)
    const { data: placements, error: placementsError } = await adminClient
      .from('game_placements')
      .select('player_id, faction_id, worker_type, orator_role, sub_round, game_factions!inner(faction_key)')
      .eq('round_id', round.id);

    if (placementsError) throw placementsError;

    // Fetch factions for this game
    const { data: factions, error: factionsError } = await adminClient
      .from('game_factions')
      .select('*')
      .eq('game_id', game_id);

    if (factionsError) throw factionsError;

    // Fetch player affinities
    const { data: affinities, error: affinitiesError } = await adminClient
      .from('game_player_faction_affinity')
      .select('player_id, faction_id, affinity, game_factions!inner(faction_key)')
      .eq('game_id', game_id);

    if (affinitiesError) throw affinitiesError;

    // Transform to game engine format
    const engineFactions: BalancedFaction[] = (factions ?? []).map((f: any) => ({
      key: f.faction_key,
      displayName: f.display_name,
      latinName: f.faction_key,
      description: '',
      power: f.power_level,
      preferences: {
        centralization: f.pref_centralization,
        expansion: f.pref_expansion,
        commerce: f.pref_commerce,
        patrician: f.pref_patrician,
        tradition: f.pref_tradition,
        militarism: f.pref_militarism,
      },
    }));

    const enginePlacements: Placement[] = (placements ?? []).map((p: any) => ({
      playerId: p.player_id,
      factionKey: (p.game_factions as any).faction_key,
      workerType: p.worker_type as WorkerType,
      oratorRole: p.orator_role as OratorRole | undefined,
      subRound: p.sub_round,
    }));

    // Build affinity map: playerId -> factionKey -> affinity
    const playerAffinities: Record<string, Record<string, number>> = {};
    for (const a of affinities ?? []) {
      const pid = a.player_id;
      const fkey = (a.game_factions as any).faction_key;
      if (!playerAffinities[pid]) playerAffinities[pid] = {};
      playerAffinities[pid][fkey] = a.affinity;
    }

    // Run resolution engine
    const result = resolveDemagogery(enginePlacements, engineFactions, playerAffinities);

    // Persist via SQL RPC (service role bypasses revoked permissions)
    const { error: rpcError } = await adminClient.rpc('resolve_demagogery', {
      p_game_id: game_id,
      p_influence_changes: result.influenceChanges,
      p_power_changes: result.factionPowerChanges,
    });

    if (rpcError) throw rpcError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
