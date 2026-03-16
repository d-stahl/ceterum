import { AxisKey } from './axes.ts';
import { SchismConfig, SchismSide } from './controversies.ts';

export interface SchismSubmission {
  playerId: string;
  supports: boolean;  // true = support SL's declared side, false = sabotage
}

export interface SchismResult {
  slDeclaredSideKey: string;
  winningSideKey: string;
  winningSide: SchismSide;
  losingSide: SchismSide;
  wasSabotaged: boolean;
  supporters: string[];
  saboteurs: string[];
  teamMembers: string[];
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  victoryPoints: number;
}

/**
 * Compute team size based on player count.
 * 3-4 players → 2, 5-6 → 3, 7-8 → 4
 */
export function schismTeamSize(playerCount: number): number {
  if (playerCount <= 4) return 2;
  if (playerCount <= 6) return 3;
  return 4;
}

/**
 * Resolve a Schism controversy.
 *
 * - SL declares a side and picks a team (including themselves)
 * - Team members secretly support or sabotage
 * - All support → SL's side wins
 * - Any sabotage → other side wins
 * - Winning side's effects apply
 */
export function resolveSchism(
  submissions: SchismSubmission[],
  config: SchismConfig,
  slDeclaredSideKey: string,
  teamMemberIds: string[],
): SchismResult {
  const [sideA, sideB] = config.sides;

  const slSide = sideA.key === slDeclaredSideKey ? sideA : sideB;
  const otherSide = sideA.key === slDeclaredSideKey ? sideB : sideA;

  const supporters = submissions.filter((s) => s.supports).map((s) => s.playerId);
  const saboteurs = submissions.filter((s) => !s.supports).map((s) => s.playerId);

  const wasSabotaged = saboteurs.length > 0;
  const winningSide = wasSabotaged ? otherSide : slSide;
  const losingSide = wasSabotaged ? slSide : otherSide;

  return {
    slDeclaredSideKey,
    winningSideKey: winningSide.key,
    winningSide,
    losingSide,
    wasSabotaged,
    supporters,
    saboteurs,
    teamMembers: teamMemberIds,
    axisEffects: winningSide.axisEffects,
    factionPowerEffects: winningSide.factionPowerEffects,
    victoryPoints: winningSide.victoryPoints,
  };
}
