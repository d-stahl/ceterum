-- Fix infinite recursion: game_players SELECT policy references game_players
-- Use a security definer function to bypass RLS for the subquery

CREATE OR REPLACE FUNCTION public.get_my_game_ids()
RETURNS SETOF UUID AS $$
  SELECT game_id FROM public.game_players WHERE player_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the recursive policies
DROP POLICY "Players can read players in their games" ON game_players;
DROP POLICY "Players can read players in lobby games" ON game_players;

-- Recreate without recursion
CREATE POLICY "Players can read players in their games"
  ON game_players FOR SELECT
  USING (game_id IN (SELECT public.get_my_game_ids()));

CREATE POLICY "Players can read players in lobby games"
  ON game_players FOR SELECT
  USING (
    game_id IN (SELECT g.id FROM games g WHERE g.status = 'lobby')
  );

-- Also fix the games SELECT policy that has the same issue
DROP POLICY "Players can read their own games" ON games;

CREATE POLICY "Players can read their own games"
  ON games FOR SELECT
  USING (id IN (SELECT public.get_my_game_ids()));
