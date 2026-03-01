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
