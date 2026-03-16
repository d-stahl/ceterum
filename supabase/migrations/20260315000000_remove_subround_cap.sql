-- Remove the fixed 3-sub-round cap. Demagogery now iterates until every
-- player has >= 3 placed workers, regardless of how many sub-rounds that takes.

-- Drop the sub_round <= 3 constraints on both tables
ALTER TABLE game_rounds DROP CONSTRAINT IF EXISTS game_rounds_sub_round_check;
ALTER TABLE game_rounds ADD CONSTRAINT game_rounds_sub_round_check CHECK (sub_round >= 1);

ALTER TABLE game_placements DROP CONSTRAINT IF EXISTS game_placements_sub_round_check;
ALTER TABLE game_placements ADD CONSTRAINT game_placements_sub_round_check CHECK (sub_round >= 1);

-- Rewrite submit_placement: no sub_round cap, single exit condition
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
  v_my_total INTEGER;
  v_existing INTEGER;
  v_done_count INTEGER;
  v_total_players INTEGER;
BEGIN
  SELECT id, round_number, phase, sub_round INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'No active round found'; END IF;
  IF v_round.phase != 'demagogery' THEN RAISE EXCEPTION 'Current phase is not demagogery'; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  -- Player must have < 3 total placements this round
  SELECT COUNT(*) INTO v_my_total FROM game_placements
  WHERE round_id = v_round.id AND player_id = v_caller_id;
  IF v_my_total >= 3 THEN
    RAISE EXCEPTION 'Player has no workers left to place';
  END IF;

  -- One placement per player per sub-round (locked don't count)
  SELECT COUNT(*) INTO v_existing FROM game_placements
  WHERE round_id = v_round.id AND player_id = v_caller_id
    AND sub_round = v_round.sub_round AND is_locked = FALSE;
  IF v_existing > 0 THEN RAISE EXCEPTION 'Already submitted placement for this sub-round'; END IF;

  -- One senator (orator) per faction per player per round
  IF p_worker_type = 'orator' THEN
    IF EXISTS (
      SELECT 1 FROM game_placements
      WHERE round_id = v_round.id AND player_id = v_caller_id
        AND faction_id = p_faction_id AND worker_type = 'orator'
    ) THEN
      RAISE EXCEPTION 'Already have a senator at this faction';
    END IF;
  END IF;

  -- One promoter/saboteur of the same type per faction per player per round
  IF p_worker_type IN ('promoter', 'saboteur') THEN
    IF EXISTS (
      SELECT 1 FROM game_placements
      WHERE round_id = v_round.id AND player_id = v_caller_id
        AND faction_id = p_faction_id AND worker_type = p_worker_type
    ) THEN
      RAISE EXCEPTION 'Already have a % at this faction', p_worker_type;
    END IF;
  END IF;

  INSERT INTO game_placements (game_id, round_id, player_id, faction_id, worker_type, orator_role, sub_round)
  VALUES (p_game_id, v_round.id, v_caller_id, p_faction_id, p_worker_type, p_orator_role, v_round.sub_round);

  -- Is everyone done with this sub-round?
  -- "Done" = placed this sub-round (non-locked) OR has >= 3 total placements
  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;

  SELECT COUNT(*) INTO v_done_count
  FROM game_players gp
  WHERE gp.game_id = p_game_id
    AND (
      EXISTS (
        SELECT 1 FROM game_placements gpl
        WHERE gpl.round_id = v_round.id AND gpl.player_id = gp.player_id
          AND gpl.sub_round = v_round.sub_round AND gpl.is_locked = FALSE
      )
      OR
      (SELECT COUNT(*) FROM game_placements gpl
       WHERE gpl.round_id = v_round.id AND gpl.player_id = gp.player_id) >= 3
    );

  IF v_done_count < v_total_players THEN
    RETURN jsonb_build_object('status', 'waiting', 'submitted', v_done_count, 'total', v_total_players);
  END IF;

  -- Everyone done. Does anyone still have < 3 placements?
  IF EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.game_id = p_game_id
      AND (SELECT COUNT(*) FROM game_placements gpl
           WHERE gpl.round_id = v_round.id AND gpl.player_id = gp.player_id) < 3
  ) THEN
    UPDATE game_rounds SET sub_round = v_round.sub_round + 1 WHERE id = v_round.id;
    RETURN jsonb_build_object('status', 'advanced', 'sub_round', v_round.sub_round + 1);
  END IF;

  -- All players have >= 3 placements — resolve
  UPDATE game_rounds SET phase = 'demagogery_resolved' WHERE id = v_round.id;
  RETURN jsonb_build_object('status', 'ready_for_resolution');
END;
$$;
