-- Fix apply_axis_effects to clamp to -2..+2 (matching the CHECK constraint
-- added in 20260305000000_axis_range_clamp.sql). The old -5..+5 clamp caused
-- CHECK violations when resolutions pushed axes past ±2.

CREATE OR REPLACE FUNCTION apply_axis_effects(
  p_game_id UUID,
  p_axis_effects JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_axis TEXT;
  v_shift INTEGER;
  v_applied JSONB := '{}'::JSONB;
BEGIN
  FOR v_axis, v_shift IN
    SELECT key, value::INTEGER FROM jsonb_each_text(p_axis_effects)
  LOOP
    UPDATE game_axes
    SET current_value = GREATEST(-2, LEAST(2, current_value + v_shift))
    WHERE game_id = p_game_id AND axis_key = v_axis;

    v_applied := v_applied || jsonb_build_object(v_axis, v_shift);
  END LOOP;
  RETURN v_applied;
END;
$$;

-- Re-apply REVOKE (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION apply_axis_effects(UUID, JSONB) FROM authenticated, anon;
