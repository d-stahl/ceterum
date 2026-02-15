export const PLAYER_COLORS = [
  { id: 'ivory',   label: 'Ivory',   hex: '#FFFFF0' },
  { id: 'slate',   label: 'Slate',   hex: '#5A6474' },
  { id: 'crimson', label: 'Crimson', hex: '#DC143C' },
  { id: 'cobalt',  label: 'Cobalt',  hex: '#0047AB' },
  { id: 'emerald', label: 'Emerald', hex: '#2E8B57' },
  { id: 'purple',  label: 'Purple',  hex: '#7B2D8E' },
  { id: 'gold',    label: 'Gold',    hex: '#DAA520' },
  { id: 'burnt_orange', label: 'Burnt Orange', hex: '#C65A1E' },
  { id: 'rose',    label: 'Rose',    hex: '#E8909C' },
  { id: 'teal',    label: 'Teal',    hex: '#2E8B8B' },
] as const;

export type PlayerColorId = typeof PLAYER_COLORS[number]['id'];

export function getColorHex(id: string): string {
  return PLAYER_COLORS.find(c => c.id === id)?.hex ?? '#FFFFF0';
}

export function getColorLabel(id: string): string {
  return PLAYER_COLORS.find(c => c.id === id)?.label ?? 'Unknown';
}
