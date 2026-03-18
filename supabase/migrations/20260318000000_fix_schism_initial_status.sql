-- Fix: Schisms need 'declared' initial status (SL picks side + team before voting).
-- The previous migration used ELSE 'voting' which was correct for clash but wrong for schism.

-- Fix submit_senate_leader_actions
CREATE OR REPLACE FUNCTION submit_senate_leader_actions(
  p_game_id UUID,
  p_discarded_key TEXT,
  p_ordered_keys TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_first_type TEXT;
  v_first_status TEXT;
  i INTEGER;
BEGIN
  SELECT id, round_number, phase, senate_leader_id, controversy_pool INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase != 'ruling_pool' THEN
    RAISE EXCEPTION 'Not in pool management phase';
  END IF;

  IF v_round.senate_leader_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the Senate Leader can manage the controversy pool';
  END IF;

  IF EXISTS (SELECT 1 FROM game_senate_leader_actions WHERE round_id = v_round.id) THEN
    RAISE EXCEPTION 'Senate Leader actions already submitted';
  END IF;

  IF NOT (p_discarded_key = ANY(v_round.controversy_pool)) THEN
    RAISE EXCEPTION 'Discarded controversy is not in the pool';
  END IF;

  IF array_length(p_ordered_keys, 1) != 3 THEN
    RAISE EXCEPTION 'Must order exactly 3 controversies';
  END IF;

  FOR i IN 1..3 LOOP
    IF NOT (p_ordered_keys[i] = ANY(v_round.controversy_pool)) THEN
      RAISE EXCEPTION 'Ordered key % is not in the pool', p_ordered_keys[i];
    END IF;
    IF p_ordered_keys[i] = p_discarded_key THEN
      RAISE EXCEPTION 'Cannot order the discarded controversy';
    END IF;
  END LOOP;

  INSERT INTO game_senate_leader_actions (round_id, game_id, senate_leader_id, discarded_key, ordered_keys)
  VALUES (v_round.id, p_game_id, v_caller_id, p_discarded_key, p_ordered_keys);

  UPDATE game_controversy_deck
  SET status = 'resolved', resolved_with_key = 'discarded', resolved_in_round = v_round.round_number
  WHERE game_id = p_game_id AND controversy_key = p_discarded_key;

  UPDATE game_controversy_deck
  SET status = 'leftover'
  WHERE game_id = p_game_id AND controversy_key = p_ordered_keys[3];

  -- Determine initial status for first controversy based on type
  -- clash → 'voting' (all players act simultaneously, no SL declaration)
  -- vote, schism → 'declared' (SL declares resolution / picks side + team first)
  SELECT snapshot->>'type' INTO v_first_type
  FROM game_controversy_snapshots
  WHERE game_id = p_game_id AND controversy_key = p_ordered_keys[1];

  v_first_status := CASE WHEN v_first_type = 'clash' THEN 'voting' ELSE 'declared' END;

  INSERT INTO game_controversy_state (round_id, controversy_key, game_id, status)
  VALUES
    (v_round.id, p_ordered_keys[1], p_game_id, v_first_status),
    (v_round.id, p_ordered_keys[2], p_game_id, 'pending');

  UPDATE game_rounds SET phase = 'ruling_voting_1' WHERE id = v_round.id;

  RETURN jsonb_build_object('status', 'ok', 'first_controversy', p_ordered_keys[1]);
END;
$$;

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
BEGIN
  IF p_current_phase = 'ruling_voting_1' THEN
    -- Look up second controversy type
    SELECT snapshot->>'type' INTO v_type
    FROM game_controversy_snapshots
    WHERE game_id = p_game_id AND controversy_key = p_second_controversy_key;

    -- clash → 'voting' (no SL declaration); vote, schism → 'declared'
    v_status := CASE WHEN v_type = 'clash' THEN 'voting' ELSE 'declared' END;

    UPDATE game_controversy_state
    SET status = v_status
    WHERE round_id = p_round_id AND controversy_key = p_second_controversy_key;

    UPDATE game_rounds SET phase = 'ruling_voting_2' WHERE id = p_round_id;

    RETURN jsonb_build_object('status', 'voting_2');
  ELSE
    UPDATE game_rounds SET phase = 'round_end' WHERE id = p_round_id;
    RETURN jsonb_build_object('status', 'round_end');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_controversy_phase(UUID, UUID, TEXT, TEXT) FROM authenticated, anon;
