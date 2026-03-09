import { Placement, WorkerType, OratorRole } from './workers';
import { BalancedFaction } from './balance';

// ── Tunable constants ───────────────────────────────────────────────
export const DEMAGOG_BASE = 10;
export const AGITATOR_BASE = 5;
export const ADVOCATE_BASE = 5;
export const PROMOTER_INFLUENCE = 5;  // fixed, no scaling
export const SABOTEUR_INFLUENCE = 5;  // fixed, no scaling

export const CROWD_PENALTY = 0.6; // ×0.6 per additional worker of same type at faction

export const PROMOTER_POWER_CHANGE = 1;
export const SABOTEUR_POWER_CHANGE = -2; // no stack: capped at -2 regardless of saboteur count
export const PROMOTER_AFFINITY_CHANGE = 2;  // self only
export const SABOTEUR_AFFINITY_SPLASH = -1; // to every player with a senator at faction

// ── Types ───────────────────────────────────────────────────────────
export interface ResolutionResult {
  influenceChanges: Record<string, number>;
  factionPowerChanges: Record<string, number>;
  affinityChanges: Record<string, Record<string, number>>; // playerId → factionKey → delta
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
  affinityChanges: Record<string, Record<string, number>>;
};

// ── Helpers ─────────────────────────────────────────────────────────
function fmtMult(n: number): string {
  return `×${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;
}

/** Power multiplier: P1=0.6, P3=1.0, P5=1.4 */
function powerMult(power: number): number {
  return (power + 2) / 5;
}

/** Affinity multiplier: aff-5=0.75, aff0=1.0, aff+5=1.25 */
function affMult(affinity: number): number {
  return 1.0 + 0.05 * affinity;
}

/** Crowding modifier: 1.0 for 1 worker, 0.6 for 2, 0.36 for 3, etc. */
function crowdMod(count: number): number {
  return count <= 1 ? 1.0 : Math.pow(CROWD_PENALTY, count - 1);
}

/** Agitator siphon rate: 0.10 at aff-5, 0.40 at aff0, 0.70 at aff+5 */
function siphonRate(affinity: number): number {
  return 0.4 + 0.06 * affinity;
}

/** Advocate siphon-reduction factor: 0.25 at aff-5, 0.50 at aff0, 0.75 at aff+5 */
function advocateReduction(affinity: number): number {
  return 0.5 + 0.05 * affinity;
}

/** Advocate demagog-boost factor: 0.25 at aff-5, 0.50 at aff0, 0.75 at aff+5 */
function advocateBoost(affinity: number): number {
  return 0.5 + 0.05 * affinity;
}

function addAffDelta(
  deltas: Record<string, Record<string, number>>,
  playerId: string,
  factionKey: string,
  amount: number,
): void {
  if (!deltas[playerId]) deltas[playerId] = {};
  deltas[playerId][factionKey] = (deltas[playerId][factionKey] || 0) + amount;
}

function addInfluence(
  changes: Record<string, number>,
  playerId: string,
  amount: number,
): void {
  changes[playerId] = (changes[playerId] || 0) + amount;
}

// ── Main resolution ─────────────────────────────────────────────────

/**
 * Resolve all placements with per-worker itemized breakdowns.
 *
 * Resolution order:
 *   1. Power changes (promoter/saboteur) — net-delta, then clamp
 *   2. Affinity changes (promoter self-bonus, saboteur splash) — net-delta, then clamp
 *   3. Influence payouts — using effective (post-change) power and affinity
 */
export function resolveDemagogeryDetailed(
  placements: Placement[],
  factions: BalancedFaction[],
  playerAffinities: Record<string, Record<string, number>>,
): DetailedResolutionResult {
  const workerEffects: WorkerEffect[] = [];
  const influenceChanges: Record<string, number> = {};
  const factionPowerDeltas: Record<string, number> = {};
  const affinityDeltas: Record<string, Record<string, number>> = {};

  // Group placements by faction
  const byFaction = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byFaction.get(p.factionKey) || [];
    list.push(p);
    byFaction.set(p.factionKey, list);
  }

  // ─── Phase 1: Power deltas ────────────────────────────────────────
  for (const [factionKey, fps] of byFaction) {
    const promoters = fps.filter((p) => p.workerType === 'promoter');
    const saboteurs = fps.filter((p) => p.workerType === 'saboteur');

    let delta = promoters.length * PROMOTER_POWER_CHANGE;
    if (saboteurs.length > 0) {
      delta += SABOTEUR_POWER_CHANGE; // no stack: always -2 regardless of count
    }
    if (delta !== 0) {
      factionPowerDeltas[factionKey] = delta;
    }
  }

  // ─── Phase 2: Affinity deltas ─────────────────────────────────────
  for (const [factionKey, fps] of byFaction) {
    const promoters = fps.filter((p) => p.workerType === 'promoter');
    const saboteurs = fps.filter((p) => p.workerType === 'saboteur');
    const senators = fps.filter((p) => p.workerType === 'orator');

    for (const prom of promoters) {
      addAffDelta(affinityDeltas, prom.playerId, factionKey, PROMOTER_AFFINITY_CHANGE);
    }

    if (saboteurs.length > 0) {
      for (const sen of senators) {
        addAffDelta(affinityDeltas, sen.playerId, factionKey, SABOTEUR_AFFINITY_SPLASH);
      }
    }
  }

  // ─── Effective values (original + deltas, clamped) ────────────────
  const effPower = (factionKey: string): number => {
    const faction = factions.find((f) => f.key === factionKey);
    if (!faction) return 3;
    const delta = factionPowerDeltas[factionKey] || 0;
    return Math.max(1, Math.min(5, faction.power + delta));
  };

  const effAffinity = (playerId: string, factionKey: string): number => {
    const base = playerAffinities[playerId]?.[factionKey] ?? 0;
    const delta = affinityDeltas[playerId]?.[factionKey] ?? 0;
    return Math.max(-5, Math.min(5, base + delta));
  };

  // ─── Phase 3: Influence payouts ───────────────────────────────────
  for (const [factionKey, fps] of byFaction) {
    const power = effPower(factionKey);
    const pMult = powerMult(power);

    const demagogs = fps.filter((p) => p.oratorRole === 'demagog');
    const advocates = fps.filter((p) => p.oratorRole === 'advocate');
    const agitators = fps.filter((p) => p.oratorRole === 'agitator');
    const promoters = fps.filter((p) => p.workerType === 'promoter');
    const saboteurs = fps.filter((p) => p.workerType === 'saboteur');

    const demagogCrowd = crowdMod(demagogs.length);
    const advocateCrowd = crowdMod(advocates.length);
    const agitatorCrowd = crowdMod(agitators.length);

    // ── Aggregate advocate effects (with crowding) ──────────────────
    let totalBoost = 0;
    let stealThroughFactor = 1.0;

    for (const adv of advocates) {
      const aff = effAffinity(adv.playerId, factionKey);
      const rawBoost = advocateBoost(aff);
      const rawReduction = advocateReduction(aff);
      totalBoost += rawBoost * advocateCrowd;
      stealThroughFactor *= 1 - rawReduction * advocateCrowd;
    }
    stealThroughFactor = Math.max(0, Math.min(1, stealThroughFactor));
    const demagogBoostMult = 1 + totalBoost;

    // ── Demagog payouts (before siphon) ─────────────────────────────
    type DemagogEntry = { placement: Placement; raw: number; boosted: number };
    const demagogEntries: DemagogEntry[] = [];
    for (const dem of demagogs) {
      const aff = effAffinity(dem.playerId, factionKey);
      const raw = DEMAGOG_BASE * pMult * affMult(aff) * demagogCrowd;
      const boosted = raw * demagogBoostMult;
      demagogEntries.push({ placement: dem, raw, boosted });
    }

    // ── Agitator siphons ────────────────────────────────────────────
    type AgitatorEntry = { placement: Placement; basePay: number; stolen: number };
    const agitatorEntries: AgitatorEntry[] = [];
    const siphonLoss = new Map<Placement, number>();

    for (const agi of agitators) {
      const aff = effAffinity(agi.playerId, factionKey);
      const basePay = AGITATOR_BASE * pMult * affMult(aff) * agitatorCrowd;
      const rawRate = siphonRate(aff);
      const effectiveRate = Math.max(0, rawRate * stealThroughFactor * agitatorCrowd);

      let totalStolen = 0;
      for (const de of demagogEntries) {
        const stolen = de.boosted * effectiveRate;
        totalStolen += stolen;
        siphonLoss.set(de.placement, (siphonLoss.get(de.placement) || 0) + stolen);
      }

      agitatorEntries.push({ placement: agi, basePay, stolen: totalStolen });
    }

    // ── Emit demagog effects ────────────────────────────────────────
    for (const de of demagogEntries) {
      const loss = siphonLoss.get(de.placement) || 0;
      const finalPayout = Math.max(0, Math.round(de.boosted - loss));
      const lineItems: EffectLineItem[] = [];

      lineItems.push({ label: 'Base payout', value: DEMAGOG_BASE, displayValue: `${DEMAGOG_BASE}` });
      if (pMult !== 1.0) {
        lineItems.push({ label: `Power (${power})`, value: pMult, displayValue: fmtMult(pMult) });
      }
      const aff = effAffinity(de.placement.playerId, factionKey);
      const aMult = affMult(aff);
      if (aMult !== 1.0) {
        lineItems.push({ label: `Affinity (${aff >= 0 ? '+' : ''}${aff})`, value: aMult, displayValue: fmtMult(aMult) });
      }
      if (demagogCrowd !== 1.0) {
        lineItems.push({ label: `Crowding (${demagogs.length} demagogs)`, value: demagogCrowd, displayValue: fmtMult(demagogCrowd) });
      }
      if (totalBoost > 0) {
        lineItems.push({ label: 'Advocate boost', value: demagogBoostMult, displayValue: fmtMult(demagogBoostMult) });
      }
      if (loss > 0) {
        lineItems.push({ label: 'Agitator siphon', value: -loss, displayValue: `-${Math.round(loss)}` });
      }
      lineItems.push({ label: 'Net payout', value: finalPayout, displayValue: `${finalPayout}` });

      addInfluence(influenceChanges, de.placement.playerId, finalPayout);
      workerEffects.push({
        playerId: de.placement.playerId,
        factionKey,
        workerType: 'orator',
        oratorRole: 'demagog',
        lineItems,
        totalInfluence: finalPayout,
        totalPowerChange: 0,
      });
    }

    // ── Emit agitator effects ───────────────────────────────────────
    for (const ae of agitatorEntries) {
      const finalPayout = Math.max(0, Math.round(ae.basePay + ae.stolen));
      const lineItems: EffectLineItem[] = [];

      lineItems.push({ label: 'Base payout', value: AGITATOR_BASE, displayValue: `${AGITATOR_BASE}` });
      if (pMult !== 1.0) {
        lineItems.push({ label: `Power (${power})`, value: pMult, displayValue: fmtMult(pMult) });
      }
      const aff = effAffinity(ae.placement.playerId, factionKey);
      const aMult = affMult(aff);
      if (aMult !== 1.0) {
        lineItems.push({ label: `Affinity (${aff >= 0 ? '+' : ''}${aff})`, value: aMult, displayValue: fmtMult(aMult) });
      }
      if (agitatorCrowd !== 1.0) {
        lineItems.push({ label: `Crowding (${agitators.length} agitators)`, value: agitatorCrowd, displayValue: fmtMult(agitatorCrowd) });
      }
      if (ae.stolen > 0) {
        lineItems.push({ label: 'Influence siphoned', value: ae.stolen, displayValue: `+${Math.round(ae.stolen)}` });
      }
      if (demagogEntries.length === 0) {
        lineItems.push({ label: 'No demagogs to siphon', value: 0, displayValue: '' });
      }
      lineItems.push({ label: 'Net payout', value: finalPayout, displayValue: `${finalPayout}` });

      addInfluence(influenceChanges, ae.placement.playerId, finalPayout);
      workerEffects.push({
        playerId: ae.placement.playerId,
        factionKey,
        workerType: 'orator',
        oratorRole: 'agitator',
        lineItems,
        totalInfluence: finalPayout,
        totalPowerChange: 0,
      });
    }

    // ── Emit advocate effects ───────────────────────────────────────
    for (const adv of advocates) {
      const aff = effAffinity(adv.playerId, factionKey);
      const aMult = affMult(aff);
      const basePay = ADVOCATE_BASE * pMult * aMult * advocateCrowd;
      const finalPayout = Math.max(0, Math.round(basePay));
      const lineItems: EffectLineItem[] = [];

      lineItems.push({ label: 'Base payout', value: ADVOCATE_BASE, displayValue: `${ADVOCATE_BASE}` });
      if (pMult !== 1.0) {
        lineItems.push({ label: `Power (${power})`, value: pMult, displayValue: fmtMult(pMult) });
      }
      if (aMult !== 1.0) {
        lineItems.push({ label: `Affinity (${aff >= 0 ? '+' : ''}${aff})`, value: aMult, displayValue: fmtMult(aMult) });
      }
      if (advocateCrowd !== 1.0) {
        lineItems.push({ label: `Crowding (${advocates.length} advocates)`, value: advocateCrowd, displayValue: fmtMult(advocateCrowd) });
      }

      const boostDesc = advocateBoost(aff) * advocateCrowd;
      if (demagogEntries.length > 0 && boostDesc > 0) {
        lineItems.push({ label: 'Boosting demagogs', value: boostDesc, displayValue: fmtPct(boostDesc) });
      }
      const reductionDesc = advocateReduction(aff) * advocateCrowd;
      if (agitatorEntries.length > 0 && reductionDesc > 0) {
        lineItems.push({ label: 'Reducing siphon', value: reductionDesc, displayValue: fmtPct(-reductionDesc) });
      }
      if (demagogEntries.length === 0) {
        lineItems.push({ label: 'No demagogs to boost', value: 0, displayValue: '' });
      }
      lineItems.push({ label: 'Net payout', value: finalPayout, displayValue: `${finalPayout}` });

      addInfluence(influenceChanges, adv.playerId, finalPayout);
      workerEffects.push({
        playerId: adv.playerId,
        factionKey,
        workerType: 'orator',
        oratorRole: 'advocate',
        lineItems,
        totalInfluence: finalPayout,
        totalPowerChange: 0,
      });
    }

    // ── Emit promoter effects ───────────────────────────────────────
    for (const prom of promoters) {
      const lineItems: EffectLineItem[] = [
        { label: 'Fixed payout', value: PROMOTER_INFLUENCE, displayValue: `+${PROMOTER_INFLUENCE}` },
        { label: 'Faction power', value: PROMOTER_POWER_CHANGE, displayValue: `+${PROMOTER_POWER_CHANGE}` },
        { label: 'Self affinity', value: PROMOTER_AFFINITY_CHANGE, displayValue: `+${PROMOTER_AFFINITY_CHANGE}` },
      ];

      addInfluence(influenceChanges, prom.playerId, PROMOTER_INFLUENCE);
      workerEffects.push({
        playerId: prom.playerId,
        factionKey,
        workerType: 'promoter',
        lineItems,
        totalInfluence: PROMOTER_INFLUENCE,
        totalPowerChange: PROMOTER_POWER_CHANGE,
      });
    }

    // ── Emit saboteur effects ───────────────────────────────────────
    for (const sab of saboteurs) {
      const senators = fps.filter((p) => p.workerType === 'orator');
      const splashedPlayers = [...new Set(senators.map((s) => s.playerId))];
      const lineItems: EffectLineItem[] = [
        { label: 'Fixed payout', value: SABOTEUR_INFLUENCE, displayValue: `+${SABOTEUR_INFLUENCE}` },
        { label: 'Faction power', value: SABOTEUR_POWER_CHANGE, displayValue: `${SABOTEUR_POWER_CHANGE}` },
      ];
      if (splashedPlayers.length > 0) {
        lineItems.push({
          label: `Affinity damage (${splashedPlayers.length} senator${splashedPlayers.length > 1 ? 's' : ''})`,
          value: SABOTEUR_AFFINITY_SPLASH,
          displayValue: `${SABOTEUR_AFFINITY_SPLASH} each`,
        });
      }

      addInfluence(influenceChanges, sab.playerId, SABOTEUR_INFLUENCE);
      // Power change is accounted for in factionPowerDeltas (phase 1)
      workerEffects.push({
        playerId: sab.playerId,
        factionKey,
        workerType: 'saboteur',
        lineItems,
        totalInfluence: SABOTEUR_INFLUENCE,
        totalPowerChange: saboteurs.indexOf(sab) === 0 ? SABOTEUR_POWER_CHANGE : 0, // only first saboteur reports power change (no stack)
      });
    }
  }

  return {
    workerEffects,
    influenceChanges,
    factionPowerChanges: factionPowerDeltas,
    affinityChanges: affinityDeltas,
  };
}

/**
 * Backward-compatible wrapper around resolveDemagogeryDetailed.
 */
export function resolveDemagogery(
  placements: Placement[],
  factions: BalancedFaction[],
  playerAffinities: Record<string, Record<string, number>>,
): ResolutionResult {
  const { influenceChanges, factionPowerChanges, affinityChanges } = resolveDemagogeryDetailed(
    placements,
    factions,
    playerAffinities,
  );
  return { influenceChanges, factionPowerChanges, affinityChanges };
}
