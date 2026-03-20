-- Track outsiders who explicitly pass on betting
CREATE TABLE IF NOT EXISTS game_schism_bet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES profiles(id),
  passed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, controversy_key, player_id)
);

ALTER TABLE game_schism_bet_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read own or resolved schism bet passes"
  ON game_schism_bet_passes FOR SELECT
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM game_controversy_state cs
      WHERE cs.round_id = game_schism_bet_passes.round_id
        AND cs.controversy_key = game_schism_bet_passes.controversy_key
        AND cs.status = 'resolved'
    )
  );

-- Check if all players have acted (team voted + outsiders bet/passed)
CREATE OR REPLACE FUNCTION check_schism_readiness(
  p_game_id UUID,
  p_round_id UUID,
  p_controversy_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cs RECORD;
  v_total_players INTEGER;
  v_team_size INTEGER;
  v_team_votes INTEGER;
  v_outsider_count INTEGER;
  v_outsider_acted INTEGER;
BEGIN
  SELECT * INTO v_cs
  FROM game_controversy_state
  WHERE round_id = p_round_id AND controversy_key = p_controversy_key;

  IF NOT FOUND OR v_cs.status != 'voting' THEN
    RETURN jsonb_build_object('status', 'not_voting');
  END IF;

  v_team_size := array_length(v_cs.schism_team_members, 1);

  SELECT COUNT(*) INTO v_team_votes
  FROM game_schism_submissions
  WHERE round_id = p_round_id AND controversy_key = p_controversy_key;

  SELECT COUNT(*) INTO v_total_players
  FROM game_players WHERE game_id = p_game_id;

  v_outsider_count := v_total_players - v_team_size;

  SELECT COUNT(*) INTO v_outsider_acted FROM (
    SELECT player_id FROM game_schism_bets
    WHERE round_id = p_round_id AND controversy_key = p_controversy_key
    UNION
    SELECT player_id FROM game_schism_bet_passes
    WHERE round_id = p_round_id AND controversy_key = p_controversy_key
  ) AS acted;

  IF v_team_votes >= v_team_size AND v_outsider_acted >= v_outsider_count THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object(
    'status', 'waiting',
    'team_votes', v_team_votes,
    'team_size', v_team_size,
    'outsider_acted', v_outsider_acted,
    'outsider_count', v_outsider_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION check_schism_readiness(UUID, UUID, TEXT) FROM authenticated, anon;

-- Update submit_schism_vote to check full readiness (team + outsiders)
CREATE OR REPLACE FUNCTION submit_schism_vote(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_supports BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_cs RECORD;
  v_readiness JSONB;
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

  IF NOT (v_caller_id = ANY(v_cs.schism_team_members)) THEN
    RAISE EXCEPTION 'Only team members can vote in a Schism';
  END IF;

  INSERT INTO game_schism_submissions (game_id, round_id, controversy_key, player_id, supports)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_supports);

  v_readiness := check_schism_readiness(p_game_id, v_round.id, p_controversy_key);

  RETURN v_readiness;
END;
$$;

-- Update submit_schism_bet to also check readiness and return it
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
  v_readiness JSONB;
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

  v_readiness := check_schism_readiness(p_game_id, v_round.id, p_controversy_key);

  RETURN v_readiness;
END;
$$;

-- pass_schism_bet also checks readiness
CREATE OR REPLACE FUNCTION pass_schism_bet(
  p_game_id UUID,
  p_controversy_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_cs RECORD;
  v_readiness JSONB;
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
    RAISE EXCEPTION 'Team members cannot pass on bets';
  END IF;

  INSERT INTO game_schism_bet_passes (game_id, round_id, controversy_key, player_id)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id)
  ON CONFLICT (round_id, controversy_key, player_id) DO NOTHING;

  v_readiness := check_schism_readiness(p_game_id, v_round.id, p_controversy_key);

  RETURN v_readiness;
END;
$$;
