import { resolveEndeavour, computeRankRewards, VP_TO_INFLUENCE_RATE } from '../endeavour.ts';
import type { EndeavourConfig, ControversyOutcome } from '../controversies.ts';

const successOutcome: ControversyOutcome = {
  axisEffects: { commerce: 1 },
  factionPowerEffects: { mercatores: 1, nautae: 1 },
};

const failureOutcome: ControversyOutcome = {
  axisEffects: { commerce: -1 },
  factionPowerEffects: { mercatores: -1, nautae: -1 },
};

const config: EndeavourConfig = {
  difficultyPercent: 0.50,
  firstPlaceReward: 2.5,
  successOutcome,
  failureOutcome,
};

describe('resolveEndeavour', () => {
  it('succeeds when total investment meets threshold', () => {
    const result = resolveEndeavour(
      [
        { playerId: 'a', influenceInvested: 10 },
        { playerId: 'b', influenceInvested: 8 },
        { playerId: 'c', influenceInvested: 5 },
      ],
      config,
      40, // threshold = 40 * 0.50 = 20, total = 23
      3,
    );

    expect(result.succeeded).toBe(true);
    expect(result.threshold).toBe(20);
    expect(result.totalInvested).toBe(23);
    expect(result.axisEffects).toEqual({ commerce: 1 });
    expect(result.factionPowerEffects).toEqual({ mercatores: 1, nautae: 1 });
  });

  it('fails when total investment is below threshold', () => {
    const result = resolveEndeavour(
      [
        { playerId: 'a', influenceInvested: 5 },
        { playerId: 'b', influenceInvested: 3 },
        { playerId: 'c', influenceInvested: 0 },
      ],
      config,
      40, // threshold = 20, total = 8
      3,
    );

    expect(result.succeeded).toBe(false);
    expect(result.rankings).toEqual([]);
    expect(result.axisEffects).toEqual({ commerce: -1 });
  });

  it('ranks investors by investment descending', () => {
    const result = resolveEndeavour(
      [
        { playerId: 'c', influenceInvested: 5 },
        { playerId: 'a', influenceInvested: 10 },
        { playerId: 'b', influenceInvested: 8 },
      ],
      config,
      10, // threshold = 5, easily met
      3,
    );

    expect(result.succeeded).toBe(true);
    // 3 players, step = 2.5 / 2 = 1.25
    // rank 1: 2.5, rank 2: 1.25, rank 3: 0 (excluded)
    expect(result.rankings[0].playerId).toBe('a');
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[1].playerId).toBe('b');
    expect(result.rankings[1].rank).toBe(2);
    expect(result.rankings.length).toBe(2); // 3rd gets 0, excluded
  });

  it('excludes zero-investors from rankings', () => {
    const result = resolveEndeavour(
      [
        { playerId: 'a', influenceInvested: 10 },
        { playerId: 'b', influenceInvested: 0 },
        { playerId: 'c', influenceInvested: 5 },
      ],
      config,
      10,
      3,
    );

    expect(result.succeeded).toBe(true);
    // Only 2 investors, but totalPlayers=3, step = 2.5/2 = 1.25
    // rank 1: 2.5, rank 2: 1.25
    expect(result.rankings.length).toBe(2);
    expect(result.rankings.find((r) => r.playerId === 'b')).toBeUndefined();
  });

  it('gives tied investors the same rank and reward', () => {
    const result = resolveEndeavour(
      [
        { playerId: 'a', influenceInvested: 10 },
        { playerId: 'b', influenceInvested: 10 },
        { playerId: 'c', influenceInvested: 5 },
      ],
      config,
      10,
      3,
    );

    expect(result.succeeded).toBe(true);
    const rankA = result.rankings.find((r) => r.playerId === 'a')!;
    const rankB = result.rankings.find((r) => r.playerId === 'b')!;
    expect(rankA.rank).toBe(1);
    expect(rankB.rank).toBe(1);
    expect(rankA.vpAwarded).toBe(rankB.vpAwarded);
    expect(rankA.influenceAwarded).toBe(rankB.influenceAwarded);
  });
});

describe('computeRankRewards', () => {
  it('distributes rewards with linear decay to zero', () => {
    // 3 players, firstPlaceReward = 2.5
    // step = 2.5 / (3-1) = 1.25
    // rank 1: 2.5 → 2 VP + round(0.5 * 20) = 10 influence
    // rank 2: 1.25 → 1 VP + round(0.25 * 20) = 5 influence
    // rank 3: 0 → excluded
    const rewards = computeRankRewards(['a', 'b', 'c'], [10, 8, 5], 2.5, 3);

    expect(rewards.length).toBe(2);
    expect(rewards[0].vpAwarded).toBe(2);
    expect(rewards[0].influenceAwarded).toBe(10);
    expect(rewards[1].vpAwarded).toBe(1);
    expect(rewards[1].influenceAwarded).toBe(5);
  });

  it('returns empty array for no investors', () => {
    expect(computeRankRewards([], [], 2.5, 3)).toEqual([]);
  });

  it('handles single investor in 2-player game', () => {
    // 2 players, step = 2.5 / 1 = 2.5
    // rank 1: 2.5 → 2 VP + 10 influence
    const rewards = computeRankRewards(['a'], [10], 2.5, 2);
    expect(rewards.length).toBe(1);
    expect(rewards[0].vpAwarded).toBe(2);
    expect(rewards[0].influenceAwarded).toBe(10);
  });

  it('last place gets zero and is excluded', () => {
    // 4 players, step = 2.5 / 3 ≈ 0.833
    // rank 1: 2.5, rank 2: 1.667, rank 3: 0.833, rank 4: 0 (excluded)
    const rewards = computeRankRewards(
      ['a', 'b', 'c', 'd'],
      [10, 9, 8, 7],
      2.5,
      4,
    );
    expect(rewards.length).toBe(3);
    expect(rewards[2].vpAwarded).toBe(0);
    expect(rewards[2].influenceAwarded).toBeGreaterThan(0);
  });

  it('works with 5 players', () => {
    // 5 players, step = 2.5 / 4 = 0.625
    // rank 1: 2.5, rank 2: 1.875, rank 3: 1.25, rank 4: 0.625, rank 5: 0 (excluded)
    const rewards = computeRankRewards(
      ['a', 'b', 'c', 'd', 'e'],
      [10, 9, 8, 7, 6],
      2.5,
      5,
    );
    expect(rewards.length).toBe(4);
    expect(rewards[0].rawReward).toBe(2.5);
    expect(rewards[3].rawReward).toBe(0.625);
  });
});
