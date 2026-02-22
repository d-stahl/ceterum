import { supabase } from './supabase';
import { WorkerType, OratorRole } from './game-engine/workers';

export async function submitPlacement(
  gameId: string,
  factionId: string,
  workerType: WorkerType,
  oratorRole?: OratorRole,
): Promise<{ status: string; subRound?: number; submitted?: number; total?: number }> {
  const { data, error } = await supabase.functions.invoke('submit-placement', {
    body: {
      game_id: gameId,
      faction_id: factionId,
      worker_type: workerType,
      orator_role: oratorRole ?? null,
    },
  });
  if (error) throw error;
  return data as any;
}
