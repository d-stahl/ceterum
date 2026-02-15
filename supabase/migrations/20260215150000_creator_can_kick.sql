-- Allow game creators to remove any player from their games
CREATE POLICY "Game creator can kick players"
  ON game_players FOR DELETE
  USING (
    game_id IN (
      SELECT id FROM games WHERE created_by = auth.uid()
    )
  );
