import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolvePledgeRound } from '../_shared/game-engine/ruling.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id, candidate_id, pledge_round } = await req.json();
    if (!game_id || !candidate_id || pledge_round == null) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Submit pledge via anon client (validates membership, deduplication, contender check)
    const { data: submitResult, error: submitError } = await anonClient.rpc('submit_pledge', {
      p_game_id: game_id,
      p_candidate_id: candidate_id,
      p_pledge_round: pledge_round,
    });

    if (submitError) {
      return new Response(JSON.stringify({ error: submitError.message }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If all players have pledged, resolve this pledge round server-side
    if (submitResult?.status === 'ready_for_resolution') {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // Fetch current round to get contenders and round info
      const { data: round, error: roundError } = await adminClient
        .from('game_rounds')
        .select('id, round_number, pledge_contenders')
        .eq('game_id', game_id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();
      if (roundError) throw roundError;

      const contenderIds: string[] = round.pledge_contenders ?? [];

      // Fetch all pledges for this pledge_round
      const { data: pledges, error: pledgesError } = await adminClient
        .from('game_support_pledges')
        .select('pledger_id, candidate_id')
        .eq('round_id', round.id)
        .eq('pledge_round', pledge_round);
      if (pledgesError) throw pledgesError;

      // Fetch player influence (used as pledge weight)
      const { data: playerStates, error: statesError } = await adminClient
        .from('game_player_state')
        .select('player_id, influence')
        .eq('game_id', game_id);
      if (statesError) throw statesError;

      const influenceMap: Record<string, number> = {};
      for (const ps of playerStates ?? []) {
        influenceMap[ps.player_id] = ps.influence;
      }

      // Build pledges array for the game engine
      const enginePledges = (pledges ?? []).map((p: any) => ({
        pledgerId: p.pledger_id,
        candidateId: p.candidate_id,
        weight: influenceMap[p.pledger_id] ?? 0,
      }));

      // Run elimination
      const { eliminatedId, remainingIds } = resolvePledgeRound(contenderIds, enginePledges);

      if (remainingIds.length === 1) {
        // Runoff resolved — set Senate Leader and draw controversy pool
        const { data: finalResult, error: finalError } = await adminClient.rpc('finalize_senate_leader_and_pool', {
          p_game_id: game_id,
          p_round_id: round.id,
          p_leader_id: remainingIds[0],
          p_round_number: round.round_number,
        });
        if (finalError) throw finalError;

        return new Response(JSON.stringify({ status: 'leader_selected', leader_id: remainingIds[0] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Multiple contenders remain — update contenders list for next pledge round
      const { error: updateError } = await adminClient
        .from('game_rounds')
        .update({ pledge_contenders: remainingIds })
        .eq('id', round.id);
      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        status: 'eliminated',
        eliminated_id: eliminatedId,
        remaining_ids: remainingIds,
        next_pledge_round: pledge_round + 1,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Not yet resolved — return submit result as-is
    return new Response(JSON.stringify(submitResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
