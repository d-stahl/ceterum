-- Add player agenda: target axis positions for secret objectives (Iteration 4).
-- Stored as JSONB: { "centralization": 1, "expansion": -2, ... }
ALTER TABLE game_player_state ADD COLUMN agenda JSONB DEFAULT '{}';

-- Update launch_game to accept and store player agendas.
CREATE OR REPLACE FUNCTION launch_game(
  p_game_id UUID,
  p_factions JSONB,
  p_controversies JSONB,
  p_deck_order TEXT[],
  p_agendas JSONB DEFAULT '{}'::JSONB  -- { "player_id": { "centralization": 1, ... }, ... }
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
  v_upcoming TEXT[] := '{}';
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

  -- Create player state rows with agenda
  FOR v_player IN SELECT player_id FROM game_players WHERE game_id = p_game_id
  LOOP
    INSERT INTO game_player_state (game_id, player_id, influence, agenda)
    VALUES (
      p_game_id, v_player.player_id, 0,
      COALESCE(p_agendas->>(v_player.player_id::TEXT), '{}')::JSONB
    );
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

  -- Compute upcoming_pool for round 1: first 4 cards from deck
  SELECT ARRAY(
    SELECT controversy_key FROM game_controversy_deck
    WHERE game_id = p_game_id AND status = 'undrawn'
    ORDER BY draw_position ASC
    LIMIT 4
  ) INTO v_upcoming;

  -- Create first round with upcoming_pool
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round, upcoming_pool)
  VALUES (p_game_id, 1, 'demagogery', 1, v_upcoming)
  RETURNING id INTO v_round_id;
END;
$$;
