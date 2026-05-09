-- Snapshot pledger influence at pledge time so the Leader Election results
-- view keeps showing the weight each player actually had when they voted,
-- even if influence shifts later (e.g. during controversy voting).
ALTER TABLE game_support_pledges ADD COLUMN pledger_influence INTEGER;

-- Update submit_leader_vote to capture the snapshot.
CREATE OR REPLACE FUNCTION submit_leader_vote(
  p_game_id UUID,
  p_candidate_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_caller_id UUID;
  v_caller_influence INTEGER;
  v_total_players INT;
  v_submitted INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round
  FROM game_rounds
  WHERE game_id = p_game_id
  ORDER BY round_number DESC
  LIMIT 1
  FOR UPDATE;

  IF v_round IS NULL OR v_round.phase != 'leader_election' THEN
    RAISE EXCEPTION 'Game is not in leader_election phase';
  END IF;

  SELECT influence INTO v_caller_influence
  FROM game_player_state
  WHERE game_id = p_game_id AND player_id = v_caller_id;

  IF v_caller_influence IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this game';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_player_state
    WHERE game_id = p_game_id AND player_id = p_candidate_id
  ) THEN
    RAISE EXCEPTION 'Candidate is not a member of this game';
  END IF;

  INSERT INTO game_support_pledges (game_id, round_id, pledger_id, candidate_id, pledge_round, pledger_influence)
  VALUES (p_game_id, v_round.id, v_caller_id, p_candidate_id, 1, v_caller_influence);

  SELECT COUNT(*) INTO v_total_players
  FROM game_player_state
  WHERE game_id = p_game_id;

  SELECT COUNT(*) INTO v_submitted
  FROM game_support_pledges
  WHERE round_id = v_round.id AND pledge_round = 1;

  IF v_submitted >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  ELSE
    RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted, 'total', v_total_players);
  END IF;
END;
$$;
