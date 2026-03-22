import { resolveSchism, resolveSchismBets, schismTeamSize } from '../schism.ts';
import { VP_TO_INFLUENCE_RATE } from '../constants.ts';
import type { SchismConfig } from '../controversies.ts';

const config: SchismConfig = {
  sides: [
    {
      key: 'side_a',
      title: 'Side A',
      description: 'First option',
      axisEffects: { commerce: 1, militarism: -1 },
      factionPowerEffects: { nautae: 1 },
      supportVP: 2,
      betrayVP: 1,
      allBetrayVP: 0.5,
    },
    {
      key: 'side_b',
      title: 'Side B',
      description: 'Second option',
      axisEffects: { militarism: 1, commerce: -1 },
      factionPowerEffects: { milites: 1 },
      supportVP: 3,
      betrayVP: 2,
      allBetrayVP: 1,
    },
  ],
};

describe('schismTeamSize', () => {
  it('returns 2 for 3-4 players', () => {
    expect(schismTeamSize(3)).toBe(2);
    expect(schismTeamSize(4)).toBe(2);
  });

  it('returns 3 for 5-6 players', () => {
    expect(schismTeamSize(5)).toBe(3);
    expect(schismTeamSize(6)).toBe(3);
  });

  it('returns 4 for 7-8 players', () => {
    expect(schismTeamSize(7)).toBe(4);
    expect(schismTeamSize(8)).toBe(4);
  });
});

describe('resolveSchism — PD payoffs', () => {
  it('all support: each team member gets supportVP from declared side', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: true },
      ],
      config,
      'side_a',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(false);
    expect(result.winningSideKey).toBe('side_a');
    expect(result.axisEffects).toEqual({ commerce: 1, militarism: -1 });
    // All support → each gets side_a.supportVP = 2
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 2, influenceAwarded: 0 },
      { playerId: 'bob', vpAwarded: 2, influenceAwarded: 0 },
    ]);
  });

  it('mixed: saboteurs get betrayVP, supporters get 0', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: false },
      ],
      config,
      'side_a',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(true);
    expect(result.winningSideKey).toBe('side_b');
    // Mixed → bob (saboteur) gets side_a.betrayVP = 1, alice gets 0
    expect(result.rewards).toEqual([
      { playerId: 'bob', vpAwarded: 1, influenceAwarded: 0 },
    ]);
  });

  it('all sabotage: each saboteur gets allBetrayVP with fractional conversion', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: false },
        { playerId: 'bob', supports: false },
      ],
      config,
      'side_a',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(true);
    expect(result.winningSideKey).toBe('side_b');
    // All betray → each gets side_a.allBetrayVP = 0.5 → 0 VP + 10 influence
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 0, influenceAwarded: 10 },
      { playerId: 'bob', vpAwarded: 0, influenceAwarded: 10 },
    ]);
  });

  it('uses declared side payoffs (side B declared)', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: true },
      ],
      config,
      'side_b',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(false);
    expect(result.winningSideKey).toBe('side_b');
    // All support → side_b.supportVP = 3
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 3, influenceAwarded: 0 },
      { playerId: 'bob', vpAwarded: 3, influenceAwarded: 0 },
    ]);
  });

  it('mixed with side B declared: saboteurs get side_b.betrayVP', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: false },
        { playerId: 'bob', supports: true },
      ],
      config,
      'side_b',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(true);
    expect(result.winningSideKey).toBe('side_a');
    // Mixed → alice (saboteur) gets side_b.betrayVP = 2
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 2, influenceAwarded: 0 },
    ]);
  });

  it('mixed with betrayedVP: supporters lose VP', () => {
    const configWithPenalty: SchismConfig = {
      sides: [
        {
          key: 'high_a',
          title: 'High A',
          description: 'High stakes side A',
          axisEffects: { commerce: 1 },
          factionPowerEffects: { nautae: 1 },
          supportVP: 2.5,
          betrayVP: 1.5,
          allBetrayVP: 0.5,
          betrayedVP: -1,
        },
        {
          key: 'high_b',
          title: 'High B',
          description: 'High stakes side B',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { milites: 1 },
          supportVP: 2.5,
          betrayVP: 1.5,
          allBetrayVP: 0.5,
          betrayedVP: -1,
        },
      ],
    };

    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: false },
      ],
      configWithPenalty,
      'high_a',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(true);
    // bob (saboteur) gets 1.5 VP, alice (betrayed) loses 1 VP
    expect(result.rewards).toEqual([
      { playerId: 'bob', vpAwarded: 1, influenceAwarded: 10 },
      { playerId: 'alice', vpAwarded: -1, influenceAwarded: 0 },
    ]);
  });

  it('preserves team member ids and supporter/saboteur lists', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: false },
        { playerId: 'carol', supports: true },
      ],
      config,
      'side_a',
      ['alice', 'bob', 'carol'],
    );

    expect(result.teamMembers).toEqual(['alice', 'bob', 'carol']);
    expect(result.supporters).toEqual(['alice', 'carol']);
    expect(result.saboteurs).toEqual(['bob']);
  });
});

describe('resolveSchismBets', () => {
  it('correct bet on support: 2× stake converted to VP + influence', () => {
    const results = resolveSchismBets(
      [{ playerId: 'charlie', predictsSupport: true, stakeInfluence: 20 }],
      false, // wasSabotaged = false → support succeeded
    );

    // 20 stake × 2 = 40 payout. 40/20 = 2 VP, 0 influence remainder
    expect(results).toEqual([
      { playerId: 'charlie', won: true, stakeInfluence: 20, vpAwarded: 2, influenceAwarded: 0 },
    ]);
  });

  it('correct bet on sabotage: 2× stake converted to VP + influence', () => {
    const results = resolveSchismBets(
      [{ playerId: 'charlie', predictsSupport: false, stakeInfluence: 12 }],
      true, // wasSabotaged = true → sabotage happened
    );

    // 12 × 2 = 24. 24/20 = 1.2 → 1 VP + round(0.2×20) = 4 influence
    expect(results).toEqual([
      { playerId: 'charlie', won: true, stakeInfluence: 12, vpAwarded: 1, influenceAwarded: 4 },
    ]);
  });

  it('wrong bet: lose entire stake, no reward', () => {
    const results = resolveSchismBets(
      [{ playerId: 'charlie', predictsSupport: true, stakeInfluence: 15 }],
      true, // wasSabotaged = true → support failed
    );

    expect(results).toEqual([
      { playerId: 'charlie', won: false, stakeInfluence: 15, vpAwarded: 0, influenceAwarded: 0 },
    ]);
  });

  it('empty bets: returns empty array', () => {
    expect(resolveSchismBets([], false)).toEqual([]);
  });

  it('multiple bets: each resolved independently', () => {
    const results = resolveSchismBets(
      [
        { playerId: 'charlie', predictsSupport: false, stakeInfluence: 10 },
        { playerId: 'dave', predictsSupport: true, stakeInfluence: 5 },
      ],
      true, // sabotage happened
    );

    // charlie: correct. 10×2=20 → 1 VP + 0 inf
    // dave: wrong. loses 5.
    expect(results).toEqual([
      { playerId: 'charlie', won: true, stakeInfluence: 10, vpAwarded: 1, influenceAwarded: 0 },
      { playerId: 'dave', won: false, stakeInfluence: 5, vpAwarded: 0, influenceAwarded: 0 },
    ]);
  });
});
