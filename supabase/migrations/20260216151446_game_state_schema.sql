-- Worker types
CREATE TYPE worker_type AS ENUM ('orator', 'promoter', 'saboteur');

-- Orator roles
CREATE TYPE orator_role AS ENUM ('demagog', 'ally', 'agitator');

-- Round tracking
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  phase TEXT NOT NULL DEFAULT 'demagogery' CHECK (phase IN ('demagogery', 'ruling', 'completed')),
  sub_round INTEGER NOT NULL DEFAULT 1 CHECK (sub_round >= 1 AND sub_round <= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, round_number)
);

-- Factions selected for a game (with per-game balanced preferences)
CREATE TABLE game_factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  faction_key TEXT NOT NULL, -- e.g. 'legiones', 'mercatores'
  display_name TEXT NOT NULL, -- e.g. 'Legiones'
  power_level INTEGER NOT NULL DEFAULT 3,
  -- Per-game axis preferences (after balance nudging)
  pref_centralization INTEGER NOT NULL DEFAULT 0,
  pref_expansion INTEGER NOT NULL DEFAULT 0,
  pref_commerce INTEGER NOT NULL DEFAULT 0,
  pref_patrician INTEGER NOT NULL DEFAULT 0,
  pref_tradition INTEGER NOT NULL DEFAULT 0,
  pref_militarism INTEGER NOT NULL DEFAULT 0,
  UNIQUE (game_id, faction_key)
);

-- Policy axis state per game
CREATE TABLE game_axes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  axis_key TEXT NOT NULL, -- e.g. 'centralization', 'expansion'
  current_value INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= -5 AND current_value <= 5),
  UNIQUE (game_id, axis_key)
);

-- Player state within a game (influence, per-faction affinity)
CREATE TABLE game_player_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  influence INTEGER NOT NULL DEFAULT 0,
  UNIQUE (game_id, player_id)
);

-- Per-player per-faction affinity
CREATE TABLE game_player_faction_affinity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES game_factions(id) ON DELETE CASCADE,
  affinity INTEGER NOT NULL DEFAULT 0,
  UNIQUE (game_id, player_id, faction_id)
);

-- Worker placements per sub-round
CREATE TABLE game_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES game_factions(id) ON DELETE CASCADE,
  worker_type worker_type NOT NULL,
  orator_role orator_role, -- NULL for promoter/saboteur
  sub_round INTEGER NOT NULL CHECK (sub_round >= 1 AND sub_round <= 3),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, round_id, player_id, sub_round) -- one placement per player per sub-round
);

-- Indexes
CREATE INDEX idx_game_rounds_game ON game_rounds(game_id);
CREATE INDEX idx_game_factions_game ON game_factions(game_id);
CREATE INDEX idx_game_axes_game ON game_axes(game_id);
CREATE INDEX idx_game_player_state_game ON game_player_state(game_id);
CREATE INDEX idx_game_placements_round ON game_placements(round_id);
CREATE INDEX idx_game_placements_game_round_sub ON game_placements(game_id, round_id, sub_round);

-- RLS
ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_player_faction_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_placements ENABLE ROW LEVEL SECURITY;

-- RLS Policies: game members can read all game state for their games
CREATE POLICY "Players can read their game rounds"
  ON game_rounds FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

CREATE POLICY "Players can read their game factions"
  ON game_factions FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

CREATE POLICY "Players can read their game axes"
  ON game_axes FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

CREATE POLICY "Players can read their game player state"
  ON game_player_state FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

CREATE POLICY "Players can read their game faction affinity"
  ON game_player_faction_affinity FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- Placements: players can only see placements for completed sub-rounds (not current)
-- This is enforced at the application/RPC level rather than RLS for simplicity.
-- For now, allow read access to game members.
CREATE POLICY "Players can read their game placements"
  ON game_placements FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- Players can insert their own placements
CREATE POLICY "Players can submit placements"
  ON game_placements FOR INSERT
  WITH CHECK (
    auth.uid() = player_id
    AND game_id IN (SELECT get_my_game_ids())
  );

-- Enable realtime for game state tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE game_factions;
ALTER PUBLICATION supabase_realtime ADD TABLE game_placements;
ALTER PUBLICATION supabase_realtime ADD TABLE game_player_state;
ALTER PUBLICATION supabase_realtime ADD TABLE game_player_faction_affinity;
