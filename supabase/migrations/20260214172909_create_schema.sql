-- Game status enum
CREATE TYPE game_status AS ENUM ('lobby', 'in_progress', 'finished');

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL,
  status game_status NOT NULL DEFAULT 'lobby',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Game players join table
CREATE TABLE game_players (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, player_id)
);

-- Indexes
CREATE INDEX idx_games_invite_code ON games(invite_code);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_game_players_player ON game_players(player_id);

-- RLS: Enable on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

-- RLS Policies: profiles
CREATE POLICY "Users can read any profile"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies: games
CREATE POLICY "Players can read their own games"
  ON games FOR SELECT
  USING (
    id IN (SELECT game_id FROM game_players WHERE player_id = auth.uid())
  );

CREATE POLICY "Anyone can read lobby games"
  ON games FOR SELECT
  USING (status = 'lobby');

CREATE POLICY "Authenticated users can create games"
  ON games FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- RLS Policies: game_players
CREATE POLICY "Players can read players in their games"
  ON game_players FOR SELECT
  USING (
    game_id IN (SELECT game_id FROM game_players WHERE player_id = auth.uid())
  );

CREATE POLICY "Players can read players in lobby games"
  ON game_players FOR SELECT
  USING (
    game_id IN (SELECT g.id FROM games g WHERE g.status = 'lobby')
  );

CREATE POLICY "Authenticated users can join games"
  ON game_players FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can leave games"
  ON game_players FOR DELETE
  USING (auth.uid() = player_id);

-- Function: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, 'New Senator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
