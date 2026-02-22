-- Add pledge_contenders to game_rounds so the UI knows who is in the runoff
ALTER TABLE game_rounds ADD COLUMN pledge_contenders UUID[] DEFAULT '{}';

-- Update start_ruling_phase to populate pledge_contenders when a runoff is needed
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
  v_contenders JSONB;
  v_pool_keys TEXT[] := '{}';
  v_leftover_key TEXT;
  v_deck_key TEXT;
  v_follow_up_key TEXT;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase != 'ruling_selection' THEN
    RAISE EXCEPTION 'Round is not in ruling_selection phase (currently: %)', v_round.phase;
  END IF;

  SELECT MAX(influence) INTO v_max_influence
  FROM game_player_state WHERE game_id = p_game_id;

  SELECT COUNT(*) INTO v_contender_count
  FROM game_player_state
  WHERE game_id = p_game_id AND influence = v_max_influence;

  IF v_contender_count > 1 THEN
    -- Store contenders on the round for client consumption
    SELECT jsonb_agg(jsonb_build_object('playerId', player_id, 'influence', influence))
    INTO v_contenders
    FROM game_player_state
    WHERE game_id = p_game_id AND influence = v_max_influence;

    UPDATE game_rounds
    SET pledge_contenders = ARRAY(
      SELECT player_id FROM game_player_state
      WHERE game_id = p_game_id AND influence = v_max_influence
    )
    WHERE id = v_round.id;

    RETURN jsonb_build_object(
      'status', 'runoff_needed',
      'contenders', v_contenders
    );
  END IF;

  -- Clear winner — proceed to pool
  SELECT player_id INTO v_leader_id
  FROM game_player_state
  WHERE game_id = p_game_id AND influence = v_max_influence;

  -- Assemble pool and advance phase
  RETURN finalize_senate_leader_and_pool(p_game_id, v_round.id, v_leader_id, v_round.round_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION start_ruling_phase(UUID) FROM authenticated, anon;


-- Internal helper: set Senate Leader and assemble controversy pool.
-- Called by start_ruling_phase (clear winner) and submit-pledge Edge Function (after runoff).
CREATE OR REPLACE FUNCTION finalize_senate_leader_and_pool(
  p_game_id UUID,
  p_round_id UUID,
  p_leader_id UUID,
  p_round_number INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool_keys TEXT[] := '{}';
  v_leftover_key TEXT;
  v_deck_key TEXT;
  v_follow_up_key TEXT;
BEGIN
  UPDATE game_rounds SET senate_leader_id = p_leader_id WHERE id = p_round_id;

  -- Priority 1: follow-ups (max 2)
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

  -- Priority 2: leftover from previous round
  IF p_round_number > 1 AND array_length(v_pool_keys, 1) IS DISTINCT FROM 4 THEN
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

  -- Priority 3: fill from undrawn deck
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

  UPDATE game_rounds SET
    controversy_pool = v_pool_keys,
    phase = 'ruling_pool'
  WHERE id = p_round_id;

  RETURN jsonb_build_object(
    'status', 'leader_selected',
    'senate_leader_id', p_leader_id,
    'pool', to_jsonb(v_pool_keys)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION finalize_senate_leader_and_pool(UUID, UUID, UUID, INTEGER) FROM authenticated, anon;


-- Submit a Senate Leader selection pledge.
-- Called via anon client; validates membership and deduplication.
CREATE OR REPLACE FUNCTION submit_pledge(
  p_game_id UUID,
  p_candidate_id UUID,
  p_pledge_round INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_total_players INTEGER;
  v_submitted_count INTEGER;
BEGIN
  SELECT id, round_number, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase != 'ruling_selection' THEN
    RAISE EXCEPTION 'Not in Senate Leader selection phase';
  END IF;

  IF v_round.senate_leader_id IS NOT NULL THEN
    RAISE EXCEPTION 'Senate Leader already determined';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  -- Must pledge for one of the current contenders
  IF NOT (p_candidate_id = ANY(v_round.pledge_contenders)) THEN
    RAISE EXCEPTION 'Candidate is not a current contender';
  END IF;

  IF EXISTS (
    SELECT 1 FROM game_support_pledges
    WHERE round_id = v_round.id AND pledger_id = v_caller_id AND pledge_round = p_pledge_round
  ) THEN
    RAISE EXCEPTION 'Already pledged this round';
  END IF;

  INSERT INTO game_support_pledges (game_id, round_id, pledger_id, candidate_id, pledge_round)
  VALUES (p_game_id, v_round.id, v_caller_id, p_candidate_id, p_pledge_round);

  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  SELECT COUNT(*) INTO v_submitted_count FROM game_support_pledges
  WHERE round_id = v_round.id AND pledge_round = p_pledge_round;

  IF v_submitted_count >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution', 'pledge_round', p_pledge_round);
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;
