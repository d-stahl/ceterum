import { createEdgeClients, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import {
  buildEngineFactionsFromDb,
  buildEnginePlacementsFromDb,
  buildPlayerAffinitiesFromDb,
} from '../_shared/db-transforms.ts';
import { resolveDemagogeryDetailed } from '../_shared/game-engine/demagogery.ts';
import type { WorkerType, OratorRole } from '../_shared/game-engine/workers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { game_id, preliminary_placement } = body;
    if (!game_id) return errorResponse('Missing game_id', 400);

    const { anonClient, adminClient, user } = await createEdgeClients(req.headers.get('Authorization'));

    // Verify membership (uses anon client, respects RLS)
    const { data: membership, error: membershipError } = await anonClient
      .from('game_players')
      .select('player_id')
      .eq('game_id', game_id)
      .eq('player_id', user.id)
      .maybeSingle();
    if (membershipError || !membership) return errorResponse('Forbidden', 403);

    // Load current round for round_id and sub_round
    const { data: round, error: roundError } = await adminClient
      .from('game_rounds')
      .select('id, sub_round')
      .eq('game_id', game_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (roundError) return errorResponse('Round not found', 404);

    // Fetch placements, factions, affinities in parallel
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

    const enginePlacements = buildEnginePlacementsFromDb(placementsRes.data ?? []);
    const engineFactions = buildEngineFactionsFromDb(factionsRes.data ?? []);

    // Append preliminary placement if provided
    if (preliminary_placement) {
      const validWorkerTypes = ['orator', 'promoter', 'saboteur'];
      const validOratorRoles = ['demagog', 'advocate', 'agitator'];
      if (!validWorkerTypes.includes(preliminary_placement.workerType)) {
        return errorResponse('Invalid workerType', 400);
      }
      if (preliminary_placement.oratorRole !== undefined &&
          preliminary_placement.oratorRole !== null &&
          !validOratorRoles.includes(preliminary_placement.oratorRole)) {
        return errorResponse('Invalid oratorRole', 400);
      }
      const factionExists = engineFactions.some((f) => f.key === preliminary_placement.factionKey);
      if (!factionExists) return errorResponse('Invalid factionKey', 400);

      enginePlacements.push({
        playerId: user.id,
        factionKey: preliminary_placement.factionKey,
        workerType: preliminary_placement.workerType as WorkerType,
        oratorRole: preliminary_placement.oratorRole as OratorRole | undefined,
        subRound: round.sub_round,
      });
    }
    const playerAffinities = buildPlayerAffinitiesFromDb(affinitiesRes.data ?? []);

    const { workerEffects } = resolveDemagogeryDetailed(enginePlacements, engineFactions, playerAffinities);

    return jsonResponse({ workerEffects });

  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
