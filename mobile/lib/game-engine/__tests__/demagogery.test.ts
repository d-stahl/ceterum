import { resolveDemagogery, BASE_INFLUENCE } from '../demagogery';
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

describe('resolveDemagogery', () => {
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

  it('ally with no demagog gets nothing', () => {
    const placements: Placement[] = [
      { playerId: 'p1', factionKey: 'legiones', workerType: 'orator', oratorRole: 'ally', subRound: 1 },
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
