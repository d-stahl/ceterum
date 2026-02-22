-- Senate Leader discards 1 controversy and orders the remaining 3.
-- The top 2 are voted on this round; the 3rd becomes next round's leftover.
CREATE OR REPLACE FUNCTION submit_senate_leader_actions(
  p_game_id UUID,
  p_discarded_key TEXT,
  p_ordered_keys TEXT[]  -- exactly 3, in SL's chosen order
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
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

  IF NOT EXISTS (SELECT 1 FROM game_senate_leader_actions WHERE round_id = v_round.id) THEN
    -- First submission — validate inputs
  ELSE
    RAISE EXCEPTION 'Senate Leader actions already submitted';
  END IF;

  -- Validate discarded key is in the pool
  IF NOT (p_discarded_key = ANY(v_round.controversy_pool)) THEN
    RAISE EXCEPTION 'Discarded controversy is not in the pool';
  END IF;

  -- Validate ordered_keys: exactly 3, all in pool, none is the discarded key, all unique
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

  -- Persist SL's private choices
  INSERT INTO game_senate_leader_actions (round_id, game_id, senate_leader_id, discarded_key, ordered_keys)
  VALUES (v_round.id, p_game_id, v_caller_id, p_discarded_key, p_ordered_keys);

  -- Mark discarded card as removed from play this round
  UPDATE game_controversy_deck
  SET status = 'resolved', resolved_with_key = 'discarded', resolved_in_round = v_round.round_number
  WHERE game_id = p_game_id AND controversy_key = p_discarded_key;

  -- Mark 3rd ordered card as leftover (returns to pool next round)
  UPDATE game_controversy_deck
  SET status = 'leftover'
  WHERE game_id = p_game_id AND controversy_key = p_ordered_keys[3];

  -- Create controversy state rows for the 2 controversies being voted on this round
  INSERT INTO game_controversy_state (round_id, controversy_key, game_id, status)
  VALUES
    (v_round.id, p_ordered_keys[1], p_game_id, 'declared'),
    (v_round.id, p_ordered_keys[2], p_game_id, 'pending');

  -- Advance to first controversy voting phase
  UPDATE game_rounds SET phase = 'ruling_voting_1' WHERE id = v_round.id;

  RETURN jsonb_build_object('status', 'ok', 'first_controversy', p_ordered_keys[1]);
END;
$$;
