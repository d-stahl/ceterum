export type WorkerType = 'orator' | 'promoter' | 'saboteur';
export type OratorRole = 'demagog' | 'advocate' | 'agitator';

export interface Worker {
  type: WorkerType;
}

export interface Placement {
  playerId: string;
  factionKey: string;
  workerType: WorkerType;
  oratorRole?: OratorRole; // only for orator type
  subRound: number;
}

export const WORKER_ROSTER: Worker[] = [
  { type: 'orator' },
  { type: 'orator' },
  { type: 'orator' },
  { type: 'promoter' },
  { type: 'saboteur' },
];

export const PLACEMENTS_PER_ROUND = 3;

/**
 * Validate that a placement is legal given already-submitted placements.
 */
export function validatePlacement(
  placement: Placement,
  existingPlacements: Placement[],
): string | null {
  const playerPlacements = existingPlacements.filter(
    (p) => p.playerId === placement.playerId
  );

  // Check sub-round limit
  const sameSubRound = playerPlacements.filter(
    (p) => p.subRound === placement.subRound
  );
  if (sameSubRound.length >= 1) {
    return 'Already placed a worker this sub-round';
  }

  // Check total placements this round
  if (playerPlacements.length >= PLACEMENTS_PER_ROUND) {
    return 'All workers for this round have been placed';
  }

  // Check worker type availability
  const usedTypes = playerPlacements.map((p) => p.workerType);
  const availableOrators = 3 - usedTypes.filter((t) => t === 'orator').length;
  const availablePromoters = 1 - usedTypes.filter((t) => t === 'promoter').length;
  const availableSaboteurs = 1 - usedTypes.filter((t) => t === 'saboteur').length;

  if (placement.workerType === 'orator' && availableOrators <= 0) {
    return 'No orators remaining';
  }
  if (placement.workerType === 'promoter' && availablePromoters <= 0) {
    return 'Promoter already used';
  }
  if (placement.workerType === 'saboteur' && availableSaboteurs <= 0) {
    return 'Saboteur already used';
  }

  // Orators must have a role
  if (placement.workerType === 'orator' && !placement.oratorRole) {
    return 'Orators must have a role (demagog, advocate, or agitator)';
  }

  // Non-orators must not have a role
  if (placement.workerType !== 'orator' && placement.oratorRole) {
    return 'Only orators can have a role';
  }

  return null; // valid
}
