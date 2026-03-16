#!/usr/bin/env bash
# Copies game-engine modules from mobile (source of truth) to supabase edge functions.
# The Deno edge runtime runs in Docker with only supabase/functions mounted,
# so a symlink won't work — we need real file copies.
#
# Usage:
#   ./scripts/sync-game-engine.sh          # one-shot copy
#   ./scripts/sync-game-engine.sh --watch  # watch for changes and auto-copy

set -euo pipefail

SRC="$(dirname "$0")/../mobile/lib/game-engine"
DST="$(dirname "$0")/../supabase/functions/_shared/game-engine"

sync_files() {
  # Copy all .ts files except __tests__
  find "$SRC" -maxdepth 1 -name '*.ts' -exec cp {} "$DST/" \;
  echo "game-engine synced: mobile → supabase"
}

sync_files

if [[ "${1:-}" == "--watch" ]]; then
  echo "Watching $SRC for changes..."
  if command -v inotifywait &>/dev/null; then
    while inotifywait -q -e modify,create,delete "$SRC"/*.ts; do
      sync_files
    done
  elif command -v fswatch &>/dev/null; then
    fswatch -o "$SRC"/*.ts | while read; do
      sync_files
    done
  else
    echo "Install inotify-tools (Linux) or fswatch (macOS) for --watch mode"
    exit 1
  fi
fi
