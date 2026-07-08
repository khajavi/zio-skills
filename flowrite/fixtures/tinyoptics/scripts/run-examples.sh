#!/usr/bin/env bash
#
# run-examples.sh — run the standalone write-examples workflow against this
# fixture (build companion examples for an existing tutorial, no
# research/design/write), then archive whatever it produced plus the flue log
# and reset the fixture back to baseline. Mirrors run-tutorial.sh.
#
# Usage: bash scripts/run-examples.sh [tutorial-path]
#   tutorial-path is relative to the fixture root; defaults to docs/guides/lens.md
#   e.g. bash scripts/run-examples.sh docs/guides/lens.md
set -uo pipefail

cd "$(dirname "$0")/.."
fixture_root="$(pwd)"
flowrite_root="$(cd ../.. && pwd)"

tutorial_path="${1:-docs/guides/lens.md}"
log="$(mktemp)"
echo "flue log: $log"

input="$(jq -n --arg projectPath "$fixture_root" --arg tutorialPath "$tutorial_path" \
  '{projectPath: $projectPath, tutorialPath: $tutorialPath}')"

# exec replaces the subshell with flue so $! is flue's real PID.
(cd "$flowrite_root" && exec ./node_modules/.bin/flue run write-examples --env .env.testing --input "$input") \
  > "$log" 2>&1 &
flue_pid=$!

tail -n +1 -f "$log" &
tail_pid=$!

cleanup() {
  echo ""
  echo "interrupted — killing run and archiving whatever it produced..."
  kill "$tail_pid" 2>/dev/null
  kill -TERM "$flue_pid" 2>/dev/null
  kill -KILL "$flue_pid" 2>/dev/null
  pkill -9 -f "flue.mjs run write-examples" 2>/dev/null
  pkill -9 -f "sbt-launch" 2>/dev/null
  bash scripts/archive-docs.sh "$log"
  rm -f "$log"
  exit 130
}
trap cleanup INT TERM

wait "$flue_pid"
status=$?
kill "$tail_pid" 2>/dev/null
wait "$tail_pid" 2>/dev/null

bash scripts/archive-docs.sh "$log"
rm -f "$log"
exit "$status"
