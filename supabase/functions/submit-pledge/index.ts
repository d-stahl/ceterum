import { createEdgeClients, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import { resolvePledgeRound, resolveLeaderElection } from '../_shared/game-engine/ruling.ts';

console.log('[submit-pledge] Function loaded successfully');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[submit-pledge] Request body:', JSON.stringify(body));
    const { game_id, candidate_id, pledge_round } = body;
    if (!game_id || !candidate_id || pledge_round == null) {
      return errorResponse('Missing required fields', 400);
    }

    const { anonClient, adminClient } = await createEdgeClients(req.headers.get('Authorization'));

    // Determine current phase to route correctly
    const { data: currentRound, error: phaseError } = await adminClient
      .from('game_rounds')
      .select('id, round_number, phase, pledge_contenders')
      .eq('game_id', game_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (phaseError) {
      console.error('[submit-pledge] Phase fetch error:', phaseError);
      throw phaseError;
    }
    console.log('[submit-pledge] Current phase:', currentRound.phase);

    // --- Leader Election path ---
    if (currentRound.phase === 'leader_election') {
      console.log('[submit-pledge] Entering leader_election path');
      const { data: submitResult, error: submitError } = await anonClient.rpc('submit_leader_vote', {
        p_game_id: game_id,
        p_candidate_id: candidate_id,
      });
      console.log('[submit-pledge] submit_leader_vote result:', JSON.stringify(submitResult), 'error:', JSON.stringify(submitError));
      if (submitError) return errorResponse(submitError.message, 422);

      if (submitResult?.status !== 'ready_for_resolution') {
        return jsonResponse(submitResult);
      }

      // All players voted — resolve election server-side
      const [pledgesRes, statesRes] = await Promise.all([
        adminClient
          .from('game_support_pledges')
          .select('pledger_id, candidate_id')
          .eq('round_id', currentRound.id)
          .eq('pledge_round', 1),
        adminClient
          .from('game_player_state')
          .select('player_id, influence')
          .eq('game_id', game_id),
      ]);
      if (pledgesRes.error) throw pledgesRes.error;
      if (statesRes.error) throw statesRes.error;

      const influenceMap: Record<string, number> = {};
      const allPlayerIds: string[] = [];
      for (const ps of statesRes.data ?? []) {
        influenceMap[ps.player_id] = ps.influence;
        allPlayerIds.push(ps.player_id);
      }

      const engineVotes = (pledgesRes.data ?? []).map((p: any) => ({
        pledgerId: p.pledger_id,
        candidateId: p.candidate_id,
        weight: influenceMap[p.pledger_id] ?? 0,
      }));

      const { leaderId } = resolveLeaderElection(allPlayerIds, engineVotes, influenceMap);

      const { error: finalError } = await adminClient.rpc('finalize_senate_leader_and_pool', {
        p_game_id: game_id,
        p_round_id: currentRound.id,
        p_leader_id: leaderId,
        p_round_number: currentRound.round_number,
      });
      if (finalError) throw finalError;

      return jsonResponse({ status: 'leader_selected', leader_id: leaderId });
    }

    // --- Legacy ruling_selection pledge path ---
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
    const contenderIds: string[] = currentRound.pledge_contenders ?? [];

    const [pledgesRes, statesRes] = await Promise.all([
      adminClient
        .from('game_support_pledges')
        .select('pledger_id, candidate_id')
        .eq('round_id', currentRound.id)
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
        p_round_id: currentRound.id,
        p_leader_id: remainingIds[0],
        p_round_number: currentRound.round_number,
      });
      if (finalError) throw finalError;

      return jsonResponse({ status: 'leader_selected', leader_id: remainingIds[0] });
    }

    // Multiple contenders remain — update list for next pledge round
    const { error: updateError } = await adminClient
      .from('game_rounds')
      .update({ pledge_contenders: remainingIds })
      .eq('id', currentRound.id);
    if (updateError) throw updateError;

    return jsonResponse({
      status: 'eliminated',
      eliminated_id: eliminatedId,
      remaining_ids: remainingIds,
      next_pledge_round: pledge_round + 1,
    });

  } catch (err) {
    console.error('[submit-pledge] Caught error:', err);
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
