-- Leader Election Phase
-- Replace auto-select Senate Leader with interactive vote-based election.
-- Phase flow: demagogery → demagogery_resolved → leader_election → ruling_pool → ...

-- 1. Add 'leader_election' to allowed phases
ALTER TABLE game_rounds DROP CONSTRAINT IF EXISTS game_rounds_phase_check;
ALTER TABLE game_rounds ADD CONSTRAINT game_rounds_phase_check
  CHECK (phase IN (
    'demagogery',
    'demagogery_resolved',
    'leader_election',     -- NEW: every player votes for a candidate
    'ruling_selection',    -- legacy: kept for in-flight games
    'ruling_pool',
    'ruling_voting_1',
    'ruling_voting_2',
    'round_end',
    'completed'
  ));

-- 2. Update resolve_demagogery to transition to leader_election instead of ruling_selection
CREATE OR REPLACE FUNCTION resolve_demagogery(
  p_game_id UUID,
  p_influence_changes JSONB,
  p_power_changes JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_player RECORD;
  v_faction RECORD;
BEGIN
  -- Get current round
  SELECT * INTO v_round
  FROM game_rounds
  WHERE game_id = p_game_id
  ORDER BY round_number DESC
  LIMIT 1;

  IF v_round IS NULL OR v_round.phase != 'demagogery_resolved' THEN
    RAISE EXCEPTION 'Game is not in demagogery_resolved phase';
  END IF;

  -- Apply influence changes
  FOR v_player IN SELECT * FROM jsonb_each(p_influence_changes)
  LOOP
    UPDATE game_player_state
    SET influence = influence + (v_player.value)::int
    WHERE game_id = p_game_id AND player_id = (v_player.key)::uuid;
  END LOOP;

  -- Apply faction power changes (floor at 1)
  FOR v_faction IN SELECT * FROM jsonb_each(p_power_changes)
  LOOP
    UPDATE game_factions
    SET power_level = GREATEST(1, power_level + (v_faction.value)::int)
    WHERE game_id = p_game_id AND faction_key = v_faction.key;
  END LOOP;

  -- Transition to leader_election (was ruling_selection)
  UPDATE game_rounds
  SET phase = 'leader_election'
  WHERE id = v_round.id;
END;
$$;

REVOKE ALL ON FUNCTION resolve_demagogery(UUID, JSONB, JSONB) FROM authenticated, anon;

-- 3. Create submit_leader_vote RPC
-- Reuses game_support_pledges table with pledge_round = 1.
CREATE OR REPLACE FUNCTION submit_leader_vote(
  p_game_id UUID,
  p_candidate_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_caller_id UUID;
  v_total_players INT;
  v_submitted INT;
BEGIN
  -- Get caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current round with lock
  SELECT * INTO v_round
  FROM game_rounds
  WHERE game_id = p_game_id
  ORDER BY round_number DESC
  LIMIT 1
  FOR UPDATE;

  IF v_round IS NULL OR v_round.phase != 'leader_election' THEN
    RAISE EXCEPTION 'Game is not in leader_election phase';
  END IF;

  -- Validate caller is a game member
  IF NOT EXISTS (
    SELECT 1 FROM game_player_state
    WHERE game_id = p_game_id AND player_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'You are not a member of this game';
  END IF;

  -- Validate candidate is a game member
  IF NOT EXISTS (
    SELECT 1 FROM game_player_state
    WHERE game_id = p_game_id AND player_id = p_candidate_id
  ) THEN
    RAISE EXCEPTION 'Candidate is not a member of this game';
  END IF;

  -- Insert vote (UNIQUE constraint on round_id, pledger_id, pledge_round handles dedup)
  INSERT INTO game_support_pledges (game_id, round_id, pledger_id, candidate_id, pledge_round)
  VALUES (p_game_id, v_round.id, v_caller_id, p_candidate_id, 1);

  -- Count total players and submitted votes
  SELECT COUNT(*) INTO v_total_players
  FROM game_player_state
  WHERE game_id = p_game_id;

  SELECT COUNT(*) INTO v_submitted
  FROM game_support_pledges
  WHERE round_id = v_round.id AND pledge_round = 1;

  IF v_submitted >= v_total_players THEN
    RETURN jsonb_build_object('status', 'ready_for_resolution');
  ELSE
    RETURN jsonb_build_object('status', 'waiting', 'submitted', v_submitted, 'total', v_total_players);
  END IF;
END;
$$;

-- Note: NOT revoked from authenticated — called via anonClient with user JWT
-- (same pattern as submit_pledge). The function validates membership internally.
