# Porting `reduce-redundancy` to flowrite

**Status:** Proposed — not implemented.
**Source:** `writer-assistant/{skills/docs-reduce-redundancy,agents/docs-redundancy-fixer.ts,workflows/reduce-redundancy.ts,workflows/phases/reduce-redundancy.ts}`,
audited in [`WRITER-ASSISTANT-MIGRATION.md`](../../../WRITER-ASSISTANT-MIGRATION.md) §4 before that repo was deleted.

## The problem it solves

A page that says each thing exactly once is shorter and easier to read than one that defines
`Ledger` in the Overview, again in Use Cases, and a third time above the API table. None of
flowrite's current gates notice: the reviewer checks structure, coverage and the 28 style rules;
the fact-checker checks whether claims are *true*, not whether they are *repeated*. Only rule 3
(no filler phrases) touches redundancy at all, and only its most superficial form.

writer-assistant classified the problem in three kinds, and the classification is worth keeping:

| Kind | What it is | Example |
|---|---|---|
| **lexical** | the same word or phrase twice where one suffices | "return back"; the same 3-word phrase opening two consecutive paragraphs |
| **structural** | decorative transitions that guide nothing | "Furthermore,", "As mentioned above," |
| **semantic** | the same concept, definition, motivation or example explained more than once | "`Chunk` is an immutable sequence" in three sections |

flowrite's rule 3 covers part of **structural**. **Lexical** and **semantic** are unaddressed.

## What is deliberately not ported

writer-assistant ran a scan → fix loop: a fresh scanner session per round emitting
`[REDUNDANCY] Type: … | Section: … | …` lines, regex-parsed by
`parseFindings()`, handed to a reused fixer session, up to 3 rounds, with an `unresolvable`
set so the scanner stopped re-flagging what the fixer had already refused.

None of that machinery comes over:

- **No harness tool.** The repo's rule is that code holds a phase's result only when TypeScript
  must *act* on it. `review_page` and `fact_check_page` earn that because a verdict is derived
  from their output. Nothing gates on redundancy (see "Why it does not gate" below), so the
  result only ever goes into the model's head — a schema would buy nothing and cost two relay
  turns per call.
- **No regex-parsed prose protocol.** It exists in writer-assistant because Flue 1.x sessions
  returned text. A flowrite delegate that must return data uses a `valibot` result schema; one
  that need not, returns prose.
- **No scan/fix split, no round loop.** Two roles and three rounds were how writer-assistant got
  a fresh context per scan. A flowrite delegate already gets its own context window, and its
  input is one page — it can read, decide and edit in a single delegation.
- **No separate `SKILL.md`.** Every mounted skill costs context on every root turn. This
  content is used by exactly one delegate, so it lives in that role's instructions file, the
  way `fact-checker.md` does.

Net: a ~350-line TypeScript phase plus a 90-line skill becomes **one role, one `.md`, and a
numbered step**.

## The design

### A role: `redundancy_editor`

`src/subagents/redundancy-editor.ts` — `defineSubagent`, no tools and no skills of its own, so
it cannot re-enter the pipeline; it inherits read/edit/grep/bash from the parent sandbox, the
same way `fact_checker` does.

`src/subagents/redundancy-editor.md` carries the identity. Ported from the old SKILL.md, with
its three tables kept (Detection Guide, Fixing Strategies, Common Mistakes) because they are the
substance, and its Flue-1-era "Agent Workflow" / "Integration" sections dropped. Adapted to this
repo's conventions:

- ✅/❌ pairs instead of prose rules, per `CLAUDE.md` §3.
- A pointer to writing-style rule 3 rather than a restatement of it — one owner per rule.
- The receipt requirement: report what was cut **and what was deliberately left**, so a run log
  shows judgment rather than a count.

The bounds matter more than the detection, because the failure mode here is over-cutting —
writer-assistant's own "Common Mistakes" table lists it first:

- Never delete the last remaining example of anything.
- Never delete a code block; prose is the target.
- A repeated definition keeps its **first** occurrence; later ones become a link to it, never a
  deletion.
- Transitions that carry logic ("first", "then", "because") are not redundancy.
- Below three occurrences, a repeated *phrase* is not a finding.

### Placement: after **Write**, before **Companion examples**

New step 5 in each of `src/instructions/{data-type-ref,module-ref,tutorial}.md` — every later step
shifts by one (10 steps today in `data-type-ref` and `tutorial`, 11 in `module-ref`).

This position is load-bearing, not arbitrary:

- **Upstream of three independent verifications.** mdoc verify, fact check and review all run
  after it, so a cut that breaks a shared mdoc scope, deletes a claim's context, or mangles a
  section is caught by machinery that already exists. Placing the pass *after* fact check would
  mean the page that was checked is not the page that ships.
- **Downstream of a complete draft.** Semantic redundancy is only visible once every section
  exists.
- **Costs no extra mdoc round.** Step 6 was going to compile the page anyway.

For a hierarchical module run, the pass applies per page — the module page and each subpage —
because cross-page repetition is handled by linking, which is rule 7's job, not this one's.

### Why it does not gate the verdict

Deliberate, and the opposite of the call made for fact-check. A fact-check drift is a statement
that is *false*: evidence, two citations, checkable. A redundancy finding is a judgment that
something is *unnecessary* — and a false positive does not merely annoy, it **removes meaning
from a correct page**. Failing a run on an uncalibrated aesthetic judgment would make the gate
the most likely thing in the pipeline to be switched off.

So: the editor edits, reports, and the existing gates judge the result. If measurement later
shows it reliably finds real repetition, promoting a `semantic` finding to a review checklist
item is a one-line change; nothing here forecloses it.

## Files

**New**

- `src/subagents/redundancy-editor.md` — the role's identity, ~70 lines.
- `src/subagents/redundancy-editor.ts` — `defineSubagent({ name: 'redundancy_editor', ...TIERS.redundancyEditor, description, agent })`.

**Modified**

- `src/runtime/models.ts` — a `redundancyEditor` tier. **Sonnet / `low`**, not Haiku:
  writer-assistant used Haiku and the task is deleting prose without losing meaning, which is a
  judgment call on every cut. `REDUNDANCY_EDITOR_MODEL` / `_EFFORT` override it.
- `src/runtime/composition.ts` — add the role to `ROLES` (line 48, after `factChecker`; the
  array is consumed by `useSubagent` *after* `useSandbox`, and that order is measured — see the
  comment at lines 159–162). Add `'redundancy'` to the `skipPhase` picklist (line 50) and widen
  its description, which currently says "only code-gated phases": this phase is model-honored
  through `skippedPhases()`, not code-gated, and that distinction should be stated rather than
  quietly broken.
- `src/runtime/run-context.ts` — `'redundancy'` in the `SkipPhase` union.
- `src/runtime/self-report.ts` — `'redundancy'` in the retrospective's `phase` picklist, in run
  order (after `write`, before `examples`).
- `src/instructions/{data-type-ref,module-ref,tutorial}.md` — the new step 5, steps renumbered,
  and one guardrail per file: *a redundancy edit removes words, never facts — if a cut would
  drop information that appears nowhere else, it is not redundancy.*
- `src/agent.ts` — the three `directive` strings restate the phase list; each gains
  "→ redundancy" between write and examples.

**Unchanged, and worth noting why:** `run-telemetry.ts` gets no flag and no repeat limit. Both
exist to police *budgets*, and a plain `task` delegation has none — there is no tool to refuse a
second call and no counter to bypass. If measurement shows the model calling it repeatedly, that
is the moment to add one, not before.

**Tests:** none of the existing suites enumerate roles, so nothing breaks mechanically.
`src/agent.test.ts`'s harness-tool invariant still expects exactly
`['review_page', 'fact_check_page']` — and still passes, because this phase adds no tool. That
is the invariant working as designed.

## Verification

Unit tests buy nothing here: there is no budget, no schema, no parser, no derived verdict. The
only question is behavioral, so the measurement is a run.

**A/B on `tinytally`** — two `data-type` runs on the same fixture, per `CLAUDE.md` (2 types ×
3 methods, invented API names, cheap):

```bash
# control
flue run src/agent.ts -m "Write reference documentation for the Ledger data type" \
  --data '{"projectPath":"…/fixtures/tinytally","skipPhases":["redundancy"]}'
bash scripts/archive-docs.sh flue.log redundancy-control-turn1

# treatment
flue run src/agent.ts -m "Write reference documentation for the Ledger data type" \
  --data '{"projectPath":"…/fixtures/tinytally"}'
bash scripts/archive-docs.sh flue.log redundancy-turn1

diff -u fixtures/tinytally-archive/redundancy-control-turn1/docs/reference/ledger.md \
        fixtures/tinytally-archive/redundancy-turn1/docs/reference/ledger.md
```

`archive-docs.sh` before any commit, always — `CLAUDE.md` is explicit that `git add -A` after a
run sweeps generated pages and `build.sbt` edits into the next commit, and that this has already
forced two history rewrites.

**Pass:** the diff is made only of removals and link substitutions; every removal is prose;
no code block, no example, and no fact disappears; the run's verdict is unchanged from control.

**Fail — and each of these is a kill, not a tuning knob:**

- The page loses a fact, an example or a code block → the bounds do not hold, and a phase that
  can silently delete information from a verified page has negative value.
- The diff is empty on both runs → nothing to find on a small page; re-measure on `tinyoptics`
  before concluding either way.
- The verdict changes → the pass broke something three later gates then had to argue about.

**What to read afterwards**, the way this repo reads runs — never from the agent's closing prose:

```bash
grep 'flowrite:\|run verdict:\|run insights:' flue.log
node scripts/run-report.mjs fixtures/tinytally-archive/redundancy-turn1/run-report.json
```

The per-component cost table answers the question the design cannot: one more Sonnet delegation
per page, against a diff someone has to look at and judge worth it.

## Risks

- **Over-cutting is the failure mode.** Everything in the role's bounds section exists for it,
  and the A/B diff is the test that matters.
- **It is unmeasured until that run happens.** This repo has deleted every tool it wrote against
  an imagined problem; this phase should be held to the same standard. If the tinytally diff is
  empty or harmful, delete it rather than tune it.
- **Overlap with rule 3 will drift.** Two owners for "no filler" means one of them will
  eventually contradict the other. The role points at rule 3 rather than restating it,
  precisely so there is one place to change.
- **A follow-up worth naming now:** if this lands and measures well, the same role handles the
  *cross-page* case (a definition repeated between a module page and its subpages) — but that
  needs a page-set input and belongs to the unbuilt docs-gardener layer
  (`2026-07-16-docs-gardener-design.md`), not here.
