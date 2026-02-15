-- Player color identity enum
CREATE TYPE player_color AS ENUM (
  'ivory', 'slate', 'crimson', 'navy', 'emerald',
  'purple', 'gold', 'bronze', 'rose', 'teal'
);

-- Add columns to game_players
ALTER TABLE game_players ADD COLUMN player_name TEXT;
ALTER TABLE game_players ADD COLUMN color player_color NOT NULL DEFAULT 'ivory';

-- Unique color per game
ALTER TABLE game_players ADD CONSTRAINT unique_color_per_game UNIQUE (game_id, color);
