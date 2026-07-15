#!/usr/bin/env bash
#
# run-data-type-ref.sh — run write-data-type-ref against this fixture, then
# archive whatever it produced (docs/examples/build changes) plus the full flue
# log, and reset the fixture back to baseline. One command for local testing;
# archives even on a failed or interrupted run so the log is never lost.
# Mirrors run-tutorial.sh.
#
# Usage: bash scripts/run-data-type-ref.sh "<TypeName>" [skip-phase1,skip-phase2,...]
#   Skip phases: research, design, write, write-examples, integrate, review — e.g.
#   bash scripts/run-data-type-ref.sh "Lens" research,design,write
set -uo pipefail

cd "$(dirname "$0")/.."
fixture_root="$(pwd)"
flowrite_root="$(cd ../.. && pwd)"

type_name="${1:?usage: run-data-type-ref.sh <TypeName> [skip-phase1,skip-phase2,...]}"
skip_phases="${2:-}"
log="$(mktemp)"
echo "flue log: $log"

skip_phases_json="[]"
if [ -n "$skip_phases" ]; then
  skip_phases_json="$(printf '%s' "$skip_phases" | tr ',' '\n' | jq -R . | jq -s .)"
fi
input="$(jq -n --arg projectPath "$fixture_root" --arg typeName "$type_name" --argjson skipPhases "$skip_phases_json" \
  '{projectPath: $projectPath, typeName: $typeName, skipPhases: $skipPhases}')"

# `exec` replaces this subshell with flue itself, so $! below is flue's real PID.
(cd "$flowrite_root" && exec ./node_modules/.bin/flue run write-data-type-ref --env .env.testing --input "$input") \
  > "$log" 2>&1 &
flue_pid=$!

tail -n +1 -f "$log" &
tail_pid=$!

cleanup() {
  echo ""
  echo "interrupted — killing run and archiving whatever it produced..."
  kill "$tail_pid" 2>/dev/null
  # Fire TERM and KILL back-to-back and archive immediately — see run-tutorial.sh
  # for why there's no grace period here.
  kill -TERM "$flue_pid" 2>/dev/null
  kill -KILL "$flue_pid" 2>/dev/null
  # flue spawns sbt/java as its own children — kill them too.
  pkill -9 -f "flue.mjs run write-data-type-ref" 2>/dev/null
  pkill -9 -f "sbt-launch" 2>/dev/null
  bash scripts/archive-docs.sh "$log" write-data-type-ref
  rm -f "$log"
  exit 130
}
trap cleanup INT TERM

wait "$flue_pid"
status=$?
kill "$tail_pid" 2>/dev/null
wait "$tail_pid" 2>/dev/null

bash scripts/archive-docs.sh "$log" write-data-type-ref
rm -f "$log"
exit "$status"
