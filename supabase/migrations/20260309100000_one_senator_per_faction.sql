-- Enforce one senator (orator) per faction per player per round.
-- Also enforce one promoter and one saboteur per faction per player per round.

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
  v_faction_key TEXT;
BEGIN
  SELECT id, round_number, phase, sub_round INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'No active round found'; END IF;
  IF v_round.phase != 'demagogery' THEN RAISE EXCEPTION 'Current phase is not demagogery'; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  -- Check sub-round dedup
  SELECT COUNT(*) INTO v_existing FROM game_placements
  WHERE game_id = p_game_id AND round_id = v_round.id
    AND player_id = v_caller_id AND sub_round = v_round.sub_round;
  IF v_existing > 0 THEN RAISE EXCEPTION 'Already submitted placement for this sub-round'; END IF;

  -- One senator (orator) per faction per player per round
  IF p_worker_type = 'orator' THEN
    IF EXISTS (
      SELECT 1 FROM game_placements
      WHERE game_id = p_game_id AND round_id = v_round.id
        AND player_id = v_caller_id AND faction_id = p_faction_id
        AND worker_type = 'orator'
    ) THEN
      RAISE EXCEPTION 'Already have a senator at this faction';
    END IF;
  END IF;

  -- One promoter/saboteur of the same type per faction per player per round
  IF p_worker_type IN ('promoter', 'saboteur') THEN
    IF EXISTS (
      SELECT 1 FROM game_placements
      WHERE game_id = p_game_id AND round_id = v_round.id
        AND player_id = v_caller_id AND faction_id = p_faction_id
        AND worker_type = p_worker_type
    ) THEN
      RAISE EXCEPTION 'Already have a % at this faction', p_worker_type;
    END IF;
  END IF;

  INSERT INTO game_placements (game_id, round_id, player_id, faction_id, worker_type, orator_role, sub_round)
  VALUES (p_game_id, v_round.id, v_caller_id, p_faction_id, p_worker_type, p_orator_role, v_round.sub_round);

  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  SELECT COUNT(*) INTO v_submitted_count FROM game_placements
  WHERE game_id = p_game_id AND round_id = v_round.id AND sub_round = v_round.sub_round;

  IF v_submitted_count >= v_total_players THEN
    IF v_round.sub_round < 3 THEN
      UPDATE game_rounds SET sub_round = v_round.sub_round + 1 WHERE id = v_round.id;
      RETURN jsonb_build_object('status', 'advanced', 'sub_round', v_round.sub_round + 1);
    ELSE
      -- All 3 sub-rounds complete — transition to demagogery_resolved
      UPDATE game_rounds SET phase = 'demagogery_resolved' WHERE id = v_round.id;
      RETURN jsonb_build_object('status', 'ready_for_resolution');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;
