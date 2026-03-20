-- Fix: submit_schism_bet and increment_influence referenced game_player_states (plural)
-- but the actual table is game_player_state (singular).

CREATE OR REPLACE FUNCTION submit_schism_bet(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_predicts_support BOOLEAN,
  p_stake_influence INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_cs RECORD;
  v_current_influence INTEGER;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  SELECT * INTO v_cs
  FROM game_controversy_state
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF NOT FOUND OR v_cs.status != 'voting' THEN
    RAISE EXCEPTION 'Controversy is not open for voting';
  END IF;

  IF v_caller_id = ANY(v_cs.schism_team_members) THEN
    RAISE EXCEPTION 'Team members cannot place bets — only outsiders';
  END IF;

  SELECT influence INTO v_current_influence
  FROM game_player_state
  WHERE game_id = p_game_id AND player_id = v_caller_id
  FOR UPDATE;

  IF v_current_influence IS NULL OR v_current_influence < p_stake_influence THEN
    RAISE EXCEPTION 'Insufficient influence (have %, need %)', COALESCE(v_current_influence, 0), p_stake_influence;
  END IF;

  UPDATE game_player_state
  SET influence = GREATEST(0, influence - p_stake_influence)
  WHERE game_id = p_game_id AND player_id = v_caller_id;

  INSERT INTO game_schism_bets (game_id, round_id, controversy_key, player_id, predicts_support, stake_influence)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_predicts_support, p_stake_influence);

  RETURN jsonb_build_object('status', 'bet_placed', 'stake', p_stake_influence);
END;
$$;

CREATE OR REPLACE FUNCTION increment_influence(
  p_game_id UUID,
  p_player_id UUID,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE game_player_state
  SET influence = influence + p_amount
  WHERE game_id = p_game_id AND player_id = p_player_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_influence(UUID, UUID, INTEGER) FROM authenticated, anon;
