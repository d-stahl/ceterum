import {
  resolveDemagogery,
  resolveDemagogeryDetailed,
  DEMAGOG_BASE,
  AGITATOR_BASE,
  ADVOCATE_BASE,
  PROMOTER_INFLUENCE,
  SABOTEUR_INFLUENCE,
  PROMOTER_POWER_CHANGE,
  SABOTEUR_POWER_CHANGE,
  PROMOTER_AFFINITY_CHANGE,
  SABOTEUR_AFFINITY_SPLASH,
} from '../demagogery.ts';
import { Placement } from '../workers.ts';
import { BalancedFaction } from '../balance.ts';
import { validatePlacement } from '../workers.ts';

const testFaction: BalancedFaction = {
  key: 'legiones',
  displayName: 'The Veterans',
  latinName: 'Legiones',
  description: 'Test',
  power: 3,
  preferences: {
    centralization: 0, expansion: 0, commerce: 0,
    patrician: 0, tradition: 0, militarism: 0,
  },
};

const testFaction2: BalancedFaction = {
  key: 'mercatores',
  displayName: 'The Merchants',
  latinName: 'Mercatores',
  description: 'Test',
  power: 3,
  preferences: {
    centralization: 0, expansion: 0, commerce: 0,
    patrician: 0, tradition: 0, militarism: 0,
  },
};

const noAffinity: Record<string, Record<string, number>> = {};

describe('resolveDemagogery', () => {
  it('single demagog at P3/aff0 gets DEMAGOG_BASE', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    // 10 × (3+2)/5 × (1+0) = 10 × 1.0 × 1.0 = 10
    expect(result.influenceChanges['p1']).toBe(DEMAGOG_BASE);
  });

  it('two demagogs at same faction get crowd penalty', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 2 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.influenceChanges['p1']).toBeLessThan(DEMAGOG_BASE);
    expect(result.influenceChanges['p1']).toBe(result.influenceChanges['p2']);
  });

  it('advocate without demagogs gets base payout (not zero)', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    // Advocate still gets base payout: 5 × 1.0 × 1.0 = 5
    expect(result.influenceChanges['p1']).toBe(ADVOCATE_BASE);
  });

  it('agitator without demagogs gets base payout only', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    // Agitator base: 5 × 1.0 × 1.0 = 5, no siphon targets
    expect(result.influenceChanges['p1']).toBe(AGITATOR_BASE);
  });

  it('promoter gives fixed influence and +1 power', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.influenceChanges['p1']).toBe(PROMOTER_INFLUENCE);
    expect(result.factionPowerChanges['legiones']).toBe(PROMOTER_POWER_CHANGE);
  });

  it('saboteur gives fixed influence and -2 power', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'saboteur', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.influenceChanges['p1']).toBe(SABOTEUR_INFLUENCE);
    expect(result.factionPowerChanges['legiones']).toBe(SABOTEUR_POWER_CHANGE);
  });

  it('multiple saboteurs do not stack power change', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'saboteur', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'saboteur', subRound: 2 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    // Still -2, not -4
    expect(result.factionPowerChanges['legiones']).toBe(SABOTEUR_POWER_CHANGE);
  });

  it('agitator siphons from demagog', () => {
    const withAgitator: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
    ];
    const without: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const resultWith = resolveDemagogery(withAgitator, [testFaction], noAffinity);
    const resultWithout = resolveDemagogery(without, [testFaction], noAffinity);
    // Demagog gets less when agitator present
    expect(resultWith.influenceChanges['p1']).toBeLessThan(resultWithout.influenceChanges['p1']);
    // Agitator gets more than base (siphoned some)
    expect(resultWith.influenceChanges['p2']).toBeGreaterThan(AGITATOR_BASE);
  });

  it('advocate boosts demagog payout', () => {
    const withAdvocate: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 2 },
    ];
    const without: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const resultWith = resolveDemagogery(withAdvocate, [testFaction], noAffinity);
    const resultWithout = resolveDemagogery(without, [testFaction], noAffinity);
    expect(resultWith.influenceChanges['p1']).toBeGreaterThan(resultWithout.influenceChanges['p1']);
  });

  it('advocate reduces agitator siphon', () => {
    const withAdvocate: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
      { playerId: 'p3', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 3 },
    ];
    const withoutAdvocate: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
    ];
    const resultWith = resolveDemagogery(withAdvocate, [testFaction], noAffinity);
    const resultWithout = resolveDemagogery(withoutAdvocate, [testFaction], noAffinity);
    // Demagog keeps more when advocate present
    expect(resultWith.influenceChanges['p1']).toBeGreaterThan(resultWithout.influenceChanges['p1']);
    // Agitator steals less when advocate present
    expect(resultWith.influenceChanges['p2']).toBeLessThan(resultWithout.influenceChanges['p2']);
  });

  it('high affinity agitator siphons more than low affinity', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
    ];
    const highAff = { p2: { legiones: 4 } };
    const lowAff = { p2: { legiones: -3 } };
    const resultHigh = resolveDemagogery(placements, [testFaction], highAff);
    const resultLow = resolveDemagogery(placements, [testFaction], lowAff);
    expect(resultHigh.influenceChanges['p2']).toBeGreaterThan(resultLow.influenceChanges['p2']);
  });

  it('promoter grants self affinity', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.affinityChanges['p1']?.['legiones']).toBe(PROMOTER_AFFINITY_CHANGE);
  });

  it('saboteur splashes affinity damage to senators', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'saboteur', subRound: 2 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.affinityChanges['p1']?.['legiones']).toBe(SABOTEUR_AFFINITY_SPLASH);
  });

  it('net-delta power: promoter + saboteur at P5 → P4 (not P3)', () => {
    const maxPowerFaction: BalancedFaction = { ...testFaction, power: 5 };
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'saboteur', subRound: 2 },
    ];
    const result = resolveDemagogery(placements, [maxPowerFaction], noAffinity);
    // net delta = +1 + (-2) = -1; clamp(5 + (-1), 1, 5) = 4
    expect(result.factionPowerChanges['legiones']).toBe(-1);
  });

  it('resolution order: power/affinity changes affect influence payouts', () => {
    // Promoter at faction boosts power before demagog payout
    const weakFaction: BalancedFaction = { ...testFaction, power: 1 };
    const withPromoter: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'promoter', subRound: 2 },
    ];
    const withoutPromoter: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const resultWith = resolveDemagogery(withPromoter, [weakFaction], noAffinity);
    const resultWithout = resolveDemagogery(withoutPromoter, [weakFaction], noAffinity);
    // P1 → P2, so powerMult goes from 0.6 to 0.8 → higher demagog payout
    expect(resultWith.influenceChanges['p1']).toBeGreaterThan(resultWithout.influenceChanges['p1']);
  });
});

describe('resolveDemagogeryDetailed', () => {
  it('produces matching summary fields as resolveDemagogery', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 2 },
      { playerId: 'p3', factionKey: 'legiones', workerType: 'promoter', subRound: 3 },
    ];
    const summary = resolveDemagogery(placements, [testFaction], noAffinity);
    const detailed = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    expect(detailed.influenceChanges).toEqual(summary.influenceChanges);
    expect(detailed.factionPowerChanges).toEqual(summary.factionPowerChanges);
    expect(detailed.affinityChanges).toEqual(summary.affinityChanges);
  });

  it('demagog line items include base payout', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.oratorRole).toBe('demagog');
    expect(effect.lineItems.find(li => li.label === 'Base payout')).toBeDefined();
    expect(effect.totalInfluence).toBe(DEMAGOG_BASE);
  });

  it('crowd penalty line item appears with multiple demagogs', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 2 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.lineItems.find(li => li.label.includes('Crowd'))).toBeDefined();
  });

  it('promoter line items show payout, power, and affinity', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.workerType).toBe('promoter');
    expect(effect.lineItems).toHaveLength(3);
    expect(effect.totalInfluence).toBe(PROMOTER_INFLUENCE);
    expect(effect.totalPowerChange).toBe(PROMOTER_POWER_CHANGE);
  });

  it('saboteur line items show payout, power, and splash', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'saboteur', subRound: 2 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const sabEffect = result.workerEffects.find(e => e.workerType === 'saboteur')!;
    expect(sabEffect.lineItems.find(li => li.label.includes('Affinity damage'))).toBeDefined();
    expect(sabEffect.totalInfluence).toBe(SABOTEUR_INFLUENCE);
    expect(sabEffect.totalPowerChange).toBe(SABOTEUR_POWER_CHANGE);
  });

  it('power modifier line appears for non-3 power factions', () => {
    const weakFaction: BalancedFaction = { ...testFaction, power: 1 };
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [weakFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.lineItems.find(li => li.label.includes('Power'))).toBeDefined();
    // 10 × 0.6 = 6
    expect(effect.totalInfluence).toBe(6);
  });

  it('affinity modifies demagog payout', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const withAffinity = { p1: { legiones: 3 } };
    const result = resolveDemagogeryDetailed(placements, [testFaction], withAffinity);
    const effect = result.workerEffects[0];
    expect(effect.lineItems.find(li => li.label.includes('Affinity'))).toBeDefined();
    // 10 × 1.0 × 1.15 = 11.5 → round to 12
    expect(effect.totalInfluence).toBeGreaterThan(DEMAGOG_BASE);
  });
});

describe('validatePlacement', () => {
  it('rejects duplicate sub-round placement', () => {
    const existing: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'mercatores', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      existing,
    );
    expect(result).not.toBeNull();
  });

  it('rejects orator without role', () => {
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', subRound: 1 },
      [],
    );
    expect(result).not.toBeNull();
  });

  it('accepts valid placement', () => {
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      [],
    );
    expect(result).toBeNull();
  });

  it('rejects two orators at same faction', () => {
    const existing: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
      existing,
    );
    expect(result).toContain('senator');
  });

  it('allows orators at different factions', () => {
    const existing: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'mercatores', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
      existing,
    );
    expect(result).toBeNull();
  });

  it('allows orator and promoter at same faction', () => {
    const existing: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 2 },
      existing,
    );
    expect(result).toBeNull();
  });

  it('allows orator and saboteur at same faction', () => {
    const existing: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = validatePlacement(
      { playerId: 'p1', factionKey: 'legiones', workerType: 'saboteur', subRound: 2 },
      existing,
    );
    expect(result).toBeNull();
  });
});
