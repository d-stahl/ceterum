import { supabase } from './supabase';
import { WorkerType, OratorRole } from './game-engine/workers';

export async function submitLeaderVote(
  gameId: string,
  candidateId: string,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('submit-pledge', {
    body: { game_id: gameId, candidate_id: candidateId, pledge_round: 1 },
  });
  if (error) throw error;
  return data;
}

export async function submitPledge(
  gameId: string,
  candidateId: string,
  pledgeRound: number,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('submit-pledge', {
    body: { game_id: gameId, candidate_id: candidateId, pledge_round: pledgeRound },
  });
  if (error) throw error;
  return data;
}

export async function declareResolution(
  gameId: string,
  controversyKey: string,
  resolutionKey: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('declare_resolution', {
    p_game_id: gameId,
    p_controversy_key: controversyKey,
    p_resolution_key: resolutionKey,
  });
  if (error) throw error;
  return data;
}

export async function submitControversyVote(
  gameId: string,
  controversyKey: string,
  resolutionKey: string,
  influenceSpent: number,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('submit-controversy-vote', {
    body: {
      game_id: gameId,
      controversy_key: controversyKey,
      resolution_key: resolutionKey,
      influence_spent: influenceSpent,
    },
  });
  if (error) throw error;
  return data;
}

export async function submitSenateLeaderActions(
  gameId: string,
  discardedKey: string,
  orderedKeys: string[],
): Promise<any> {
  const { data, error } = await supabase.rpc('submit_senate_leader_actions', {
    p_game_id: gameId,
    p_discarded_key: discardedKey,
    p_ordered_keys: orderedKeys,
  });
  if (error) throw error;
  return data;
}

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
