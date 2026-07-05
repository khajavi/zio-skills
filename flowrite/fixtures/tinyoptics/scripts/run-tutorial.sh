#!/usr/bin/env bash
#
# run-tutorial.sh — run write-tutorial against this fixture, then archive
# whatever it produced (docs/examples/build changes) plus the full flue log,
# and reset the fixture back to baseline. One command for local testing;
# archives even on a failed run so the log is never lost.
#
# Usage: bash scripts/run-tutorial.sh "<topic>"
set -uo pipefail

cd "$(dirname "$0")/.."
fixture_root="$(pwd)"
flowrite_root="$(cd ../.. && pwd)"

topic="${1:?usage: run-tutorial.sh <topic>}"
log="$(mktemp)"

input=$(printf '{"projectPath":"%s","topic":"%s"}' "$fixture_root" "$topic")

(cd "$flowrite_root" && ./node_modules/.bin/flue run write-tutorial --env .env.testing --input "$input") \
  > "$log" 2>&1
status=$?

cat "$log"
bash scripts/archive-docs.sh "$log"
rm -f "$log"
exit "$status"
