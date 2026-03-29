import { createEdgeClients, corsHeaders, jsonResponse, errorResponse, verifyMembership } from '../_shared/auth.ts';
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
    console.log('[preview-effects] Request received');
    const body = await req.json();
    const { game_id, preliminary_placement } = body;
    if (!game_id) return errorResponse('Missing game_id', 400);

    const { anonClient, adminClient, user } = await createEdgeClients(req.headers.get('Authorization'));

    await verifyMembership(anonClient, game_id, user.id);

    // Load current round for round_id, sub_round, and phase
    const { data: round, error: roundError } = await adminClient
      .from('game_rounds')
      .select('id, sub_round, phase')
      .eq('game_id', game_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (roundError) return errorResponse('Round not found', 404);

    // During overview/resolved, all placements are revealed — no visibility filter
    const allRevealed = round.phase === 'demagogery_overview' || round.phase === 'demagogery_resolved';

    // Fetch placements, factions, affinities in parallel
    let placementsQuery = adminClient
      .from('game_placements')
      .select('player_id, worker_type, orator_role, sub_round, game_factions!inner(faction_key)')
      .eq('round_id', round.id);

    if (!allRevealed) {
      // Only include placements that are visible to the caller:
      // - previous sub-rounds (already revealed to all players), or
      // - locked placements (carried-forward demagogs, always visible), or
      // - the caller's own placements (they know what they submitted)
      placementsQuery = placementsQuery.or(`sub_round.lt.${round.sub_round},is_locked.eq.true,player_id.eq.${user.id}`);
    }

    const [placementsRes, factionsRes, affinitiesRes] = await Promise.all([
      placementsQuery,
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

    console.log(`[preview-effects] Resolving: ${enginePlacements.length} placements, ${engineFactions.length} factions, phase=${round.phase}`);
    const { workerEffects } = resolveDemagogeryDetailed(enginePlacements, engineFactions, playerAffinities);

    console.log(`[preview-effects] Success: ${workerEffects.length} effects`);
    return jsonResponse({ workerEffects });

  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[preview-effects] Error:', message, err instanceof Error ? err.stack : '');
    return errorResponse(message);
  }
});
