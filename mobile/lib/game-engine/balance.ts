import { AXIS_KEYS, AxisKey, AxisPreferences } from './axes.ts';
import { FACTIONS, FactionDefinition } from './factions.ts';

export interface BalancedFaction {
  key: string;
  displayName: string;
  latinName: string;
  description: string;
  power: number;
  preferences: AxisPreferences;
}

/**
 * Curated zero-sum spread profiles per faction count (4–9).
 * Each profile is a sorted array of preference slots that sums to 0.
 * Asymmetric profiles include their mirror (negated) counterpart.
 */
const SPREAD_PROFILES: Record<number, number[][]> = {
  4: [
    [-2, -1, +1, +2],
    [-1, -1, +1, +1],
    [-2, 0, 0, +2],
    [-2, 0, +1, +1],
    [-1, -1, 0, +2],   // mirror of above
  ],
  5: [
    [-2, -1, 0, +1, +2],
    [-1, -1, 0, +1, +1],
    [-2, -1, +1, +1, +1],
    [-1, -1, -1, +1, +2],   // mirror of above
    [-2, -2, +1, +1, +2],
    [-2, -1, -1, +2, +2],   // mirror of above
  ],
  6: [
    [-2, -1, -1, +1, +1, +2],
    [-1, -1, -1, +1, +1, +1],
    [-2, -1, 0, 0, +1, +2],
    [-2, -1, 0, +1, +1, +1],
    [-1, -1, -1, 0, +1, +2],   // mirror of above
    [-2, -2, 0, +1, +1, +2],
    [-2, -1, -1, 0, +2, +2],   // mirror of above
  ],
  7: [
    [-2, -1, -1, 0, +1, +1, +2],
    [-1, -1, -1, 0, +1, +1, +1],
    [-2, -1, 0, 0, 0, +1, +2],
    [-2, -2, -1, 0, +1, +2, +2],
    [-2, -1, -1, +1, +1, +1, +1],
    [-1, -1, -1, -1, +1, +1, +2],   // mirror of above
  ],
  8: [
    [-2, -2, -1, -1, +1, +1, +2, +2],
    [-1, -1, -1, -1, +1, +1, +1, +1],
    [-2, -1, -1, 0, 0, +1, +1, +2],
    [-2, -1, -1, -1, +1, +1, +1, +2],
    [-2, -2, -1, 0, +1, +1, +1, +2],
    [-2, -1, -1, -1, 0, +1, +2, +2],   // mirror of above
  ],
  9: [
    [-2, -2, -1, -1, 0, +1, +1, +2, +2],
    [-1, -1, -1, -1, 0, +1, +1, +1, +1],
    [-2, -1, -1, -1, 0, +1, +1, +1, +2],
    [-2, -1, -1, 0, 0, 0, +1, +1, +2],
    [-2, -2, -2, -1, +1, +1, +1, +2, +2],
    [-2, -2, -1, -1, -1, +1, +2, +2, +2],   // mirror of above
  ],
};

/**
 * Select numPlayers + 1 factions randomly and assign balanced axis preferences
 * using curated spread profiles. For each axis, a random profile is chosen and
 * factions are slotted into it by their default preference ordering.
 */
export function selectAndBalanceFactions(
  numPlayers: number,
  rng: () => number = Math.random
): BalancedFaction[] {
  const count = numPlayers + 1;
  if (count > FACTIONS.length) {
    throw new Error(`Cannot select ${count} factions from pool of ${FACTIONS.length}`);
  }

  // Shuffle and pick
  const shuffled = [...FACTIONS].sort(() => rng() - 0.5);
  const selected = shuffled.slice(0, count);

  // Build result with empty preferences
  const balanced: BalancedFaction[] = selected.map((f) => ({
    key: f.key,
    displayName: f.displayName,
    latinName: f.latinName,
    description: f.description,
    power: f.defaultPower,
    preferences: {} as AxisPreferences,
  }));

  const profiles = SPREAD_PROFILES[count];

  // For each axis, pick a random spread profile and slot factions by default preference order
  for (const axis of AXIS_KEYS) {
    const profile = profiles
      ? profiles[Math.floor(rng() * profiles.length)]
      : generateFallbackProfile(count, rng);

    // Sort faction indices by their default preference for this axis
    const indices = balanced.map((_, i) => i);
    indices.sort((a, b) => selected[a].defaultPreferences[axis] - selected[b].defaultPreferences[axis]);

    // Assign slots in order
    const sortedSlots = [...profile].sort((a, b) => a - b);
    for (let i = 0; i < indices.length; i++) {
      balanced[indices[i]].preferences[axis] = sortedSlots[i] as number;
    }
  }

  return balanced;
}

/**
 * Fallback for faction counts outside the curated profiles.
 * Generates a random zero-sum profile by pairing ±k values.
 */
function generateFallbackProfile(count: number, rng: () => number): number[] {
  const slots: number[] = [];
  let remaining = count;

  while (remaining > 1) {
    const k = rng() < 0.6 ? 2 : 1;
    slots.push(-k, +k);
    remaining -= 2;
  }
  if (remaining === 1) {
    slots.push(0);
  }

  return slots;
}
