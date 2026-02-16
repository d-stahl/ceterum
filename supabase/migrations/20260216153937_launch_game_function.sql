-- Launch game: transitions from lobby to in_progress and initializes all game state
CREATE OR REPLACE FUNCTION launch_game(p_game_id UUID, p_factions JSONB)
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
BEGIN
  -- Verify caller is the game creator and game is in lobby
  SELECT id, created_by, status INTO v_game
  FROM games WHERE id = p_game_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF v_game.created_by != v_caller_id THEN
    RAISE EXCEPTION 'Only the game creator can launch the game';
  END IF;

  IF v_game.status != 'lobby' THEN
    RAISE EXCEPTION 'Game is not in lobby status';
  END IF;

  -- Update game status
  UPDATE games SET status = 'in_progress' WHERE id = p_game_id;

  -- Lock player names: snapshot current display_name into game_players
  UPDATE game_players gp
  SET player_name = p.display_name
  FROM profiles p
  WHERE gp.game_id = p_game_id AND gp.player_id = p.id;

  -- Insert factions
  FOR v_faction IN SELECT * FROM jsonb_array_elements(p_factions)
  LOOP
    INSERT INTO game_factions (game_id, faction_key, display_name, power_level,
      pref_centralization, pref_expansion, pref_commerce,
      pref_patrician, pref_tradition, pref_militarism)
    VALUES (
      p_game_id,
      v_faction->>'key',
      v_faction->>'displayName',
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
    INSERT INTO game_axes (game_id, axis_key, current_value)
    VALUES (p_game_id, v_axis, 0);
  END LOOP;

  -- Create player state rows (all at 0 influence)
  FOR v_player IN SELECT player_id FROM game_players WHERE game_id = p_game_id
  LOOP
    INSERT INTO game_player_state (game_id, player_id, influence)
    VALUES (p_game_id, v_player.player_id, 0);
  END LOOP;

  -- Create first round
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round)
  VALUES (p_game_id, 1, 'demagogery', 1)
  RETURNING id INTO v_round_id;
END;
$$;
