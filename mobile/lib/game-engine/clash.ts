import { AxisKey } from './axes.ts';
import { ClashConfig, ClashPersonalEffects } from './controversies.ts';

export interface ClashSubmission {
  playerId: string;
  factionBids: Record<string, number>;  // factionKey -> influence spent
  commits: boolean;
}

export interface FactionAssignment {
  factionKey: string;
  winners: { playerId: string; bidStrength: number; share: number }[];
  totalPower: number;       // base power
  amplifiedPower: number;   // after amplifier
}

export interface PlayerPersonalEffect {
  vpAwarded: number;
  influenceLoss: number;
  affinityDelta: number;              // bonus or penalty applied to won factions
  globalAffinityDelta: number;        // penalty applied to ALL factions (withdraw+success cowardice)
  wonFactions: string[];              // faction keys this player won
  committed: boolean;
}

export interface ClashResult {
  factionAssignments: FactionAssignment[];
  committedPower: number;
  withdrawnPower: number;
  totalAvailablePower: number;
  threshold: number;
  succeeded: boolean;
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  victoryPoints: number;  // 0 on failure
  committers: string[];
  withdrawers: string[];
  personalEffects: Record<string, PlayerPersonalEffect>;
}

/** Compute bid strength: influence × (1 + affinity × 0.10) */
export function bidStrength(influenceSpent: number, affinity: number): number {
  return influenceSpent * (1 + affinity * 0.10);
}

/**
 * Assign factions to players based on bids.
 * Highest bid strength wins. Ties split the faction's power equally.
 * Returns assignments for all factions that received at least one bid.
 */
export function assignFactions(
  submissions: ClashSubmission[],
  factionPowers: Record<string, number>,
  factionAmplifiers: Partial<Record<string, number>>,
  playerAffinities: Record<string, Record<string, number>>,
): FactionAssignment[] {
  const allFactionKeys = Object.keys(factionPowers);
  const assignments: FactionAssignment[] = [];

  for (const factionKey of allFactionKeys) {
    const bids: { playerId: string; strength: number }[] = [];

    for (const sub of submissions) {
      const spent = sub.factionBids[factionKey] ?? 0;
      if (spent <= 0) continue;
      const affinity = playerAffinities[sub.playerId]?.[factionKey] ?? 0;
      bids.push({
        playerId: sub.playerId,
        strength: bidStrength(spent, affinity),
      });
    }

    if (bids.length === 0) {
      // Nobody bid on this faction — it's unassigned
      assignments.push({
        factionKey,
        winners: [],
        totalPower: factionPowers[factionKey],
        amplifiedPower: factionPowers[factionKey] * (factionAmplifiers[factionKey] ?? 1),
      });
      continue;
    }

    // Find max bid strength
    const maxStrength = Math.max(...bids.map((b) => b.strength));
    const winners = bids.filter((b) => b.strength === maxStrength);
    const share = 1 / winners.length;

    assignments.push({
      factionKey,
      winners: winners.map((w) => ({
        playerId: w.playerId,
        bidStrength: w.strength,
        share,
      })),
      totalPower: factionPowers[factionKey],
      amplifiedPower: factionPowers[factionKey] * (factionAmplifiers[factionKey] ?? 1),
    });
  }

  return assignments;
}

/**
 * Resolve a Clash controversy.
 *
 * 1. Assign factions to players based on bids (affinity × influence)
 * 2. Sum committed power (from committers' won factions, with amplifiers)
 * 3. Compare to threshold (% of total available amplified power)
 */
export function resolveClash(
  submissions: ClashSubmission[],
  config: ClashConfig,
  factionPowers: Record<string, number>,
  playerAffinities: Record<string, Record<string, number>>,
): ClashResult {
  const assignments = assignFactions(
    submissions,
    factionPowers,
    config.factionAmplifiers,
    playerAffinities,
  );

  // Total available amplified power (all factions)
  const totalAvailablePower = assignments.reduce((sum, a) => sum + a.amplifiedPower, 0);
  const threshold = totalAvailablePower * config.thresholdPercent;

  // Committed power: sum of amplified power from factions won by committers
  const committerIds = new Set(submissions.filter((s) => s.commits).map((s) => s.playerId));
  let committedPower = 0;

  for (const assignment of assignments) {
    for (const winner of assignment.winners) {
      if (committerIds.has(winner.playerId)) {
        committedPower += assignment.amplifiedPower * winner.share;
      }
    }
  }

  const succeeded = Math.floor(committedPower) >= Math.floor(threshold);

  const committers = submissions.filter((s) => s.commits).map((s) => s.playerId);
  const withdrawers = submissions.filter((s) => !s.commits).map((s) => s.playerId);

  // Withdrawn power: sum of amplified power from factions won by withdrawers
  const withdrawerIds = new Set(withdrawers);
  let withdrawnPower = 0;
  for (const assignment of assignments) {
    for (const winner of assignment.winners) {
      if (withdrawerIds.has(winner.playerId)) {
        withdrawnPower += assignment.amplifiedPower * winner.share;
      }
    }
  }

  const outcome = succeeded ? config.successOutcome : config.failureOutcome;

  // Compute won factions per player
  const wonFactions: Record<string, string[]> = {};
  for (const sub of submissions) wonFactions[sub.playerId] = [];
  for (const assignment of assignments) {
    for (const winner of assignment.winners) {
      if (!wonFactions[winner.playerId]) wonFactions[winner.playerId] = [];
      wonFactions[winner.playerId].push(assignment.factionKey);
    }
  }

  // Compute per-player personal effects
  const pe = config.personalEffects;
  const personalEffects: Record<string, PlayerPersonalEffect> = {};
  for (const sub of submissions) {
    const effect: PlayerPersonalEffect = {
      vpAwarded: 0,
      influenceLoss: 0,
      affinityDelta: 0,
      globalAffinityDelta: 0,
      wonFactions: wonFactions[sub.playerId] ?? [],
      committed: sub.commits,
    };
    if (pe) {
      if (sub.commits && succeeded) {
        effect.vpAwarded = config.successOutcome.victoryPoints;
        effect.affinityDelta = pe.commitSuccess.affinityBonus;
      } else if (sub.commits && !succeeded) {
        effect.influenceLoss = pe.commitFailure.influenceLoss;
        effect.affinityDelta = pe.commitFailure.affinityPenalty;
      } else if (!sub.commits && succeeded) {
        effect.affinityDelta = pe.withdrawSuccess.affinityPenalty;
        effect.globalAffinityDelta = pe.withdrawSuccess.globalAffinityPenalty ?? 0;
      }
      // !commits && !succeeded → no personal effect
    } else {
      // Legacy: no personal effects, VP to all committers on success
      if (sub.commits && succeeded) {
        effect.vpAwarded = config.successOutcome.victoryPoints;
      }
    }
    personalEffects[sub.playerId] = effect;
  }

  return {
    factionAssignments: assignments,
    committedPower: Math.floor(committedPower),
    withdrawnPower: Math.floor(withdrawnPower),
    totalAvailablePower,
    threshold: Math.floor(threshold),
    succeeded,
    axisEffects: outcome.axisEffects,
    factionPowerEffects: outcome.factionPowerEffects,
    victoryPoints: succeeded ? config.successOutcome.victoryPoints : 0,
    committers,
    withdrawers,
    personalEffects,
  };
}
