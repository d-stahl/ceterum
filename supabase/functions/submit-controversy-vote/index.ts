import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveControversyVotes, computeAffinityMalus } from '../_shared/game-engine/ruling.ts';
import type { Vote } from '../_shared/game-engine/ruling.ts';
import type { BalancedFaction } from '../_shared/game-engine/balance.ts';
import type { AxisKey } from '../_shared/game-engine/axes.ts';
import type { Controversy } from '../_shared/game-engine/controversies.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id, controversy_key, resolution_key, influence_spent } = await req.json();
    if (!game_id || !controversy_key || !resolution_key || influence_spent == null) {
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

    // Submit vote via anon client (validates membership, influence, SL constraint)
    const { data: submitResult, error: submitError } = await anonClient.rpc('submit_controversy_vote', {
      p_game_id: game_id,
      p_controversy_key: controversy_key,
      p_resolution_key: resolution_key,
      p_influence_spent: influence_spent,
    });

    if (submitError) {
      return new Response(JSON.stringify({ error: submitError.message }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Not the last vote — return immediately
    if (submitResult?.status !== 'ready_for_resolution') {
      return new Response(JSON.stringify(submitResult), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Last vote in — resolve server-side
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Fetch current round
    const { data: round, error: roundError } = await adminClient
      .from('game_rounds')
      .select('id, round_number, phase, senate_leader_id')
      .eq('game_id', game_id)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (roundError) throw roundError;

    // Idempotency: skip if already resolved
    const { data: csState, error: csError } = await adminClient
      .from('game_controversy_state')
      .select('status, senate_leader_declaration')
      .eq('round_id', round.id)
      .eq('controversy_key', controversy_key)
      .single();
    if (csError) throw csError;

    if (csState.status === 'resolved') {
      return new Response(JSON.stringify({ status: 'resolved' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch votes, snapshot, factions, player count
    const [votesRes, snapRes, factionsRes, countRes] = await Promise.all([
      adminClient
        .from('game_controversy_votes')
        .select('player_id, resolution_key, influence_spent')
        .eq('round_id', round.id)
        .eq('controversy_key', controversy_key),
      adminClient
        .from('game_controversy_snapshots')
        .select('snapshot')
        .eq('game_id', game_id)
        .eq('controversy_key', controversy_key)
        .single(),
      adminClient
        .from('game_factions')
        .select('id, faction_key, power_level')
        .eq('game_id', game_id),
      adminClient
        .from('game_players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game_id),
    ]);
    if (votesRes.error) throw votesRes.error;
    if (snapRes.error) throw snapRes.error;
    if (factionsRes.error) throw factionsRes.error;

    const controversy = snapRes.data.snapshot as Controversy;
    const factions = factionsRes.data ?? [];
    const totalPlayers = countRes.count ?? 1;

    // Build engine-format factions (we only need power+key for affinity malus;
    // preferences are in the snapshot JSONB — extract them)
    const engineFactions: BalancedFaction[] = factions.map((f: any) => {
      // Preferences aren't in this query — fetch separately for affinity computation
      return {
        key: f.faction_key,
        displayName: f.faction_key,
        latinName: f.faction_key,
        description: '',
        power: f.power_level,
        preferences: { centralization: 0, expansion: 0, commerce: 0, patrician: 0, tradition: 0, militarism: 0 },
      } as BalancedFaction;
    });

    // Fetch full faction preferences for affinity computation
    const { data: fullFactions, error: fullFactionsError } = await adminClient
      .from('game_factions')
      .select('faction_key, power_level, pref_centralization, pref_expansion, pref_commerce, pref_patrician, pref_tradition, pref_militarism')
      .eq('game_id', game_id);
    if (fullFactionsError) throw fullFactionsError;

    const fullEngineFactions: BalancedFaction[] = (fullFactions ?? []).map((f: any) => ({
      key: f.faction_key,
      displayName: f.faction_key,
      latinName: f.faction_key,
      description: '',
      power: f.power_level,
      preferences: {
        centralization: f.pref_centralization,
        expansion: f.pref_expansion,
        commerce: f.pref_commerce,
        patrician: f.pref_patrician,
        tradition: f.pref_tradition,
        militarism: f.pref_militarism,
      },
    }));

    const engineVotes: Vote[] = (votesRes.data ?? []).map((v: any) => ({
      playerId: v.player_id,
      resolutionKey: v.resolution_key,
      influenceSpent: v.influence_spent,
    }));

    // Resolve controversy votes
    const result = resolveControversyVotes(
      engineVotes,
      csState.senate_leader_declaration!,
      round.senate_leader_id,
      totalPlayers,
      controversy,
    );

    // Apply axis effects (clamped to [-5, +5] by the SQL function)
    const { error: axisError } = await adminClient.rpc('apply_axis_effects', {
      p_game_id: game_id,
      p_axis_effects: result.axisEffects,
    });
    if (axisError) throw axisError;

    // Apply faction power effects (GREATEST(1, power_level + change))
    for (const [factionKey, powerChange] of Object.entries(result.factionPowerEffects)) {
      if (!powerChange) continue;
      const faction = factions.find((f: any) => f.faction_key === factionKey);
      if (!faction) continue;
      const newPower = Math.max(1, faction.power_level + powerChange);
      await adminClient
        .from('game_factions')
        .update({ power_level: newPower })
        .eq('game_id', game_id)
        .eq('faction_key', factionKey);
    }

    // Compute and apply affinity malus
    const malusMap = computeAffinityMalus(
      engineVotes,
      result.winningResolutionKey,
      result.axisEffects as Partial<Record<AxisKey, number>>,
      fullEngineFactions,
      round.senate_leader_id,
    );

    if (Object.keys(malusMap).length > 0) {
      // Fetch current affinities for affected players
      const affectedPlayerIds = Object.keys(malusMap);
      const { data: currentAffinities, error: affError } = await adminClient
        .from('game_player_faction_affinity')
        .select('player_id, faction_id, affinity, game_factions!inner(faction_key)')
        .eq('game_id', game_id)
        .in('player_id', affectedPlayerIds);
      if (affError) throw affError;

      for (const [playerId, factionMalus] of Object.entries(malusMap)) {
        for (const [factionKey, malus] of Object.entries(factionMalus)) {
          const aff = (currentAffinities ?? []).find(
            (a: any) => a.player_id === playerId && (a.game_factions as any).faction_key === factionKey
          );
          if (!aff) continue;
          const newAffinity = Math.max(-5, Math.min(5, aff.affinity + malus));
          await adminClient
            .from('game_player_faction_affinity')
            .update({ affinity: newAffinity })
            .eq('game_id', game_id)
            .eq('player_id', playerId)
            .eq('faction_id', aff.faction_id);
        }
      }
    }

    // Register follow-up controversy if unlocked
    const winningResolution = controversy.resolutions.find(
      (r) => r.key === result.winningResolutionKey
    );
    if (winningResolution?.followUpKey) {
      await adminClient
        .from('game_follow_up_pool')
        .upsert({
          game_id,
          controversy_key: winningResolution.followUpKey,
          unlocked_at_round: round.round_number,
          used: false,
        }, { onConflict: 'game_id,controversy_key' });
    }

    // Mark controversy state as resolved
    await adminClient
      .from('game_controversy_state')
      .update({
        status: 'resolved',
        winning_resolution_key: result.winningResolutionKey,
        winning_total_influence: result.winningTotal,
        resolved_at: new Date().toISOString(),
        axis_effects_applied: result.axisEffects,
        faction_power_effects_applied: result.factionPowerEffects,
      })
      .eq('round_id', round.id)
      .eq('controversy_key', controversy_key);

    // Determine second controversy key for phase advancement
    const { data: allContStates } = await adminClient
      .from('game_controversy_state')
      .select('controversy_key, status')
      .eq('round_id', round.id);

    const secondKey = (allContStates ?? []).find(
      (cs: any) => cs.controversy_key !== controversy_key
    )?.controversy_key ?? '';

    // Advance phase
    const { data: advanceResult, error: advanceError } = await adminClient.rpc('advance_controversy_phase', {
      p_game_id: game_id,
      p_round_id: round.id,
      p_current_phase: round.phase,
      p_second_controversy_key: secondKey,
    });
    if (advanceError) throw advanceError;

    // Auto-call advance_round when both controversies are done
    if (advanceResult?.status === 'round_end') {
      const { error: roundEndError } = await adminClient.rpc('advance_round', {
        p_game_id: game_id,
      });
      if (roundEndError) throw roundEndError;
    }

    return new Response(JSON.stringify({ status: 'resolved', result: advanceResult }), {
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
