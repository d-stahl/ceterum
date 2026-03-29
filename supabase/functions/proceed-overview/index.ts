import { createEdgeClients, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import {
  buildEngineFactionsFromDb,
  buildEnginePlacementsFromDb,
  buildPlayerAffinitiesFromDb,
} from '../_shared/db-transforms.ts';
import { resolveDemagogery } from '../_shared/game-engine/demagogery.ts';

console.log('[proceed-overview] Function loaded successfully');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id } = await req.json();
    if (!game_id) return errorResponse('Missing game_id', 400);

    const { anonClient, adminClient } = await createEdgeClients(req.headers.get('Authorization'));

    // Mark this player as ready via anon client (SQL validates membership + phase)
    const { data: result, error } = await anonClient.rpc('proceed_from_overview', {
      p_game_id: game_id,
    });

    console.log('[proceed-overview] result:', JSON.stringify(result), 'error:', JSON.stringify(error));
    if (error) return errorResponse(error.message, 422);

    // All players ready — resolve demagogery server-side
    if (result?.status === 'ready_for_resolution') {
      console.log('[proceed-overview] All ready, resolving...');

      const { data: round, error: roundError } = await adminClient
        .from('game_rounds')
        .select('id, phase')
        .eq('game_id', game_id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();
      if (roundError) throw roundError;

      if (round.phase !== 'demagogery_resolved') {
        // Resolution already ran (race condition)
        return jsonResponse({ status: 'resolved' });
      }

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

      const engineResult = resolveDemagogery(enginePlacements, engineFactions, playerAffinities);

      const { error: rpcError } = await adminClient.rpc('resolve_demagogery', {
        p_game_id: game_id,
        p_influence_changes: engineResult.influenceChanges,
        p_power_changes: engineResult.factionPowerChanges,
        p_affinity_changes: engineResult.affinityChanges,
      });
      if (rpcError) throw rpcError;

      return jsonResponse({ status: 'resolved' });
    }

    return jsonResponse(result);

  } catch (err) {
    console.error('[proceed-overview] Caught error:', err);
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
