/**
 * Shared DB-to-engine transformation utilities for Edge Functions.
 *
 * These functions convert raw Supabase query results (snake_case, any-typed)
 * into the typed structs the game engine expects.
 *
 * Keep in sync with the shape of: game_factions, game_placements,
 * game_player_faction_affinity, and game_controversy_votes tables.
 */

import type { BalancedFaction } from './game-engine/balance.ts';
import type { Placement, WorkerType, OratorRole } from './game-engine/workers.ts';
import type { Vote } from './game-engine/ruling.ts';

/**
 * Convert game_factions rows (with pref_* columns) to BalancedFaction[].
 * Requires columns: faction_key, display_name, power_level,
 *   pref_centralization, pref_expansion, pref_commerce,
 *   pref_patrician, pref_tradition, pref_militarism
 */
export function buildEngineFactionsFromDb(factions: any[]): BalancedFaction[] {
  return (factions ?? []).map((f) => ({
    key: f.faction_key,
    displayName: f.display_name ?? f.faction_key,
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
}

/**
 * Convert game_placements rows (with game_factions joined) to Placement[].
 * Requires columns: player_id, worker_type, orator_role, sub_round
 *   and joined game_factions.faction_key
 */
export function buildEnginePlacementsFromDb(placements: any[]): Placement[] {
  return (placements ?? []).map((p) => ({
    playerId: p.player_id,
    factionKey: p.game_factions.faction_key,
    workerType: p.worker_type as WorkerType,
    oratorRole: (p.orator_role ?? undefined) as OratorRole | undefined,
    subRound: p.sub_round,
  }));
}

/**
 * Convert game_player_faction_affinity rows (with game_factions joined)
 * to the nested map the engine expects: { [playerId]: { [factionKey]: affinity } }
 * Requires columns: player_id, affinity and joined game_factions.faction_key
 */
export function buildPlayerAffinitiesFromDb(
  affinities: any[],
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const a of affinities ?? []) {
    const pid = a.player_id;
    const fkey = a.game_factions.faction_key;
    if (!result[pid]) result[pid] = {};
    result[pid][fkey] = a.affinity;
  }
  return result;
}

/**
 * Convert game_controversy_votes rows to Vote[].
 * Requires columns: player_id, resolution_key, influence_spent
 */
export function buildEngineVotesFromDb(votes: any[]): Vote[] {
  return (votes ?? []).map((v) => ({
    playerId: v.player_id,
    resolutionKey: v.resolution_key,
    influenceSpent: v.influence_spent,
  }));
}

/**
 * Convert game_endeavour_submissions rows to EndeavourSubmission[].
 * Requires columns: player_id, influence_invested
 */
export function buildEndeavourSubmissionsFromDb(
  submissions: any[],
): { playerId: string; influenceInvested: number }[] {
  return (submissions ?? []).map((s) => ({
    playerId: s.player_id,
    influenceInvested: s.influence_invested,
  }));
}

/**
 * Convert game_clash_submissions rows to ClashSubmission[].
 * Requires columns: player_id, faction_bids, commits
 */
export function buildClashSubmissionsFromDb(
  submissions: any[],
): { playerId: string; factionBids: Record<string, number>; commits: boolean }[] {
  return (submissions ?? []).map((s) => ({
    playerId: s.player_id,
    factionBids: s.faction_bids ?? {},
    commits: s.commits,
  }));
}

/**
 * Convert game_schism_submissions rows to SchismSubmission[].
 * Requires columns: player_id, supports
 */
export function buildSchismSubmissionsFromDb(
  submissions: any[],
): { playerId: string; supports: boolean }[] {
  return (submissions ?? []).map((s) => ({
    playerId: s.player_id,
    supports: s.supports,
  }));
}
