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
