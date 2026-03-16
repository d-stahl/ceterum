-- Infrastructure for new controversy types: Clash, Endeavour, Schism.
-- Extends existing tables, adds submission tables, adds VP tracking.

-- 1. Add controversy_type and result_data to game_controversy_state
ALTER TABLE game_controversy_state
  ADD COLUMN IF NOT EXISTS controversy_type TEXT,
  ADD COLUMN IF NOT EXISTS result_data JSONB;

-- Expand status constraint to include 'team_picking' (Schism: SL picks team before voting)
ALTER TABLE game_controversy_state DROP CONSTRAINT IF EXISTS game_controversy_state_status_check;
ALTER TABLE game_controversy_state
  ADD CONSTRAINT game_controversy_state_status_check
  CHECK (status IN ('pending', 'declared', 'team_picking', 'voting', 'resolved'));

-- Schism SL declaration columns
ALTER TABLE game_controversy_state
  ADD COLUMN IF NOT EXISTS schism_declared_side TEXT,
  ADD COLUMN IF NOT EXISTS schism_team_members UUID[];

-- 2. Add victory_points to game_player_state
ALTER TABLE game_player_state
  ADD COLUMN IF NOT EXISTS victory_points INTEGER NOT NULL DEFAULT 0;

-- 3. Submission tables for new types

CREATE TABLE IF NOT EXISTS game_endeavour_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES profiles(id),
  influence_invested INTEGER NOT NULL DEFAULT 0 CHECK (influence_invested >= 0),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, controversy_key, player_id)
);

ALTER TABLE game_endeavour_submissions ENABLE ROW LEVEL SECURITY;

-- Players can see own submissions always; all submissions visible after resolution
CREATE POLICY "Players read own endeavour submissions"
  ON game_endeavour_submissions FOR SELECT
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM game_controversy_state cs
      WHERE cs.round_id = game_endeavour_submissions.round_id
        AND cs.controversy_key = game_endeavour_submissions.controversy_key
        AND cs.status = 'resolved'
    )
  );

CREATE TABLE IF NOT EXISTS game_clash_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES profiles(id),
  faction_bids JSONB NOT NULL DEFAULT '{}',
  commits BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, controversy_key, player_id)
);

ALTER TABLE game_clash_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read own clash submissions"
  ON game_clash_submissions FOR SELECT
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM game_controversy_state cs
      WHERE cs.round_id = game_clash_submissions.round_id
        AND cs.controversy_key = game_clash_submissions.controversy_key
        AND cs.status = 'resolved'
    )
  );

CREATE TABLE IF NOT EXISTS game_schism_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
  controversy_key TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES profiles(id),
  supports BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, controversy_key, player_id)
);

ALTER TABLE game_schism_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read own schism submissions"
  ON game_schism_submissions FOR SELECT
  USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM game_controversy_state cs
      WHERE cs.round_id = game_schism_submissions.round_id
        AND cs.controversy_key = game_schism_submissions.controversy_key
        AND cs.status = 'resolved'
    )
  );

-- 4. Update submit_senate_leader_actions to store controversy_type
-- The type is looked up from the snapshot when creating controversy state rows.
-- For now, set it from the Edge Function after row creation (simpler than parsing JSONB in SQL).
-- The Edge Function will UPDATE game_controversy_state SET controversy_type = ... after calling this RPC.

-- 5. Update declare_resolution to be type-aware.
-- For vote: works as before (sets senate_leader_declaration, status -> 'voting').
-- For clash/endeavour: no SL declaration needed, go straight to 'voting'.
-- For schism: SL picks side + team, status -> 'voting'.

CREATE OR REPLACE FUNCTION declare_resolution(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_resolution_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
BEGIN
  SELECT id, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF v_round.senate_leader_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the Senate Leader can declare';
  END IF;

  UPDATE game_controversy_state
  SET senate_leader_declaration = p_resolution_key, status = 'voting'
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'declared';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controversy is not in declared state (already voted or wrong key)';
  END IF;

  RETURN jsonb_build_object('status', 'declared');
END;
$$;

-- New: skip declaration for clash/endeavour (go straight to voting)
CREATE OR REPLACE FUNCTION declare_controversy_open(
  p_game_id UUID,
  p_controversy_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
BEGIN
  SELECT id, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF v_round.senate_leader_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the Senate Leader can open this controversy';
  END IF;

  UPDATE game_controversy_state
  SET status = 'voting'
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'declared';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controversy is not in declared state';
  END IF;

  RETURN jsonb_build_object('status', 'voting');
END;
$$;

-- New: SL declares side and picks team for Schism
CREATE OR REPLACE FUNCTION declare_schism_action(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_side_key TEXT,
  p_team_member_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_total_players INTEGER;
  v_expected_team_size INTEGER;
BEGIN
  SELECT id, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF v_round.senate_leader_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the Senate Leader can declare a Schism';
  END IF;

  -- SL must be on the team
  IF NOT (v_caller_id = ANY(p_team_member_ids)) THEN
    RAISE EXCEPTION 'Senate Leader must be on the team';
  END IF;

  -- Validate team size: 3-4 players → 2, 5-6 → 3, 7-8 → 4
  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  v_expected_team_size := CASE
    WHEN v_total_players <= 4 THEN 2
    WHEN v_total_players <= 6 THEN 3
    ELSE 4
  END;

  IF array_length(p_team_member_ids, 1) != v_expected_team_size THEN
    RAISE EXCEPTION 'Team must have exactly % members (got %)', v_expected_team_size, array_length(p_team_member_ids, 1);
  END IF;

  -- All team members must be players in the game
  IF EXISTS (
    SELECT unnest(p_team_member_ids)
    EXCEPT
    SELECT player_id FROM game_players WHERE game_id = p_game_id
  ) THEN
    RAISE EXCEPTION 'All team members must be players in this game';
  END IF;

  UPDATE game_controversy_state
  SET schism_declared_side = p_side_key,
      schism_team_members = p_team_member_ids,
      status = 'voting'
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'declared';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controversy is not in declared state';
  END IF;

  RETURN jsonb_build_object('status', 'voting', 'team_size', v_expected_team_size);
END;
$$;

-- 6. Submission RPCs for new types

-- Endeavour: player invests influence
CREATE OR REPLACE FUNCTION submit_endeavour_investment(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_influence_invested INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_player_influence INTEGER;
  v_total_players INTEGER;
  v_submitted_count INTEGER;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_controversy_state
    WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'voting'
  ) THEN
    RAISE EXCEPTION 'Controversy is not open for submissions';
  END IF;

  IF p_influence_invested < 0 THEN
    RAISE EXCEPTION 'Investment cannot be negative';
  END IF;

  SELECT influence INTO v_player_influence
  FROM game_player_state WHERE game_id = p_game_id AND player_id = v_caller_id;

  IF p_influence_invested > v_player_influence THEN
    RAISE EXCEPTION 'Not enough influence (have %, investing %)', v_player_influence, p_influence_invested;
  END IF;

  -- Deduct influence
  UPDATE game_player_state
  SET influence = influence - p_influence_invested
  WHERE game_id = p_game_id AND player_id = v_caller_id;

  -- Record submission
  INSERT INTO game_endeavour_submissions (game_id, round_id, controversy_key, player_id, influence_invested)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_influence_invested);

  -- Check if all players submitted
  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  SELECT COUNT(*) INTO v_submitted_count FROM game_endeavour_submissions
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF v_submitted_count >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;

-- Clash: player bids for factions and commits/withdraws
CREATE OR REPLACE FUNCTION submit_clash_action(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_faction_bids JSONB,
  p_commits BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_player_influence INTEGER;
  v_total_bid INTEGER := 0;
  v_bid_value INTEGER;
  v_total_players INTEGER;
  v_submitted_count INTEGER;
BEGIN
  SELECT id, round_number, phase, senate_leader_id INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM game_players WHERE game_id = p_game_id AND player_id = v_caller_id) THEN
    RAISE EXCEPTION 'Player is not in this game';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_controversy_state
    WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'voting'
  ) THEN
    RAISE EXCEPTION 'Controversy is not open for submissions';
  END IF;

  -- Senate Leader must commit
  IF v_caller_id = v_round.senate_leader_id AND NOT p_commits THEN
    RAISE EXCEPTION 'Senate Leader must commit in a Clash';
  END IF;

  -- Sum total bids
  FOR v_bid_value IN SELECT value::INTEGER FROM jsonb_each_text(p_faction_bids)
  LOOP
    IF v_bid_value < 0 THEN
      RAISE EXCEPTION 'Bid values cannot be negative';
    END IF;
    v_total_bid := v_total_bid + v_bid_value;
  END LOOP;

  SELECT influence INTO v_player_influence
  FROM game_player_state WHERE game_id = p_game_id AND player_id = v_caller_id;

  IF v_total_bid > v_player_influence THEN
    RAISE EXCEPTION 'Total bids exceed available influence (have %, bidding %)', v_player_influence, v_total_bid;
  END IF;

  -- Deduct influence
  UPDATE game_player_state
  SET influence = influence - v_total_bid
  WHERE game_id = p_game_id AND player_id = v_caller_id;

  -- Record submission
  INSERT INTO game_clash_submissions (game_id, round_id, controversy_key, player_id, faction_bids, commits)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_faction_bids, p_commits);

  -- Check if all players submitted
  SELECT COUNT(*) INTO v_total_players FROM game_players WHERE game_id = p_game_id;
  SELECT COUNT(*) INTO v_submitted_count FROM game_clash_submissions
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF v_submitted_count >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_total_players);
END;
$$;

-- Schism: team member supports or sabotages
CREATE OR REPLACE FUNCTION submit_schism_vote(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_supports BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_round RECORD;
  v_cs RECORD;
  v_team_size INTEGER;
  v_submitted_count INTEGER;
BEGIN
  SELECT id, round_number, phase INTO v_round
  FROM game_rounds WHERE game_id = p_game_id
  ORDER BY round_number DESC LIMIT 1 FOR UPDATE;

  IF v_round.phase NOT IN ('ruling_voting_1', 'ruling_voting_2') THEN
    RAISE EXCEPTION 'Not in a voting phase';
  END IF;

  SELECT * INTO v_cs
  FROM game_controversy_state
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF NOT FOUND OR v_cs.status != 'voting' THEN
    RAISE EXCEPTION 'Controversy is not open for voting';
  END IF;

  -- Only team members can submit
  IF NOT (v_caller_id = ANY(v_cs.schism_team_members)) THEN
    RAISE EXCEPTION 'Only team members can vote in a Schism';
  END IF;

  -- Record submission
  INSERT INTO game_schism_submissions (game_id, round_id, controversy_key, player_id, supports)
  VALUES (p_game_id, v_round.id, p_controversy_key, v_caller_id, p_supports);

  -- Check if all team members submitted
  v_team_size := array_length(v_cs.schism_team_members, 1);
  SELECT COUNT(*) INTO v_submitted_count FROM game_schism_submissions
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key;

  IF v_submitted_count >= v_team_size THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  END IF;

  RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted_count, 'total', v_team_size);
END;
$$;

-- 7. Helper RPC to increment victory points atomically
CREATE OR REPLACE FUNCTION increment_victory_points(
  p_game_id UUID,
  p_player_id UUID,
  p_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE game_player_state
  SET victory_points = victory_points + p_amount
  WHERE game_id = p_game_id AND player_id = p_player_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_victory_points(UUID, UUID, INTEGER) FROM authenticated, anon;

-- 8. Update advance_controversy_phase to handle type-aware status transitions
-- For Clash/Endeavour: controversy goes from 'declared' straight to 'voting' (SL calls declare_controversy_open)
-- For Schism: SL calls declare_schism_action which sets status to 'voting'
-- The advance function itself doesn't change — it just sets the next controversy to 'declared',
-- and the Edge Function / SL action determines what happens next based on type.
-- So no changes needed here.
