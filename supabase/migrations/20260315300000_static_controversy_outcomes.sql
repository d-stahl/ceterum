-- Static controversy outcomes: immutable record of what happened when a controversy resolved.
-- Replaces scattered outcome columns on game_controversy_state.

-- 1. Create the outcomes table
CREATE TABLE game_controversy_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id),
  round_id UUID NOT NULL REFERENCES game_rounds(id),
  controversy_key TEXT NOT NULL,
  controversy_type TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  axis_outcomes JSONB NOT NULL DEFAULT '{}',
  faction_power_outcomes JSONB NOT NULL DEFAULT '{}',
  affinity_outcomes JSONB NOT NULL DEFAULT '{}',

  type_data JSONB NOT NULL,

  UNIQUE (round_id, controversy_key)
);

ALTER TABLE game_controversy_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view outcomes for their games"
  ON game_controversy_outcomes FOR SELECT
  USING (game_id IN (SELECT get_my_game_ids()));

-- 2. Backfill from existing resolved controversies
-- For non-vote types: copy result_data and effect columns
INSERT INTO game_controversy_outcomes (
  game_id, round_id, controversy_key, controversy_type, resolved_at,
  axis_outcomes, faction_power_outcomes, affinity_outcomes, type_data
)
SELECT
  cs.game_id,
  cs.round_id,
  cs.controversy_key,
  COALESCE(cs.controversy_type, 'vote'),
  COALESCE(cs.resolved_at, now()),
  -- Convert delta-based axis_effects_applied to before/after format
  -- For backfill, we don't have before-values, so store delta as {axis: {"before": 0, "after": delta}}
  -- This is lossy but acceptable for the handful of historical rows
  COALESCE(
    (SELECT jsonb_object_agg(
      key,
      jsonb_build_object('before', 0, 'after', value::numeric)
    ) FROM jsonb_each(cs.axis_effects_applied)),
    '{}'::jsonb
  ),
  COALESCE(
    (SELECT jsonb_object_agg(
      key,
      jsonb_build_object('before', 0, 'after', value::numeric)
    ) FROM jsonb_each(cs.faction_power_effects_applied)),
    '{}'::jsonb
  ),
  COALESCE(
    (SELECT jsonb_object_agg(
      t.player_id,
      (SELECT jsonb_object_agg(fe.key, jsonb_build_object('before', 0, 'after', fe.value::numeric))
       FROM jsonb_each(t.faction_effects) AS fe(key, value))
    ) FROM jsonb_each(cs.affinity_effects_applied) AS t(player_id, faction_effects)),
    '{}'::jsonb
  ),
  -- type_data: for non-vote, copy result_data; for vote, build from votes table
  CASE
    WHEN COALESCE(cs.controversy_type, 'vote') != 'vote' THEN
      COALESCE(cs.result_data, '{}'::jsonb)
    ELSE
      -- Vote type: build type_data from game_controversy_votes + state columns
      (SELECT jsonb_build_object(
        'senateLeaderId', gr.senate_leader_id,
        'senateLeaderDeclaration', cs.senate_leader_declaration,
        'senateLeaderBonus', (
          SELECT (count(*) - 1) * 2
          FROM game_players gp WHERE gp.game_id = cs.game_id
        ),
        'winningResolutionKey', cs.winning_resolution_key,
        'votes', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
            'playerId', v.player_id,
            'resolutionKey', v.resolution_key,
            'influenceSpent', v.influence_spent
          ))
          FROM game_controversy_votes v
          WHERE v.round_id = cs.round_id AND v.controversy_key = cs.controversy_key),
          '[]'::jsonb
        ),
        'resolutionTotals', '{}'::jsonb
      )
      FROM game_rounds gr WHERE gr.id = cs.round_id)
  END
FROM game_controversy_state cs
WHERE cs.status = 'resolved';

-- 3. Drop outcome columns from game_controversy_state
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS result_data;
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS axis_effects_applied;
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS faction_power_effects_applied;
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS affinity_effects_applied;
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS winning_resolution_key;
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS winning_total_influence;
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS resolved_at;
-- controversy_type is also unused: type is always looked up from game_controversy_snapshots
ALTER TABLE game_controversy_state DROP COLUMN IF EXISTS controversy_type;
