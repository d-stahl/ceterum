-- Per-user hide state for games in the "My Games" list.
ALTER TABLE game_players ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- RPC: toggle the caller's hidden flag for one game. Scoped to the caller's
-- own row only, so there's no risk of writing to another player's row.
CREATE OR REPLACE FUNCTION set_game_hidden(p_game_id UUID, p_hidden BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE game_players
  SET hidden = p_hidden
  WHERE game_id = p_game_id AND player_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
