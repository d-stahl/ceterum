-- Make advance_round idempotent: if the round has already been advanced,
-- return success instead of raising an exception. This allows each player
-- to press Continue independently without errors.

CREATE OR REPLACE FUNCTION advance_round(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_upcoming TEXT[] := '{}';
  v_follow_up_key TEXT;
  v_leftover_key TEXT;
  v_deck_key TEXT;
  v_initial_powers JSONB;
  v_initial_influence JSONB;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  -- Already advanced — return success (idempotent)
  IF v_round.phase != 'round_end' THEN
    RETURN jsonb_build_object('status', 'already_advanced');
  END IF;

  -- Halve unspent influence (rounded in player's favor = ceiling)
  UPDATE game_player_state
  SET influence = CEIL(influence::NUMERIC / 2)::INTEGER
  WHERE game_id = p_game_id;

  -- Decay all faction affinities toward 0 by 1
  UPDATE game_player_faction_affinity
  SET affinity = CASE
    WHEN affinity < 0 THEN affinity + 1
    WHEN affinity > 0 THEN affinity - 1
    ELSE 0
  END
  WHERE game_id = p_game_id;

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

  -- Compute upcoming_pool for the new round using same priority as start_ruling_phase:
  -- Priority 1: follow-ups (unused, max 2)
  FOR v_follow_up_key IN
    SELECT controversy_key FROM game_follow_up_pool
    WHERE game_id = p_game_id AND used = FALSE
    ORDER BY unlocked_at_round ASC
    LIMIT 2
  LOOP
    v_upcoming := v_upcoming || v_follow_up_key;
  END LOOP;

  -- Priority 2: leftover (unused from previous pool, max fill to 4)
  IF array_length(v_upcoming, 1) IS NULL OR array_length(v_upcoming, 1) < 4 THEN
    FOR v_leftover_key IN
      SELECT cs.controversy_key
      FROM game_controversy_state cs
      WHERE cs.round_id = v_round.id AND cs.status = 'pending'
      LIMIT (4 - COALESCE(array_length(v_upcoming, 1), 0))
    LOOP
      v_upcoming := v_upcoming || v_leftover_key;
    END LOOP;
  END IF;

  -- Priority 3: draw from deck
  IF array_length(v_upcoming, 1) IS NULL OR array_length(v_upcoming, 1) < 4 THEN
    FOR v_deck_key IN
      SELECT unnest(deck_order)
      FROM games WHERE id = p_game_id
      LIMIT 20
    LOOP
      IF v_deck_key = ANY(
        SELECT controversy_key FROM game_controversy_state WHERE game_id = p_game_id
      ) THEN CONTINUE; END IF;
      IF v_deck_key = ANY(v_upcoming) THEN CONTINUE; END IF;

      v_upcoming := v_upcoming || v_deck_key;
      EXIT WHEN array_length(v_upcoming, 1) >= 4;
    END LOOP;
  END IF;

  -- Create new round
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round, upcoming_pool, initial_faction_powers, initial_influence)
  VALUES (p_game_id, v_round.round_number + 1, 'demagogery', 1, v_upcoming, v_initial_powers, v_initial_influence);

  RETURN jsonb_build_object('status', 'advanced', 'round_number', v_round.round_number + 1);
END;
$$;

-- Re-apply REVOKE
REVOKE EXECUTE ON FUNCTION advance_round(UUID) FROM authenticated, anon;
