# Architecture Review — flowrite tutorial-writer (2026-07-06)

Focus: design/architecture, token cost. Ranked by expected token savings.

## 1. Three subagent profiles silently inherit sonnet+high thinking — biggest cost leak

`tutorial-designer.ts`, `tutorial-drafter.ts`, `tutorial-reviewer.ts` have no `...TIERS.x`
spread (unlike researcher/examples/integrator, which all set one explicitly). Since
`design_tutorial_structure` / `write_tutorial_draft` / `review_against_checklist` call
`session.task()` from inside the `tutorial_writer` session, these three inherit its
default: sonnet-4-6 @ `high` thinking.

- `tutorial_reviewer` — mechanical pass/fail against a checklist. Sonnet+high is waste.
  Drop to low/medium thinking, maybe cheaper model.
- `tutorial_designer` — structuring, not prose generation. Medium thinking is plenty.
- `tutorial_drafter` — actual creative writing. Keep high; it's earning it.

Fix: add explicit tiers to `models.ts` (e.g. `reviewer`, `designer`), spread into those
two profiles.

## 2. `examples_builder` / `docs_integrator` lack the tools they're instructed to use

Same bug class as the `gh_query` fix applied to `tutorial_researcher`. `examples-builder.ts`
step 4 says "Compile with `sbt "<module>/compile"`" but the profile has no `tools:` —
forced onto raw bash, no structured error extraction (`errorLines`), duplicating
`compile_examples`/`run_example` tools that already exist but aren't handed down. Same
for `docs_integrator` step 4 (`sbt "docs/mdoc --in <path>"` via raw bash) duplicating
`mdoc_compile`. Give each subagent its own scoped tool subset instead of raw bash.

## 3. Action/subagent doubling — 6 components for 3 pieces of work

`design_tutorial_structure`+`tutorial_designer`, `write_tutorial_draft`+`tutorial_drafter`,
`review_against_checklist`+`tutorial_reviewer` — each pair exists solely to dodge the
self-recursion hazard of calling `harness.session()` on the same agent. Legitimate
reason, not a bug, but real complexity (3 extra profile files/names).

`component-usage.ts`'s `ACTION_NAMES` set is a hand-duplicated literal list of these 3
names with zero single source of truth — rename drift means silent miscategorization in
the usage report. Should derive from the actions array itself rather than a second
hardcoded copy.

## 4. Orchestrator itself runs at `high` thinking for a mostly deterministic 8-step flow

`tutorial_writer.md`'s job is "call step N, check result, call step N+1" — closer to a
state machine than creative work. `high` thinking compounds on every one of those ~8+
orchestration turns, on top of the `high` thinking already spent inside `tutorial_drafter`.
Consider `medium` for the orchestrator; reserve `high` for the drafter where it's earned.

## 5. Minor — redundant thinkingLevel override

`tutorial-writer.ts:50` sets `thinkingLevel: TIERS.writer.thinkingLevel` explicitly, but
`docsAuthorBase` profile already spreads `...TIERS.writer` (same value). Dead
duplication, no cost impact, just noise.

## Next step

Implement #1 first (add reviewer/designer tiers, wire into the two profiles) — biggest
expected token savings, smallest change.
