import { supabase } from './supabase';
import { resolveDemagogery } from './game-engine/demagogery';
import { BalancedFaction } from './game-engine/balance';
import { Placement, WorkerType, OratorRole } from './game-engine/workers';

export async function submitPlacement(
  gameId: string,
  factionId: string,
  workerType: WorkerType,
  oratorRole?: OratorRole,
): Promise<{ status: string; subRound?: number; submitted?: number; total?: number }> {
  const { data, error } = await supabase.rpc('submit_placement', {
    p_game_id: gameId,
    p_faction_id: factionId,
    p_worker_type: workerType,
    p_orator_role: oratorRole ?? null,
  });

  if (error) throw error;
  return data as any;
}

export async function resolveCurrentPhase(gameId: string): Promise<void> {
  // Fetch current round
  const { data: round, error: roundError } = await supabase
    .from('game_rounds')
    .select('id, round_number, phase')
    .eq('game_id', gameId)
    .order('round_number', { ascending: false })
    .limit(1)
    .single();

  if (roundError) throw roundError;
  if (round.phase !== 'completed') throw new Error('Round is not ready for resolution');

  // Fetch all placements for this round
  const { data: placements, error: placementsError } = await supabase
    .from('game_placements')
    .select('player_id, faction_id, worker_type, orator_role, sub_round, game_factions!inner(faction_key)')
    .eq('round_id', round.id);

  if (placementsError) throw placementsError;

  // Fetch factions for this game
  const { data: factions, error: factionsError } = await supabase
    .from('game_factions')
    .select('*')
    .eq('game_id', gameId);

  if (factionsError) throw factionsError;

  // Fetch player affinities
  const { data: affinities, error: affinitiesError } = await supabase
    .from('game_player_faction_affinity')
    .select('player_id, faction_id, affinity, game_factions!inner(faction_key)')
    .eq('game_id', gameId);

  if (affinitiesError) throw affinitiesError;

  // Transform to game engine format
  const engineFactions: BalancedFaction[] = (factions ?? []).map((f: any) => ({
    key: f.faction_key,
    displayName: f.display_name,
    latinName: f.faction_key, // not stored separately, use key
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

  // Run resolution
  const result = resolveDemagogery(enginePlacements, engineFactions, playerAffinities);

  // Write results via RPC
  const { error } = await supabase.rpc('resolve_demagogery', {
    p_game_id: gameId,
    p_influence_changes: result.influenceChanges,
    p_power_changes: result.factionPowerChanges,
  });

  if (error) throw error;
}
