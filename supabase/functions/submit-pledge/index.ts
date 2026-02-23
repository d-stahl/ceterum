import { createEdgeClients, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import { resolvePledgeRound } from '../_shared/game-engine/ruling.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id, candidate_id, pledge_round } = await req.json();
    if (!game_id || !candidate_id || pledge_round == null) {
      return errorResponse('Missing required fields', 400);
    }

    const { anonClient, adminClient } = await createEdgeClients(req.headers.get('Authorization'));

    // Submit pledge via anon client (validates membership, deduplication, contender check)
    const { data: submitResult, error: submitError } = await anonClient.rpc('submit_pledge', {
      p_game_id: game_id,
      p_candidate_id: candidate_id,
      p_pledge_round: pledge_round,
    });

    if (submitError) return errorResponse(submitError.message, 422);

    if (submitResult?.status !== 'ready_for_resolution') {
      return jsonResponse(submitResult);
    }

    // All players have pledged — resolve this pledge round server-side
    const { data: round, error: roundError } = await adminClient
      .from('game_rounds')
      .select('id, round_number, pledge_contenders')
      .eq('game_id', game_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (roundError) throw roundError;

    const contenderIds: string[] = round.pledge_contenders ?? [];

    const [pledgesRes, statesRes] = await Promise.all([
      adminClient
        .from('game_support_pledges')
        .select('pledger_id, candidate_id')
        .eq('round_id', round.id)
        .eq('pledge_round', pledge_round),
      adminClient
        .from('game_player_state')
        .select('player_id, influence')
        .eq('game_id', game_id),
    ]);
    if (pledgesRes.error) throw pledgesRes.error;
    if (statesRes.error) throw statesRes.error;

    const influenceMap: Record<string, number> = {};
    for (const ps of statesRes.data ?? []) {
      influenceMap[ps.player_id] = ps.influence;
    }

    const enginePledges = (pledgesRes.data ?? []).map((p: any) => ({
      pledgerId: p.pledger_id,
      candidateId: p.candidate_id,
      weight: influenceMap[p.pledger_id] ?? 0,
    }));

    const { eliminatedId, remainingIds } = resolvePledgeRound(contenderIds, enginePledges);

    if (remainingIds.length === 1) {
      const { error: finalError } = await adminClient.rpc('finalize_senate_leader_and_pool', {
        p_game_id: game_id,
        p_round_id: round.id,
        p_leader_id: remainingIds[0],
        p_round_number: round.round_number,
      });
      if (finalError) throw finalError;

      return jsonResponse({ status: 'leader_selected', leader_id: remainingIds[0] });
    }

    // Multiple contenders remain — update list for next pledge round
    const { error: updateError } = await adminClient
      .from('game_rounds')
      .update({ pledge_contenders: remainingIds })
      .eq('id', round.id);
    if (updateError) throw updateError;

    return jsonResponse({
      status: 'eliminated',
      eliminated_id: eliminatedId,
      remaining_ids: remainingIds,
      next_pledge_round: pledge_round + 1,
    });

  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
