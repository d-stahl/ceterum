-- Submit a worker placement for the current sub-round
CREATE OR REPLACE FUNCTION submit_placement(
  p_game_id UUID,
  p_faction_id UUID,
  p_worker_type worker_type,
  p_orator_role orator_role DEFAULT NULL
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
  v_existing INTEGER;
BEGIN
  -- Get current round
  SELECT id, round_number, phase, sub_round INTO v_round
  FROM game_rounds
  WHERE game_id = p_game_id
  ORDER BY round_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active round found';
  END IF;

  IF v_round.phase != 'demagogery' THEN
    RAISE EXCEPTION 'Current phase is not demagogery';
  END IF;

  -- Verify player is in the game
  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  -- Check player hasn't already submitted this sub-round
  SELECT COUNT(*) INTO v_existing
  FROM game_placements
  WHERE game_id = p_game_id AND round_id = v_round.id
    AND player_id = v_caller_id AND sub_round = v_round.sub_round;

  IF v_existing > 0 THEN
    RAISE EXCEPTION 'Already submitted placement for this sub-round';
  END IF;

  -- Insert placement
  INSERT INTO game_placements (game_id, round_id, player_id, faction_id, worker_type, orator_role, sub_round)
  VALUES (p_game_id, v_round.id, v_caller_id, p_faction_id, p_worker_type, p_orator_role, v_round.sub_round);

  -- Check if all players have submitted
  SELECT COUNT(*) INTO v_total_players
  FROM game_players WHERE game_id = p_game_id;

  SELECT COUNT(*) INTO v_submitted_count
  FROM game_placements
  WHERE game_id = p_game_id AND round_id = v_round.id AND sub_round = v_round.sub_round;

  -- If all submitted, advance sub-round
  IF v_submitted_count >= v_total_players THEN
    IF v_round.sub_round < 3 THEN
      UPDATE game_rounds SET sub_round = v_round.sub_round + 1
      WHERE id = v_round.id;
      RETURN jsonb_build_object('status', 'advanced', 'sub_round', v_round.sub_round + 1);
    ELSE
      -- All 3 sub-rounds complete, mark as ready for resolution
      UPDATE game_rounds SET phase = 'completed'
      WHERE id = v_round.id;
      RETURN jsonb_build_object('status', 'ready_for_resolution');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;

-- Resolve demagogery phase: apply influence and power changes, advance to next round
CREATE OR REPLACE FUNCTION resolve_demagogery(
  p_game_id UUID,
  p_influence_changes JSONB,  -- {"player_id": amount, ...}
  p_power_changes JSONB       -- {"faction_key": amount, ...}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_player_id TEXT;
  v_influence INTEGER;
  v_faction_key TEXT;
  v_power_change INTEGER;
  v_round_number INTEGER;
BEGIN
  -- Get current round
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds
  WHERE game_id = p_game_id
  ORDER BY round_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_round.phase != 'completed' THEN
    RAISE EXCEPTION 'Round is not ready for resolution';
  END IF;

  -- Apply influence changes
  FOR v_player_id, v_influence IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_influence_changes)
  LOOP
    UPDATE game_player_state
    SET influence = influence + v_influence
    WHERE game_id = p_game_id AND player_id = v_player_id::UUID;
  END LOOP;

  -- Apply faction power changes
  FOR v_faction_key, v_power_change IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_power_changes)
  LOOP
    UPDATE game_factions
    SET power_level = GREATEST(1, power_level + v_power_change)
    WHERE game_id = p_game_id AND faction_key = v_faction_key;
  END LOOP;

  v_round_number := v_round.round_number;

  -- Check if game should end (after 6 rounds)
  IF v_round_number >= 6 THEN
    UPDATE games SET status = 'finished' WHERE id = p_game_id;
    RETURN;
  END IF;

  -- Create next round (skip ruling phase for iteration 1)
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round)
  VALUES (p_game_id, v_round_number + 1, 'demagogery', 1);
END;
$$;
