import { WorkerType, OratorRole } from './game-engine/workers';
import { WorkerEffect } from './game-engine/demagogery';

/**
 * Find the effect for a specific worker placement in a pre-fetched WorkerEffect[].
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
