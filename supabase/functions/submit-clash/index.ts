import { createEdgeClients, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';
import { buildClashSubmissionsFromDb, buildEngineFactionsFromDb, buildPlayerAffinitiesFromDb } from '../_shared/db-transforms.ts';
import { resolveClash } from '../_shared/game-engine/clash.ts';
import { computeAffinityEffects } from '../_shared/game-engine/ruling.ts';
import type { AxisKey } from '../_shared/game-engine/axes.ts';
import type { ClashControversy } from '../_shared/game-engine/controversies.ts';
import { CONTROVERSY_MAP } from '../_shared/game-engine/controversies.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { game_id, controversy_key, faction_bids, commits } = await req.json();
    if (!game_id || !controversy_key || faction_bids == null || commits == null) {
      return errorResponse('Missing required fields', 400);
    }

    const { anonClient, adminClient } = await createEdgeClients(req.headers.get('Authorization'));

    // Submit action via anon client (validates membership, phase, deduplication)
    const { data: submitResult, error: submitError } = await anonClient.rpc('submit_clash_action', {
      p_game_id: game_id,
      p_controversy_key: controversy_key,
      p_faction_bids: faction_bids,
      p_commits: commits,
    });

    if (submitError) return errorResponse(submitError.message, 422);

    if (submitResult?.status !== 'ready_for_resolution') {
      return jsonResponse(submitResult);
    }

    // Last submission in — resolve server-side
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
      .select('status')
      .eq('round_id', round.id)
      .eq('controversy_key', controversy_key)
      .single();
    if (csError) throw csError;

    if (csState.status === 'resolved') {
      return jsonResponse({ status: 'resolved' });
    }

    // Fetch submissions, controversy snapshot, factions, axes, affinities in parallel
    const [subsRes, snapRes, factionsRes, axesRes, affinitiesRes] = await Promise.all([
      adminClient
        .from('game_clash_submissions')
        .select('player_id, faction_bids, commits')
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
        .select('faction_key, display_name, power_level, pref_centralization, pref_expansion, pref_commerce, pref_patrician, pref_tradition, pref_militarism')
        .eq('game_id', game_id),
      adminClient
        .from('game_axes')
        .select('axis_key, current_value')
        .eq('game_id', game_id),
      adminClient
        .from('game_player_faction_affinity')
        .select('player_id, affinity, game_factions!inner(faction_key)')
        .eq('game_id', game_id),
    ]);
    if (subsRes.error) throw subsRes.error;
    if (snapRes.error) throw snapRes.error;
    if (factionsRes.error) throw factionsRes.error;
    if (axesRes.error) throw axesRes.error;
    if (affinitiesRes.error) throw affinitiesRes.error;

    const controversy = snapRes.data.snapshot as ClashControversy;
    const submissions = buildClashSubmissionsFromDb(subsRes.data ?? []);
    const engineFactions = buildEngineFactionsFromDb(factionsRes.data ?? []);
    const playerAffinities = buildPlayerAffinitiesFromDb(affinitiesRes.data ?? []);

    // Build faction powers map: factionKey -> power_level
    const factionPowers: Record<string, number> = {};
    for (const f of (factionsRes.data ?? [])) {
      factionPowers[f.faction_key] = f.power_level;
    }

    const axisValues: Record<string, number> = {};
    for (const row of (axesRes.data ?? [])) {
      axisValues[row.axis_key] = row.current_value;
    }

    // Snapshot before-values for outcome tracking
    const axisBefore: Record<string, number> = {};
    for (const row of (axesRes.data ?? [])) {
      axisBefore[row.axis_key] = row.current_value;
    }
    const factionPowerBefore: Record<string, number> = {};
    for (const f of (factionsRes.data ?? [])) {
      factionPowerBefore[f.faction_key] = f.power_level;
    }

    const result = resolveClash(submissions, controversy.clashConfig, factionPowers, playerAffinities);

    // Apply axis effects
    const { error: axisError } = await adminClient.rpc('apply_axis_effects', {
      p_game_id: game_id,
      p_axis_effects: result.axisEffects,
    });
    if (axisError) throw axisError;

    // Apply faction power effects
    const factions = factionsRes.data ?? [];
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

    // Award VP to committers on success
    if (result.succeeded && result.victoryPoints > 0) {
      for (const committerId of result.committers) {
        await adminClient.rpc('increment_victory_points', {
          p_game_id: game_id,
          p_player_id: committerId,
          p_amount: result.victoryPoints,
        });
      }
    }

    // Compute affinity effects based on the outcome
    const affinityBefore: Record<string, Record<string, number>> = {};
    let affinityEffects: Record<string, Record<string, number>> = {};
    if (Object.keys(result.axisEffects).length > 0) {
      // Committers "backed" the outcome, withdrawers did not
      const pseudoVotes = result.committers.map((pid) => ({
        playerId: pid,
        resolutionKey: '_clash_outcome',
        influenceSpent: 1, // equal weight for affinity purposes
      }));

      affinityEffects = computeAffinityEffects(
        pseudoVotes,
        '_clash_outcome',
        result.axisEffects as Partial<Record<AxisKey, number>>,
        engineFactions,
        axisValues as Partial<Record<AxisKey, number>>,
        round.senate_leader_id,
      );

      if (Object.keys(affinityEffects).length > 0) {
        const affectedPlayerIds = Object.keys(affinityEffects);
        const { data: currentAffinities, error: affError } = await adminClient
          .from('game_player_faction_affinity')
          .select('player_id, faction_id, affinity, game_factions!inner(faction_key)')
          .eq('game_id', game_id)
          .in('player_id', affectedPlayerIds);
        if (affError) throw affError;

        for (const aff of (currentAffinities ?? [])) {
          const pid = aff.player_id;
          const fkey = (aff as any).game_factions.faction_key;
          if (!affinityBefore[pid]) affinityBefore[pid] = {};
          affinityBefore[pid][fkey] = aff.affinity;
        }

        for (const [playerId, factionEffects] of Object.entries(affinityEffects)) {
          for (const [factionKey, delta] of Object.entries(factionEffects)) {
            const aff = (currentAffinities ?? []).find(
              (a: any) => a.player_id === playerId && a.game_factions.faction_key === factionKey,
            );
            if (!aff) continue;
            const newAffinity = Math.max(-5, Math.min(5, aff.affinity + delta));
            await adminClient
              .from('game_player_faction_affinity')
              .update({ affinity: newAffinity })
              .eq('game_id', game_id)
              .eq('player_id', playerId)
              .eq('faction_id', aff.faction_id);
          }
        }
      }
    }

    // Build outcome data
    const axisOutcomes: Record<string, { before: number; after: number }> = {};
    for (const [axis, delta] of Object.entries(result.axisEffects)) {
      if (!delta) continue;
      const before = axisBefore[axis] ?? 0;
      axisOutcomes[axis] = { before, after: before + delta };
    }

    const factionPowerOutcomes: Record<string, { before: number; after: number }> = {};
    for (const [fkey, delta] of Object.entries(result.factionPowerEffects)) {
      if (!delta) continue;
      const before = factionPowerBefore[fkey] ?? 3;
      factionPowerOutcomes[fkey] = { before, after: Math.max(1, before + delta) };
    }

    const affinityOutcomes: Record<string, Record<string, { before: number; after: number }>> = {};
    for (const [playerId, factionDeltas] of Object.entries(affinityEffects)) {
      affinityOutcomes[playerId] = {};
      for (const [factionKey, delta] of Object.entries(factionDeltas)) {
        const before = affinityBefore[playerId]?.[factionKey] ?? 0;
        affinityOutcomes[playerId][factionKey] = {
          before,
          after: Math.max(-5, Math.min(5, before + delta)),
        };
      }
    }

    const typeData = {
      threshold: result.threshold,
      committedPower: result.committedPower,
      totalAvailablePower: result.totalAvailablePower,
      succeeded: result.succeeded,
      factionAssignments: result.factionAssignments.map((a: any) => ({
        factionKey: a.factionKey,
        amplifiedPower: a.amplifiedPower,
        winners: a.winners.map((w: any) => ({
          playerId: w.playerId,
          bidAmount: submissions.find((s) => s.playerId === w.playerId)?.factionBids[a.factionKey] ?? 0,
        })),
      })),
      committers: result.committers,
      withdrawers: result.withdrawers,
      victoryPoints: result.victoryPoints,
    };

    const { error: outcomeError } = await adminClient
      .from('game_controversy_outcomes')
      .insert({
        game_id,
        round_id: round.id,
        controversy_key,
        controversy_type: 'clash',
        axis_outcomes: axisOutcomes,
        faction_power_outcomes: factionPowerOutcomes,
        affinity_outcomes: affinityOutcomes,
        type_data: typeData,
      });
    if (outcomeError) throw outcomeError;

    // Register follow-up controversy if unlocked
    const outcome = result.succeeded
      ? controversy.clashConfig.successOutcome
      : controversy.clashConfig.failureOutcome;
    if (outcome.followUpKey) {
      await adminClient
        .from('game_follow_up_pool')
        .upsert({
          game_id,
          controversy_key: outcome.followUpKey,
          unlocked_at_round: round.round_number,
          used: false,
        }, { onConflict: 'game_id,controversy_key' });
      const followUpDef = CONTROVERSY_MAP[outcome.followUpKey];
      if (followUpDef) {
        await adminClient
          .from('game_controversy_snapshots')
          .upsert({
            game_id,
            controversy_key: outcome.followUpKey,
            snapshot: followUpDef,
          }, { onConflict: 'game_id,controversy_key' });
      }
    }

    // Mark controversy resolved
    await adminClient
      .from('game_controversy_state')
      .update({ status: 'resolved' })
      .eq('round_id', round.id)
      .eq('controversy_key', controversy_key);

    // Advance to next controversy or round end
    const { data: allContStates } = await adminClient
      .from('game_controversy_state')
      .select('controversy_key, status')
      .eq('round_id', round.id);

    const secondKey = (allContStates ?? []).find(
      (cs: any) => cs.controversy_key !== controversy_key,
    )?.controversy_key ?? '';

    const { data: advanceResult, error: advanceError } = await adminClient.rpc('advance_controversy_phase', {
      p_game_id: game_id,
      p_round_id: round.id,
      p_current_phase: round.phase,
      p_second_controversy_key: secondKey,
    });
    if (advanceError) throw advanceError;

    return jsonResponse({ status: 'resolved', result: advanceResult });

  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message);
  }
});
