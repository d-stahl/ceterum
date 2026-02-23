-- Add upcoming_pool to game_rounds: persistent preview of upcoming controversies.
-- Populated at round creation; visible during demagogery so players can plan.

ALTER TABLE game_rounds ADD COLUMN upcoming_pool TEXT[] DEFAULT '{}';

-- Update launch_game to populate upcoming_pool on round 1 (top 4 from deck)
CREATE OR REPLACE FUNCTION launch_game(
  p_game_id UUID,
  p_factions JSONB,
  p_controversies JSONB,
  p_deck_order TEXT[]
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

-- Update advance_round to populate upcoming_pool on the new round using priority logic
CREATE OR REPLACE FUNCTION advance_round(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_upcoming TEXT[] := '{}';
  v_follow_up_key TEXT;
  v_leftover_key TEXT;
  v_deck_key TEXT;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase != 'round_end' THEN
    RAISE EXCEPTION 'Round is not in round_end phase (currently: %)', v_round.phase;
  END IF;

  -- Halve unspent influence (rounded in player's favor = ceiling)
  UPDATE game_player_state
  SET influence = CEIL(influence::NUMERIC / 2)::INTEGER
  WHERE game_id = p_game_id;

  -- Decay all faction affinities toward 0 by 1
  UPDATE game_player_faction_affinity
  SET affinity = CASE
    WHEN affinity < 0 THEN affinity + 1
    WHEN affinity > 0 THEN affinity - 1
    ELSE 0
  END
  WHERE game_id = p_game_id;

  -- Mark current round as completed
  UPDATE game_rounds SET phase = 'completed' WHERE id = v_round.id;

  -- Check if game is over (6 rounds)
  IF v_round.round_number >= 6 THEN
    UPDATE games SET status = 'finished' WHERE id = p_game_id;
    RETURN jsonb_build_object('status', 'game_over', 'round_number', v_round.round_number);
  END IF;

  -- Compute upcoming_pool for the new round using same priority as start_ruling_phase:
  -- Priority 1: follow-ups (unused, max 2)
  FOR v_follow_up_key IN
    SELECT controversy_key FROM game_follow_up_pool
    WHERE game_id = p_game_id AND used = FALSE
    ORDER BY unlocked_at_round ASC
    LIMIT 2
  LOOP
    v_upcoming := v_upcoming || v_follow_up_key;
  END LOOP;

  -- Priority 2: leftovers from just-completed round
  IF array_length(v_upcoming, 1) IS DISTINCT FROM 4 THEN
    FOR v_leftover_key IN
      SELECT controversy_key FROM game_controversy_deck
      WHERE game_id = p_game_id AND status = 'leftover'
    LOOP
      EXIT WHEN array_length(v_upcoming, 1) >= 4;
      v_upcoming := v_upcoming || v_leftover_key;
    END LOOP;
  END IF;

  -- Priority 3: undrawn deck cards (in shuffle order)
  IF array_length(v_upcoming, 1) IS DISTINCT FROM 4 THEN
    FOR v_deck_key IN
      SELECT controversy_key FROM game_controversy_deck
      WHERE game_id = p_game_id AND status = 'undrawn'
      ORDER BY draw_position ASC
    LOOP
      EXIT WHEN array_length(v_upcoming, 1) >= 4;
      v_upcoming := v_upcoming || v_deck_key;
    END LOOP;
  END IF;

  -- Create next round with upcoming_pool pre-populated
  INSERT INTO game_rounds (game_id, round_number, phase, sub_round, upcoming_pool)
  VALUES (p_game_id, v_round.round_number + 1, 'demagogery', 1, v_upcoming);

  RETURN jsonb_build_object(
    'status', 'next_round',
    'round_number', v_round.round_number + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_round(UUID) FROM authenticated, anon;
