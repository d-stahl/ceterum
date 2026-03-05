export const AXIS_KEYS = [
  'centralization',
  'expansion',
  'commerce',
  'patrician',
  'tradition',
  'militarism',
] as const;

export type AxisKey = typeof AXIS_KEYS[number];

export const AXIS_LABELS: Record<AxisKey, { positive: string; negative: string }> = {
  centralization: { positive: 'Centralization', negative: 'Autonomy' },
  expansion: { positive: 'Expansion', negative: 'Isolationism' },
  commerce: { positive: 'Commerce', negative: 'Agrarianism' },
  patrician: { positive: 'Patrician Privilege', negative: 'Citizen Equality' },
  tradition: { positive: 'Tradition', negative: 'Reform' },
  militarism: { positive: 'Militarism', negative: 'Diplomacy' },
};

export type AxisPreferences = Record<AxisKey, number>;

export function createDefaultAxes(): AxisPreferences {
  return Object.fromEntries(AXIS_KEYS.map((k) => [k, 0])) as AxisPreferences;
}

const AXIS_MIN = -2;
const AXIS_MAX = 2;

/**
 * Compute the agenda score for a single axis.
 *
 * 4 points are distributed around the player's agenda position:
 * - Exact match: +2, each adjacent (±1): +1  (normal: 1-2-1)
 * - If an adjacent would fall off the agenda range (-2 to +2), its +1
 *   is absorbed into the center position (extreme: 3-1 or 1-3).
 *
 * Policy position (game axis, -5 to +5) is compared against the
 * agenda position (-2 to +2). Returns 0 if policy is more than 1 away.
 */
export function computeAxisScore(policyPosition: number, agendaPosition: number): number {
  const dist = Math.abs(policyPosition - agendaPosition);
  if (dist > 1) return 0;

  if (dist === 0) {
    // Exact match: base +2, plus +1 for each neighbor that falls outside agenda range
    let score = 2;
    if (agendaPosition - 1 < AXIS_MIN) score += 1;
    if (agendaPosition + 1 > AXIS_MAX) score += 1;
    return score;
  }

  // Adjacent: +1
  return 1;
}
