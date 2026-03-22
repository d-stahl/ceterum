-- Fix: Endeavours were starting with status 'declared' instead of 'voting'.
-- Both clash and endeavour should go straight to 'voting' (no SL declaration step).
-- Only vote-type and schism controversies need 'declared' (SL picks resolution / side+team).

-- Fix start_ruling_phase
CREATE OR REPLACE FUNCTION start_ruling_phase(
  p_game_id UUID,
  p_round_id UUID,
  p_ordered_keys TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_first_type TEXT;
  v_first_status TEXT;
BEGIN
  SELECT id, phase INTO v_round
  FROM game_rounds WHERE id = p_round_id FOR UPDATE;

  IF v_round.phase != 'demagogery_resolved' THEN
    RAISE EXCEPTION 'Not in demagogery_resolved phase';
  END IF;

  -- Look up first controversy type from snapshot
  SELECT snapshot->>'type' INTO v_first_type
  FROM game_controversy_snapshots
  WHERE game_id = p_game_id AND controversy_key = p_ordered_keys[1];

  -- clash/endeavour → 'voting' (no SL declaration); vote/schism → 'declared'
  v_first_status := CASE WHEN v_first_type IN ('clash', 'endeavour') THEN 'voting' ELSE 'declared' END;

  INSERT INTO game_controversy_state (round_id, controversy_key, game_id, status)
  VALUES
    (v_round.id, p_ordered_keys[1], p_game_id, v_first_status),
    (v_round.id, p_ordered_keys[2], p_game_id, 'pending');

  UPDATE game_rounds
  SET phase = 'ruling_voting_1',
      controversy_order = p_ordered_keys
  WHERE id = p_round_id;

  RETURN jsonb_build_object('status', 'ruling_voting_1', 'first_controversy', p_ordered_keys[1]);
END;
$$;

REVOKE EXECUTE ON FUNCTION start_ruling_phase(UUID, UUID, TEXT[]) FROM authenticated, anon;

-- Fix advance_controversy_phase
CREATE OR REPLACE FUNCTION advance_controversy_phase(
  p_game_id UUID,
  p_round_id UUID,
  p_current_phase TEXT,
  p_second_controversy_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
  v_status TEXT;
  v_influence JSONB;
BEGIN
  IF p_current_phase = 'ruling_voting_1' THEN
    -- Look up second controversy type
    SELECT snapshot->>'type' INTO v_type
    FROM game_controversy_snapshots
    WHERE game_id = p_game_id AND controversy_key = p_second_controversy_key;

    -- clash/endeavour → 'voting' (no SL declaration); vote/schism → 'declared'
    v_status := CASE WHEN v_type IN ('clash', 'endeavour') THEN 'voting' ELSE 'declared' END;

    UPDATE game_controversy_state
    SET status = v_status
    WHERE round_id = p_round_id AND controversy_key = p_second_controversy_key;

    UPDATE game_rounds SET phase = 'ruling_voting_2' WHERE id = p_round_id;

    RETURN jsonb_build_object('status', 'voting_2');
  ELSE
    -- Snapshot influence before round ends (advance_round will halve it)
    SELECT jsonb_object_agg(player_id::TEXT, influence) INTO v_influence
    FROM game_player_state WHERE game_id = p_game_id;

    UPDATE game_rounds
    SET phase = 'round_end', end_of_round_influence = v_influence
    WHERE id = p_round_id;

    RETURN jsonb_build_object('status', 'round_end');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_controversy_phase(UUID, UUID, TEXT, TEXT) FROM authenticated, anon;
