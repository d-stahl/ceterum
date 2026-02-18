import { Placement, WorkerType, OratorRole } from './workers';
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

export type EffectLineItem = {
  label: string;
  value: number;
  displayValue: string;
};

export type WorkerEffect = {
  playerId: string;
  factionKey: string;
  workerType: WorkerType;
  oratorRole?: OratorRole;
  lineItems: EffectLineItem[];
  totalInfluence: number;
  totalPowerChange: number;
};

export type DetailedResolutionResult = {
  workerEffects: WorkerEffect[];
  influenceChanges: Record<string, number>;
  factionPowerChanges: Record<string, number>;
};

function fmt(n: number, prefix: '+' | '×' = '+'): string {
  if (prefix === '×') return `×${parseFloat(n.toFixed(2))}`;
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Resolve all placements with per-worker itemized breakdowns.
 */
export function resolveDemagogeryDetailed(
  placements: Placement[],
  factions: BalancedFaction[],
  playerAffinities: Record<string, Record<string, number>>,
): DetailedResolutionResult {
  const workerEffects: WorkerEffect[] = [];
  const influenceChanges: Record<string, number> = {};
  const factionPowerChanges: Record<string, number> = {};

  // Group placements by faction
  const byFaction = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byFaction.get(p.factionKey) || [];
    list.push(p);
    byFaction.set(p.factionKey, list);
  }

  for (const [factionKey, factionPlacements] of byFaction) {
    const faction = factions.find((f) => f.key === factionKey);
    if (!faction) continue;

    const demagogs = factionPlacements.filter((p) => p.oratorRole === 'demagog');
    const advocates = factionPlacements.filter((p) => p.oratorRole === 'advocate');
    const agitators = factionPlacements.filter((p) => p.oratorRole === 'agitator');
    const promoters = factionPlacements.filter((p) => p.workerType === 'promoter');
    const saboteurs = factionPlacements.filter((p) => p.workerType === 'saboteur');

    const powerMod = Math.max(0.1, faction.power / 3);
    const hasDemagogs = demagogs.length > 0;
    const hasAdvocates = advocates.length > 0;
    const hasAgitators = agitators.length > 0;

    // --- Demagogs ---
    if (hasDemagogs) {
      const crowdMod = demagogs.length === 1 ? 1.0 :
        Math.pow(CROWD_PENALTY, demagogs.length - 1);

      for (const dem of demagogs) {
        const lineItems: EffectLineItem[] = [];
        const affinity = playerAffinities[dem.playerId]?.[factionKey] ?? 0;
        const affinityMod = Math.max(0.1, 1 + affinity * 0.1);

        lineItems.push({ label: 'Base influence', value: BASE_INFLUENCE, displayValue: fmt(BASE_INFLUENCE) });
        lineItems.push({ label: `Faction power (${faction.power})`, value: powerMod, displayValue: fmt(powerMod, '×') });
        lineItems.push({ label: `Affinity (${fmt(affinity)})`, value: affinityMod, displayValue: fmt(affinityMod, '×') });
        if (demagogs.length > 1) {
          lineItems.push({ label: `Crowd penalty (${demagogs.length} demagogs)`, value: crowdMod, displayValue: fmt(crowdMod, '×') });
        }
        if (hasAdvocates) {
          lineItems.push({ label: 'Advocate boost', value: ALLY_BONUS, displayValue: fmt(ALLY_BONUS) });
        }
        if (hasAgitators) {
          lineItems.push({ label: 'Agitator penalty', value: -AGITATOR_PENALTY, displayValue: fmt(-AGITATOR_PENALTY) });
        }

        let payout = BASE_INFLUENCE * powerMod * affinityMod * crowdMod;
        if (hasAdvocates) payout += ALLY_BONUS;
        if (hasAgitators) payout -= AGITATOR_PENALTY;
        payout = Math.max(0, Math.round(payout));

        influenceChanges[dem.playerId] = (influenceChanges[dem.playerId] || 0) + payout;
        workerEffects.push({
          playerId: dem.playerId,
          factionKey,
          workerType: 'orator',
          oratorRole: 'demagog',
          lineItems,
          totalInfluence: payout,
          totalPowerChange: 0,
        });
      }

      // --- Advocates ---
      const advocateCrowdMod = advocates.length === 1 ? 1.0 :
        Math.pow(ALLY_CROWD_PENALTY, advocates.length - 1);

      for (const advocate of advocates) {
        const lineItems: EffectLineItem[] = [];
        lineItems.push({ label: 'Advocate payout', value: ALLY_SELF_PAY, displayValue: fmt(ALLY_SELF_PAY) });
        lineItems.push({ label: `Faction power (${faction.power})`, value: powerMod, displayValue: fmt(powerMod, '×') });
        if (advocates.length > 1) {
          lineItems.push({ label: `Crowd penalty (${advocates.length} advocates)`, value: advocateCrowdMod, displayValue: fmt(advocateCrowdMod, '×') });
        }
        if (hasAgitators) {
          lineItems.push({ label: 'Agitator penalty', value: -AGITATOR_ALLY_PENALTY, displayValue: fmt(-AGITATOR_ALLY_PENALTY) });
        }

        let payout = ALLY_SELF_PAY * powerMod * advocateCrowdMod;
        if (hasAgitators) payout -= AGITATOR_ALLY_PENALTY;
        payout = Math.max(0, Math.round(payout));

        influenceChanges[advocate.playerId] = (influenceChanges[advocate.playerId] || 0) + payout;
        workerEffects.push({
          playerId: advocate.playerId,
          factionKey,
          workerType: 'orator',
          oratorRole: 'advocate',
          lineItems,
          totalInfluence: payout,
          totalPowerChange: 0,
        });
      }

      // --- Agitators ---
      const agitatorCrowdMod = agitators.length === 1 ? 1.0 :
        Math.pow(AGITATOR_CROWD_PENALTY, agitators.length - 1);

      for (const agi of agitators) {
        const lineItems: EffectLineItem[] = [];
        lineItems.push({ label: 'Agitator payout', value: AGITATOR_SELF_PAY, displayValue: fmt(AGITATOR_SELF_PAY) });
        lineItems.push({ label: `Faction power (${faction.power})`, value: powerMod, displayValue: fmt(powerMod, '×') });
        if (agitators.length > 1) {
          lineItems.push({ label: `Crowd penalty (${agitators.length} agitators)`, value: agitatorCrowdMod, displayValue: fmt(agitatorCrowdMod, '×') });
        }

        let payout = AGITATOR_SELF_PAY * powerMod * agitatorCrowdMod;
        payout = Math.max(0, Math.round(payout));

        influenceChanges[agi.playerId] = (influenceChanges[agi.playerId] || 0) + payout;
        workerEffects.push({
          playerId: agi.playerId,
          factionKey,
          workerType: 'orator',
          oratorRole: 'agitator',
          lineItems,
          totalInfluence: payout,
          totalPowerChange: 0,
        });
      }
    } else {
      // No demagogs — advocates and agitators are wasted
      for (const advocate of advocates) {
        workerEffects.push({
          playerId: advocate.playerId,
          factionKey,
          workerType: 'orator',
          oratorRole: 'advocate',
          lineItems: [{ label: 'No demagog — wasted', value: 0, displayValue: '+0' }],
          totalInfluence: 0,
          totalPowerChange: 0,
        });
      }
      for (const agi of agitators) {
        workerEffects.push({
          playerId: agi.playerId,
          factionKey,
          workerType: 'orator',
          oratorRole: 'agitator',
          lineItems: [{ label: 'No demagog — wasted', value: 0, displayValue: '+0' }],
          totalInfluence: 0,
          totalPowerChange: 0,
        });
      }
    }

    // --- Promoters ---
    for (const p of promoters) {
      factionPowerChanges[factionKey] = (factionPowerChanges[factionKey] || 0) + PROMOTER_POWER_CHANGE;
      workerEffects.push({
        playerId: p.playerId,
        factionKey,
        workerType: 'promoter',
        lineItems: [{ label: 'Power +1', value: PROMOTER_POWER_CHANGE, displayValue: '+1' }],
        totalInfluence: 0,
        totalPowerChange: PROMOTER_POWER_CHANGE,
      });
    }

    // --- Saboteurs ---
    for (const s of saboteurs) {
      factionPowerChanges[factionKey] = (factionPowerChanges[factionKey] || 0) + SABOTEUR_POWER_CHANGE;
      workerEffects.push({
        playerId: s.playerId,
        factionKey,
        workerType: 'saboteur',
        lineItems: [{ label: 'Power −1', value: SABOTEUR_POWER_CHANGE, displayValue: '−1' }],
        totalInfluence: 0,
        totalPowerChange: SABOTEUR_POWER_CHANGE,
      });
    }
  }

  return { workerEffects, influenceChanges, factionPowerChanges };
}

/**
 * Resolve all placements for a complete Demagogery phase (all 3 sub-rounds).
 * Backward-compatible wrapper around resolveDemagogeryDetailed.
 */
export function resolveDemagogery(
  placements: Placement[],
  factions: BalancedFaction[],
  playerAffinities: Record<string, Record<string, number>>,
): ResolutionResult {
  const { influenceChanges, factionPowerChanges } = resolveDemagogeryDetailed(
    placements, factions, playerAffinities,
  );
  return { influenceChanges, factionPowerChanges };
}
