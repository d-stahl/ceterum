import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tracks the last screen a player viewed per game/round,
 * so reopening the app resumes where they left off instead of
 * replaying all catch-up screens.
 */

export type CheckpointScreen =
  | 'overview'
  | 'results'
  | 'election'
  | 'controversy'
  | 'round_summary';

type Checkpoint = {
  roundId: string;
  screen: CheckpointScreen;
  controversiesSeen: string[]; // keys of dismissed controversies
};

function key(gameId: string) {
  return `game-checkpoint:${gameId}`;
}

export async function loadCheckpoint(gameId: string): Promise<Checkpoint | null> {
  const raw = await AsyncStorage.getItem(key(gameId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Migrate from old number-based format
    if (typeof parsed.controversiesSeen === 'number') {
      parsed.controversiesSeen = [];
    }
    return parsed as Checkpoint;
  } catch {
    return null;
  }
}

export async function saveCheckpoint(
  gameId: string,
  roundId: string,
  screen: CheckpointScreen,
  controversiesSeen: string[] = [],
): Promise<void> {
  const data: Checkpoint = { roundId, screen, controversiesSeen };
  await AsyncStorage.setItem(key(gameId), JSON.stringify(data));
}

export async function clearCheckpoint(gameId: string): Promise<void> {
  await AsyncStorage.removeItem(key(gameId));
}
