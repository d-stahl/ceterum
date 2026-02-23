import { resolveDemagogery, resolveDemagogeryDetailed, BASE_INFLUENCE, ALLY_BONUS, AGITATOR_MOD } from '../demagogery';
import { Placement } from '../workers';
import { BalancedFaction } from '../balance';
import { validatePlacement } from '../workers';

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

const noAffinity: Record<string, Record<string, number>> = {};

describe('resolveDemagogery (backward compat)', () => {
  it('single demagog gets base influence', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.influenceChanges['p1']).toBe(BASE_INFLUENCE);
  });

  it('two demagogs at same faction get crowd penalty', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 2 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.influenceChanges['p1']).toBeLessThan(BASE_INFLUENCE);
    expect(result.influenceChanges['p1']).toBe(result.influenceChanges['p2']);
  });

  it('advocate with no demagog gets nothing', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.influenceChanges['p1'] || 0).toBe(0);
  });

  it('promoter increases faction power', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.factionPowerChanges['legiones']).toBe(1);
  });

  it('saboteur decreases faction power', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'saboteur', subRound: 1 },
    ];
    const result = resolveDemagogery(placements, [testFaction], noAffinity);
    expect(result.factionPowerChanges['legiones']).toBe(-1);
  });

  it('agitator reduces demagog payout', () => {
    const withAgitator: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
    ];
    const without: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const resultWith = resolveDemagogery(withAgitator, [testFaction], noAffinity);
    const resultWithout = resolveDemagogery(without, [testFaction], noAffinity);
    expect(resultWith.influenceChanges['p1']).toBeLessThan(resultWithout.influenceChanges['p1']);
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
  });

  it('single demagog has no crowd penalty line item', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.oratorRole).toBe('demagog');
    expect(effect.lineItems.find(li => li.label.includes('Crowd'))).toBeUndefined();
    expect(effect.lineItems.find(li => li.label === 'Base influence')).toBeDefined();
    expect(effect.totalInfluence).toBe(BASE_INFLUENCE);
  });

  it('crowd penalty line item appears with multiple demagogs', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 2 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    const crowdItem = effect.lineItems.find(li => li.label.includes('Crowd'));
    expect(crowdItem).toBeDefined();
    expect(crowdItem!.displayValue).toContain('%');
  });

  it('advocate boost line item appears when advocates present', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 2 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const demagogEffect = result.workerEffects.find(e => e.oratorRole === 'demagog')!;
    expect(demagogEffect.lineItems.find(li => li.label === 'Advocate present')).toBeDefined();
    expect(demagogEffect.totalInfluence).toBe(BASE_INFLUENCE + ALLY_BONUS);
  });

  it('agitator penalty line item appears when agitators present', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 2 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const demagogEffect = result.workerEffects.find(e => e.oratorRole === 'demagog')!;
    expect(demagogEffect.lineItems.find(li => li.label === 'Agitator present')).toBeDefined();
    // power=3 → no bonus; single demagog → no crowd; agitator → ×0.5; base=4 → ceil(4×0.5)=2
    expect(demagogEffect.totalInfluence).toBe(Math.ceil(BASE_INFLUENCE * AGITATOR_MOD));
  });

  it('wasted advocate shows "No demagog" line item', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.lineItems).toHaveLength(1);
    expect(effect.lineItems[0].label).toBe('No demagog — wasted');
    expect(effect.totalInfluence).toBe(0);
  });

  it('wasted agitator shows "No demagog" line item', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.lineItems[0].label).toBe('No demagog — wasted');
    expect(effect.totalInfluence).toBe(0);
  });

  it('promoter has single power line item', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'promoter', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.workerType).toBe('promoter');
    expect(effect.lineItems).toHaveLength(1);
    expect(effect.lineItems[0].label).toBe('Power +1');
    expect(effect.totalPowerChange).toBe(1);
    expect(effect.totalInfluence).toBe(0);
  });

  it('saboteur has single power line item', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'saboteur', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [testFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.workerType).toBe('saboteur');
    expect(effect.lineItems[0].label).toContain('Power');
    expect(effect.totalPowerChange).toBe(-1);
  });

  it('affinity modifies demagog payout', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const withAffinity = { p1: { legiones: 3 } };
    const result = resolveDemagogeryDetailed(placements, [testFaction], withAffinity);
    const effect = result.workerEffects[0];
    const affinityItem = effect.lineItems.find(li => li.label.includes('Affinity') || li.label.includes('sympathy') || li.label.includes('Sympathy'));
    expect(affinityItem).toBeDefined();
    expect(effect.totalInfluence).toBeGreaterThan(BASE_INFLUENCE);
  });

  it('power modifier line appears for non-3 power factions', () => {
    const weakFaction: BalancedFaction = { ...testFaction, power: 1 };
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
    ];
    const result = resolveDemagogeryDetailed(placements, [weakFaction], noAffinity);
    const effect = result.workerEffects[0];
    expect(effect.lineItems.find(li => li.label === 'Very weak faction')).toBeDefined();
    // base(4) + power(-2) = 2; ceil(2) = 2
    expect(effect.totalInfluence).toBe(2);
  });

  it('example calculation: power4 + advocate + agitator => 5', () => {
    const strongFaction: BalancedFaction = { ...testFaction, power: 4 };
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'demagog', subRound: 1 },
      { playerId: 'p2', factionKey: 'legiones', workerType: 'orator', oratorRole: 'advocate', subRound: 2 },
      { playerId: 'p3', factionKey: 'legiones', workerType: 'orator', oratorRole: 'agitator', subRound: 3 },
    ];
    const result = resolveDemagogeryDetailed(placements, [strongFaction], noAffinity);
    const demagogEffect = result.workerEffects.find(e => e.oratorRole === 'demagog')!;
    // 4 base + 1 power + 4 advocate = 9; × 0.5 agitator = 4.5; ceil = 5
    expect(demagogEffect.totalInfluence).toBe(5);
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
});
