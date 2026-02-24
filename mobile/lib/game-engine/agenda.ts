import { AXIS_KEYS, AxisKey } from './axes';

export type PlayerAgenda = Record<AxisKey, number>; // -2 to +2 per axis

const MIN_VAL = -2;
const MAX_VAL = 2;

/**
 * Generate balanced, distributed agendas for all players.
 * For each axis:
 *   1. Randomize each player's position (-2 to +2)
 *   2. Balance: adjust random players until sum == 0
 *   3. De-clump: break up positions with > floor(n/2) players
 *      by moving pairs in opposite directions (preserves sum)
 */
export function generateAgendas(playerIds: string[]): Record<string, PlayerAgenda> {
  const n = playerIds.length;
  const result: Record<string, Partial<Record<AxisKey, number>>> = {};
  for (const pid of playerIds) {
    result[pid] = {};
  }

  for (const axis of AXIS_KEYS) {
    // Step 1: Randomize
    const positions: number[] = playerIds.map(() =>
      MIN_VAL + Math.floor(Math.random() * (MAX_VAL - MIN_VAL + 1))
    );

    // Step 2: Balance — adjust until sum == 0
    balance(positions, n);

    // Step 3: De-clump
    declump(positions, n);

    // Assign
    for (let i = 0; i < n; i++) {
      result[playerIds[i]][axis] = positions[i];
    }
  }

  return result as Record<string, PlayerAgenda>;
}

function balance(positions: number[], n: number): void {
  const MAX_ITER = n * 20;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const sum = positions.reduce((a, b) => a + b, 0);
    if (sum === 0) break;

    // Find players who can move in the needed direction
    const direction = sum > 0 ? -1 : 1;
    const moveable = positions
      .map((val, idx) => ({ val, idx }))
      .filter(({ val }) =>
        direction > 0 ? val < MAX_VAL : val > MIN_VAL
      );

    if (moveable.length === 0) break; // shouldn't happen

    const pick = moveable[Math.floor(Math.random() * moveable.length)];
    positions[pick.idx] += direction;
  }
}

function declump(positions: number[], n: number): void {
  const maxPerPosition = Math.floor(n / 2);
  const MAX_ITER = n * 20;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Find the most crowded position exceeding the threshold
    const counts = new Map<number, number[]>(); // value → indices
    for (let i = 0; i < n; i++) {
      const val = positions[i];
      if (!counts.has(val)) counts.set(val, []);
      counts.get(val)!.push(i);
    }

    let clumpVal: number | null = null;
    let clumpIndices: number[] = [];
    for (const [val, indices] of counts) {
      if (indices.length > maxPerPosition && indices.length > clumpIndices.length) {
        clumpVal = val;
        clumpIndices = indices;
      }
    }

    if (clumpVal === null) break; // no clumps

    // Pick one player from the clump
    const aIdx = clumpIndices[Math.floor(Math.random() * clumpIndices.length)];
    // Pick one other random player (could be in or out of clump)
    const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== aIdx);
    const bIdx = others[Math.floor(Math.random() * others.length)];

    // Try to move them away from each other (toward extremes)
    if (tryMovePair(positions, aIdx, bIdx, 'apart')) continue;
    // Try to move them toward each other
    if (tryMovePair(positions, aIdx, bIdx, 'together')) continue;
    // Can't move this pair — try another iteration (different random picks)
  }
}

function tryMovePair(
  positions: number[],
  aIdx: number,
  bIdx: number,
  direction: 'apart' | 'together',
): boolean {
  const a = positions[aIdx];
  const b = positions[bIdx];

  let aDelta: number;
  let bDelta: number;

  if (direction === 'apart') {
    // Move A toward its nearest extreme, B toward its nearest extreme
    // If they're at the same position, A goes down, B goes up
    if (a <= b) {
      aDelta = -1;
      bDelta = 1;
    } else {
      aDelta = 1;
      bDelta = -1;
    }
  } else {
    // Move toward each other
    if (a < b) {
      aDelta = 1;
      bDelta = -1;
    } else if (a > b) {
      aDelta = -1;
      bDelta = 1;
    } else {
      // Same position — pick arbitrary directions
      aDelta = -1;
      bDelta = 1;
    }
  }

  const newA = a + aDelta;
  const newB = b + bDelta;

  if (newA < MIN_VAL || newA > MAX_VAL || newB < MIN_VAL || newB > MAX_VAL) {
    return false;
  }

  positions[aIdx] = newA;
  positions[bIdx] = newB;
  return true;
}
