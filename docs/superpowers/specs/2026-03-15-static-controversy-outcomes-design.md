# Static Controversy Outcomes

## Problem

Controversy outcome screens reconstruct display data from live queries tied to the current round context. When another player advances the round, the round ID changes and vote/submission queries return nothing — causing outcomes to disappear mid-viewing.

More broadly, outcome data is scattered: some in `game_controversy_state` columns, some in separate tables (`game_controversy_votes`), some computed at display time. There's no single immutable record of what happened.

## Solution

A new `game_controversy_outcomes` table stores a complete, immutable record of each resolved controversy. Written once at resolution time, never updated. All values are absolute (before/after) so outcomes are fully self-contained — no need to query live game state or compute deltas.

Outcome-related columns are removed from `game_controversy_state`, which becomes purely a lifecycle tracker.

## Schema

### New table: `game_controversy_outcomes`

```sql
CREATE TABLE game_controversy_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id),
  round_id UUID NOT NULL REFERENCES game_rounds(id),
  controversy_key TEXT NOT NULL,
  controversy_type TEXT NOT NULL,  -- 'vote' | 'endeavour' | 'clash' | 'schism'
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
```

### Universal outcome fields

**`axis_outcomes`** — absolute before/after for each affected axis:
```json
{
  "commerce": { "before": 0.5, "after": 1.5 },
  "militarism": { "before": -1, "after": 0 }
}
```
Only axes that changed are included. Axes are stored as their actual numeric values (range -2 to +2).

**`faction_power_outcomes`** — absolute before/after for each affected faction:
```json
{
  "optimates": { "before": 3, "after": 4 },
  "populares": { "before": 2, "after": 1 }
}
```
Only factions whose power changed are included. Power is always an integer (range 1-5).

**`affinity_outcomes`** — absolute before/after for each affected player-faction pair:
```json
{
  "player-uuid-1": {
    "optimates": { "before": 1, "after": 2 },
    "populares": { "before": 0, "after": -1 }
  }
}
```
Only players/factions with changes are included. Affinity is an integer (range -5 to +5).

### `type_data` by controversy type

**Vote:**
```json
{
  "senateLeaderId": "uuid",
  "senateLeaderDeclaration": "resolution_key",
  "senateLeaderBonus": 4,
  "winningResolutionKey": "resolution_key",
  "votes": [
    { "playerId": "uuid", "resolutionKey": "key", "influenceSpent": 5 }
  ],
  "resolutionTotals": {
    "resolution_a": 14,
    "resolution_b": 7,
    "resolution_c": 3
  }
}
```
`resolutionTotals` includes the SL bonus in the declared resolution's total.

**Endeavour:**
```json
{
  "threshold": 40,
  "totalInvested": 45,
  "succeeded": true,
  "rankings": [
    { "playerId": "uuid", "rank": 1, "invested": 20, "vpAwarded": 2, "influenceAwarded": 10 }
  ]
}
```

**Clash:**
```json
{
  "threshold": 8,
  "committedPower": 9,
  "totalAvailablePower": 12,
  "succeeded": true,
  "factionAssignments": [
    {
      "factionKey": "optimates",
      "amplifiedPower": 6,
      "winners": [{ "playerId": "uuid", "bidAmount": 3 }]
    }
  ],
  "committers": ["uuid1", "uuid2"],
  "withdrawers": ["uuid3"],
  "victoryPoints": 2
}
```
`threshold` and `committedPower` are stored as floored integers. `bidAmount` is the raw influence spent (not the computed bid strength). `amplifiedPower` is the faction's power after applying the clash amplifier. The engine floors both values before comparison: `floor(committedPower) >= floor(threshold)`.

**Schism:**
```json
{
  "slDeclaredSideKey": "side_a",
  "winningSideKey": "side_b",
  "wasSabotaged": true,
  "teamMembers": ["uuid1", "uuid2"],
  "supporters": ["uuid1"],
  "saboteurs": ["uuid2"],
  "victoryPoints": 1
}
```

## Columns removed from `game_controversy_state`

These columns move into `game_controversy_outcomes` and are dropped from `game_controversy_state`:

- `result_data`
- `axis_effects_applied`
- `faction_power_effects_applied`
- `affinity_effects_applied`
- `winning_resolution_key`
- `winning_total_influence`
- `resolved_at`

What remains on `game_controversy_state`:

| Column | Purpose |
|--------|---------|
| `status` | Lifecycle: pending / declared / voting / resolved |
| `senate_leader_declaration` | SL's declared resolution key (vote type, during voting phase) |
| `schism_declared_side` | SL's chosen side key (schism type, during voting phase) |
| `schism_team_members` | Selected team UUIDs (schism type, during voting phase) |

## Edge Function changes

Each edge function's resolution path changes to:

1. **Snapshot before-values** for axes, faction powers, and affinities (already fetched for engine computation; affinities need an additional fetch before applying changes)
2. **Apply effects** to game state (unchanged)
3. **Compute after-values** from before + delta (no extra DB read needed)
4. **Insert one row** into `game_controversy_outcomes` with absolute before/after values and type-specific data
5. **Update `game_controversy_state`** to just `status = 'resolved'`

The before-values for axes and faction powers are already fetched in parallel at the start of each edge function. Affinity before-values are already fetched for the `computeAffinityEffects` call. After-values are computed from before + delta without an extra DB read.

**Vote-specific note:** The SL bonus (`(totalPlayers - 1) * 2`) is not currently returned by `resolveControversyVotes`. The edge function computes it from the player count and stores it in `type_data.senateLeaderBonus`. `resolutionTotals` is computed from the votes plus the SL bonus on the declared resolution.

## Clash engine change

In `clash.ts` (`resolveClash`), floor the threshold and committedPower for the comparison:

```typescript
const succeeded = Math.floor(committedPower) >= Math.floor(threshold);
```

Store the floored values in the outcome record. This applies to both `mobile/lib/game-engine/clash.ts` and `supabase/functions/_shared/game-engine/clash.ts`.

## UI changes

Outcome screens read from `game_controversy_outcomes` instead of reconstructing from multiple sources.

**ControversyVoting.tsx (vote type):**
- On `status === 'resolved'`, fetch the outcome row from `game_controversy_outcomes`
- Pass `type_data.votes`, `type_data.resolutionTotals`, etc. to `ResolutionOutcome`
- No more live query of `game_controversy_votes` for display
- `AxisEffectSlider` receives absolute before/after from `axis_outcomes` — no more computing `currentValue - change`

**EndeavourVoting / ClashVoting / SchismVoting:**
- On `status === 'resolved'`, fetch the outcome row
- Read all display data from `type_data`, `axis_outcomes`, `faction_power_outcomes`
- Same pattern across all types

**Game screen (`[id].tsx`):**
- The `roundEndSnapshot` race condition is resolved: outcome data lives in its own table with its own query, independent of which round the client thinks it's on
- The `controversyStates` snapshot logic can be simplified since outcomes are self-contained

**OnTheHorizon / ControversyCard:**
- Resolved controversy cards can read from `game_controversy_outcomes` for their effect display instead of the removed columns on `game_controversy_state`

## Migration strategy

This is a local dev environment where migration and code deploy happen atomically (stop Supabase, run migration, deploy functions, restart). No expand-contract pattern needed.

1. Create `game_controversy_outcomes` table with RLS
2. Backfill existing resolved controversies from current `game_controversy_state` columns + `game_controversy_votes` data (only a handful of rows in active games)
3. Drop removed columns from `game_controversy_state`
4. Update all four edge functions to write outcome rows
5. Update UI components to read from `game_controversy_outcomes`

Steps 1-3 are a single migration. Steps 4-5 are code changes deployed together with the migration.

**Note on `resolved_at` removal:** The game screen's `loadAllResolvedControversies` query currently orders by `resolved_at` on `game_controversy_state`. This query must be updated to join or read from `game_controversy_outcomes` instead.
