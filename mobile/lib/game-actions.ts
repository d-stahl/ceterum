import { supabase } from './supabase';
import { WorkerType, OratorRole } from './game-engine/workers';

export async function submitPlacement(
  gameId: string,
  factionId: string,
  workerType: WorkerType,
  oratorRole?: OratorRole,
): Promise<{ status: string; subRound?: number; submitted?: number; total?: number }> {
  const { data, error } = await supabase.rpc('submit_placement', {
    p_game_id: gameId,
    p_faction_id: factionId,
    p_worker_type: workerType,
    p_orator_role: oratorRole ?? null,
  });

  if (error) throw error;
  return data as any;
}

export async function resolveCurrentPhase(gameId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('resolve-demagogery', {
    body: { game_id: gameId },
  });
  if (error) throw error;
}
