-- Add game_controversy_outcomes to Realtime publication.
-- Without this, subscribing to the table on a channel breaks the entire channel.
ALTER PUBLICATION supabase_realtime ADD TABLE game_controversy_outcomes;
