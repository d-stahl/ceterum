import { createEdgeClients, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import {
  buildEngineFactionsFromDb,
  buildEnginePlacementsFromDb,
  buildPlayerAffinitiesFromDb,
} from '../_shared/db-transforms.ts';
import { resolveDemagogery } from '../_shared/game-engine/demagogery.ts';

console.log('[submit-placement] Function loaded successfully');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[submit-placement] Request body:', JSON.stringify(body));
    const { game_id, faction_id, worker_type, orator_role } = body;
    if (!game_id || !faction_id || !worker_type) {
      return errorResponse('Missing required fields', 400);
    }

    const { anonClient, adminClient } = await createEdgeClients(req.headers.get('Authorization'));

    // Submit via anon client — SQL validates membership, sub-round limits, dedup
    const { data: submitResult, error: submitError } = await anonClient.rpc('submit_placement', {
      p_game_id: game_id,
      p_faction_id: faction_id,
      p_worker_type: worker_type,
      p_orator_role: orator_role ?? null,
    });

    console.log('[submit-placement] submit_placement result:', JSON.stringify(submitResult), 'error:', JSON.stringify(submitError));
    if (submitError) return errorResponse(submitError.message, 422);

    // All 3 sub-rounds complete — resolve immediately, server-side
    if (submitResult?.status === 'ready_for_resolution') {
      console.log('[submit-placement] Ready for resolution, fetching round...');
      // Get current round
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

      // Fetch all placements, factions, and affinities in parallel
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
      });
      if (rpcError) throw rpcError;

      // resolve_demagogery now transitions directly to leader_election phase
      return jsonResponse({ status: 'resolved' });
    }

    return jsonResponse(submitResult);

  } catch (err) {
    console.error('[submit-placement] Caught error:', err);
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
