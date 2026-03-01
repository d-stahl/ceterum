import { AxisKey } from './axes';
import { BalancedFaction } from './balance';
import { Controversy } from './controversies';

// --- Senate Leader Selection ---

export interface PlayerInfluence {
  playerId: string;
  influence: number;
}

/**
 * Determine Senate Leader from influence rankings.
 * Returns { leaderId } if clear winner, { contenderIds } if tie.
 */
export function determineSenateLeader(
  players: PlayerInfluence[],
): { leaderId: string } | { contenderIds: string[] } {
  if (players.length === 0) throw new Error('No players');
  const sorted = [...players].sort((a, b) => b.influence - a.influence);
  const maxInfluence = sorted[0].influence;
  const contenders = sorted.filter((p) => p.influence === maxInfluence);
  if (contenders.length === 1) {
    return { leaderId: contenders[0].playerId };
  }
  return { contenderIds: contenders.map((p) => p.playerId) };
}

/**
 * Resolve a pledge round: eliminate the contender with least total pledged support.
 * All players pledge their influence (as weight, not spent) to one contender.
 * Contenders can also pledge to each other but not to themselves.
 * Returns the eliminated contender and remaining contenders.
 * Ties: the first contender in the array order with min support is eliminated
 * (caller should pre-sort contenderIds in a consistent/randomized order for tiebreaking).
 */
export function resolvePledgeRound(
  contenderIds: string[],
  pledges: { pledgerId: string; candidateId: string; weight: number }[],
): { eliminatedId: string; remainingIds: string[] } {
  const totals: Record<string, number> = {};
  for (const id of contenderIds) totals[id] = 0;
  for (const p of pledges) {
    if (p.candidateId in totals) {
      totals[p.candidateId] += p.weight;
    }
  }
  // Find contender with least support
  let minSupport = Infinity;
  let minId = contenderIds[0];
  for (const id of contenderIds) {
    if (totals[id] < minSupport) {
      minSupport = totals[id];
      minId = id;
    }
  }
  const remaining = contenderIds.filter((id) => id !== minId);
  return { eliminatedId: minId, remainingIds: remaining };
}

// --- Controversy Pool Assembly ---

/**
 * Assemble the controversy pool for a round.
 * Priority: (1) follow-ups from last round (max 2), (2) leftover from last round, (3) new draws.
 * Always returns exactly 4 keys (or fewer if deck is nearly empty).
 */
export function assembleControversyPool(
  followUpKeys: string[],       // unlocked follow-ups (0-2)
  leftoverKey: string | null,   // 3rd ordered card from last round
  deckKeys: string[],           // remaining undrawn keys in deck order
): string[] {
  const pool: string[] = [];

  // Priority 1: follow-ups (max 2)
  for (const key of followUpKeys.slice(0, 2)) {
    pool.push(key);
  }

  // Priority 2: leftover from previous round
  if (leftoverKey && pool.length < 4) {
    pool.push(leftoverKey);
  }

  // Priority 3: fill with new draws
  let drawIndex = 0;
  while (pool.length < 4 && drawIndex < deckKeys.length) {
    pool.push(deckKeys[drawIndex]);
    drawIndex++;
  }

  return pool;
}

// --- Controversy Resolution ---

export interface Vote {
  playerId: string;
  resolutionKey: string;
  influenceSpent: number;
}

export interface ControversyResult {
  winningResolutionKey: string;
  winningTotal: number;
  resolutionTotals: Record<string, number>;  // resolutionKey -> total influence
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
}

/**
 * Resolve a controversy vote.
 * Senate Leader's declared resolution gets +1 bonus per non-SL player.
 * Ties are broken in favor of SL's declaration.
 */
export function resolveControversyVotes(
  votes: Vote[],
  senateLeaderDeclaration: string,
  senateLeaderId: string,
  totalPlayers: number,
  controversy: Controversy,
): ControversyResult {
  // Tally votes per resolution
  const totals: Record<string, number> = {};
  for (const r of controversy.resolutions) {
    totals[r.key] = 0;
  }
  for (const v of votes) {
    totals[v.resolutionKey] = (totals[v.resolutionKey] || 0) + v.influenceSpent;
  }

  // Apply SL institutional bonus: +1 per non-SL player
  const slBonus = totalPlayers - 1;
  totals[senateLeaderDeclaration] = (totals[senateLeaderDeclaration] || 0) + slBonus;

  // Determine winner (ties go to SL's declaration)
  let winningKey = senateLeaderDeclaration;
  let winningTotal = totals[senateLeaderDeclaration] || 0;
  for (const [key, total] of Object.entries(totals)) {
    if (total > winningTotal) {
      winningKey = key;
      winningTotal = total;
    }
  }

  // Look up the winning resolution's effects
  const winningResolution = controversy.resolutions.find((r) => r.key === winningKey)!;

  return {
    winningResolutionKey: winningKey,
    winningTotal,
    resolutionTotals: totals,
    axisEffects: winningResolution.axisEffects,
    factionPowerEffects: winningResolution.factionPowerEffects,
  };
}

// --- Affinity Malus ---

/**
 * Compute affinity malus for each player based on their vote and faction preferences.
 * For each faction in the game:
 *   For each axis that shifted by the winning resolution:
 *     If the player voted FOR the winning resolution AND:
 *       - The faction is non-neutral (pref != 0) and the axis moved AGAINST the faction's preference → -1 affinity
 *       - The faction is neutral (pref = 0) and the axis moved in any direction → -1 affinity
 * Senate Leader suffers double malus.
 *
 * Returns: playerId -> factionKey -> malus (negative number, or omitted if 0)
 */
export function computeAffinityMalus(
  votes: Vote[],
  winningResolutionKey: string,
  axisEffects: Partial<Record<AxisKey, number>>,
  factions: BalancedFaction[],
  senateLeaderId: string,
): Record<string, Record<string, number>> {
  const malus: Record<string, Record<string, number>> = {};

  // Only voters who voted for the winning resolution are affected
  const winningVoters = votes
    .filter((v) => v.resolutionKey === winningResolutionKey)
    .map((v) => v.playerId);

  for (const playerId of winningVoters) {
    const playerMalus: Record<string, number> = {};
    for (const faction of factions) {
      let upset = false;
      for (const [axisStr, shift] of Object.entries(axisEffects)) {
        const axis = axisStr as AxisKey;
        if (!shift || shift === 0) continue;
        const pref = faction.preferences[axis];

        if (pref === 0) {
          // Neutral faction: any axis movement moves policy away from center
          upset = true;
        } else if ((pref > 0 && shift < 0) || (pref < 0 && shift > 0)) {
          // Faction has a preference and axis moved opposite to it
          upset = true;
        }
        if (upset) break;
      }

      if (upset) {
        let factionMalus = -1;
        // Senate Leader suffers double malus
        if (playerId === senateLeaderId) {
          factionMalus *= 2;
        }
        playerMalus[faction.key] = factionMalus;
      }
    }
    if (Object.keys(playerMalus).length > 0) {
      malus[playerId] = playerMalus;
    }
  }

  return malus;
}

// --- Round End ---

/**
 * Halve unspent influence, rounded in player's favor (ceiling).
 */
export function halveInfluence(current: number): number {
  return Math.ceil(current / 2);
}

/**
 * Decay affinity toward 0 by 1 each round.
 */
export function decayAffinity(current: number): number {
  if (current < 0) return current + 1;
  if (current > 0) return current - 1;
  return 0;
}
