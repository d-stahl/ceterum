-- Update launch_game to accept controversy snapshot data and deck order
CREATE OR REPLACE FUNCTION launch_game(
  p_game_id UUID,
  p_factions JSONB,
  p_controversies JSONB,    -- array of full controversy objects for version-locking
  p_deck_order TEXT[]        -- shuffled controversy keys
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_game RECORD;
  v_faction JSONB;
  v_faction_id UUID;
  v_player RECORD;
  v_round_id UUID;
  v_axis TEXT;
  v_axes TEXT[] := ARRAY['centralization', 'expansion', 'commerce', 'patrician', 'tradition', 'militarism'];
  v_controversy JSONB;
  v_position INTEGER;
  v_key TEXT;
BEGIN
  -- Verify caller is the game creator and game is in lobby
  SELECT id, created_by, status INTO v_game
  FROM games WHERE id = p_game_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.created_by != v_caller_id THEN RAISE EXCEPTION 'Only the game creator can launch the game'; END IF;
  IF v_game.status != 'lobby' THEN RAISE EXCEPTION 'Game is not in lobby status'; END IF;

  -- Update game status
  UPDATE games SET status = 'in_progress' WHERE id = p_game_id;

  -- Lock player names: snapshot current display_name into game_players
  UPDATE game_players gp SET player_name = p.display_name
  FROM profiles p WHERE gp.game_id = p_game_id AND gp.player_id = p.id;

  -- Insert factions
  FOR v_faction IN SELECT * FROM jsonb_array_elements(p_factions)
  LOOP
    INSERT INTO game_factions (game_id, faction_key, display_name, power_level,
      pref_centralization, pref_expansion, pref_commerce,
      pref_patrician, pref_tradition, pref_militarism)
    VALUES (
      p_game_id, v_faction->>'key', v_faction->>'displayName',
      (v_faction->>'power')::INTEGER,
      (v_faction->'preferences'->>'centralization')::INTEGER,
      (v_faction->'preferences'->>'expansion')::INTEGER,
      (v_faction->'preferences'->>'commerce')::INTEGER,
      (v_faction->'preferences'->>'patrician')::INTEGER,
      (v_faction->'preferences'->>'tradition')::INTEGER,
      (v_faction->'preferences'->>'militarism')::INTEGER
    )
    RETURNING id INTO v_faction_id;

    -- Create affinity rows for each player for this faction
    FOR v_player IN SELECT player_id FROM game_players WHERE game_id = p_game_id
    LOOP
      INSERT INTO game_player_faction_affinity (game_id, player_id, faction_id, affinity)
      VALUES (p_game_id, v_player.player_id, v_faction_id, 0);
    END LOOP;
  END LOOP;

  -- Create axes (all at 0)
  FOREACH v_axis IN ARRAY v_axes
  LOOP
    INSERT INTO game_axes (game_id, axis_key, current_value) VALUES (p_game_id, v_axis, 0);
  END LOOP;

  -- Create player state rows (all at 0 influence)
  FOR v_player IN SELECT player_id FROM game_players WHERE game_id = p_game_id
  LOOP
    INSERT INTO game_player_state (game_id, player_id, influence) VALUES (p_game_id, v_player.player_id, 0);
  END LOOP;

  -- Snapshot controversy definitions for version isolation
  FOR v_controversy IN SELECT * FROM jsonb_array_elements(p_controversies)
  LOOP
    INSERT INTO game_controversy_snapshots (game_id, controversy_key, snapshot)
    VALUES (p_game_id, v_controversy->>'key', v_controversy);
  END LOOP;

  -- Initialize controversy deck with shuffled order
  v_position := 1;
  FOREACH v_key IN ARRAY p_deck_order
  LOOP
    INSERT INTO game_controversy_deck (game_id, controversy_key, draw_position, status)
    VALUES (p_game_id, v_key, v_position, 'undrawn');
    v_position := v_position + 1;
  END LOOP;

  -- Create first round
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round)
  VALUES (p_game_id, 1, 'demagogery', 1)
  RETURNING id INTO v_round_id;
END;
$$;

-- Update submit_placement: 'completed' -> 'demagogery_resolved' to signal ruling phase start
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
  SELECT id, round_number, phase, sub_round INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'No active round found'; END IF;
  IF v_round.phase != 'demagogery' THEN RAISE EXCEPTION 'Current phase is not demagogery'; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  SELECT COUNT(*) INTO v_existing FROM game_placements
  WHERE game_id = p_game_id AND round_id = v_round.id
    AND player_id = v_caller_id AND sub_round = v_round.sub_round;
  IF v_existing > 0 THEN RAISE EXCEPTION 'Already submitted placement for this sub-round'; END IF;

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
      -- All 3 sub-rounds complete — transition to demagogery_resolved (not 'completed')
      UPDATE game_rounds SET phase = 'demagogery_resolved' WHERE id = v_round.id;
      RETURN jsonb_build_object('status', 'ready_for_resolution');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;

-- Update resolve_demagogery: transition to ruling_selection instead of creating next round directly
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
BEGIN
  -- Get current round (must be in demagogery_resolved phase)
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF NOT FOUND OR v_round.phase != 'demagogery_resolved' THEN
    RAISE EXCEPTION 'Round is not ready for resolution (expected demagogery_resolved, got %)', v_round.phase;
  END IF;

  -- Apply influence changes
  FOR v_player_id, v_influence IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_influence_changes)
  LOOP
    UPDATE game_player_state SET influence = influence + v_influence
    WHERE game_id = p_game_id AND player_id = v_player_id::UUID;
  END LOOP;

  -- Apply faction power changes
  FOR v_faction_key, v_power_change IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_power_changes)
  LOOP
    UPDATE game_factions SET power_level = GREATEST(1, power_level + v_power_change)
    WHERE game_id = p_game_id AND faction_key = v_faction_key;
  END LOOP;

  -- Transition to ruling phase (Senate Leader selection)
  UPDATE game_rounds SET phase = 'ruling_selection' WHERE id = v_round.id;
END;
$$;
