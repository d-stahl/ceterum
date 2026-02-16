import { AXIS_KEYS, AxisKey, AxisPreferences } from './axes';
import { FACTIONS, FactionDefinition } from './factions';

export interface BalancedFaction {
  key: string;
  displayName: string;
  latinName: string;
  description: string;
  power: number;
  preferences: AxisPreferences;
}

/**
 * Select numPlayers + 1 factions randomly and balance their axis preferences
 * so each axis nets to 0 across the selected factions.
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

  // Clone preferences for nudging
  const balanced: BalancedFaction[] = selected.map((f) => ({
    key: f.key,
    displayName: f.displayName,
    latinName: f.latinName,
    description: f.description,
    power: f.defaultPower,
    preferences: { ...f.defaultPreferences },
  }));

  // Balance each axis to net 0
  for (const axis of AXIS_KEYS) {
    balanceAxis(balanced, axis);
  }

  return balanced;
}

/**
 * Nudge faction preferences on a single axis until the net is 0.
 * Each nudge moves a faction's preference by 1 toward 0 (or away from 0
 * if the axis is skewed the other way). Nudges are applied to the most
 * extreme factions first to minimize identity distortion.
 */
function balanceAxis(factions: BalancedFaction[], axis: AxisKey): void {
  let net = factions.reduce((sum, f) => sum + f.preferences[axis], 0);

  // Iteratively nudge until balanced
  let maxIterations = 100; // safety valve
  while (net !== 0 && maxIterations-- > 0) {
    if (net > 0) {
      // Need to reduce: find faction with highest positive preference
      const target = factions
        .filter((f) => f.preferences[axis] > 0)
        .sort((a, b) => b.preferences[axis] - a.preferences[axis])[0];
      if (!target) break; // can't reduce further
      target.preferences[axis] -= 1;
      net -= 1;
    } else {
      // Need to increase: find faction with lowest negative preference
      const target = factions
        .filter((f) => f.preferences[axis] < 0)
        .sort((a, b) => a.preferences[axis] - b.preferences[axis])[0];
      if (!target) break; // can't increase further
      target.preferences[axis] += 1;
      net += 1;
    }
  }
}
