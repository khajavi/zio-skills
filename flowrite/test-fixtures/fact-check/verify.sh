#!/usr/bin/env bash
#
# verify.sh — the fact-check phase's acceptance test, against a page whose every error is known.
#
# Why a hand-planted page rather than a real run: ground truth has to be exact. A page a real run
# produced has unknown accuracy to begin with, so "the checker found three problems" would be a
# judgement call. Here the answer is arithmetic — 5 planted drifts, 4 correct claims, and the second
# number matters more than the first. A gate that flags correct prose gets switched off.
#
# Usage: bash test-fixtures/fact-check/verify.sh
#
# It plants seeded-ledger.md in the tinyproject fixture, runs ONLY the fact-check phase (every other
# phase skipped), prints what the check reported, and removes the page again. The fixture is left at
# baseline either way — including on interrupt, which is why the cleanup runs from a trap.
#
# Requires .env.testing with a working ANTHROPIC_API_KEY. Everything except the fact-checker is
# pinned to Haiku there; the fact-checker is deliberately left on its default Sonnet tier, because
# testing the gate on a weaker model than it ships on proves nothing.
#
# ---------------------------------------------------------------------------------------------
# The 5 planted drifts, against tally/src/main/scala/tally/Ledger.scala:
#
#   1  erase(name): Ledger        no such member. The class scaladoc says there is "deliberately no
#                                 removal", so this is the fabrication case — expect not-in-source.
#   2  tallyOf: Option[Long]      source returns Long, and 0L when the name is absent. The page even
#                                 explains the None case, so the prose is wrong too.
#   3  seeded(count: Int)         source takes Long.
#   4  absorb keeps the larger    source folds with +: it SUMS the tallies of shared names.
#   5  record replaces the tally  source is counts.getOrElse(name, 0L) + by: it ADDS.
#
# The 4 correct claims that must NOT be reported:
#
#   final case class Ledger(counts: Map[String, Long])   the real structural signature
#   Ledger.blank is a val, not a method                  it is: `val blank: Ledger`
#   record starts a new name from zero                   the getOrElse(name, 0L) branch
#   Window#tallied returns a Ledger                      it does — the cross-type claim is sound
#
# PASS = all 5 reported, with both citations each, and none of the 4 flagged.
# ---------------------------------------------------------------------------------------------
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
fixture="$root/fixtures/tinyproject"
page="$fixture/docs/reference/ledger.md"
log="$(mktemp)"

if [ ! -f "$root/.env.testing" ]; then
  echo "missing $root/.env.testing — copy .env.testing.example and fill in ANTHROPIC_API_KEY" >&2
  exit 1
fi

# The fixture is a from-scratch baseline and must never keep this page. Trap rather than a trailing
# line: an interrupted run would otherwise leave a planted page behind, and the next run would then
# be checking a page it did not plant.
cleanup() {
  rm -f "$page"
  echo "fixture reset (removed docs/reference/ledger.md)"
}
trap cleanup EXIT INT TERM

cp "$here/seeded-ledger.md" "$page"

# Every phase except fact-check. The list is what makes this cheap: no research, no drafting, no sbt.
request='The reference page for the Ledger data type already exists at docs/reference/ledger.md. \
Every phase except fact check is skipped for this run: do not research, design, write, or integrate \
anything, and do not run sbt or mdoc. Call fact_check_page on that page, then file the run result \
reporting what it found.'
data="$(jq -nc --arg p "$fixture" \
  '{projectPath:$p, skipPhases:["research","design","write","write-examples","integrate","review"]}')"

echo "log: $log"
(cd "$root" && env NODE_USE_ENV_PROXY=1 no_proxy=localhost,127.0.0.1 \
  FLUE_VERBOSE_TOOLS="${FLUE_VERBOSE_TOOLS:-1}" \
  ./node_modules/.bin/flue run src/agent.ts \
  --env .env.testing -m "$request" --data "$data") > "$log" 2>&1
status=$?

echo ""
echo "=== what the check reported ==="
grep -E "flowrite:|Fact-check of|not-in-source|contradicted|stale-citation|run verdict:" "$log" \
  || echo "(nothing — read $log in full; the run may have failed before the phase)"
echo ""
echo "Now check the two things this test exists for, in $log:"
echo "  * all 5 planted drifts reported, each citing BOTH the page line and a source path:Lstart-Lend"
echo "  * none of the 4 correct claims flagged — a false positive here is the worse failure"
echo ""
echo "The review phase is skipped, so the verdict reads not-reviewed: a fact-check deliberately"
echo "cannot move that. Verdict folding is covered by src/tools/phases/fact-check.test.ts instead."
exit "$status"
