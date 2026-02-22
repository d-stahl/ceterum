-- Fix orator_role enum: rename 'ally' to 'advocate' to match TypeScript
ALTER TYPE orator_role RENAME VALUE 'ally' TO 'advocate';

-- Expand game_rounds phase constraint to include ruling sub-phases
ALTER TABLE game_rounds DROP CONSTRAINT IF EXISTS game_rounds_phase_check;
ALTER TABLE game_rounds ADD CONSTRAINT game_rounds_phase_check
  CHECK (phase IN (
    'demagogery',          -- worker placement (existing)
    'demagogery_resolved', -- demagogery done, waiting to start ruling (replaces 'completed')
    'ruling_selection',    -- determining Senate Leader (pledge rounds if tied)
    'ruling_pool',         -- Senate Leader managing controversy pool (discard + order)
    'ruling_voting_1',     -- voting on first controversy
    'ruling_voting_2',     -- voting on second controversy
    'round_end',           -- processing round end (halve influence, decay affinity)
    'completed'            -- round fully done
  ));

-- Add Senate Leader column to game_rounds
ALTER TABLE game_rounds ADD COLUMN senate_leader_id UUID REFERENCES profiles(id);
-- Controversy pool: the 4 controversy keys drawn for this round (visible to all players)
ALTER TABLE game_rounds ADD COLUMN controversy_pool TEXT[] DEFAULT '{}';
-- Which controversies have been resolved this round (public after resolution)
ALTER TABLE game_rounds ADD COLUMN controversies_resolved TEXT[] DEFAULT '{}';

-- Controversy deck: shuffled deck state per game
CREATE TABLE game_controversy_deck (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  draw_position INTEGER NOT NULL,  -- order in shuffled deck (1-based)
  status TEXT NOT NULL DEFAULT 'undrawn'
    CHECK (status IN ('undrawn', 'in_pool', 'resolved', 'leftover')),
  resolved_with_key TEXT,          -- resolution key if resolved, NULL otherwise
  resolved_in_round INTEGER,       -- round number when resolved, NULL otherwise
  PRIMARY KEY (game_id, controversy_key)
);

-- Controversy snapshots: JSONB version-lock of controversy definitions at game launch
CREATE TABLE game_controversy_snapshots (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  snapshot JSONB NOT NULL,  -- full Controversy object serialized
  PRIMARY KEY (game_id, controversy_key)
);

-- Senate Leader private actions: discard and ordering (only SL can read their own)
CREATE TABLE game_senate_leader_actions (
  round_id UUID PRIMARY KEY REFERENCES game_rounds(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  senate_leader_id UUID NOT NULL REFERENCES profiles(id),
  discarded_key TEXT NOT NULL,
  ordered_keys TEXT[] NOT NULL,    -- exactly 3 keys in SL's chosen resolution order
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Controversy state per round: tracks voting status for each controversy
CREATE TABLE game_controversy_state (
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'declared', 'voting', 'resolved')),
  senate_leader_declaration TEXT,  -- resolution key SL publicly declared
  winning_resolution_key TEXT,     -- set after resolution
  winning_total_influence INTEGER, -- total influence for winning resolution
  resolved_at TIMESTAMPTZ,
  axis_effects_applied JSONB,      -- record of actual axis shifts applied
  faction_power_effects_applied JSONB,  -- record of actual power changes applied
  PRIMARY KEY (round_id, controversy_key)
);

-- Controversy votes: secret until revealed
CREATE TABLE game_controversy_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES profiles(id),
  resolution_key TEXT NOT NULL,
  influence_spent INTEGER NOT NULL DEFAULT 0
    CHECK (influence_spent >= 0),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, controversy_key, player_id)
);

-- Senate Leader selection pledges (for runoff tiebreaks)
CREATE TABLE game_support_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  pledger_id UUID NOT NULL REFERENCES profiles(id),
  candidate_id UUID NOT NULL REFERENCES profiles(id),
  pledge_round INTEGER NOT NULL DEFAULT 1,  -- elimination round number
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, pledger_id, pledge_round)
);

-- Unlocked follow-up controversies (stub for Iteration 3)
CREATE TABLE game_follow_up_pool (
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  unlocked_at_round INTEGER NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (game_id, controversy_key)
);

-- Indexes
CREATE INDEX idx_controversy_deck_game ON game_controversy_deck(game_id);
CREATE INDEX idx_controversy_deck_status ON game_controversy_deck(game_id, status);
CREATE INDEX idx_controversy_snapshots_game ON game_controversy_snapshots(game_id);
CREATE INDEX idx_senate_leader_actions_game ON game_senate_leader_actions(game_id);
CREATE INDEX idx_controversy_state_game ON game_controversy_state(game_id);
CREATE INDEX idx_controversy_votes_round ON game_controversy_votes(round_id, controversy_key);
CREATE INDEX idx_support_pledges_round ON game_support_pledges(round_id, pledge_round);

-- RLS
ALTER TABLE game_controversy_deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_controversy_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_senate_leader_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_controversy_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_controversy_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_support_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_follow_up_pool ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Controversy deck: game members can read
CREATE POLICY "Players can read their game controversy deck"
  ON game_controversy_deck FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- Controversy snapshots: game members can read
CREATE POLICY "Players can read their game controversy snapshots"
  ON game_controversy_snapshots FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- Senate Leader actions: ONLY the Senate Leader can read their own actions
CREATE POLICY "Senate Leader can read own actions"
  ON game_senate_leader_actions FOR SELECT
  USING (senate_leader_id = auth.uid());

-- Controversy state: game members can read
CREATE POLICY "Players can read controversy state"
  ON game_controversy_state FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- Controversy votes: players can read own votes always, all votes only when controversy is resolved
CREATE POLICY "Players can read own votes"
  ON game_controversy_votes FOR SELECT
  USING (player_id = auth.uid() AND game_id IN (SELECT get_my_game_ids()));

CREATE POLICY "Players can read all votes for resolved controversies"
  ON game_controversy_votes FOR SELECT
  USING (
    game_id IN (SELECT get_my_game_ids())
    AND EXISTS (
      SELECT 1 FROM game_controversy_state gcs
      WHERE gcs.round_id = game_controversy_votes.round_id
        AND gcs.controversy_key = game_controversy_votes.controversy_key
        AND gcs.status = 'resolved'
    )
  );

-- Support pledges: game members can read, players can insert own
CREATE POLICY "Players can read pledges"
  ON game_support_pledges FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

CREATE POLICY "Players can submit pledges"
  ON game_support_pledges FOR INSERT
  WITH CHECK (pledger_id = auth.uid() AND game_id IN (SELECT get_my_game_ids()));

-- Follow-up pool: game members can read
CREATE POLICY "Players can read follow-up pool"
  ON game_follow_up_pool FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- Enable realtime for ruling phase tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_controversy_state;
ALTER PUBLICATION supabase_realtime ADD TABLE game_controversy_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE game_support_pledges;
