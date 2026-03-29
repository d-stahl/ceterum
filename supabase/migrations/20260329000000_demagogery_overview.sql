-- Add a demagogery_overview phase between the last placement sub-round and resolution.
-- Players see the full board (all workers revealed) and click "Proceed" to advance to the tally.

-- 1. Add 'demagogery_overview' to allowed phases
ALTER TABLE game_rounds DROP CONSTRAINT IF EXISTS game_rounds_phase_check;
ALTER TABLE game_rounds ADD CONSTRAINT game_rounds_phase_check
  CHECK (phase IN (
    'demagogery',
    'demagogery_overview',   -- NEW: all placements visible, players review before tally
    'demagogery_resolved',
    'leader_election',
    'ruling_selection',
    'ruling_pool',
    'ruling_voting_1',
    'ruling_voting_2',
    'round_end',
    'completed'
  ));

-- 2. Track which players have clicked "Proceed" in overview
ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS overview_ready UUID[] DEFAULT '{}';

-- 3. Update submit_placement: transition to overview instead of resolved
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

  SELECT COUNT(*) INTO v_my_total FROM game_placements
  WHERE round_id = v_round.id AND player_id = v_caller_id;

  IF v_my_total < 3 THEN
    SELECT COUNT(*) INTO v_existing FROM game_placements
    WHERE round_id = v_round.id AND player_id = v_caller_id
      AND sub_round = v_round.sub_round AND is_locked = FALSE;
    IF v_existing > 0 THEN RAISE EXCEPTION 'Already submitted placement for this sub-round'; END IF;

    IF p_worker_type = 'orator' THEN
      IF EXISTS (
        SELECT 1 FROM game_placements
        WHERE round_id = v_round.id AND player_id = v_caller_id
          AND faction_id = p_faction_id AND worker_type = 'orator'
      ) THEN
        RAISE EXCEPTION 'Already have a senator at this faction';
      END IF;
    END IF;

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
  END IF;

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

  IF v_round.sub_round < 3 AND EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.game_id = p_game_id
      AND (SELECT COUNT(*) FROM game_placements gpl
           WHERE gpl.round_id = v_round.id AND gpl.player_id = gp.player_id) < 3
  ) THEN
    UPDATE game_rounds SET sub_round = v_round.sub_round + 1 WHERE id = v_round.id;
    RETURN jsonb_build_object('status', 'advanced', 'sub_round', v_round.sub_round + 1);
  END IF;

  -- All done — transition to overview (not resolved)
  UPDATE game_rounds SET phase = 'demagogery_overview', overview_ready = '{}' WHERE id = v_round.id;
  RETURN jsonb_build_object('status', 'overview');
END;
$$;

-- 4. New RPC: proceed_from_overview
CREATE OR REPLACE FUNCTION proceed_from_overview(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_total_players INTEGER;
  v_ready_count INTEGER;
BEGIN
  SELECT id, phase, overview_ready INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'No active round found'; END IF;
  IF v_round.phase != 'demagogery_overview' THEN
    RAISE EXCEPTION 'Not in demagogery overview phase';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  -- Already proceeded?
  IF v_caller_id = ANY(v_round.overview_ready) THEN
    RETURN jsonb_build_object('status', 'already_ready');
  END IF;

  -- Add caller to ready list
  UPDATE game_rounds
  SET overview_ready = array_append(overview_ready, v_caller_id)
  WHERE id = v_round.id;

  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  v_ready_count := array_length(v_round.overview_ready, 1);
  IF v_ready_count IS NULL THEN v_ready_count := 0; END IF;
  v_ready_count := v_ready_count + 1; -- include current caller

  IF v_ready_count >= v_total_players THEN
    UPDATE game_rounds SET phase = 'demagogery_resolved' WHERE id = v_round.id;
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'ready', v_ready_count, 'total', v_total_players);
END;
$$;
