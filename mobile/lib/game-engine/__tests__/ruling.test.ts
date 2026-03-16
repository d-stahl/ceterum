import {
  determineSenateLeader,
  resolvePledgeRound,
  assembleControversyPool,
  resolveControversyVotes,
  computeAffinityEffects,
  getFactionStance,
  halveInfluence,
} from '../ruling.ts';
import { Controversy } from '../controversies.ts';

const mockControversy: Controversy = {
  key: 'test',
  title: 'Test',
  type: 'vote',
  category: 'military',
  flavor: 'Test flavor',
  illustration: 'test',
  resolutions: [
    { key: 'a', title: 'A', description: 'A', axisEffects: { militarism: 1 }, factionPowerEffects: { legiones: 1 } },
    { key: 'b', title: 'B', description: 'B', axisEffects: { militarism: -1 }, factionPowerEffects: {} },
    { key: 'c', title: 'C', description: 'C', axisEffects: {}, factionPowerEffects: {} },
  ],
};

describe('determineSenateLeader', () => {
  it('returns single leader when no tie', () => {
    const result = determineSenateLeader([
      { playerId: 'p1', influence: 10 },
      { playerId: 'p2', influence: 5 },
    ]);
    expect(result).toEqual({ leaderId: 'p1' });
  });

  it('returns contenders when two are tied for most', () => {
    const result = determineSenateLeader([
      { playerId: 'p1', influence: 10 },
      { playerId: 'p2', influence: 10 },
      { playerId: 'p3', influence: 5 },
    ]);
    expect(result).toEqual({ contenderIds: ['p1', 'p2'] });
  });

  it('returns all three when all tied', () => {
    const result = determineSenateLeader([
      { playerId: 'p1', influence: 7 },
      { playerId: 'p2', influence: 7 },
      { playerId: 'p3', influence: 7 },
    ]);
    expect(result).toEqual({ contenderIds: ['p1', 'p2', 'p3'] });
  });

  it('throws on empty array', () => {
    expect(() => determineSenateLeader([])).toThrow('No players');
  });
});

describe('resolvePledgeRound', () => {
  it('eliminates contender with least support', () => {
    const result = resolvePledgeRound(['p1', 'p2', 'p3'], [
      { pledgerId: 'p4', candidateId: 'p1', weight: 5 },
      { pledgerId: 'p5', candidateId: 'p2', weight: 3 },
      // p3 gets no pledges
    ]);
    expect(result.eliminatedId).toBe('p3');
    expect(result.remainingIds).toEqual(['p1', 'p2']);
  });

  it('eliminates contender with zero support over others', () => {
    const result = resolvePledgeRound(['p1', 'p2'], [
      { pledgerId: 'p3', candidateId: 'p2', weight: 10 },
    ]);
    expect(result.eliminatedId).toBe('p1');
    expect(result.remainingIds).toEqual(['p2']);
  });

  it('ignores pledges for non-contenders', () => {
    const result = resolvePledgeRound(['p1', 'p2'], [
      { pledgerId: 'p3', candidateId: 'p1', weight: 5 },
      { pledgerId: 'p4', candidateId: 'noncontender', weight: 100 },
    ]);
    // p2 gets 0 support, p1 gets 5
    expect(result.eliminatedId).toBe('p2');
  });
});

describe('assembleControversyPool', () => {
  it('fills pool to exactly 4 from deck when no follow-ups or leftover', () => {
    const pool = assembleControversyPool([], null, ['a', 'b', 'c', 'd', 'e']);
    expect(pool).toHaveLength(4);
    expect(pool).toEqual(['a', 'b', 'c', 'd']);
  });

  it('prioritizes follow-ups then leftover then new draws', () => {
    const pool = assembleControversyPool(['follow1'], 'leftover', ['new1', 'new2', 'new3']);
    expect(pool).toEqual(['follow1', 'leftover', 'new1', 'new2']);
  });

  it('uses at most 2 follow-ups', () => {
    const pool = assembleControversyPool(['f1', 'f2', 'f3'], null, ['new1', 'new2']);
    expect(pool).toEqual(['f1', 'f2', 'new1', 'new2']);
  });

  it('uses leftover only if there is room after follow-ups', () => {
    const pool = assembleControversyPool(['f1', 'f2'], 'leftover', ['new1', 'new2']);
    expect(pool).toEqual(['f1', 'f2', 'leftover', 'new1']);
  });

  it('returns fewer than 4 when deck is nearly empty', () => {
    const pool = assembleControversyPool([], null, ['a', 'b']);
    expect(pool).toHaveLength(2);
    expect(pool).toEqual(['a', 'b']);
  });
});

describe('resolveControversyVotes', () => {
  it('winning resolution gets most influence including SL bonus', () => {
    // SL declares 'a', 3 players total → SL bonus = 2
    // p1 spends 5 on 'a', p2 spends 10 on 'b'
    // a: 5 + 2 = 7, b: 10 → b wins
    const result = resolveControversyVotes(
      [
        { playerId: 'p1', resolutionKey: 'a', influenceSpent: 5 },
        { playerId: 'p2', resolutionKey: 'b', influenceSpent: 10 },
      ],
      'a', 'p1', 3, mockControversy,
    );
    expect(result.winningResolutionKey).toBe('b');
    expect(result.winningTotal).toBe(10);
  });

  it('SL declaration wins ties', () => {
    // 3 players, SL bonus = 2
    // p1 spends 3 on 'a', p2 spends 5 on 'b'
    // a: 3 + 2 = 5, b: 5 → tie, SL declared 'a' → 'a' wins
    const result = resolveControversyVotes(
      [
        { playerId: 'p1', resolutionKey: 'a', influenceSpent: 3 },
        { playerId: 'p2', resolutionKey: 'b', influenceSpent: 5 },
      ],
      'a', 'p1', 3, mockControversy,
    );
    expect(result.winningResolutionKey).toBe('a');
  });

  it('returns correct axis effects for winning resolution', () => {
    // 2 players, SL bonus = 1. p1 spends 10 on 'a', SL declared 'a'
    // a: 10 + 1 = 11 → wins
    const result = resolveControversyVotes(
      [{ playerId: 'p1', resolutionKey: 'a', influenceSpent: 10 }],
      'a', 'p1', 2, mockControversy,
    );
    expect(result.axisEffects).toEqual({ militarism: 1 });
    expect(result.factionPowerEffects).toEqual({ legiones: 1 });
  });

  it('resolution totals include SL bonus on declared resolution', () => {
    const result = resolveControversyVotes(
      [{ playerId: 'p1', resolutionKey: 'a', influenceSpent: 0 }],
      'a', 'p1', 4, mockControversy,
    );
    // SL bonus = (4 - 1) * 2 = 6
    expect(result.resolutionTotals['a']).toBe(6);
    expect(result.resolutionTotals['b']).toBe(0);
  });
});

describe('getFactionStance', () => {
  it('returns opposed when resolution moves axis away from faction preference', () => {
    // Faction wants militarism=2, current=0, resolution shifts -1 (away)
    expect(getFactionStance({ militarism: -1 }, { militarism: 2 }, { militarism: 0 })).toBe('opposed');
  });

  it('returns in_favor when resolution moves axis toward faction preference', () => {
    // Faction wants militarism=2, current=0, resolution shifts +1 (toward)
    expect(getFactionStance({ militarism: 1 }, { militarism: 2 }, { militarism: 0 })).toBe('in_favor');
  });

  it('returns neutral when faction has no preference on affected axis', () => {
    expect(getFactionStance({ militarism: -1 }, { militarism: 0 }, { militarism: 0 })).toBe('neutral');
  });

  it('counts aligned vs opposed across multiple axes', () => {
    // 2 opposed, 1 aligned → opposed
    expect(getFactionStance(
      { militarism: -1, commerce: -1, expansion: 1 },
      { militarism: 2, commerce: 2, expansion: 2 },
      { militarism: 0, commerce: 0, expansion: 0 },
    )).toBe('opposed');
  });

  it('returns neutral when aligned equals opposed', () => {
    expect(getFactionStance(
      { militarism: -1, commerce: 1 },
      { militarism: 2, commerce: 2 },
      { militarism: 0, commerce: 0 },
    )).toBe('neutral');
  });

  it('handles axis already at preference — any movement is away', () => {
    // Faction wants -1, current is -1 → shift +1 moves to 0 (away), shift -1 moves to -2 (also away)
    expect(getFactionStance({ militarism: 1 }, { militarism: -1 }, { militarism: -1 })).toBe('opposed');
    expect(getFactionStance({ militarism: -1 }, { militarism: -1 }, { militarism: -1 })).toBe('opposed');
  });

  it('handles axis beyond preference — moving back toward is aligned', () => {
    // Faction wants 2, current is -2 → shift +1 moves to -1 (closer to 2)
    expect(getFactionStance({ militarism: 1 }, { militarism: 2 }, { militarism: -2 })).toBe('in_favor');
  });
});

describe('computeAffinityEffects', () => {
  const militaristFaction = {
    key: 'legiones', displayName: 'Veterans', latinName: 'Legiones',
    description: '', power: 3,
    preferences: { centralization: 0, expansion: 0, commerce: 0, patrician: 0, tradition: 0, militarism: 2 },
  };

  it('penalizes voters when faction is opposed', () => {
    const effects = computeAffinityEffects(
      [{ playerId: 'p1', resolutionKey: 'b', influenceSpent: 5 }],
      'b',
      { militarism: -1 },
      [militaristFaction],
      { militarism: 0 },
      'p2',
    );
    expect(effects['p1']['legiones']).toBe(-1);
  });

  it('rewards voters when faction is in favor', () => {
    const effects = computeAffinityEffects(
      [{ playerId: 'p1', resolutionKey: 'b', influenceSpent: 5 }],
      'b',
      { militarism: 1 },
      [militaristFaction],
      { militarism: 0 },
      'p2',
    );
    expect(effects['p1']['legiones']).toBe(1);
  });

  it('doubles penalty for Senate Leader but not bonus', () => {
    const effects = computeAffinityEffects(
      [{ playerId: 'p1', resolutionKey: 'b', influenceSpent: 5 }],
      'b',
      { militarism: -1 },
      [militaristFaction],
      { militarism: 0 },
      'p1', // p1 IS Senate Leader
    );
    expect(effects['p1']['legiones']).toBe(-2);

    // But bonus is just +1 for SL
    const bonus = computeAffinityEffects(
      [{ playerId: 'p1', resolutionKey: 'b', influenceSpent: 5 }],
      'b',
      { militarism: 1 },
      [militaristFaction],
      { militarism: 0 },
      'p1',
    );
    expect(bonus['p1']['legiones']).toBe(1);
  });

  it('does not affect voters who voted for losing resolution', () => {
    const effects = computeAffinityEffects(
      [
        { playerId: 'p1', resolutionKey: 'a', influenceSpent: 3 },
        { playerId: 'p2', resolutionKey: 'b', influenceSpent: 5 },
      ],
      'b',
      { militarism: -1 },
      [militaristFaction],
      { militarism: 0 },
      'p3',
    );
    expect(effects['p1']).toBeUndefined();
    expect(effects['p2']['legiones']).toBe(-1);
  });

  it('excludes voters who spent 0 influence', () => {
    const effects = computeAffinityEffects(
      [{ playerId: 'p1', resolutionKey: 'b', influenceSpent: 0 }],
      'b',
      { militarism: -1 },
      [militaristFaction],
      { militarism: 0 },
      'p2',
    );
    expect(effects['p1']).toBeUndefined();
  });
});

describe('halveInfluence', () => {
  it('halves even numbers exactly', () => expect(halveInfluence(10)).toBe(5));
  it('rounds up odd numbers in player favor', () => expect(halveInfluence(7)).toBe(4));
  it('rounds up 1 to 1', () => expect(halveInfluence(1)).toBe(1));
  it('handles zero', () => expect(halveInfluence(0)).toBe(0));
});
