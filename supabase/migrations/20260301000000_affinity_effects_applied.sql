-- Store affinity malus per controversy resolution so the client can display it.
-- Shape: { "player_id": { "faction_key": -1 }, ... }
ALTER TABLE game_controversy_state
  ADD COLUMN IF NOT EXISTS affinity_effects_applied JSONB;
