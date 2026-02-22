import { CONTROVERSIES, CONTROVERSY_MAP, ROOT_CONTROVERSY_KEYS } from '../controversies';
import { AXIS_KEYS } from '../axes';
import { FACTIONS } from '../factions';

describe('Controversy definitions', () => {
  it('has exactly 20 root controversies', () => {
    expect(CONTROVERSIES).toHaveLength(20);
  });

  it('all keys are unique', () => {
    const keys = CONTROVERSIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('each controversy has exactly 3 resolutions', () => {
    for (const c of CONTROVERSIES) {
      expect(c.resolutions).toHaveLength(3);
    }
  });

  it('resolution keys are unique within each controversy', () => {
    for (const c of CONTROVERSIES) {
      const keys = c.resolutions.map((r) => r.key);
      expect(new Set(keys).size).toBe(3);
    }
  });

  it('axis effects only reference valid axis keys', () => {
    const validAxes = new Set(AXIS_KEYS);
    for (const c of CONTROVERSIES) {
      for (const r of c.resolutions) {
        for (const key of Object.keys(r.axisEffects)) {
          expect(validAxes.has(key as any)).toBe(true);
        }
      }
    }
  });

  it('faction power effects only reference valid faction keys', () => {
    const validFactions = new Set(FACTIONS.map((f) => f.key));
    for (const c of CONTROVERSIES) {
      for (const r of c.resolutions) {
        for (const key of Object.keys(r.factionPowerEffects)) {
          expect(validFactions.has(key)).toBe(true);
        }
      }
    }
  });

  it('CONTROVERSY_MAP maps all keys', () => {
    expect(Object.keys(CONTROVERSY_MAP)).toHaveLength(20);
    for (const c of CONTROVERSIES) {
      expect(CONTROVERSY_MAP[c.key]).toBe(c);
    }
  });

  it('every category is valid', () => {
    const validCategories = ['military', 'social', 'economic', 'political', 'religious'];
    for (const c of CONTROVERSIES) {
      expect(validCategories).toContain(c.category);
    }
  });

  it('ROOT_CONTROVERSY_KEYS matches CONTROVERSIES order', () => {
    expect(ROOT_CONTROVERSY_KEYS).toHaveLength(20);
    CONTROVERSIES.forEach((c, i) => {
      expect(ROOT_CONTROVERSY_KEYS[i]).toBe(c.key);
    });
  });

  it('all controversies have non-empty flavor text', () => {
    for (const c of CONTROVERSIES) {
      expect(c.flavor.length).toBeGreaterThan(0);
    }
  });

  it('all resolutions have non-empty descriptions', () => {
    for (const c of CONTROVERSIES) {
      for (const r of c.resolutions) {
        expect(r.description.length).toBeGreaterThan(0);
      }
    }
  });
});
