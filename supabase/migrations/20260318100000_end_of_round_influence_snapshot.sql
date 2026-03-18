-- Bug A: Round-end summary shows "0 → 0" because the client snapshots influence
-- from React state, which may already reflect post-halving values due to Realtime
-- race conditions. Fix: store pre-halving influence server-side on the round row
-- at the moment the round transitions to 'round_end'.

ALTER TABLE game_rounds ADD COLUMN IF NOT EXISTS end_of_round_influence JSONB;

-- Update advance_controversy_phase to snapshot influence when entering round_end.
-- Also includes the schism fix from 20260318000000 (clash → voting, else → declared).
CREATE OR REPLACE FUNCTION advance_controversy_phase(
  p_game_id UUID,
  p_round_id UUID,
  p_current_phase TEXT,
  p_second_controversy_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
  v_status TEXT;
  v_influence JSONB;
BEGIN
  IF p_current_phase = 'ruling_voting_1' THEN
    -- Look up second controversy type
    SELECT snapshot->>'type' INTO v_type
    FROM game_controversy_snapshots
    WHERE game_id = p_game_id AND controversy_key = p_second_controversy_key;

    -- clash → 'voting' (no SL declaration); vote, schism → 'declared'
    v_status := CASE WHEN v_type = 'clash' THEN 'voting' ELSE 'declared' END;

    UPDATE game_controversy_state
    SET status = v_status
    WHERE round_id = p_round_id AND controversy_key = p_second_controversy_key;

    UPDATE game_rounds SET phase = 'ruling_voting_2' WHERE id = p_round_id;

    RETURN jsonb_build_object('status', 'voting_2');
  ELSE
    -- Snapshot influence before round ends (advance_round will halve it)
    SELECT jsonb_object_agg(player_id::TEXT, influence) INTO v_influence
    FROM game_player_state WHERE game_id = p_game_id;

    UPDATE game_rounds
    SET phase = 'round_end', end_of_round_influence = v_influence
    WHERE id = p_round_id;

    RETURN jsonb_build_object('status', 'round_end');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION advance_controversy_phase(UUID, UUID, TEXT, TEXT) FROM authenticated, anon;
