import { Placement, WorkerType, OratorRole } from './workers';
import { BalancedFaction } from './balance';

// Tunable constants (subject to playtesting)
export const BASE_INFLUENCE = 4;
export const ALLY_BONUS = 4;       // advocate bonus added to demagog's additive sum
export const ALLY_SELF_PAY = 2;    // advocate's own base payout
export const AGITATOR_SELF_PAY = 2;
export const AGITATOR_MOD = 0.5;   // agitator applies a ×0.5 multiplier to demagogs and advocates
export const CROWD_PENALTY = 0.6;  // each additional demagog multiplies payout by 0.6
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

function fmtAdd(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function getPowerBonus(power: number): number {
  if (power <= 1) return -2;
  if (power === 2) return -1;
  if (power === 3) return 0;
  if (power === 4) return 1;
  return 2;
}

function getPowerLabel(power: number): string | null {
  if (power <= 1) return 'Very weak faction';
  if (power === 2) return 'Weak faction';
  if (power === 3) return null;
  if (power === 4) return 'Powerful faction';
  return 'Very powerful faction';
}

function getAffinityBonus(affinity: number): number {
  if (affinity <= -2) return -2;
  if (affinity === -1) return -1;
  if (affinity === 0) return 0;
  if (affinity === 1) return 1;
  return 2;
}

function getAffinityLabel(affinity: number): string | null {
  if (affinity <= -2) return 'Strong antipathy';
  if (affinity === -1) return 'Antipathy';
  if (affinity === 0) return null;
  if (affinity === 1) return 'Sympathy';
  return 'Strong sympathy';
}

function crowdPct(n: number): number {
  return Math.round(100 * (1 - Math.pow(CROWD_PENALTY, n - 1)));
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

    const powerBonus = getPowerBonus(faction.power);
    const powerLabel = getPowerLabel(faction.power);
    const hasDemagogs = demagogs.length > 0;
    const hasAdvocates = advocates.length > 0;
    const hasAgitators = agitators.length > 0;

    // Crowd multiplier based on number of demagogs (shared by demagogs and advocates)
    const demagogCrowdMod = demagogs.length <= 1 ? 1.0 : Math.pow(CROWD_PENALTY, demagogs.length - 1);
    const agitatorCrowdMod = agitators.length <= 1 ? 1.0 : Math.pow(AGITATOR_CROWD_PENALTY, agitators.length - 1);

    // --- Demagogs ---
    if (hasDemagogs) {
      for (const dem of demagogs) {
        const lineItems: EffectLineItem[] = [];
        const affinity = playerAffinities[dem.playerId]?.[factionKey] ?? 0;
        const affinityBonus = getAffinityBonus(affinity);
        const affinityLabel = getAffinityLabel(affinity);
        const advocateBonus = hasAdvocates ? ALLY_BONUS : 0;

        lineItems.push({ label: 'Base influence', value: BASE_INFLUENCE, displayValue: fmtAdd(BASE_INFLUENCE) });

        if (powerLabel !== null) {
          lineItems.push({ label: powerLabel, value: powerBonus, displayValue: fmtAdd(powerBonus) });
        }
        if (affinityLabel !== null) {
          lineItems.push({ label: `${affinityLabel} (${fmtAdd(affinity)})`, value: affinityBonus, displayValue: fmtAdd(affinityBonus) });
        }
        if (hasAdvocates) {
          lineItems.push({ label: 'Advocate present', value: advocateBonus, displayValue: fmtAdd(advocateBonus) });
        }
        if (demagogs.length > 1) {
          const pct = crowdPct(demagogs.length);
          lineItems.push({ label: `Crowding (${demagogs.length} demagogs)`, value: demagogCrowdMod, displayValue: `-${pct}%` });
        }
        if (hasAgitators) {
          lineItems.push({ label: 'Agitator present', value: AGITATOR_MOD, displayValue: '-50%' });
        }

        const additiveSum = BASE_INFLUENCE + powerBonus + affinityBonus + advocateBonus;
        const payout = Math.ceil(Math.max(0, additiveSum * demagogCrowdMod * (hasAgitators ? AGITATOR_MOD : 1.0)));

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

      // --- Advocates (when demagogs present) ---
      for (const advocate of advocates) {
        const lineItems: EffectLineItem[] = [];

        lineItems.push({ label: 'Advocate payout', value: ALLY_SELF_PAY, displayValue: fmtAdd(ALLY_SELF_PAY) });

        if (powerLabel !== null) {
          lineItems.push({ label: powerLabel, value: powerBonus, displayValue: fmtAdd(powerBonus) });
        }
        if (demagogs.length > 1) {
          const pct = crowdPct(demagogs.length);
          lineItems.push({ label: `Crowding (${demagogs.length} demagogs)`, value: demagogCrowdMod, displayValue: `-${pct}%` });
        }
        if (hasAgitators) {
          lineItems.push({ label: 'Agitator present', value: AGITATOR_MOD, displayValue: '-50%' });
        }

        const additiveSum = ALLY_SELF_PAY + powerBonus;
        const payout = Math.ceil(Math.max(0, additiveSum * demagogCrowdMod * (hasAgitators ? AGITATOR_MOD : 1.0)));

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
      for (const agi of agitators) {
        const lineItems: EffectLineItem[] = [];

        lineItems.push({ label: 'Agitator payout', value: AGITATOR_SELF_PAY, displayValue: fmtAdd(AGITATOR_SELF_PAY) });

        if (powerLabel !== null) {
          lineItems.push({ label: powerLabel, value: powerBonus, displayValue: fmtAdd(powerBonus) });
        }
        if (agitators.length > 1) {
          const pct = crowdPct(agitators.length);
          lineItems.push({ label: `Crowding (${agitators.length} agitators)`, value: agitatorCrowdMod, displayValue: `-${pct}%` });
        }

        const additiveSum = AGITATOR_SELF_PAY + powerBonus;
        const payout = Math.ceil(Math.max(0, additiveSum * agitatorCrowdMod));

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
