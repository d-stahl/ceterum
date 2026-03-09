-- Worker balance redesign: new resolve_demagogery with affinity changes support
-- and net-delta power clamping (sum all deltas before clamping, not one-by-one)

-- Drop the old function signature first (3 params → 4 params)
DROP FUNCTION IF EXISTS resolve_demagogery(UUID, JSONB, JSONB);

CREATE OR REPLACE FUNCTION resolve_demagogery(
  p_game_id UUID,
  p_influence_changes JSONB,
  p_power_changes JSONB,
  p_affinity_changes JSONB  -- { playerId: { factionKey: delta } }
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round RECORD;
  v_player RECORD;
  v_faction RECORD;
  v_player_id UUID;
  v_faction_key TEXT;
  v_delta INT;
  v_affinity_entry RECORD;
  v_faction_entry RECORD;
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

  -- Apply faction power changes (net-delta, clamp 1-5)
  FOR v_faction IN SELECT * FROM jsonb_each(p_power_changes)
  LOOP
    UPDATE game_factions
    SET power_level = GREATEST(1, LEAST(5, power_level + (v_faction.value)::int))
    WHERE game_id = p_game_id AND faction_key = v_faction.key;
  END LOOP;

  -- Apply affinity changes: { playerId: { factionKey: delta } }
  IF p_affinity_changes IS NOT NULL THEN
    FOR v_affinity_entry IN SELECT * FROM jsonb_each(p_affinity_changes)
    LOOP
      v_player_id := (v_affinity_entry.key)::uuid;
      FOR v_faction_entry IN SELECT * FROM jsonb_each(v_affinity_entry.value)
      LOOP
        v_faction_key := v_faction_entry.key;
        v_delta := (v_faction_entry.value)::int;
        UPDATE game_player_faction_affinity gpa
        SET affinity = GREATEST(-5, LEAST(5, gpa.affinity + v_delta))
        FROM game_factions gf
        WHERE gpa.game_id = p_game_id
          AND gpa.player_id = v_player_id
          AND gf.id = gpa.faction_id
          AND gf.game_id = p_game_id
          AND gf.faction_key = v_faction_key;
      END LOOP;
    END LOOP;
  END IF;

  -- Transition to leader_election
  UPDATE game_rounds
  SET phase = 'leader_election'
  WHERE id = v_round.id;
END;
$$;

REVOKE ALL ON FUNCTION resolve_demagogery(UUID, JSONB, JSONB, JSONB) FROM authenticated, anon;
