ALTER TABLE games ADD COLUMN max_players INTEGER NOT NULL DEFAULT 3;
ALTER TABLE games ADD CONSTRAINT max_players_range CHECK (max_players >= 3 AND max_players <= 8);
