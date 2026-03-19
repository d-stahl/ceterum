import { supabase } from './supabase';
import { WorkerType, OratorRole } from './game-engine/workers';
import { WorkerEffect } from './game-engine/demagogery';

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

// --- Endeavour ---

export async function submitEndeavourInvestment(
  gameId: string,
  controversyKey: string,
  influenceInvested: number,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('submit-endeavour', {
    body: {
      game_id: gameId,
      controversy_key: controversyKey,
      influence_invested: influenceInvested,
    },
  });
  if (error) throw error;
  return data;
}

// --- Clash ---

export async function declareControversyOpen(
  gameId: string,
  controversyKey: string,
): Promise<any> {
  const { data, error } = await supabase.rpc('declare_controversy_open', {
    p_game_id: gameId,
    p_controversy_key: controversyKey,
  });
  if (error) throw error;
  return data;
}

export async function submitClashAction(
  gameId: string,
  controversyKey: string,
  factionBids: Record<string, number>,
  commits: boolean,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('submit-clash', {
    body: {
      game_id: gameId,
      controversy_key: controversyKey,
      faction_bids: factionBids,
      commits,
    },
  });
  if (error) throw error;
  return data;
}

// --- Schism ---

export async function declareSchismAction(
  gameId: string,
  controversyKey: string,
  sideKey: string,
  teamMemberIds: string[],
): Promise<any> {
  const { data, error } = await supabase.rpc('declare_schism_action', {
    p_game_id: gameId,
    p_controversy_key: controversyKey,
    p_side_key: sideKey,
    p_team_member_ids: teamMemberIds,
  });
  if (error) throw error;
  return data;
}

export async function submitSchismVote(
  gameId: string,
  controversyKey: string,
  supports: boolean,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke('submit-schism', {
    body: {
      game_id: gameId,
      controversy_key: controversyKey,
      supports,
    },
  });
  if (error) throw error;
  return data;
}

export async function submitSchismBet(
  gameId: string,
  controversyKey: string,
  predictsSupport: boolean,
  stakeInfluence: number,
): Promise<any> {
  const { data, error } = await supabase.rpc('submit_schism_bet', {
    p_game_id: gameId,
    p_controversy_key: controversyKey,
    p_predicts_support: predictsSupport,
    p_stake_influence: stakeInfluence,
  });
  if (error) throw error;
  return data;
}

export async function advanceRound(gameId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('advance-round', {
    body: { game_id: gameId },
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

export type PreliminaryPlacementRequest = {
  factionKey: string;
  workerType: WorkerType;
  oratorRole?: OratorRole;
};

export async function fetchPreviewEffects(
  gameId: string,
  preliminaryPlacement?: PreliminaryPlacementRequest,
): Promise<WorkerEffect[]> {
  const { data, error } = await supabase.functions.invoke('preview-effects', {
    body: {
      game_id: gameId,
      preliminary_placement: preliminaryPlacement ?? null,
    },
  });
  if (error) throw error;
  return (data as { workerEffects: WorkerEffect[] }).workerEffects;
}
