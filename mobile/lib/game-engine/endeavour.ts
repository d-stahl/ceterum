import { AxisKey } from './axes.ts';
import { EndeavourConfig } from './controversies.ts';

export { VP_TO_INFLUENCE_RATE } from './constants.ts';
import { VP_TO_INFLUENCE_RATE } from './constants.ts';

export interface EndeavourSubmission {
  playerId: string;
  influenceInvested: number;
}

export interface EndeavourRankReward {
  playerId: string;
  invested: number;
  rank: number;        // 1-based
  rawReward: number;   // unrounded VP equivalent
  vpAwarded: number;
  influenceAwarded: number;
}

export interface EndeavourResult {
  totalInvested: number;
  threshold: number;
  succeeded: boolean;
  rankings: EndeavourRankReward[];
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
}

/**
 * Compute rank rewards for an Endeavour.
 *
 * Formula (linear scale from firstPlaceReward down to 0):
 *   step = firstPlaceReward / (totalPlayers - 1)
 *   rank_reward(i) = firstPlaceReward - i * step    (i=0 for 1st)
 *   vp = floor(rank_reward)
 *   influence = round((rank_reward - vp) * VP_TO_INFLUENCE_RATE)
 *
 * Last place (reward = 0) is excluded from the returned list.
 */
export function computeRankRewards(
  rankedPlayerIds: string[],
  rankedInvestments: number[],
  firstPlaceReward: number,
  totalPlayers: number,
): EndeavourRankReward[] {
  const n = rankedPlayerIds.length;
  if (n === 0 || totalPlayers <= 1) return [];

  const step = firstPlaceReward / (totalPlayers - 1);

  const rewards: EndeavourRankReward[] = [];
  for (let i = 0; i < n; i++) {
    const rawReward = Math.max(0, firstPlaceReward - i * step);
    if (rawReward <= 0) break;
    const vpAwarded = Math.floor(rawReward);
    const influenceAwarded = Math.round((rawReward - vpAwarded) * VP_TO_INFLUENCE_RATE);
    rewards.push({
      playerId: rankedPlayerIds[i],
      invested: rankedInvestments[i],
      rank: i + 1,
      rawReward,
      vpAwarded,
      influenceAwarded,
    });
  }
  return rewards;
}

/**
 * Resolve an Endeavour controversy.
 *
 * - Threshold = totalInitialInfluence × difficultyPercent
 * - Players who invested > 0 are ranked by investment (descending)
 * - Ties share the higher rank (both get same reward)
 * - On success: rank rewards distributed, success effects apply
 * - On failure: invested influence is lost, failure effects apply, no rewards
 */
export function resolveEndeavour(
  submissions: EndeavourSubmission[],
  config: EndeavourConfig,
  totalInitialInfluence: number,
  totalPlayers: number,
): EndeavourResult {
  const threshold = Math.round(totalInitialInfluence * config.difficultyPercent);
  const totalInvested = submissions.reduce((sum, s) => sum + s.influenceInvested, 0);
  const succeeded = totalInvested >= threshold;

  // Filter to investors only, sort descending by investment
  const investors = submissions
    .filter((s) => s.influenceInvested > 0)
    .sort((a, b) => b.influenceInvested - a.influenceInvested);

  // Handle ties: players with equal investment share the same rank reward
  const rankings: EndeavourRankReward[] = [];
  if (succeeded && investors.length > 0 && totalPlayers > 1) {
    const step = config.firstPlaceReward / (totalPlayers - 1);
    let rankIndex = 0;

    for (let i = 0; i < investors.length; i++) {
      // If this player invested the same as the previous, share the rank
      if (i > 0 && investors[i].influenceInvested === investors[i - 1].influenceInvested) {
        // Same rank as previous
      } else {
        rankIndex = i;
      }

      const rawReward = Math.max(0, config.firstPlaceReward - rankIndex * step);
      if (rawReward <= 0) break;
      const vpAwarded = Math.floor(rawReward);
      const influenceAwarded = Math.round((rawReward - vpAwarded) * VP_TO_INFLUENCE_RATE);

      rankings.push({
        playerId: investors[i].playerId,
        invested: investors[i].influenceInvested,
        rank: rankIndex + 1,
        rawReward,
        vpAwarded,
        influenceAwarded,
      });
    }
  }

  const outcome = succeeded ? config.successOutcome : config.failureOutcome;

  return {
    totalInvested,
    threshold,
    succeeded,
    rankings,
    axisEffects: outcome.axisEffects,
    factionPowerEffects: outcome.factionPowerEffects,
  };
}
