import { resolveEndeavour, computeRankRewards } from '../endeavour.ts';
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
  firstPlaceReward: 25,
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
    // 3 players, step = 25 / 2 = 12.5
    // rank 1: 25, rank 2: 12.5 → round to 13, rank 3: 0 (excluded)
    expect(result.rankings[0].playerId).toBe('a');
    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[0].vpAwarded).toBe(25);
    expect(result.rankings[1].playerId).toBe('b');
    expect(result.rankings[1].rank).toBe(2);
    expect(result.rankings[1].vpAwarded).toBe(13);
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
  });
});

describe('computeRankRewards', () => {
  it('distributes rewards with linear decay to zero', () => {
    // 3 players, firstPlaceReward = 25
    // step = 25 / 2 = 12.5
    // rank 1: 25 VP, rank 2: round(12.5) = 13 VP, rank 3: 0 (excluded)
    const rewards = computeRankRewards(['a', 'b', 'c'], [10, 8, 5], 25, 3);

    expect(rewards.length).toBe(2);
    expect(rewards[0].vpAwarded).toBe(25);
    expect(rewards[1].vpAwarded).toBe(13);
  });

  it('returns empty array for no investors', () => {
    expect(computeRankRewards([], [], 25, 3)).toEqual([]);
  });

  it('handles single investor in 2-player game', () => {
    // 2 players, step = 25 / 1 = 25
    // rank 1: 25 VP
    const rewards = computeRankRewards(['a'], [10], 25, 2);
    expect(rewards.length).toBe(1);
    expect(rewards[0].vpAwarded).toBe(25);
  });

  it('last place gets zero and is excluded', () => {
    // 4 players, step = 25 / 3 ≈ 8.33
    // rank 1: 25, rank 2: round(16.67)=17, rank 3: round(8.33)=8, rank 4: 0 (excluded)
    const rewards = computeRankRewards(
      ['a', 'b', 'c', 'd'],
      [10, 9, 8, 7],
      25,
      4,
    );
    expect(rewards.length).toBe(3);
    expect(rewards[2].vpAwarded).toBe(8);
  });

  it('works with 5 players', () => {
    // 5 players, step = 25 / 4 = 6.25
    // rank 1: 25, rank 2: 18.75, rank 3: 12.5, rank 4: 6.25, rank 5: 0 (excluded)
    const rewards = computeRankRewards(
      ['a', 'b', 'c', 'd', 'e'],
      [10, 9, 8, 7, 6],
      25,
      5,
    );
    expect(rewards.length).toBe(4);
    expect(rewards[0].rawReward).toBe(25);
    expect(rewards[3].rawReward).toBe(6.25);
    expect(rewards[3].vpAwarded).toBe(6);
  });
});
