import { selectAndBalanceFactions } from '../balance';
import { AXIS_KEYS } from '../axes';

// Deterministic RNG for tests
function seededRng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('selectAndBalanceFactions', () => {
  it('selects numPlayers + 1 factions', () => {
    const factions = selectAndBalanceFactions(4, seededRng(42));
    expect(factions).toHaveLength(5);
  });

  it('balances every axis to net 0', () => {
    // Run with multiple seeds to test robustness
    for (let seed = 1; seed <= 20; seed++) {
      const factions = selectAndBalanceFactions(4, seededRng(seed));
      for (const axis of AXIS_KEYS) {
        const net = factions.reduce((sum, f) => sum + f.preferences[axis], 0);
        expect(net).toBe(0);
      }
    }
  });

  it('balances for different player counts', () => {
    for (let players = 3; players <= 8; players++) {
      const factions = selectAndBalanceFactions(players, seededRng(99));
      expect(factions).toHaveLength(players + 1);
      for (const axis of AXIS_KEYS) {
        const net = factions.reduce((sum, f) => sum + f.preferences[axis], 0);
        expect(net).toBe(0);
      }
    }
  });

  it('throws if requesting too many factions', () => {
    expect(() => selectAndBalanceFactions(10, seededRng(1))).toThrow();
  });

  it('preserves faction identity (no preference changes larger than needed)', () => {
    const factions = selectAndBalanceFactions(4, seededRng(42));
    // Each preference should still be in range [-2, 2]
    for (const f of factions) {
      for (const axis of AXIS_KEYS) {
        expect(f.preferences[axis]).toBeGreaterThanOrEqual(-2);
        expect(f.preferences[axis]).toBeLessThanOrEqual(2);
      }
    }
  });
});
