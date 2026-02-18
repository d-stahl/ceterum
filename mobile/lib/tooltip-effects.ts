import { Placement, WorkerType, OratorRole } from './game-engine/workers';
import { BalancedFaction } from './game-engine/balance';
import { resolveDemagogeryDetailed, WorkerEffect } from './game-engine/demagogery';

/**
 * Compute tooltip effects for all current placements (including preliminary).
 */
export function computeTooltipEffects(
  placements: Placement[],
  factions: BalancedFaction[],
  playerAffinities: Record<string, Record<string, number>>,
): WorkerEffect[] {
  const { workerEffects } = resolveDemagogeryDetailed(placements, factions, playerAffinities);
  return workerEffects;
}

/**
 * Find the effect for a specific worker placement.
 */
export function getEffectForWorker(
  effects: WorkerEffect[],
  playerId: string,
  factionKey: string,
  workerType: WorkerType,
  oratorRole?: OratorRole,
): WorkerEffect | null {
  return effects.find(
    (e) =>
      e.playerId === playerId &&
      e.factionKey === factionKey &&
      e.workerType === workerType &&
      e.oratorRole === oratorRole,
  ) ?? null;
}
