-- Advance to next round: halve influence (ceiling), decay affinity, create new round.
-- Called internally by submit-controversy-vote Edge Function after controversy 2 resolves.
-- Revoked from authenticated/anon — service role only.
CREATE OR REPLACE FUNCTION advance_round(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase != 'round_end' THEN
    RAISE EXCEPTION 'Round is not in round_end phase (currently: %)', v_round.phase;
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

  -- Create next round
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round)
  VALUES (p_game_id, v_round.round_number + 1, 'demagogery', 1);

  RETURN jsonb_build_object(
    'status', 'next_round',
    'round_number', v_round.round_number + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_round(UUID) FROM authenticated, anon;
