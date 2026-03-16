/** Centralized color palette for the Ceterum app.
 *
 * Usage:
 *   import { C, goldBg, navyBg } from '../lib/theme';
 *   // solid:       C.gold, C.parchment, C.screenBg
 *   // translucent: goldBg(0.12), navyBg(0.88)
 */

// ---------------------------------------------------------------------------
// Solid colors
// ---------------------------------------------------------------------------

export const C = {
  // Text / accent golds
  gold: '#c9a84c',
  parchment: '#e0c097',
  paleGold: '#e8d5a3',
  warmGold: '#c4a882',
  accentGold: '#DAA520',
  darkText: '#1a1209',

  // Backgrounds
  screenBg: '#1a1a2e',

  // Status
  positive: '#4caf50',
  negative: '#e53935',
  error: '#ff6b6b',

  // Axis movement
  axisPositive: 'rgba(76,175,80,0.6)',
  axisNegative: 'rgba(229,57,53,0.6)',

  // Tooltip line items
  positiveGreen: '#6ec87a',
  negativeRed: '#e07070',

  // SL bonus
  slBonus: '#B8963E',

  // Neutrals
  gray: '#888888',
  black: '#000000',
  white: '#ffffff',

  // Affinity indicator
  emeraldGreen: '#2E8B57',
} as const;

// ---------------------------------------------------------------------------
// Parametric rgba helpers — use for opacity variants of base colors
// ---------------------------------------------------------------------------

export function goldBg(opacity: number): string {
  return `rgba(201,168,76,${opacity})`;
}

export function parchmentBg(opacity: number): string {
  return `rgba(224,192,151,${opacity})`;
}

export function navyBg(opacity: number): string {
  return `rgba(26,26,46,${opacity})`;
}

export function brownBg(opacity: number): string {
  return `rgba(20,14,5,${opacity})`;
}

export function darkBrownBg(opacity: number): string {
  return `rgba(12,8,2,${opacity})`;
}

export function darkNavyBg(opacity: number): string {
  return `rgba(20,20,36,${opacity})`;
}

export function accentGoldBg(opacity: number): string {
  return `rgba(218,165,32,${opacity})`;
}

export function negativeBg(opacity: number): string {
  return `rgba(229,57,53,${opacity})`;
}

export function whiteBg(opacity: number): string {
  return `rgba(255,255,255,${opacity})`;
}

export function blackBg(opacity: number): string {
  return `rgba(0,0,0,${opacity})`;
}

// ---------------------------------------------------------------------------
// Category colors (legacy, kept for reference)
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<string, string> = {
  military: '#e53935',
  social: '#7cb342',
  economic: '#ffa726',
  political: '#5c6bc0',
  religious: '#ab47bc',
};

// Controversy type colors
// ---------------------------------------------------------------------------

export const CONTROVERSY_TYPE_COLORS: Record<string, string> = {
  vote: '#5c6bc0',
  clash: '#e53935',
  endeavour: '#ffa726',
  schism: '#ab47bc',
};

export const CONTROVERSY_TYPE_LABELS: Record<string, string> = {
  vote: 'Vote',
  clash: 'Clash',
  endeavour: 'Endeavour',
  schism: 'Schism',
};
