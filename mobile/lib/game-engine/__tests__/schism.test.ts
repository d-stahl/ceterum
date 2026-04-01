import { resolveSchism, resolveSchismBets, schismTeamSize } from '../schism.ts';
import type { SchismConfig } from '../controversies.ts';

const config: SchismConfig = {
  sides: [
    {
      key: 'side_a',
      title: 'Side A',
      description: 'First option',
      axisEffects: { commerce: 1, militarism: -1 },
      factionPowerEffects: { nautae: 1 },
      supportVP: 20,
      betrayVP: 10,
      allBetrayVP: 5,
    },
    {
      key: 'side_b',
      title: 'Side B',
      description: 'Second option',
      axisEffects: { militarism: 1, commerce: -1 },
      factionPowerEffects: { milites: 1 },
      supportVP: 30,
      betrayVP: 20,
      allBetrayVP: 10,
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
    // All support → each gets side_a.supportVP = 20
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 20 },
      { playerId: 'bob', vpAwarded: 20 },
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
    // Mixed → bob (saboteur) gets side_a.betrayVP = 10, alice gets 0
    expect(result.rewards).toEqual([
      { playerId: 'bob', vpAwarded: 10 },
    ]);
  });

  it('all sabotage: each saboteur gets allBetrayVP', () => {
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
    // All betray → each gets side_a.allBetrayVP = 5
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 5 },
      { playerId: 'bob', vpAwarded: 5 },
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
    // All support → side_b.supportVP = 30
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 30 },
      { playerId: 'bob', vpAwarded: 30 },
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
    // Mixed → alice (saboteur) gets side_b.betrayVP = 20
    expect(result.rewards).toEqual([
      { playerId: 'alice', vpAwarded: 20 },
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
          supportVP: 25,
          betrayVP: 15,
          allBetrayVP: 5,
          betrayedVP: -10,
        },
        {
          key: 'high_b',
          title: 'High B',
          description: 'High stakes side B',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { milites: 1 },
          supportVP: 25,
          betrayVP: 15,
          allBetrayVP: 5,
          betrayedVP: -10,
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
    // bob (saboteur) gets 15 VP, alice (betrayed) loses 10 VP
    expect(result.rewards).toEqual([
      { playerId: 'bob', vpAwarded: 15 },
      { playerId: 'alice', vpAwarded: -10 },
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
  it('correct bet on support: 1 VP per influence staked', () => {
    const results = resolveSchismBets(
      [{ playerId: 'charlie', predictsSupport: true, stakeInfluence: 20 }],
      false, // wasSabotaged = false → support succeeded
    );

    expect(results).toEqual([
      { playerId: 'charlie', won: true, stakeInfluence: 20, vpAwarded: 20 },
    ]);
  });

  it('correct bet on sabotage: 1 VP per influence staked', () => {
    const results = resolveSchismBets(
      [{ playerId: 'charlie', predictsSupport: false, stakeInfluence: 12 }],
      true, // wasSabotaged = true → sabotage happened
    );

    expect(results).toEqual([
      { playerId: 'charlie', won: true, stakeInfluence: 12, vpAwarded: 12 },
    ]);
  });

  it('wrong bet: lose entire stake, no reward', () => {
    const results = resolveSchismBets(
      [{ playerId: 'charlie', predictsSupport: true, stakeInfluence: 15 }],
      true, // wasSabotaged = true → support failed
    );

    expect(results).toEqual([
      { playerId: 'charlie', won: false, stakeInfluence: 15, vpAwarded: 0 },
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

    // charlie: correct → 10 VP. dave: wrong → loses 5.
    expect(results).toEqual([
      { playerId: 'charlie', won: true, stakeInfluence: 10, vpAwarded: 10 },
      { playerId: 'dave', won: false, stakeInfluence: 5, vpAwarded: 0 },
    ]);
  });
});
