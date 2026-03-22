-- Change victory_points from INTEGER to NUMERIC to support fractional VP values
-- (e.g. 2.5 VP for a clash success outcome)

ALTER TABLE game_player_state
  ALTER COLUMN victory_points TYPE NUMERIC USING victory_points::NUMERIC;

-- Recreate increment_victory_points with NUMERIC parameter
-- (DROP the old INTEGER version first, then create the new one)
DROP FUNCTION IF EXISTS increment_victory_points(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION increment_victory_points(
  p_game_id UUID,
  p_player_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE game_player_state
  SET victory_points = victory_points + p_amount
  WHERE game_id = p_game_id AND player_id = p_player_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_victory_points(UUID, UUID, NUMERIC) FROM authenticated, anon;
