-- Narrow axis range from -5..+5 to -2..+2 to match agenda range.

-- 1. Clamp existing values into the new range
UPDATE game_axes SET current_value = GREATEST(-2, LEAST(2, current_value));

-- 2. Replace the CHECK constraint
ALTER TABLE game_axes DROP CONSTRAINT IF EXISTS game_axes_current_value_check;
ALTER TABLE game_axes ADD CONSTRAINT game_axes_current_value_check
  CHECK (current_value >= -2 AND current_value <= 2);

-- 3. Recreate resolve_controversy_vote with -2/+2 clamp
CREATE OR REPLACE FUNCTION resolve_controversy_vote(
  p_game_id UUID,
  p_controversy_key TEXT,
  p_winning_resolution_key TEXT,
  p_axis_effects JSONB,
  p_faction_power_effects JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_axis TEXT;
  v_shift INTEGER;
  v_fkey TEXT;
  v_pchange INTEGER;
  v_applied JSONB := '{}'::JSONB;
  v_fp_applied JSONB := '{}'::JSONB;
BEGIN
  -- Apply axis effects
  FOR v_axis, v_shift IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_axis_effects)
  LOOP
    UPDATE game_axes
    SET current_value = GREATEST(-2, LEAST(2, current_value + v_shift))
    WHERE game_id = p_game_id AND axis_key = v_axis;

    v_applied := v_applied || jsonb_build_object(v_axis, v_shift);
  END LOOP;

  -- Apply faction power effects
  FOR v_fkey, v_pchange IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_faction_power_effects)
  LOOP
    UPDATE game_factions
    SET power_level = GREATEST(0, power_level + v_pchange)
    WHERE game_id = p_game_id AND faction_key = v_fkey;

    v_fp_applied := v_fp_applied || jsonb_build_object(v_fkey, v_pchange);
  END LOOP;

  -- Mark controversy as resolved
  UPDATE game_controversy_state
  SET status = 'resolved',
      winning_resolution_key = p_winning_resolution_key,
      axis_effects_applied = v_applied,
      faction_power_effects_applied = v_fp_applied,
      resolved_at = NOW()
  WHERE game_id = p_game_id AND controversy_key = p_controversy_key;
END;
$$;
