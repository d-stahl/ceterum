import { Placement } from './workers';
import { BalancedFaction } from './balance';

// Tunable constants (subject to playtesting)
export const BASE_INFLUENCE = 4;
export const CROWD_PENALTY = 0.6; // each demagog gets 60% when 2 present
export const ALLY_BONUS = 2; // flat bonus to demagog from allies (regardless of count)
export const ALLY_SELF_PAY = 2; // ally's own payout
export const ALLY_CROWD_PENALTY = 0.6;
export const AGITATOR_PENALTY = 3; // flat penalty to demagog from agitators
export const AGITATOR_ALLY_PENALTY = 1; // flat penalty to each ally from agitators
export const AGITATOR_SELF_PAY = 2;
export const AGITATOR_CROWD_PENALTY = 0.6;
export const PROMOTER_POWER_CHANGE = 1;
export const SABOTEUR_POWER_CHANGE = -1;

export interface ResolutionResult {
  influenceChanges: Record<string, number>; // playerId -> influence gained
  factionPowerChanges: Record<string, number>; // factionKey -> power change
}

/**
 * Resolve all placements for a complete Demagogery phase (all 3 sub-rounds).
 */
export function resolveDemagogery(
  placements: Placement[],
  factions: BalancedFaction[],
  playerAffinities: Record<string, Record<string, number>>, // playerId -> factionKey -> affinity
): ResolutionResult {
  const influenceChanges: Record<string, number> = {};
  const factionPowerChanges: Record<string, number> = {};

  // Group placements by faction
  const byFaction = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byFaction.get(p.factionKey) || [];
    list.push(p);
    byFaction.set(p.factionKey, list);
  }

  // Resolve each faction independently
  for (const [factionKey, factionPlacements] of byFaction) {
    const faction = factions.find((f) => f.key === factionKey);
    if (!faction) continue;

    const demagogs = factionPlacements.filter((p) => p.oratorRole === 'demagog');
    const allies = factionPlacements.filter((p) => p.oratorRole === 'ally');
    const agitators = factionPlacements.filter((p) => p.oratorRole === 'agitator');
    const promoters = factionPlacements.filter((p) => p.workerType === 'promoter');
    const saboteurs = factionPlacements.filter((p) => p.workerType === 'saboteur');

    const powerMod = Math.max(0.1, faction.power / 3); // scale by power, floor at 0.1

    // Resolve demagogs
    if (demagogs.length > 0) {
      const hasAllies = allies.length > 0;
      const hasAgitators = agitators.length > 0;

      // Crowd penalty for multiple demagogs
      const crowdMod = demagogs.length === 1 ? 1.0 :
        Math.pow(CROWD_PENALTY, demagogs.length - 1);

      for (const dem of demagogs) {
        const affinity = playerAffinities[dem.playerId]?.[factionKey] ?? 0;
        const affinityMod = Math.max(0.1, 1 + affinity * 0.1);

        let payout = BASE_INFLUENCE * powerMod * affinityMod * crowdMod;
        if (hasAllies) payout += ALLY_BONUS;
        if (hasAgitators) payout -= AGITATOR_PENALTY;
        payout = Math.max(0, Math.round(payout));

        influenceChanges[dem.playerId] = (influenceChanges[dem.playerId] || 0) + payout;
      }

      // Resolve allies
      const allyCrowdMod = allies.length === 1 ? 1.0 :
        Math.pow(ALLY_CROWD_PENALTY, allies.length - 1);

      for (const ally of allies) {
        let payout = ALLY_SELF_PAY * powerMod * allyCrowdMod;
        if (hasAgitators) payout -= AGITATOR_ALLY_PENALTY;
        payout = Math.max(0, Math.round(payout));

        influenceChanges[ally.playerId] = (influenceChanges[ally.playerId] || 0) + payout;
      }

      // Resolve agitators
      const agitatorCrowdMod = agitators.length === 1 ? 1.0 :
        Math.pow(AGITATOR_CROWD_PENALTY, agitators.length - 1);

      for (const agi of agitators) {
        let payout = AGITATOR_SELF_PAY * powerMod * agitatorCrowdMod;
        payout = Math.max(0, Math.round(payout));

        influenceChanges[agi.playerId] = (influenceChanges[agi.playerId] || 0) + payout;
      }
    }
    // Allies/agitators with no demagog = wasted (0 payout, already not added)

    // Resolve promoters/saboteurs
    for (const _p of promoters) {
      factionPowerChanges[factionKey] = (factionPowerChanges[factionKey] || 0) + PROMOTER_POWER_CHANGE;
    }
    for (const _s of saboteurs) {
      factionPowerChanges[factionKey] = (factionPowerChanges[factionKey] || 0) + SABOTEUR_POWER_CHANGE;
    }
  }

  return { influenceChanges, factionPowerChanges };
}
