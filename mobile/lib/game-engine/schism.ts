import { AxisKey } from './axes.ts';
import { SchismConfig, SchismSide } from './controversies.ts';
import { VP_TO_INFLUENCE_RATE } from './constants.ts';

export interface SchismSubmission {
  playerId: string;
  supports: boolean;  // true = support SL's declared side, false = sabotage
}

export interface SchismReward {
  playerId: string;
  vpAwarded: number;
  influenceAwarded: number;
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
  rewards: SchismReward[];
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
 * Resolve a Schism controversy with prisoner's dilemma payoffs.
 *
 * Payoffs come from the **declared** side's config (the side the SL chose):
 * - All support → each team member gets `supportVP`
 * - Mixed (some support, some sabotage) → saboteurs get `betrayVP`, supporters get 0
 * - All sabotage → each saboteur gets `allBetrayVP`
 *
 * Fractional VP is converted: floor → VP, remainder × VP_TO_INFLUENCE_RATE → influence.
 *
 * Policy effects: all support → declared side's effects; any sabotage → other side's effects.
 */
export function resolveSchism(
  submissions: SchismSubmission[],
  config: SchismConfig,
  slDeclaredSideKey: string,
  teamMemberIds: string[],
): SchismResult {
  const [sideA, sideB] = config.sides;

  const declaredSide = sideA.key === slDeclaredSideKey ? sideA : sideB;
  const otherSide = sideA.key === slDeclaredSideKey ? sideB : sideA;

  const supporters = submissions.filter((s) => s.supports).map((s) => s.playerId);
  const saboteurs = submissions.filter((s) => !s.supports).map((s) => s.playerId);

  const wasSabotaged = saboteurs.length > 0;
  const winningSide = wasSabotaged ? otherSide : declaredSide;
  const losingSide = wasSabotaged ? declaredSide : otherSide;

  // Determine raw VP per player based on PD outcome
  const rewards: SchismReward[] = [];

  if (!wasSabotaged) {
    // All support → everyone gets declaredSide.supportVP
    for (const pid of supporters) {
      const raw = declaredSide.supportVP;
      rewards.push(convertToReward(pid, raw));
    }
  } else if (supporters.length > 0) {
    // Mixed → saboteurs get betrayVP, supporters get betrayedVP (default 0)
    for (const pid of saboteurs) {
      const raw = declaredSide.betrayVP;
      rewards.push(convertToReward(pid, raw));
    }
    const betrayedPenalty = declaredSide.betrayedVP ?? 0;
    if (betrayedPenalty !== 0) {
      for (const pid of supporters) {
        rewards.push(convertToReward(pid, betrayedPenalty));
      }
    }
  } else {
    // All sabotage → everyone gets allBetrayVP
    for (const pid of saboteurs) {
      const raw = declaredSide.allBetrayVP;
      rewards.push(convertToReward(pid, raw));
    }
  }

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
    rewards,
  };
}

// --- Outsider Bets ---

export interface SchismBet {
  playerId: string;
  predictsSupport: boolean;  // true = bets all will support, false = bets sabotage
  stakeInfluence: number;
}

export interface SchismBetResult {
  playerId: string;
  won: boolean;
  stakeInfluence: number;
  vpAwarded: number;
  influenceAwarded: number;
}

/**
 * Resolve outsider bets on a Schism outcome.
 *
 * - Correct prediction: 2× stake, converted to VP + influence remainder
 * - Wrong prediction: lose entire stake
 */
export function resolveSchismBets(
  bets: SchismBet[],
  wasSabotaged: boolean,
): SchismBetResult[] {
  return bets.map((bet) => {
    const correct = bet.predictsSupport ? !wasSabotaged : wasSabotaged;
    if (!correct) {
      return {
        playerId: bet.playerId,
        won: false,
        stakeInfluence: bet.stakeInfluence,
        vpAwarded: 0,
        influenceAwarded: 0,
      };
    }
    const payout = bet.stakeInfluence * 2;
    const rawVP = payout / VP_TO_INFLUENCE_RATE;
    const vpAwarded = Math.floor(rawVP);
    const influenceAwarded = Math.round((rawVP - vpAwarded) * VP_TO_INFLUENCE_RATE);
    return {
      playerId: bet.playerId,
      won: true,
      stakeInfluence: bet.stakeInfluence,
      vpAwarded,
      influenceAwarded,
    };
  });
}

// --- Helpers ---

function convertToReward(playerId: string, rawVP: number): SchismReward {
  const vpAwarded = Math.floor(rawVP);
  const influenceAwarded = Math.round((rawVP - vpAwarded) * VP_TO_INFLUENCE_RATE);
  return { playerId, vpAwarded, influenceAwarded };
}
