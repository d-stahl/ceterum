# Ceterum — Architectural Principles

This document records the architecture decisions and principles for this project. Read it before making
changes. Update it when you make architectural decisions.

---

## Project Structure

```
app/
├── mobile/               # Expo React Native app
│   ├── app/              # Expo Router screens
│   ├── components/       # UI components
│   └── lib/              # Shared client utilities + game engine
│       └── game-engine/  # Pure TypeScript game logic (no side effects)
└── supabase/
    ├── functions/        # Deno Edge Functions (server-side game logic)
    │   └── _shared/      # Shared code between Edge Functions
    │       └── game-engine/  # Deno-compatible copies of game engine modules
    └── migrations/       # Database migrations (sequential, never modify old ones)
```

---

## Security Model — THE MOST IMPORTANT RULE

**Clients never compute authoritative game state. All game mechanics run server-side.**

### Why

Any client-computed value sent to the server can be fabricated by a cheater. Influence earned,
power changes, axis shifts — these all affect gameplay, so they must be computed on the server.

### The Pattern

Every game state mutation follows this chain:

```
Client action  →  Edge Function  →  SQL RPC (SECURITY DEFINER)
                  (computes)         (writes, atomic)
```

1. **Client** sends only what the player chose: which faction, which resolution, how much influence.
   Never sends computed results.

2. **Edge Function** (Deno) validates authentication, runs the game engine, and calls the SQL RPC
   with server-computed results. Uses two clients:
   - `anonClient` (user JWT): for actions that need `auth.uid()` in SQL, respects RLS
   - `adminClient` (service role): for reads/writes that need to bypass RLS after validation

3. **SQL RPC** (`SECURITY DEFINER`) atomically applies the computed results to game tables.
   Critical RPCs are REVOKED from `authenticated` and `anon` roles — only the service-role
   client from an Edge Function can call them:
   ```sql
   REVOKE EXECUTE ON FUNCTION resolve_demagogery(UUID, JSONB, JSONB) FROM authenticated, anon;
   ```

### What MUST be REVOKED from clients

Functions that modify game state based on computed values (not player choices):
- `resolve_demagogery` ✅
- `start_ruling_phase` ✅
- `advance_round` ✅

Functions called with player choices (validated server-side in SQL) are fine to leave accessible:
- `submit_placement` (SQL validates: membership, phase, sub-round, dedup)
- `submit_controversy_vote` (SQL validates: membership, influence, SL constraint)
- `submit_senate_leader_actions` (SQL validates: SL identity, pool membership)
- `declare_resolution` (SQL validates: SL identity, phase)

### Client-side game engine copies

The game engine modules (`demagogery.ts`, `ruling.ts`, `controversies.ts`) are present in
`mobile/lib/game-engine/` for two legitimate uses:
1. **Tooltip previews**: Show players expected effects of their placements
2. **Tests**: Pure logic tests run in the mobile Jest environment

These copies **never feed computed values to the server**. They are UI-only.
`supabase/functions/_shared/game-engine/` contains Deno-compatible copies of the same modules
for server-side use. Keep them in sync when changing game mechanics.

---

## Edge Function Conventions

All Edge Functions follow the same structure:

```typescript
import { createEdgeClients, verifyMembership } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { /* CORS preflight */ }

  const { game_id, ...playerChoice } = await req.json();
  const authHeader = req.headers.get('Authorization');
  const { anonClient, adminClient, user } = await createEdgeClients(authHeader);

  await verifyMembership(anonClient, game_id, user.id);  // throws on failure

  // 1. Submit player's choice via anon client (SQL validates, returns status)
  const { data } = await anonClient.rpc('submit_...', { p_game_id: game_id, ...playerChoice });

  // 2. If last submission → run game engine as admin, persist results
  if (data?.status === 'ready_for_resolution') {
    // ... fetch data, transform, compute, persist
  }

  return jsonResponse(data);
});
```

Shared utilities live in `supabase/functions/_shared/`:
- `auth.ts` — `createEdgeClients()`, `verifyMembership()`, `jsonResponse()`
- `db-transforms.ts` — `buildEngineFactionsFromDb()`, `buildEnginePlacementsFromDb()`, `buildPlayerAffinitiesFromDb()`
- `game-engine/` — Deno-compatible copies of game engine modules

---

## Database Conventions

### Migrations

- Never modify existing migration files. Always add new ones.
- Use `CREATE OR REPLACE FUNCTION` for RPCs (idempotent).
- Every table has RLS enabled. Add policies for the minimal required access.
- Use `SECURITY DEFINER` for RPCs that need service-role access patterns.
- Use `FOR UPDATE` on row locks when checking-then-updating game state.

### Phase transitions

The `game_rounds.phase` column tracks game state. Transitions are:

```
demagogery → demagogery_resolved → ruling_selection → ruling_pool
→ ruling_voting_1 → ruling_voting_2 → completed (→ new round: demagogery)
```

Phase transitions happen in Edge Functions (via SQL RPCs), never in client code.
Clients observe transitions via Supabase Realtime subscriptions.

### RLS patterns

- Players can read data for games they're in: `game_id IN (SELECT get_my_game_ids())`
- Votes are secret until the controversy is resolved
- Senate Leader private actions (`game_senate_leader_actions`) readable only by the SL

---

## Mobile App Conventions

### Component size

Components over 300 lines should be split. If a component manages both data-fetching and complex
UI, extract a presentational inner component and a data hook.

Exception: `GameScreenInner` in `app/(app)/game/[id].tsx` is the central orchestrator and may be
larger, but should not exceed ~800 lines. Extract phase-specific hooks when this limit is
approached.

### State management

- No external state management library (Zustand, Redux). Local state + Supabase Realtime.
- Prefer `useState` + Supabase Realtime subscriptions over polling.
- Use `useRef` for values that shouldn't trigger re-renders: drag positions, influence snapshots.
- Snapshot game state before server mutations to compute deltas for UI feedback.

### Realtime subscriptions

Subscribe in a single channel per screen, consolidating all tables. Example:

```typescript
supabase.channel(`game-${gameId}`)
  .on('postgres_changes', { table: 'game_rounds', ... }, handler)
  .on('postgres_changes', { table: 'game_factions', ... }, handler)
  .subscribe();
```

Always unsubscribe in the `useEffect` cleanup.

### TypeScript

Avoid `as any` for Supabase query results. Use proper types:
```typescript
// Bad
const factions = (data ?? []).map((f: any) => ...);

// Better — use a typed DB row type
type FactionRow = { faction_key: string; power_level: number; ... };
const factions = (data as FactionRow[] ?? []).map((f) => ...);
```

Prefer narrow `as` casts (e.g., `data as FactionRow[]`) over `as any`.

---

## Game Engine Conventions

The game engine (`mobile/lib/game-engine/`) is **pure TypeScript with no side effects**.
Functions take data in, return results out. No Supabase calls, no async.

### Module responsibilities

| Module | Responsibility |
|--------|---------------|
| `workers.ts` | Worker types, roles, basic constants |
| `axes.ts` | Axis key definitions |
| `balance.ts` | Faction selection and balancing for game setup |
| `factions.ts` | Static faction definitions (source of truth) |
| `controversies.ts` | Static controversy definitions (source of truth) |
| `demagogery.ts` | Demagogery phase resolution (influence, power changes) |
| `ruling.ts` | Ruling phase logic (SL selection, voting, affinity, round end) |

### Keeping Deno copies in sync

When changing `mobile/lib/game-engine/X.ts`, also update
`supabase/functions/_shared/game-engine/X.ts`. The Deno versions require `.ts` import extensions.
The comment `// Deno-compatible copy` marks these files.

---

## Local Supabase Management

The project runs a local Supabase stack via Docker. Config lives in `supabase/config.toml`.

### Starting / stopping

```bash
npx supabase start        # starts all containers, applies config.toml
npx supabase stop         # stops containers, preserves data in Docker volumes
npx supabase stop --project-id supabase  # if "app" project conflicts with another stack
```

**Data is safe across stop/start.** It lives in a named Docker volume, not the container.
`supabase db reset` wipes data — only run that intentionally.

### Critical: config.toml is only applied on `supabase start`

If a setting in `config.toml` isn't reflected in the running instance (e.g. anonymous sign-ins
disabled despite `enable_anonymous_sign_ins = true`), it means the instance was started with
stale config. **Fix: `npx supabase stop && npx supabase start`.**

Do NOT try to patch the running GoTrue container directly — the admin JWT validation is opaque
and the config is re-applied cleanly on restart.

### Auth

- Anonymous sign-ins are the app's auth strategy (set in `config.toml`).
- Users with stale refresh tokens (e.g. after a `db reset`) will hit "Invalid Refresh Token".
  The app handles this gracefully by clearing the session and re-authenticating anonymously.
- If the mobile app shows "Anonymous sign-ins are disabled", the Supabase stack needs a restart.

### Applying new migrations to a running instance

```bash
npx supabase db push --local   # runs pending migrations against the local DB
npx supabase db reset --local  # ⚠️  WIPES ALL DATA, re-runs all migrations from scratch
```

### Watch out: two project IDs in use

The Docker containers may be named `supabase_*_supabase` (old project) or `supabase_*_app`
(current project, from `project_id = "app"` in config.toml). If `npx supabase stop` says
"cannot find project", use `npx supabase stop --project-id supabase` to stop the old one.

After any project switch, run `npx supabase db reset --local` to ensure all migrations are
applied cleanly. The database volume is project-scoped, so switching projects gives you a
different (possibly stale) DB state.

---

## Iteration Roadmap

| Iteration | Focus |
|-----------|-------|
| 1 (done) | Demagogery phase, end-to-end playable |
| 2 (done) | Ruling phase — Senate Leader, controversy voting, round end |
| 3 | Follow-up controversy trees, deck exhaustion handling |
| 4 | Secret objectives, scoring, game end screen |
| 5 | Polish, balance tuning, admin/debug view |
