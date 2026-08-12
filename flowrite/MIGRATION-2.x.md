# Flue 2 migration — status and handover

Branch `feature/flue-2-migration`, 15 commits, `tsc --noEmit` clean. Nothing pushed.
A pre-rewrite backup of the same work sits on `backup-pre-rebase` (identical tree);
delete it once you are happy with the history.

## What changed

`@flue/*` went from `1.0.0-beta.9` to `2.0.3`. A stable `1.0.0` never shipped, so
beta.9 was the end of an abandoned line and there was no incremental step. Flue 2
deleted every primitive flowrite was built on:

| Beta | Now |
|---|---|
| `defineAgent(ctx => config)` | `'use agent'` + exported function + hooks (must be sync) |
| `defineWorkflow` | deleted; each agent is its own entry point |
| `defineAgentProfile` | `defineSubagent({ name, description, agent, model?, thinkingLevel? })` |
| `defineAction` | `defineTool({ harness: true })` |
| `session.task(p, { agent, result })` | `delegate(...)` in `src/shared/delegate.ts` |
| `run({ input })`, bare return | `run({ data })`, return `{ output }` |
| `harness.fs` | `harness.sandbox` |
| `run_start`/`run_end`, `runId` | `agent_start`/`agent_end`, `instanceId`+`submissionId` |

Directories: `src/actions/` → `src/phases/`, `src/profiles/` → `src/subagents/`,
`src/workflows/` deleted.

**The model still decides phase order.** The writer calls phase tools; each tool
delegates to a role. That was a deliberate choice, and it is why `harness.prompt`
is used rather than a code-driven orchestrator.

## Running it

```bash
flue run src/agents/docs-writer.ts --env .env.testing \
  --id dtr-Chunk \
  -m "Please write reference documentation for the Chunk data type" \
  --data '{"projectPath":"/path/to/checkout"}'
```

`projectPath` resolves from `--data`, then `REPO_PATH`, then `process.cwd()`. The kind of document
and its subject come from the message; ask for a module reference or a tutorial the same way.
`layout`/`shapeOverride` remain `--data` overrides for module runs. `--env .env.testing` pins every
tier to Haiku.
`FLUE_VERBOSE_TOOLS=1` logs tools, delegations, and turns to stderr.

On this machine flue also needs `NODE_USE_ENV_PROXY=1` and
`no_proxy=localhost,127.0.0.1`; a "Connection error" with 0 tokens is that.

## Validation status — INCOMPLETE

| Pipeline | Status |
|---|---|
| data-type-ref | **Re-run post-fix and completed** (Lens, 2026-08-07): 15KB page, mdoc 0 errors, method coverage 100%, signatures match source. 541 turns, $5.2331. Style gate fails with 26 unresolved violations — see below, this is pre-existing. |
| module-ref | Never completed. Reached the hierarchical per-type subpages (4× research + 4× write), which is the least-tested branch, then was stopped. |
| tutorial | Never run. `examples_builder` and the decoupled sbt examples build are therefore unexercised. |

## Cost: 2.x is materially more expensive

First trustworthy measurement, data-type-ref on the same fixture at the same haiku
tier:

| | Turns | Cost |
|---|---|---|
| beta `write-data-type-ref-turn4` | 225 | $1.80 |
| beta `write-data-type-ref-turn1` | 420 | $3.58 |
| **2.x (Lens)** | **541** | **$5.23** |

Against the best comparable beta run that is **2.4× the turns and 2.9× the cost**;
against beta's worst, 1.29× and 1.46×. Module-ref baselines for later comparison:
281 turns/$2.26 and 359/$2.85.

The mechanism is structural, not a bug. Every phase now routes through a harness
scratch conversation that must itself decide to delegate — roughly 8 extra turns per
delegation — so overhead scales with delegation count. The Lens run made 28
delegations. Module-ref delegates most, so expect it to be hit hardest.

If this matters, the lever is `src/shared/delegate.ts`: a tighter lead-in that gets
the scratch conversation to delegate in one turn instead of several would cut the
per-delegation overhead directly.

## Output quality is comparable, and one agent claim is not trustworthy

Hard gates pass: mdoc 0 errors, method coverage 100%, all signatures match source.

The style gate does not: all four review calls returned `passed=false` with 26
unresolved writing-style violations (rules 8, 16, 17, 19, 22, 28). This is **not a
migration regression** — beta's `turn4` ended the same way with 84 such failures, so
2.x is cleaner here. It follows from `MAX_FIX_ROUNDS=1` and `MAX_REVIEW_CALLS=1`,
which are designed to finish with known issues.

What is worth fixing independently: the agent's closing summary asserted
"Comprehensive fixes addressed all 24 initial violations; final page meets
writing-style conventions… ready for publication." Its own review data says
`passed=false` with 26 violations outstanding. The review cap explicitly instructs it
to "report them in your summary"; it claimed success instead, and also called review
four times after being told not to. Do not take a run's retrospective at face value —
check the review payloads.

## Bugs found by running, not by typechecking

The port compiled clean and was still wrong in seven ways. Worth remembering that
`tsc` proved nothing here.

1. **Sandbox anchored in the wrong repo.** `cwd` belongs to `local({ cwd })`, not to
   `useSandbox(f, { cwd })` — the first anchors the sandbox on the host, the second
   picks a directory inside an already-anchored one. File access still worked via
   absolute paths, so nothing failed. What broke was workspace discovery: an A/B
   probe reading `turn_request.input.systemPrompt` showed the writers receiving
   2971 chars of flowrite's own `CLAUDE.md` instead of the fixture's `AGENTS.md`.
   Wrong context, not merely missing.
2. **No `durability` static.** Flue 2 applies a one-hour submission deadline by
   default (`maxAttempts` 10); beta had none. A module-ref run settled `failed`
   mid-review at 548 turns. Now 6h / 2 attempts — 10 automatic retries of an
   expensive pipeline is dangerous.
3. **Usage reporting orphaned.** Deleting the workflow wrapper removed the only
   caller of `trackTokenUsage`/`trackComponentUsage`; runs silently reported no cost
   for several commits.
4. **`useAgentFinish` does not run on a failed submission**, so end-of-run reporting
   hung off it lost the data for exactly the runs that needed it. There is a
   `process.once('exit')` backstop now.
5. **Five phase tools kept `process.env.REPO_PATH!`.** Nothing sets that any more and
   the non-null assertion hid it from `tsc`.
6. **`console.log` in observers corrupts `flue run --json`** — stdout is the reply.
7. **`harness` is the harness's own name (`"default"`)**, not the owning tool's, and a
   delegate inherits its parent's harness. Per-phase cost attribution is therefore
   not derivable from the event; role cost is exact via `taskId`, and harness turns
   aggregate under the writer. Totals reconcile.

## Suggested next steps

1. Re-run data-type-ref post-fix for a trustworthy page and the first real cost figure.
2. Run module-ref to completion; it is the longest and least tested.
3. Run tutorial, the only path that exercises `examples_builder`.
4. Regenerate `fixtures/tinyoptics/docs/` once all three pass, replacing the pages
   written before the sandbox fix.
5. Independent of this migration: the review cadence cap (`MAX_REVIEW_CALLS=1`)
   returns feedback from before the agent's own edits, and the agent worked around it
   by grepping to verify its fixes by hand.
