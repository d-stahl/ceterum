-- Remove the Senate Leader forced-commit requirement for Clashes.
-- SL now has the same commit/withdraw choice as all other players.

CREATE OR REPLACE FUNCTION submit_clash_action(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_faction_bids JSONB,
  p_commits BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_player_influence INTEGER;
  v_total_bid INTEGER := 0;
  v_bid_value INTEGER;
  v_total_players INTEGER;
  v_submitted_count INTEGER;
BEGIN
  SELECT id, round_number, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_controversy_state
    WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'voting'
  ) THEN
    RAISE EXCEPTION 'Controversy is not open for submissions';
  END IF;

  -- Sum total bids
  FOR v_bid_value IN SELECT value::INTEGER FROM jsonb_each_text(p_faction_bids)
  LOOP
    IF v_bid_value < 0 THEN
      RAISE EXCEPTION 'Bid values cannot be negative';
    END IF;
    v_total_bid := v_total_bid + v_bid_value;
  END LOOP;

  SELECT influence INTO v_player_influence
  FROM game_player_state WHERE game_id = p_game_id AND player_id = v_caller_id;

  IF v_total_bid > v_player_influence THEN
    RAISE EXCEPTION 'Total bids exceed available influence (have %, bidding %)', v_player_influence, v_total_bid;
  END IF;

  -- Deduct influence
  UPDATE game_player_state
  SET influence = influence - v_total_bid
  WHERE game_id = p_game_id AND player_id = v_caller_id;

  -- Record submission
  INSERT INTO game_clash_submissions (game_id, round_id, controversy_key, player_id, faction_bids, commits)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_faction_bids, p_commits);

  -- Check if all players submitted
  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  SELECT COUNT(*) INTO v_submitted_count FROM game_clash_submissions
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF v_submitted_count >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;
