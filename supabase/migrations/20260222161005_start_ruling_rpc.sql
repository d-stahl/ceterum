-- Start ruling phase: determine Senate Leader and draw controversy pool.
-- Called internally by the submit-placement Edge Function after demagogery resolves.
-- Revoked from authenticated/anon — only accessible via service-role client.

CREATE OR REPLACE FUNCTION start_ruling_phase(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_max_influence INTEGER;
  v_contender_count INTEGER;
  v_leader_id UUID;
  v_pool_keys TEXT[] := '{}';
  v_leftover_key TEXT;
  v_deck_key TEXT;
  v_follow_up_key TEXT;
BEGIN
  -- Get current round
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase != 'ruling_selection' THEN
    RAISE EXCEPTION 'Round is not in ruling_selection phase (currently: %)', v_round.phase;
  END IF;

  -- Determine Senate Leader: player with most influence
  SELECT MAX(influence) INTO v_max_influence
  FROM game_player_state WHERE game_id = p_game_id;

  SELECT COUNT(*) INTO v_contender_count
  FROM game_player_state
  WHERE game_id = p_game_id AND influence = v_max_influence;

  IF v_contender_count = 1 THEN
    -- Clear winner
    SELECT player_id INTO v_leader_id
    FROM game_player_state
    WHERE game_id = p_game_id AND influence = v_max_influence;

    UPDATE game_rounds SET senate_leader_id = v_leader_id WHERE id = v_round.id;
  ELSE
    -- Multiple contenders tied for most influence — need pledge runoff.
    -- Return contender list; phase stays 'ruling_selection' until resolved.
    RETURN jsonb_build_object(
      'status', 'runoff_needed',
      'contenders', (
        SELECT jsonb_agg(jsonb_build_object('playerId', player_id, 'influence', influence))
        FROM game_player_state
        WHERE game_id = p_game_id AND influence = v_max_influence
      )
    );
  END IF;

  -- Assemble controversy pool (4 cards in priority order)

  -- Priority 1: follow-ups from previous rounds (max 2, unused)
  FOR v_follow_up_key IN
    SELECT controversy_key FROM game_follow_up_pool
    WHERE game_id = p_game_id AND used = FALSE
    ORDER BY unlocked_at_round ASC
    LIMIT 2
  LOOP
    v_pool_keys := v_pool_keys || v_follow_up_key;
    UPDATE game_follow_up_pool SET used = TRUE
    WHERE game_id = p_game_id AND controversy_key = v_follow_up_key;
  END LOOP;

  -- Priority 2: leftover from previous round (the 3rd ordered card that wasn't voted on)
  IF v_round.round_number > 1 AND array_length(v_pool_keys, 1) IS DISTINCT FROM 4 THEN
    SELECT controversy_key INTO v_leftover_key
    FROM game_controversy_deck
    WHERE game_id = p_game_id AND status = 'leftover'
    LIMIT 1;

    IF v_leftover_key IS NOT NULL THEN
      v_pool_keys := v_pool_keys || v_leftover_key;
      UPDATE game_controversy_deck
      SET status = 'in_pool'
      WHERE game_id = p_game_id AND controversy_key = v_leftover_key;
    END IF;
  END IF;

  -- Priority 3: fill remaining slots from undrawn deck (in shuffle order)
  FOR v_deck_key IN
    SELECT controversy_key FROM game_controversy_deck
    WHERE game_id = p_game_id AND status = 'undrawn'
    ORDER BY draw_position ASC
  LOOP
    EXIT WHEN array_length(v_pool_keys, 1) >= 4;
    v_pool_keys := v_pool_keys || v_deck_key;
    UPDATE game_controversy_deck
    SET status = 'in_pool'
    WHERE game_id = p_game_id AND controversy_key = v_deck_key;
  END LOOP;

  -- Publish pool on the round (visible to all players via realtime)
  UPDATE game_rounds SET
    controversy_pool = v_pool_keys,
    phase = 'ruling_pool'
  WHERE id = v_round.id;

  RETURN jsonb_build_object(
    'status', 'leader_selected',
    'senate_leader_id', v_leader_id,
    'pool', to_jsonb(v_pool_keys)
  );
END;
$$;

-- Revoke direct access — only Edge Functions (service role) should call this
REVOKE EXECUTE ON FUNCTION start_ruling_phase(UUID) FROM authenticated, anon;
