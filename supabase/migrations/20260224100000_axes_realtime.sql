-- Add game_axes to realtime publication.
-- Without this, subscribing to game_axes changes in the same channel
-- can cause the entire realtime channel to fail silently.
ALTER PUBLICATION supabase_realtime ADD TABLE game_axes;
