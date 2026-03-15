# Static Controversy Outcomes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered, live-queried outcome data with a single immutable `game_controversy_outcomes` table written at resolution time.

**Architecture:** Each edge function snapshots before-values, applies effects, then writes one outcome row with absolute before/after values. UI reads outcomes from this table instead of reconstructing from live state. `game_controversy_state` becomes lifecycle-only.

**Tech Stack:** PostgreSQL (migration), Deno Edge Functions (4 functions), React Native (5 UI components), TypeScript game engine (clash.ts floor change)

**Spec:** `docs/superpowers/specs/2026-03-15-static-controversy-outcomes-design.md`

---

## Chunk 1: Engine Change + Migration

### Task 1: Floor clash threshold/committedPower in engine

**Files:**
- Modify: `mobile/lib/game-engine/clash.ts:130`
- Modify: `supabase/functions/_shared/game-engine/clash.ts` (same change)
- Test: `mobile/lib/game-engine/__tests__/clash.test.ts`

- [ ] **Step 1: Update the comparison in `resolveClash`**

In `mobile/lib/game-engine/clash.ts`, change line 130 from:
```typescript
const succeeded = committedPower >= threshold;
```
to:
```typescript
const succeeded = Math.floor(committedPower) >= Math.floor(threshold);
```

And update the return to store floored values:
```typescript
committedPower: Math.floor(committedPower),
// ...
threshold: Math.floor(threshold),
```

- [ ] **Step 2: Apply the same change to the Deno copy**

In `supabase/functions/_shared/game-engine/clash.ts`, make the identical changes. This file has `.ts` import extensions but identical logic.

- [ ] **Step 3: Run clash tests**

Run: `cd mobile && npx jest clash --verbose`
Expected: All existing tests pass. The flooring doesn't change outcomes for the integer test inputs currently used.

- [ ] **Step 4: Add a test for fractional threshold flooring**

In `mobile/lib/game-engine/__tests__/clash.test.ts`, add:
```typescript
it('floors threshold and committedPower to integers', () => {
  // Use a threshold percent that produces a fractional value
  // totalAvailablePower in standard test is 16, so 0.33 → 5.28, floored to 5
  const fracConfig: ClashConfig = {
    ...config,
    thresholdPercent: 0.33,
  };
  const result = resolveClash(submissions, fracConfig, factionPowers, affinities);
  expect(Number.isInteger(result.threshold)).toBe(true);
  expect(Number.isInteger(result.committedPower)).toBe(true);
  expect(result.threshold).toBe(5); // floor(16 * 0.33) = floor(5.28) = 5
});
```

- [ ] **Step 5: Run tests**

Run: `cd mobile && npx jest clash --verbose`
Expected: All tests pass including new one.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/game-engine/clash.ts mobile/lib/game-engine/__tests__/clash.test.ts supabase/functions/_shared/game-engine/clash.ts
git commit -m "fix(clash): floor threshold and committedPower to integers"
```

---

### Task 2: Create migration — new table + drop old columns

**Files:**
- Create: `supabase/migrations/20260315300000_static_controversy_outcomes.sql`

This migration: creates the outcomes table, backfills from existing data, drops removed columns from `game_controversy_state`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260315300000_static_controversy_outcomes.sql`:

```sql
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
      player_id,
      (SELECT jsonb_object_agg(fk, jsonb_build_object('before', 0, 'after', fv::numeric))
       FROM jsonb_each(faction_effects))
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
```

- [ ] **Step 2: Apply the migration**

Run: `cd /home/daniel/ceterum/app && npx supabase db push --local`
Expected: Migration applies successfully.

- [ ] **Step 3: Verify the table exists and backfill worked**

Run:
```bash
docker exec supabase_db_app psql -U postgres -d postgres -c "SELECT controversy_key, controversy_type, resolved_at FROM game_controversy_outcomes ORDER BY resolved_at;"
```
Expected: Rows for each previously-resolved controversy.

Run:
```bash
docker exec supabase_db_app psql -U postgres -d postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'game_controversy_state' ORDER BY ordinal_position;"
```
Expected: Only `round_id`, `controversy_key`, `game_id`, `status`, `senate_leader_declaration`, `schism_declared_side`, `schism_team_members`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260315300000_static_controversy_outcomes.sql
git commit -m "migration: add game_controversy_outcomes table, drop old columns"
```

---

## Chunk 2: Edge Functions

### Task 3: Update submit-controversy-vote edge function

**Files:**
- Modify: `supabase/functions/submit-controversy-vote/index.ts`

The vote edge function is the most complex because it needs to:
- Build the votes array for `type_data`
- Compute `resolutionTotals` including SL bonus
- Snapshot axis/power/affinity before-values
- Compute after-values

- [ ] **Step 1: Update the resolution section**

In `supabase/functions/submit-controversy-vote/index.ts`, replace the section from "Mark controversy resolved" through the `advance_controversy_phase` call.

The key changes:
1. Before applying effects, capture before-values for axes (`axesRes.data`) and factions (`factionsRes.data`) — these are already fetched.
2. After applying axis effects and faction power effects, compute after-values from before + delta.
3. For affinities: capture before-values from `currentAffinities` (already fetched), compute after from before + delta.
4. Build `type_data` with votes from `votesRes.data`, SL info from `round.senate_leader_id` and `csState.senate_leader_declaration`, compute `resolutionTotals` and `senateLeaderBonus`.
5. Insert into `game_controversy_outcomes` instead of updating multiple columns on `game_controversy_state`.
6. Update `game_controversy_state` to just `status = 'resolved'`.

The full updated resolution section (from after the `resolveControversyVotes` call to end of try block):

```typescript
    // Build before-values maps
    const axisBefore: Record<string, number> = {};
    for (const row of (axesRes.data ?? [])) {
      axisBefore[row.axis_key] = row.current_value;
    }
    const factionPowerBefore: Record<string, number> = {};
    for (const f of (factionsRes.data ?? [])) {
      factionPowerBefore[f.faction_key] = f.power_level;
    }

    // Apply axis effects
    const { error: axisError } = await adminClient.rpc('apply_axis_effects', {
      p_game_id: game_id,
      p_axis_effects: result.axisEffects,
    });
    if (axisError) throw axisError;

    // Apply faction power effects
    const factions = factionsRes.data ?? [];
    for (const [factionKey, powerChange] of Object.entries(result.factionPowerEffects)) {
      if (!powerChange) continue;
      const faction = factions.find((f: any) => f.faction_key === factionKey);
      if (!faction) continue;
      const newPower = Math.max(1, faction.power_level + powerChange);
      await adminClient
        .from('game_factions')
        .update({ power_level: newPower })
        .eq('game_id', game_id)
        .eq('faction_key', factionKey);
    }

    // Compute affinity effects
    const malusMap = computeAffinityEffects(
      engineVotes,
      result.winningResolutionKey,
      result.axisEffects as Partial<Record<AxisKey, number>>,
      engineFactions,
      axisValues as Partial<Record<AxisKey, number>>,
      round.senate_leader_id,
    );

    // Capture affinity before-values and apply
    const affinityBefore: Record<string, Record<string, number>> = {};
    if (Object.keys(malusMap).length > 0) {
      const affectedPlayerIds = Object.keys(malusMap);
      const { data: currentAffinities, error: affError } = await adminClient
        .from('game_player_faction_affinity')
        .select('player_id, faction_id, affinity, game_factions!inner(faction_key)')
        .eq('game_id', game_id)
        .in('player_id', affectedPlayerIds);
      if (affError) throw affError;

      // Snapshot before
      for (const aff of (currentAffinities ?? [])) {
        const pid = aff.player_id;
        const fkey = (aff as any).game_factions.faction_key;
        if (!affinityBefore[pid]) affinityBefore[pid] = {};
        affinityBefore[pid][fkey] = aff.affinity;
      }

      // Apply
      for (const [playerId, factionMalus] of Object.entries(malusMap)) {
        for (const [factionKey, malus] of Object.entries(factionMalus)) {
          const aff = (currentAffinities ?? []).find(
            (a: any) => a.player_id === playerId && a.game_factions.faction_key === factionKey,
          );
          if (!aff) continue;
          const newAffinity = Math.max(-5, Math.min(5, aff.affinity + malus));
          await adminClient
            .from('game_player_faction_affinity')
            .update({ affinity: newAffinity })
            .eq('game_id', game_id)
            .eq('player_id', playerId)
            .eq('faction_id', aff.faction_id);
        }
      }
    }

    // Build outcome record
    const axisOutcomes: Record<string, { before: number; after: number }> = {};
    for (const [axis, delta] of Object.entries(result.axisEffects)) {
      if (!delta) continue;
      const before = axisBefore[axis] ?? 0;
      axisOutcomes[axis] = { before, after: before + delta };
    }

    const factionPowerOutcomes: Record<string, { before: number; after: number }> = {};
    for (const [fkey, delta] of Object.entries(result.factionPowerEffects)) {
      if (!delta) continue;
      const before = factionPowerBefore[fkey] ?? 3;
      factionPowerOutcomes[fkey] = { before, after: Math.max(1, before + delta) };
    }

    const affinityOutcomes: Record<string, Record<string, { before: number; after: number }>> = {};
    for (const [playerId, factionDeltas] of Object.entries(malusMap)) {
      affinityOutcomes[playerId] = {};
      for (const [factionKey, delta] of Object.entries(factionDeltas)) {
        const before = affinityBefore[playerId]?.[factionKey] ?? 0;
        affinityOutcomes[playerId][factionKey] = {
          before,
          after: Math.max(-5, Math.min(5, before + delta)),
        };
      }
    }

    // Build vote type_data
    const slBonus = (totalPlayers - 1) * 2;
    const resolutionTotals: Record<string, number> = {};
    for (const r of controversy.resolutions) {
      resolutionTotals[r.key] = 0;
    }
    for (const v of (votesRes.data ?? [])) {
      resolutionTotals[v.resolution_key] = (resolutionTotals[v.resolution_key] ?? 0) + v.influence_spent;
    }
    if (csState.senate_leader_declaration) {
      resolutionTotals[csState.senate_leader_declaration] =
        (resolutionTotals[csState.senate_leader_declaration] ?? 0) + slBonus;
    }

    const typeData = {
      senateLeaderId: round.senate_leader_id,
      senateLeaderDeclaration: csState.senate_leader_declaration,
      senateLeaderBonus: slBonus,
      winningResolutionKey: result.winningResolutionKey,
      votes: (votesRes.data ?? []).map((v: any) => ({
        playerId: v.player_id,
        resolutionKey: v.resolution_key,
        influenceSpent: v.influence_spent,
      })),
      resolutionTotals,
    };

    // Insert outcome
    const { error: outcomeError } = await adminClient
      .from('game_controversy_outcomes')
      .insert({
        game_id,
        round_id: round.id,
        controversy_key,
        controversy_type: 'vote',
        axis_outcomes: axisOutcomes,
        faction_power_outcomes: factionPowerOutcomes,
        affinity_outcomes: affinityOutcomes,
        type_data: typeData,
      });
    if (outcomeError) throw outcomeError;

    // Register follow-up controversy if unlocked
    // ... (keep existing follow-up logic unchanged)

    // Mark controversy resolved (lifecycle only)
    await adminClient
      .from('game_controversy_state')
      .update({ status: 'resolved' })
      .eq('round_id', round.id)
      .eq('controversy_key', controversy_key);

    // Advance to next controversy or round end
    // ... (keep existing advance logic unchanged)
```

- [ ] **Step 2: Verify the function compiles**

Run: `deno check supabase/functions/submit-controversy-vote/index.ts` or restart Supabase functions and test.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/submit-controversy-vote/index.ts
git commit -m "refactor(vote): write outcome to game_controversy_outcomes"
```

---

### Task 4: Update submit-endeavour edge function

**Files:**
- Modify: `supabase/functions/submit-endeavour/index.ts`

Same pattern as vote but simpler — `result_data` fields move into `type_data`, and we build before/after maps for axes, powers, affinities.

- [ ] **Step 1: Update the resolution section**

Apply the same pattern: snapshot before-values (already fetched), apply effects (unchanged), build outcome record, insert into `game_controversy_outcomes`, update `game_controversy_state` to just `status = 'resolved'`.

`type_data` for endeavour:
```typescript
const typeData = {
  threshold: result.threshold,
  totalInvested: result.totalInvested,
  succeeded: result.succeeded,
  rankings: result.rankings,
};
```

The axis/power/affinity outcome building is identical to the vote function pattern above.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/submit-endeavour/index.ts
git commit -m "refactor(endeavour): write outcome to game_controversy_outcomes"
```

---

### Task 5: Update submit-clash edge function

**Files:**
- Modify: `supabase/functions/submit-clash/index.ts`

- [ ] **Step 1: Update the resolution section**

Same pattern. `type_data` for clash:
```typescript
const typeData = {
  threshold: result.threshold,        // already floored by engine
  committedPower: result.committedPower, // already floored by engine
  totalAvailablePower: result.totalAvailablePower,
  succeeded: result.succeeded,
  factionAssignments: result.factionAssignments.map((a: any) => ({
    factionKey: a.factionKey,
    amplifiedPower: a.amplifiedPower,
    winners: a.winners.map((w: any) => ({
      playerId: w.playerId,
      bidAmount: /* raw bid from submissions */ submissions.find(
        (s) => s.playerId === w.playerId
      )?.factionBids[a.factionKey] ?? 0,
    })),
  })),
  committers: result.committers,
  withdrawers: result.withdrawers,
  victoryPoints: result.victoryPoints,
};
```

Note: `bidAmount` is the raw influence bid, extracted from `submissions` (the `factionBids` field), not the computed `bidStrength` from the engine.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/submit-clash/index.ts
git commit -m "refactor(clash): write outcome to game_controversy_outcomes"
```

---

### Task 6: Update submit-schism edge function

**Files:**
- Modify: `supabase/functions/submit-schism/index.ts`

- [ ] **Step 1: Update the resolution section**

Same pattern. `type_data` for schism:
```typescript
const typeData = {
  slDeclaredSideKey: result.slDeclaredSideKey,
  winningSideKey: result.winningSideKey,
  wasSabotaged: result.wasSabotaged,
  teamMembers: result.teamMembers,
  supporters: result.supporters,
  saboteurs: result.saboteurs,
  victoryPoints: result.victoryPoints,
};
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/submit-schism/index.ts
git commit -m "refactor(schism): write outcome to game_controversy_outcomes"
```

---

## Chunk 3: UI — Vote Outcome

### Task 7: Update ControversyVoting to read from outcomes table

**Files:**
- Modify: `mobile/components/ControversyVoting.tsx`

This is the biggest UI change. Currently the resolved section fetches votes live from `game_controversy_votes` and reconstructs totals. After this change, it reads everything from `game_controversy_outcomes`.

- [ ] **Step 1: Add outcome fetching**

Replace the `fetchVotes` callback and the votes state with an outcome fetch. Add a new state:
```typescript
const [outcome, setOutcome] = useState<any>(null);
```

Add a `fetchOutcome` callback:
```typescript
const fetchOutcome = useCallback(async () => {
  const { data } = await supabase
    .from('game_controversy_outcomes')
    .select('type_data, axis_outcomes, faction_power_outcomes, affinity_outcomes')
    .eq('round_id', roundId)
    .eq('controversy_key', controversyKey)
    .single();
  if (data) setOutcome(data);
}, [roundId, controversyKey]);
```

Call `fetchOutcome()` when status becomes `'resolved'` (replace the `fetchVotes` call in the existing useEffect).

- [ ] **Step 2: Update the resolved rendering section**

Replace the current resolved section (which builds `voteRows` from live votes and computes `resolutionTotals`) with one that reads from `outcome.type_data`:

```typescript
if (status === 'resolved' && outcome) {
  const td = outcome.type_data;
  const voteRows = (td.votes ?? []).map((v: any) => {
    const player = players.find((p) => p.player_id === v.playerId);
    return {
      playerId: v.playerId,
      playerName: player?.player_name ?? 'Unknown',
      playerColor: player?.color ?? C.gray,
      resolutionKey: v.resolutionKey,
      influenceSpent: v.influenceSpent,
    };
  });

  // Convert axis_outcomes to the format ResolutionOutcome expects
  const axisEffects: Record<string, number> = {};
  const axisValues: Record<string, number> = {};
  for (const [axis, vals] of Object.entries(outcome.axis_outcomes as Record<string, { before: number; after: number }>)) {
    axisEffects[axis] = vals.after - vals.before;
    axisValues[axis] = vals.before; // pre-resolution value for slider
  }

  const factionPowerEffects: Record<string, number> = {};
  for (const [fkey, vals] of Object.entries(outcome.faction_power_outcomes as Record<string, { before: number; after: number }>)) {
    factionPowerEffects[fkey] = vals.after - vals.before;
  }

  // Flatten affinity outcomes to delta format for ResolutionOutcome
  const affinityEffects: Record<string, Record<string, number>> = {};
  for (const [pid, factions] of Object.entries(outcome.affinity_outcomes as Record<string, Record<string, { before: number; after: number }>>)) {
    affinityEffects[pid] = {};
    for (const [fkey, vals] of Object.entries(factions)) {
      affinityEffects[pid][fkey] = vals.after - vals.before;
    }
  }

  return (
    <ResolutionOutcome
      controversy={controversy}
      resolutionTotals={td.resolutionTotals}
      winningResolutionKey={td.winningResolutionKey}
      senateLeaderDeclaration={td.senateLeaderDeclaration ?? ''}
      senateLeaderBonus={td.senateLeaderBonus}
      votes={voteRows}
      axisEffects={axisEffects}
      factionPowerEffects={factionPowerEffects}
      affinityEffects={affinityEffects}
      axisValues={axisValues}
      factionInfoMap={factionInfoMap}
      players={players}
      playerAgendas={playerAgendas}
      onContinue={onContinue}
    />
  );
}
```

- [ ] **Step 3: Remove dead code**

Remove:
- The `votes` state and `fetchVotes` callback
- The Realtime subscription on `game_controversy_votes` (no longer needed for display)
- The `slDeclaration` usage in the resolved section (now from `outcome.type_data`)
- Unused `ControversyStateRow` fields: `winning_resolution_key`, `winning_total_influence`, `axis_effects_applied`, `faction_power_effects_applied`, `affinity_effects_applied`

Update `ControversyStateRow` type to only have:
```typescript
type ControversyStateRow = {
  status: string;
  senate_leader_declaration: string | null;
};
```

Update `fetchState` select to only fetch: `'status, senate_leader_declaration'`.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/ControversyVoting.tsx
git commit -m "refactor(vote-ui): read outcome from game_controversy_outcomes"
```

---

## Chunk 4: UI — Non-Vote Outcomes

### Task 8: Update EndeavourVoting resolved section

**Files:**
- Modify: `mobile/components/EndeavourVoting.tsx`

- [ ] **Step 1: Add outcome fetching**

Same pattern as Task 7: add `outcome` state, `fetchOutcome` callback fetching from `game_controversy_outcomes`, call it when status is `'resolved'`.

- [ ] **Step 2: Update resolved rendering**

Replace the resolved section to read from `outcome.type_data` and `outcome.axis_outcomes` / `outcome.faction_power_outcomes`. Convert before/after to deltas for the existing `AxisEffectSlider` and `PowerEffectRow` components, using `before` as the slider's `currentValue`.

- [ ] **Step 3: Simplify ControversyStateRow**

Remove `axis_effects_applied`, `faction_power_effects_applied`, `result_data` from the type. Update `fetchState` select to only: `'status'`.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/EndeavourVoting.tsx
git commit -m "refactor(endeavour-ui): read outcome from game_controversy_outcomes"
```

---

### Task 9: Update ClashVoting resolved section

**Files:**
- Modify: `mobile/components/ClashVoting.tsx`

- [ ] **Step 1: Same pattern as Task 8**

Add outcome fetching, update resolved rendering, simplify state type.

- [ ] **Step 2: Commit**

```bash
git add mobile/components/ClashVoting.tsx
git commit -m "refactor(clash-ui): read outcome from game_controversy_outcomes"
```

---

### Task 10: Update SchismVoting resolved section

**Files:**
- Modify: `mobile/components/SchismVoting.tsx`

- [ ] **Step 1: Same pattern as Task 8**

Add outcome fetching, update resolved rendering, simplify state type. Note: SchismVoting's `ControversyStateRow` also has `schism_declared_side` and `schism_team_members` — these stay (needed during voting phase).

- [ ] **Step 2: Commit**

```bash
git add mobile/components/SchismVoting.tsx
git commit -m "refactor(schism-ui): read outcome from game_controversy_outcomes"
```

---

## Chunk 5: Game Screen + Cleanup

### Task 11: Update game screen to use outcomes table

**Files:**
- Modify: `mobile/app/(app)/game/[id].tsx`

The game screen uses `controversyStates` for two things:
1. Determining which controversy is active (by status) — keeps working, status is still on `game_controversy_state`
2. Showing resolved controversy effects in OnTheHorizon cards — needs to read from `game_controversy_outcomes`
3. The `roundEndSnapshot` race condition — resolved by outcomes being in their own table

- [ ] **Step 1: Update `ControversyStateRow` type**

Change to:
```typescript
type ControversyStateRow = {
  controversy_key: string;
  status: string;
};
```

- [ ] **Step 2: Update `loadControversyStates`**

Simplify the select:
```typescript
const { data } = await supabase
  .from('game_controversy_state')
  .select('controversy_key, status')
  .eq('round_id', currentRound.id);
```

- [ ] **Step 3: Update `loadAllResolvedControversies`**

This function currently reads from `game_controversy_state` with `resolved_at` ordering. Change to read from `game_controversy_outcomes`:

```typescript
async function loadAllResolvedControversies() {
  const { data } = await supabase
    .from('game_controversy_outcomes')
    .select('controversy_key, controversy_type, axis_outcomes, faction_power_outcomes, resolved_at')
    .eq('game_id', gameId)
    .order('resolved_at', { ascending: true });
  if (data) setAllResolvedStates(data);
}
```

Update the type of `allResolvedStates` to match the new shape. Update any consumers of this data (OnTheHorizon resolved info).

- [ ] **Step 4: Simplify `roundEndSnapshot`**

The snapshot no longer needs to capture `controversyStates` for outcome display — outcomes are in their own stable table. The snapshot only needs to track which controversies exist and their status (for the undismissed-resolved check). The fresh-fetch fix from earlier in this session can be simplified.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(app)/game/[id].tsx
git commit -m "refactor(game-screen): read outcomes from game_controversy_outcomes"
```

---

### Task 12: Update ControversyCard for resolved display

**Files:**
- Modify: `mobile/components/ControversyCard.tsx`

- [ ] **Step 1: Update `ResolvedInfo` type**

The `ResolvedInfo` type currently has `axisEffects` and `factionPowerEffects` as delta maps. Update to accept before/after format from `game_controversy_outcomes`, or convert at the call site. The simplest approach: convert at the call site in `[id].tsx` where `allResolvedStates` feeds into the card, keeping ControversyCard's interface unchanged.

If the call site conversion is done in Task 11, no changes needed here.

- [ ] **Step 2: Commit (if changes needed)**

```bash
git add mobile/components/ControversyCard.tsx
git commit -m "refactor(controversy-card): adapt to outcomes table data"
```

---

### Task 13: End-to-end test

- [ ] **Step 1: Restart Supabase and Expo**

```bash
cd /home/daniel/ceterum/app && npx supabase stop && npx supabase start
```

Restart Expo dev server.

- [ ] **Step 2: Play through a controversy resolution**

In the NNRR97 game (round 3), resolve a controversy and verify:
- Outcome screen shows correctly with all data (votes, effects, affinities)
- Another player advancing the round does NOT cause outcome data to disappear
- OnTheHorizon shows resolved controversy effects correctly
- Round-end summary works

- [ ] **Step 3: Final commit if any fixes needed**
