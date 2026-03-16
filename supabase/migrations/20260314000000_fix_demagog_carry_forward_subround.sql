-- Fix 1: demagog lock-in carry-forward used sub_round = 0, which violates
-- the game_placements_sub_round_check constraint (sub_round >= 1).
-- Change to sub_round = 1 — locked placements logically belong to sub-round 1.
--
-- Fix 2: make advance_round idempotent (return 'already_advanced' instead of
-- raising an exception). This lets clients fire-and-forget the advance call
-- so each player can dismiss the round-end summary at their own pace.

CREATE OR REPLACE FUNCTION advance_round(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_new_round_id UUID;
  v_upcoming TEXT[] := '{}';
  v_follow_up_key TEXT;
  v_leftover_key TEXT;
  v_deck_key TEXT;
  v_initial_powers JSONB;
  v_initial_influence JSONB;
  v_active_players INTEGER;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  -- Idempotent: if already advanced, return success
  IF v_round.phase != 'round_end' THEN
    RETURN jsonb_build_object('status', 'already_advanced');
  END IF;

  -- Halve unspent influence (rounded in player's favor = ceiling)
  UPDATE game_player_state
  SET influence = CEIL(influence::NUMERIC / 2)::INTEGER
  WHERE game_id = p_game_id;

  -- NOTE: Affinity decay removed — affinity changes only from game mechanics now

  -- Mark current round as completed
  UPDATE game_rounds SET phase = 'completed' WHERE id = v_round.id;

  -- Check if game is over (6 rounds)
  IF v_round.round_number >= 6 THEN
    UPDATE games SET status = 'finished' WHERE id = p_game_id;
    RETURN jsonb_build_object('status', 'game_over', 'round_number', v_round.round_number);
  END IF;

  -- Snapshot post-halving faction powers and influence for the new round
  SELECT jsonb_object_agg(faction_key, power_level) INTO v_initial_powers
  FROM game_factions WHERE game_id = p_game_id;

  SELECT jsonb_object_agg(player_id::TEXT, influence) INTO v_initial_influence
  FROM game_player_state WHERE game_id = p_game_id;

  -- Compute upcoming_pool for the new round
  -- Priority 1: follow-ups (unused, max 2)
  FOR v_follow_up_key IN
    SELECT controversy_key FROM game_follow_up_pool
    WHERE game_id = p_game_id AND used = FALSE
    ORDER BY unlocked_at_round ASC
    LIMIT 2
  LOOP
    v_upcoming := v_upcoming || v_follow_up_key;
  END LOOP;

  -- Priority 2: leftovers from just-completed round
  IF array_length(v_upcoming, 1) IS DISTINCT FROM 4 THEN
    FOR v_leftover_key IN
      SELECT controversy_key FROM game_controversy_deck
      WHERE game_id = p_game_id AND status = 'leftover'
    LOOP
      EXIT WHEN array_length(v_upcoming, 1) >= 4;
      v_upcoming := v_upcoming || v_leftover_key;
    END LOOP;
  END IF;

  -- Priority 3: undrawn deck cards (in shuffle order)
  IF array_length(v_upcoming, 1) IS DISTINCT FROM 4 THEN
    FOR v_deck_key IN
      SELECT controversy_key FROM game_controversy_deck
      WHERE game_id = p_game_id AND status = 'undrawn'
      ORDER BY draw_position ASC
    LOOP
      EXIT WHEN array_length(v_upcoming, 1) >= 4;
      v_upcoming := v_upcoming || v_deck_key;
    END LOOP;
  END IF;

  -- Create next round with upcoming_pool and snapshots pre-populated
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round, upcoming_pool, initial_faction_powers, initial_influence)
  VALUES (p_game_id, v_round.round_number + 1, 'demagogery', 1, v_upcoming, v_initial_powers, v_initial_influence)
  RETURNING id INTO v_new_round_id;

  -- Carry forward demagog placements as locked for the new round
  INSERT INTO game_placements (game_id, round_id, player_id, faction_id, worker_type, orator_role, sub_round, is_locked)
  SELECT p_game_id, v_new_round_id, gp.player_id, gp.faction_id, 'orator'::worker_type, 'demagog'::orator_role, 1, TRUE
  FROM game_placements gp
  WHERE gp.round_id = v_round.id
    AND gp.worker_type = 'orator'
    AND gp.orator_role = 'demagog';

  -- If every player already has >= 3 placements (all locked), skip demagogery entirely
  SELECT COUNT(*) INTO v_active_players
  FROM game_players gp
  WHERE gp.game_id = p_game_id
    AND (SELECT COUNT(*) FROM game_placements gpl
         WHERE gpl.round_id = v_new_round_id AND gpl.player_id = gp.player_id
        ) < 3;

  IF v_active_players = 0 THEN
    UPDATE game_rounds SET phase = 'demagogery_resolved' WHERE id = v_new_round_id;
    RETURN jsonb_build_object(
      'status', 'skip_demagogery',
      'round_number', v_round.round_number + 1
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'next_round',
    'round_number', v_round.round_number + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_round(UUID) FROM authenticated, anon;
