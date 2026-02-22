-- Senate Leader publicly declares their preferred resolution for a controversy.
CREATE OR REPLACE FUNCTION declare_resolution(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_resolution_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
BEGIN
  SELECT id, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF v_round.senate_leader_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the Senate Leader can declare';
  END IF;

  UPDATE game_controversy_state
  SET senate_leader_declaration = p_resolution_key, status = 'voting'
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'declared';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controversy is not in declared state (already voted or wrong key)';
  END IF;

  RETURN jsonb_build_object('status', 'declared');
END;
$$;


-- A player secretly votes on the active controversy, spending influence.
CREATE OR REPLACE FUNCTION submit_controversy_vote(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_resolution_key TEXT,
  p_influence_spent INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_controversy_state RECORD;
  v_player_influence INTEGER;
  v_total_players INTEGER;
  v_submitted_count INTEGER;
BEGIN
  SELECT id, round_number, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase (current phase: %)', v_round.phase;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  SELECT * INTO v_controversy_state
  FROM game_controversy_state
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controversy not found in current round';
  END IF;

  IF v_controversy_state.status != 'voting' THEN
    RAISE EXCEPTION 'Controversy is not open for voting (Senate Leader must declare first)';
  END IF;

  -- Senate Leader must vote for their own declaration
  IF v_caller_id = v_round.senate_leader_id
    AND p_resolution_key != v_controversy_state.senate_leader_declaration THEN
    RAISE EXCEPTION 'Senate Leader must vote for their declared resolution';
  END IF;

  -- Validate influence
  SELECT influence INTO v_player_influence
  FROM game_player_state WHERE game_id = p_game_id AND player_id = v_caller_id;

  IF p_influence_spent < 0 THEN
    RAISE EXCEPTION 'Influence spent cannot be negative';
  END IF;

  IF p_influence_spent > v_player_influence THEN
    RAISE EXCEPTION 'Not enough influence (have %, spending %)', v_player_influence, p_influence_spent;
  END IF;

  -- Deduct influence immediately
  UPDATE game_player_state
  SET influence = influence - p_influence_spent
  WHERE game_id = p_game_id AND player_id = v_caller_id;

  -- Record vote (UNIQUE constraint prevents double-voting)
  INSERT INTO game_controversy_votes (game_id, round_id, controversy_key, player_id, resolution_key, influence_spent)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_resolution_key, p_influence_spent);

  -- Check if all players have voted
  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  SELECT COUNT(*) INTO v_submitted_count FROM game_controversy_votes
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF v_submitted_count >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object(
    'status', 'waiting',
    'submitted', v_submitted_count,
    'total', v_total_players
  );
END;
$$;


-- Internal: apply axis effects (±1 clamped to [-5, +5]) after a controversy resolves.
-- Returns JSONB of actual shifts applied.
CREATE OR REPLACE FUNCTION apply_axis_effects(
  p_game_id UUID,
  p_axis_effects JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_axis TEXT;
  v_shift INTEGER;
  v_applied JSONB := '{}'::JSONB;
BEGIN
  FOR v_axis, v_shift IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_axis_effects)
  LOOP
    UPDATE game_axes
    SET current_value = GREATEST(-5, LEAST(5, current_value + v_shift))
    WHERE game_id = p_game_id AND axis_key = v_axis;

    v_applied := v_applied || jsonb_build_object(v_axis, v_shift);
  END LOOP;
  RETURN v_applied;
END;
$$;

REVOKE EXECUTE ON FUNCTION apply_axis_effects(UUID, JSONB) FROM authenticated, anon;


-- Internal: advance controversy phase after controversy 1 resolves, or trigger round end.
-- Called by the Edge Function after resolution, with service role.
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
BEGIN
  IF p_current_phase = 'ruling_voting_1' THEN
    -- Advance to controversy 2: mark it as 'declared' so SL can declare
    UPDATE game_controversy_state
    SET status = 'declared'
    WHERE round_id = p_round_id AND controversy_key = p_second_controversy_key;

    UPDATE game_rounds SET phase = 'ruling_voting_2' WHERE id = p_round_id;

    RETURN jsonb_build_object('status', 'voting_2');
  ELSE
    -- Both controversies resolved — transition to round_end
    UPDATE game_rounds SET phase = 'round_end' WHERE id = p_round_id;
    RETURN jsonb_build_object('status', 'round_end');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_controversy_phase(UUID, UUID, TEXT, TEXT) FROM authenticated, anon;
