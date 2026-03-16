import { createEdgeClients, verifyMembership, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import {
  buildEngineFactionsFromDb,
  buildEnginePlacementsFromDb,
  buildPlayerAffinitiesFromDb,
} from '../_shared/db-transforms.ts';
import { resolveDemagogery } from '../_shared/game-engine/demagogery.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id } = await req.json();
    if (!game_id) {
      return errorResponse('Missing game_id', 400);
    }

    const { anonClient, adminClient, user } = await createEdgeClients(req.headers.get('Authorization'));
    await verifyMembership(anonClient, game_id, user.id);

    const { data, error } = await adminClient.rpc('advance_round', {
      p_game_id: game_id,
    });
    if (error) throw error;

    // All players had locked demagogs — demagogery skipped, resolve immediately
    if (data?.status === 'skip_demagogery') {
      const { data: round, error: roundError } = await adminClient
        .from('game_rounds')
        .select('id')
        .eq('game_id', game_id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();
      if (roundError) throw roundError;

      const [placementsRes, factionsRes, affinitiesRes] = await Promise.all([
        adminClient
          .from('game_placements')
          .select('player_id, worker_type, orator_role, sub_round, game_factions!inner(faction_key)')
          .eq('round_id', round.id),
        adminClient
          .from('game_factions')
          .select('faction_key, display_name, power_level, pref_centralization, pref_expansion, pref_commerce, pref_patrician, pref_tradition, pref_militarism')
          .eq('game_id', game_id),
        adminClient
          .from('game_player_faction_affinity')
          .select('player_id, affinity, game_factions!inner(faction_key)')
          .eq('game_id', game_id),
      ]);
      if (placementsRes.error) throw placementsRes.error;
      if (factionsRes.error) throw factionsRes.error;
      if (affinitiesRes.error) throw affinitiesRes.error;

      const engineFactions = buildEngineFactionsFromDb(factionsRes.data ?? []);
      const enginePlacements = buildEnginePlacementsFromDb(placementsRes.data ?? []);
      const playerAffinities = buildPlayerAffinitiesFromDb(affinitiesRes.data ?? []);

      const result = resolveDemagogery(enginePlacements, engineFactions, playerAffinities);

      const { error: rpcError } = await adminClient.rpc('resolve_demagogery', {
        p_game_id: game_id,
        p_influence_changes: result.influenceChanges,
        p_power_changes: result.factionPowerChanges,
        p_affinity_changes: result.affinityChanges,
      });
      if (rpcError) throw rpcError;

      return jsonResponse({ status: 'skip_demagogery', round_number: data.round_number });
    }

    return jsonResponse(data);
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
