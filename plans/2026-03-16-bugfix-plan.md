# Bugfix Plan — 2026-03-16

## Bug 1 — Outcome page axis/faction values computed from live state

**Location:** `mobile/components/ResolutionOutcome.tsx:205-221, 228-238`

**Problem:** The outcome display reverse-engineers "before" values by subtracting the delta from the **live** axis value (`(axisValues[axis] - change)`). By the time a player views the first controversy's outcome, the second controversy has already resolved, so the live values reflect both changes. Result: wrong before/after numbers (e.g. Commerce shows -1→0 instead of 0→1).

Same issue for faction power on lines 228-238: `info.power - change` uses live power.

**Fix:** Pass the stored `axis_outcomes` and `faction_power_outcomes` from `game_controversy_outcomes` into `ResolutionOutcome`. These already contain correct `{ before, after }` pairs. Replace the reverse-engineering with direct reads from the stored outcome data.

**Also check:** `ClashVoting`, `EndeavourVoting`, `SchismVoting` — do they render outcome displays with the same pattern? If so, same fix.

---

## Bug 2 — Round-end summary reads live state instead of snapshot

**Location:** `mobile/app/(app)/game/[id].tsx:1407-1424`

**Problem:** When Player 1 advances the round, Player 2 (still on "Round X Complete") sees all numbers update via Realtime. The round-end screen should show a static view of the state as it was when the round ended.

**Affected data:**
- `playerInfluences` (line 1408): reads live `playerStates` — influence changes when next round starts (halving happens in `advance_round`)
- `axes` (line 1417): passes live `axes` array — will reflect next round's changes
- `factionPowers` (line 1419): reads live `factions` power levels

**Fix:** Expand `roundEndSnapshot` (currently captures `controversyStates`, `roundNumber`, `roundId`, `initialFactionPowers`) to also capture:
- `playerStates` (influence values)
- `axes` (axis values)
- `factions` (power levels)

Snapshot these when entering `round_end` phase, then use the snapshotted values in the `RoundEndSummary` render block.

---

## Bug 3 — Demagog carry-forward never expires

**Location:** `supabase/migrations/20260314000000_fix_demagog_carry_forward_subround.sql`, lines 96-102

**Problem:** `advance_round` copies ALL demagog placements from the ending round to the new round as locked. This includes already-locked placements from the previous round. Result: demagogs accumulate forever and never leave.

**Intended behavior:** A demagog placement is a two-round commitment:
- Round N: player places demagog (fresh, `is_locked = FALSE`)
- Round N+1: carried forward as locked (`is_locked = TRUE`) — still takes effect
- Round N+2: expires — NOT carried forward

**Fix:** Change the carry-forward query filter from:
```sql
WHERE gp.round_id = v_round.id
  AND gp.worker_type = 'orator'
  AND gp.orator_role = 'demagog'
```
to:
```sql
WHERE gp.round_id = v_round.id
  AND gp.worker_type = 'orator'
  AND gp.orator_role = 'demagog'
  AND gp.is_locked = FALSE
```

Only fresh (non-locked) demagogs get carried forward. Already-locked ones have served their extra round and expire.

---

## Bug 4 — Game-over screen ignores resolution VPs + needs redesign

**Location:** `mobile/app/(app)/game/[id].tsx:905-1057`

**Problem:** Final score (line 924) only counts policy agenda alignment (`computeAxisScore`). The `victory_points` column from `game_player_state` is fetched but never added to the total. Non-vote controversies (clash, schism, endeavour) award VPs that are invisible to players.

**VP data sources (already in `game_controversy_outcomes.type_data`):**
- Clash: `type_data.victoryPoints` (awarded to ALL players on success, 0 on failure)
- Schism: `type_data.victoryPoints` + `type_data.winnerPlayerIds` (awarded to winning side only)
- Endeavour: `type_data.rankings[].vpAwarded` (per-player based on investment rank)

**Redesign spec (from user):**

```
Final Standings
1. Player — total_score
2. Player — total_score
3. Player — total_score

Score Breakdown

Policy Agenda:
  Player +n
  Player +n
  Player +n
  [Show details] → expands to show current policy axes with per-axis scoring (as current)

Resolutions:
  Player +n
  Player +n
  Player +n
  [Show details] → expands to list controversy outcomes that awarded VPs,
                    with illustration, title, outcome name, and per-player VP awards
```

**Fix:**
1. Total score = `agendaScore + victory_points` (from `game_player_state`)
2. Restructure layout into two collapsible sections:
   - **Policy Agenda**: summary line per player with total agenda score, expandable detail (current axis breakdown)
   - **Resolutions**: summary line per player with total resolution VPs, expandable detail showing each VP-awarding controversy (illustration, title, outcome, per-player VPs)
3. Use `game_controversy_outcomes` data (already loaded as `allOutcomes`) to build the resolution VP breakdown

---

## Enhancement 5 — Current standings in Players tab

**Location:** `mobile/components/PlayersPanel.tsx`

**Problem:** Players tab doesn't show VP standings during the game. From memory: "Players tab should show current score."

**Spec:** Reuse the same scoring components from the game-over screen (Bug 4), but displayed in the Players tab with heading "Current Standing" instead of "Score Breakdown". Same layout:

```
Current Standing

Policy Agenda:
  Player +n
  Player +n
  Player +n
  [Show details] → axis breakdown

Resolutions:
  Player +n
  Player +n
  Player +n
  [Show details] → VP-awarding controversies with illustrations
```

**Implementation:** Extract the scoring breakdown into a shared component (e.g. `ScoreBreakdown`) used by both the game-over screen and the Players tab. This avoids duplicating the scoring/rendering logic. The component takes:
- `playerAgendas`, `axisValuesMap`, `playerScores` (for policy agenda section)
- `allOutcomes`, `players`, `factionInfoMap` (for resolution VP section)
- `heading` prop ("Score Breakdown" vs "Current Standing")

The Players tab will need access to `allOutcomes` (resolved controversy outcomes) — either passed as a prop or fetched within the tab. Check how the tab currently receives its data.

---

## Bug/Enhancement 6 — Clash UI issues

**Location:** `mobile/components/ClashVoting.tsx`

### 6a — Threshold shows percentage instead of absolute number

**Problem:** Display says "Threshold: 70% of total faction power". Players need the actual number to make decisions.

**Fix:** Compute the actual threshold value (from `totalAvailablePower * thresholdPercent`) and display it, e.g. "Threshold: 10 power" or "10 of 14 total power needed".

### 6b — "Influence remaining" should be "Influence spent"

**Problem:** Inconsistent with other resolution screens which show spent, not remaining.

**Fix:** Change label to "Influence spent: X / Y" (spent out of total available).

### 6c — Overspending UX

**Problem:** Players can keep incrementing bids past their available influence. Only a text warning appears ("Total bids exceed...").

**Fix:**
1. Disable `+` buttons when total bids = available influence
2. If total exceeds available (e.g. via direct text input), show red border on all non-zero bid input fields
3. Keep the text warning as a fallback

### 6d — Clash outcome "committed/threshold" display is confusing

**Problem:** Shows "12 / 10 power committed". The "10" is the threshold (70% of amplified total), not total available power. This is confusing because players expect committed < total when someone withdrew. The numbers are arithmetically correct (amplifiers inflate committed power), but the display doesn't explain this.

**Analysis of the 12/10 case:** `purging_the_mediterranean` has `factionAmplifiers: { nautae: 2, milites: 2 }`. If nautae (power 3, amplifier 2) is won by a committer, it contributes 6 amplified power. The threshold is 70% of total amplified power. So committed power CAN exceed threshold even with a withdrawer, because amplified factions contribute outsized power.

**Fix:** Make the display clearer:
- "X power committed (threshold: Y)" or a progress bar with threshold marked
- Possibly show a breakdown of how amplified power was computed

### 6e — Clash outcome infovis redesign

**Problem:** Current layout just lists faction champions and committed/withdrew lists. Doesn't show per-faction power contribution or outcome rewards.

**New layout spec (from user):**

```
Per faction:
  The Provincials
    Player Name
    X power contributed (green)

  The Craftsmen
    Player Name
    X power contributed (green)

  The Plebs
    Player Name
    X power withheld (red)

  The Priests
    Player Name
    X power contributed (green)

[threshold bar / committed vs threshold display]

[Rewards section — reuse same UI element as Endeavour resolution outcome]
```

**Implementation:**
- Iterate `factionAssignments` from the clash result
- For each faction, show the winning player and whether they committed or withdrew
- Power shown = `amplifiedPower * share` (the actual contribution)
- Green "X power contributed" for committers, red "X power withheld" for withdrawers
- Rewards: reuse the axis/faction power/affinity effects display from `ResolutionOutcome` or `EndeavourVoting` outcome view

### 6d clarification — committed power display format

User-specified format:
```
Rome Prevails
12 power committed
3 power withdrawn
Threshold: 10
```

Note: committed power calculation is already correct — it uses base power × faction amplifier, NOT affinity. Affinity only affects bidding (who wins each faction). No engine change needed, just display changes.

---

## Bug 7 — Help modal text not scrollable on real devices

**Location:** `mobile/components/HelpModal.tsx:268-281`

**Problem:** Help text cuts off and can't be scrolled, especially on real devices (works partially on emulator).

**Cause:** The `ScrollView` (line 273) is nested inside two `Pressable` wrappers:
```jsx
<Pressable style={styles.backdrop} onPress={onDismiss}>      // outer — dismisses
  <Pressable style={styles.sheet} onPress={() => {}}>         // inner — blocks dismiss
    <ScrollView>                                                // can't scroll
```

The inner `Pressable` with `onPress={() => {}}` intercepts touch/scroll gestures on real devices, preventing the `ScrollView` from receiving them. On the emulator, mouse scroll events may bypass this.

**Fix:** Replace the inner `Pressable` with a plain `View`. To prevent backdrop dismissal when tapping the sheet content, use `onStartShouldSetResponder={() => true}` on the `View`, or restructure to avoid nested Pressables entirely. A common pattern:

```jsx
<Modal>
  <View style={styles.backdrop}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
    <View style={styles.sheet}>
      <ScrollView>...</ScrollView>
    </View>
  </View>
</Modal>
```

This keeps the dismiss-on-backdrop behavior without wrapping the sheet content in a `Pressable`.
