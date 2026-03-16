import { resolveSchism, schismTeamSize } from '../schism.ts';
import type { SchismConfig } from '../controversies.ts';

const config: SchismConfig = {
  sides: [
    {
      key: 'support_pirates',
      title: 'Negotiate with the pirates',
      description: 'Seek terms with the pirate captains',
      axisEffects: { commerce: 1, militarism: -1 },
      factionPowerEffects: { nautae: 1 },
      victoryPoints: 2,
    },
    {
      key: 'crush_pirates',
      title: 'Crush the pirates',
      description: 'Send the fleet to destroy them',
      axisEffects: { militarism: 1, commerce: -1 },
      factionPowerEffects: { milites: 1 },
      victoryPoints: 3,
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

describe('resolveSchism', () => {
  it('succeeds when all team members support', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: true },
      ],
      config,
      'support_pirates',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(false);
    expect(result.winningSideKey).toBe('support_pirates');
    expect(result.axisEffects).toEqual({ commerce: 1, militarism: -1 });
    expect(result.victoryPoints).toBe(2);
    expect(result.supporters).toEqual(['alice', 'bob']);
    expect(result.saboteurs).toEqual([]);
  });

  it('flips to other side when any member sabotages', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: false },
      ],
      config,
      'support_pirates',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(true);
    expect(result.winningSideKey).toBe('crush_pirates');
    expect(result.axisEffects).toEqual({ militarism: 1, commerce: -1 });
    expect(result.victoryPoints).toBe(3);
    expect(result.supporters).toEqual(['alice']);
    expect(result.saboteurs).toEqual(['bob']);
  });

  it('flips even with multiple saboteurs', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: false },
        { playerId: 'bob', supports: false },
        { playerId: 'carol', supports: true },
      ],
      config,
      'support_pirates',
      ['alice', 'bob', 'carol'],
    );

    expect(result.wasSabotaged).toBe(true);
    expect(result.winningSideKey).toBe('crush_pirates');
    expect(result.saboteurs).toEqual(['alice', 'bob']);
    expect(result.supporters).toEqual(['carol']);
  });

  it('works when SL declares side B', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
        { playerId: 'bob', supports: true },
      ],
      config,
      'crush_pirates',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(false);
    expect(result.winningSideKey).toBe('crush_pirates');
    expect(result.slDeclaredSideKey).toBe('crush_pirates');
    expect(result.axisEffects).toEqual({ militarism: 1, commerce: -1 });
    expect(result.factionPowerEffects).toEqual({ milites: 1 });
  });

  it('sabotage on side B flips to side A', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: false },
        { playerId: 'bob', supports: true },
      ],
      config,
      'crush_pirates',
      ['alice', 'bob'],
    );

    expect(result.wasSabotaged).toBe(true);
    expect(result.winningSideKey).toBe('support_pirates');
    expect(result.axisEffects).toEqual({ commerce: 1, militarism: -1 });
  });

  it('preserves team member ids', () => {
    const result = resolveSchism(
      [
        { playerId: 'alice', supports: true },
      ],
      config,
      'support_pirates',
      ['alice', 'bob'],
    );

    expect(result.teamMembers).toEqual(['alice', 'bob']);
  });
});
