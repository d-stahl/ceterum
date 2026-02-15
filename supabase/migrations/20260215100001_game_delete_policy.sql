-- Allow game creators to delete their games
CREATE POLICY "Creators can delete their games"
  ON games FOR DELETE
  USING (auth.uid() = created_by);
