-- Store clash threshold at open-time so it doesn't shift when power effects resolve.
-- The threshold depends on faction power levels at the moment the SL opens the clash,
-- not the post-resolution power levels.

-- 1. Add static_data column to game_controversy_state
ALTER TABLE game_controversy_state
  ADD COLUMN IF NOT EXISTS static_data JSONB DEFAULT '{}';

-- 2. Update declare_controversy_open to compute and store the clash threshold
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
  v_snapshot JSONB;
  v_threshold_percent NUMERIC;
  v_amplifiers JSONB;
  v_total_amplified NUMERIC := 0;
  v_faction RECORD;
  v_amplifier NUMERIC;
  v_threshold NUMERIC;
  v_static JSONB := '{}';
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

  -- Look up controversy snapshot to check if it's a clash and get config
  SELECT snapshot INTO v_snapshot
  FROM game_controversy_snapshots
  WHERE game_id = p_game_id AND controversy_key = p_controversy_key;

  IF v_snapshot IS NOT NULL AND v_snapshot->>'type' = 'clash' THEN
    v_threshold_percent := (v_snapshot->'clashConfig'->>'thresholdPercent')::NUMERIC;
    v_amplifiers := COALESCE(v_snapshot->'clashConfig'->'factionAmplifiers', '{}'::JSONB);

    -- Sum amplified faction powers
    FOR v_faction IN
      SELECT faction_key, power_level
      FROM game_factions
      WHERE game_id = p_game_id
    LOOP
      v_amplifier := COALESCE((v_amplifiers->>v_faction.faction_key)::NUMERIC, 1);
      v_total_amplified := v_total_amplified + (v_faction.power_level * v_amplifier);
    END LOOP;

    v_threshold := ROUND(v_total_amplified * v_threshold_percent);
    v_static := jsonb_build_object(
      'clashThreshold', v_threshold,
      'totalAmplifiedPower', v_total_amplified
    );
  END IF;

  UPDATE game_controversy_state
  SET status = 'voting',
      static_data = v_static
  WHERE round_id = v_round.id AND controversy_key = p_controversy_key AND status = 'declared';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Controversy is not in declared state';
  END IF;

  RETURN jsonb_build_object('status', 'voting');
END;
$$;
