# RFC + Spec: `docs-gardener` — periodic documentation drift/gap detector

- **Status:** Partly implemented — see "What exists now" below
- **Date:** 2026-07-16
- **Component:** flowrite (Flue-based ZIO documentation agents)
- **Author:** @khajavi

## What exists now (2026-08-20)

Signal 2's detection engine was built, as a phase of the writer rather than as a periodic auditor:
the `fact_checker` role (`src/subagents/fact-checker.{ts,md}`) and the `fact_check_page` phase tool
(`src/tools/phases/fact-check.ts`). It checks ONE page against source on the run that wrote it, and
its drifts fail that run's verdict through `recordedVerdict()`.

Taken from this RFC: the findings shape, the both-sides citation requirement ("No citation pair ⇒ not
reported"), the omit-rather-than-guess rule, and fail-safe-not-silent (the `incomplete` field).
Dropped from it: `fingerprint` and `suggestedAction`, which serve cross-run dedup this does not do.

Still unbuilt, and still described accurately by the rest of this document:

- **Signal 1, missing coverage.** Partly covered already by `check_method_coverage`, which is a
  deterministic tool the writer calls, not an audit.
- **The whole-repo sweep.** `fact_check_page` takes one page path; nothing walks a docs tree.
- **The rolling GitHub issue**, `src/shared/github-issue.ts`, fingerprint reconciliation across runs,
  and the `docs-garden.yml` cron.
- **The `docs-gardener` agent itself.** Nothing needs to be read-only-by-absence-of-capability yet,
  because the checker runs inside a writer that is allowed to fix what it finds.

Two corrections to the plan below, for whoever picks up the rest. The file layout it names
(`src/agents/`, `src/workflows/garden.ts`) predates the Flue 2 migration: agents live in `src/`,
roles in `src/subagents/`, and workflows no longer exist. And a `harness: true` tool cannot fan out
in parallel — a session runs one operation at a time — so a whole-repo sweep either walks pages
serially or is driven by the model batching `task` calls.

## Summary

A new **read-only auditor** agent, `docs-gardener`, that runs periodically against a
ZIO library checkout and its docs, detects **missing documentation coverage** and
**signature drift**, and reports findings into a **single rolling GitHub issue**. It
is a sibling to the existing writer agents (`tutorial-writer`, `data-type-ref-writer`,
`module-ref-writer`) and reuses their profile, tools, and observability. It never
edits docs — remediation stays with the humans and the existing writers.

## Motivation

flowrite can *write* compile-verified docs, but nothing watches for docs decaying
after they ship. As a library evolves, reference pages drift from the source
(renamed params, changed return types, removed methods) and new public API arrives
undocumented. Today this is caught by chance in review. A scheduled auditor turns
"someone eventually notices" into "a ranked, deduplicated checklist that stays
current with `main`."

Non-goals (explicitly out of scope for v1):

- Auto-fixing, PR generation, or full remediation. **Report-only.**
- Broken-`mdoc` build checking and staleness (git-age) heuristics. Deferred.
- Prose quality / writing-style auditing (already covered by writers' style loop).

## Design overview

An agent is `model + instructions + tools + skills + sandbox`. The gardener adds a
read-only auditor to the existing pattern:

```
src/agents/docs-gardener.md          # identity: read-only auditor, never edits docs
src/agents/docs-gardener.ts          # wiring: profile + tools + findings schema
src/workflows/garden.ts              # finite entry point; input = { projectPath, docsPath }
src/skills/docs-drift-checklist/     # what "missing" and "drift" mean, per doc-kind
src/shared/github-issue.ts           # deterministic single-rolling-issue sync (gh)
```

Two boundaries make this safe and testable:

1. **Read-only by contract.** The gardener has no write/integrate actions and no
   writer subagents. Its only output is a schema-typed findings object; it never
   touches doc files. Report-only is enforced by *absence of capability*, not by
   convention.
2. **Engine vs deployment split.** `garden` is the Flue workflow (the engine,
   invokable via `flue run garden` or ambient `invoke()`). The periodic trigger is
   a **GitHub Actions cron** in the target library repo that runs the engine and
   feeds findings to the issue-sync step. Least-privilege permissions
   (`issues: write`, `contents: read`) enforce report-only at the platform layer too.

### Considered alternatives

- **Pure-deterministic linter (no LLM).** Precise on missing coverage, but
  signature drift between prose and code needs semantic reading a parser can't do.
  Rejected as the whole engine; the deterministic parts are reused *inside* the
  agent (method-coverage tool) and for the issue-sync step.
- **Audit mode bolted onto an existing writer.** Rejected: a writer's identity is
  "produce a page"; auditing is read-only, whole-repo, and ranked. Muddies both
  agents.

## Detection: the two signals

Both run against a library checkout + its docs dir, inside the sandbox.

### Signal 1 — Missing coverage (mostly deterministic; model ranks)

- Reuse the existing `check-method-coverage` tool to enumerate the public API
  surface (types, constructors, methods) from source.
- Enumerate what existing docs actually cover (which types have a page; which
  methods appear in it).
- Diff → `missing[]`: public API elements with no doc mention. Each carries a
  `source` citation (`path:Lstart-Lend`) so a finding can never be invented.

### Signal 2 — Signature drift (needs the model)

- For each documented type, extract the **documented signature** (from prose / code
  blocks) and compare to the **actual source signature**.
- Flag: param added / removed / renamed, type changed, return type changed, method
  removed from source but still documented.
- Every drift finding cites **both** sides: `documented` (docs `path:line`) vs
  `actual` (source `path:line`). No citation pair ⇒ not reported (false-positive
  guard).

### Findings schema (valibot — the honesty spec that drives the run)

```ts
finding: {
  kind:      'missing' | 'signature-drift',
  severity:  'high' | 'medium' | 'low',
  docKind:   'data-type-ref' | 'module-ref' | 'tutorial' | null, // null for missing pages
  subject:   string,          // e.g. "Prism.andThen" or "Chunk (no reference page)"
  detail:    string,          // one-line human explanation
  source:    string,          // path:Lstart-Lend in the library
  documented: string | null,  // docs path:line (null for 'missing')
  fingerprint: string,        // stable id for issue dedup across runs
  suggestedAction: string,    // e.g. "run write-data-type-ref for Prism"
}
```

`fingerprint = hash(kind + subject + docKind)` — stable across runs so the rolling
issue can check items off and reopen regressions.

## Issue lifecycle: single rolling issue

Deterministic sync in `src/shared/github-issue.ts` (**no LLM** — reproducible,
cheap). Runs after the agent returns findings.

- **Find-or-create** one issue by label `docs-garden` (+ hidden marker
  `<!-- docs-garden:v1 -->` in the body).
- **Body generated from findings**, grouped by severity, each row keyed by
  `fingerprint`:
  ```
  - [ ] `HIGH` Prism.andThen — signature drift (docs/prism.md:88 vs Prism.scala:L42) → run write-data-type-ref for Prism
  ```
- **Reconcile across runs by fingerprint:**
  - new fingerprint → new unchecked row.
  - fingerprint gone this run → row dropped (resolved).
  - fingerprint returns after being resolved → row reopens (regression); issue
    re-opened if it was closed.
  - human-checked `[x]` rows whose fingerprint still present → keep checked (respect
    triage) but annotate "still detected".
- **Empty findings** → close the issue with an "all clear as of `<sha>`" comment.
  Reopen on the next non-empty run.
- **Provenance footer**: commit SHA, run timestamp, `runId`, and the token/cost line
  from the existing component-usage tracker.

Idempotent: re-running on the same SHA edits in place, never spams.

## Scheduled trigger (reference deployment)

Lives in the **target ZIO library repo**, not flowrite:

```yaml
# .github/workflows/docs-garden.yml
on:
  schedule: [{ cron: '0 6 * * 1' }]   # weekly, Mon 06:00 UTC
  workflow_dispatch: {}                # manual run
permissions:
  contents: read
  issues: write
jobs:
  garden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4              # code + docs in one tree
      - run: pnpm dlx @flue/cli run garden \
               --input '{"projectPath":".","docsPath":"docs"}'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      # issue-sync step consumes findings JSON and calls gh with GITHUB_TOKEN
```

- Cron is UTC; weekly default, tunable. `workflow_dispatch` for on-demand runs.
- Least privilege: `issues: write`, `contents: read` — no push, no PR.
- The `garden` workflow emits findings as its structured result; the issue-sync step
  reads it and calls `gh`.

## Error handling

- **Fail safe, not silent.** A build/parse error on the checkout produces a single
  `high` finding — "audit could not complete: `<reason>`" — instead of a false
  all-clear. "No drift" and "couldn't look" must never be confused.
- **False-positive guard.** Every finding requires its citation(s); the model is
  instructed to *omit* rather than guess. In report-only mode a miss beats a false
  alarm.

## Testing

- Test on the bundled `fixtures/tinyoptics/` (Haiku via `--env .env.testing`, per
  repo convention).
- Seed known drift: rename a `Prism` method param, delete a documented method, add
  an undocumented type → assert the findings list and the rendered issue body.
- `--dry-run` issue mode prints the issue body without calling `gh`, for local runs
  and CI assertions.
- Reuse the token/component-usage tracker and the run retrospective (`insights[]`)
  so the gardener's own context improves like the writers'.

## Open questions

1. Cron cadence: weekly vs on every push to `main` vs both.
2. Should `docKind` inference be automatic, or configured per docs directory?
3. Severity policy: is a missing page always `high`, or scaled by API surface size?

## Rollout

1. Implement `garden` workflow + `docs-gardener` agent + `docs-drift-checklist`
   skill; reuse `docs-author-base`, `check-method-coverage`, `gh` tool.
2. Implement deterministic `github-issue.ts` sync with `--dry-run`.
3. Validate on tinyoptics with seeded drift.
4. Ship the reference `docs-garden.yml` workflow for one ZIO library as the pilot.
```