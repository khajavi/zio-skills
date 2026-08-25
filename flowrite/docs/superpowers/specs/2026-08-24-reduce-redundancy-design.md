# Porting `reduce-redundancy` to flowrite

**Status:** Implemented as `src/redundancy.ts` — a standalone agent, unmeasured against a live model.
See `BACKLOG.md` finding 9 for the measurement this still owes.
**Source:** `writer-assistant/{skills/docs-reduce-redundancy,agents/docs-redundancy-fixer.ts,workflows/reduce-redundancy.ts,workflows/phases/reduce-redundancy.ts}`,
audited in [`WRITER-ASSISTANT-MIGRATION.md`](../../../WRITER-ASSISTANT-MIGRATION.md) §4 before that
repo was deleted.

## The problem it solves

A page that says each thing exactly once is shorter and easier to read than one that defines
`Ledger` in the Overview, again in Use Cases, and a third time above the API table. None of
flowrite's gates notice: the reviewer checks structure, coverage and the 28 style rules; the
fact-checker checks whether claims are *true*, not whether they are *repeated*. Only rule 3 (no
filler phrases) touches redundancy at all, and only its most superficial form.

writer-assistant classified the problem in three kinds, and the classification is worth keeping:

| Kind | What it is | Example |
|---|---|---|
| **lexical** | the same word or phrase twice where one suffices | "return back"; the same 3-word phrase opening two consecutive paragraphs |
| **structural** | decorative transitions that guide nothing | "Furthermore,", "As mentioned above," |
| **semantic** | the same concept, definition, motivation or example explained more than once | "`Chunk` is an immutable sequence" in three sections |

flowrite's rule 3 covers part of **structural**. **Lexical** and **semantic** are unaddressed.

## What is deliberately not ported

writer-assistant ran a scan → fix loop: a fresh scanner session per round emitting
`[REDUNDANCY] Type: … | Section: … | …` lines, regex-parsed by `parseFindings()`, handed to a reused
fixer session, up to 3 rounds, with an `unresolvable` set so the scanner stopped re-flagging what the
fixer had already refused.

None of that machinery came over:

- **No harness tool.** The repo's rule is that code holds a phase's result only when TypeScript must
  *act* on it. `review_page` and `fact_check_page` earn that because a verdict is derived from their
  output. Nothing gates on redundancy, so the result only ever goes into the model's head — a schema
  would buy nothing and cost two relay turns per call.
- **No regex-parsed prose protocol.** It exists in writer-assistant because Flue 1.x sessions returned
  text.
- **No scan/fix split, no round loop.** Two roles and three rounds were how writer-assistant got a
  fresh context per scan. One agent reads, decides and edits.

Net: a ~350-line TypeScript phase plus a 90-line skill became **one agent module, one instruction
file, and one skill resource**.

## Superseded: it was going to be a phase of the write flow

The first version of this spec put it at step 5 of all three instruction files, on every run, as a
`defineSubagent` role in `ROLES` with `'redundancy'` in the `SkipPhase` union. That was rejected
before implementation, and the reasoning is worth keeping because it generalises:

**It is a maintenance pass, not a production step.** The page it edits already exists, already
compiled, already passed review. Charging every write run a delegation to re-read a page for
repetition — when the drafter that just wrote it is the party best placed not to create the
repetition — spends tokens on every run for a problem that appears on some.

**A standalone entry point was itself a missing capability.** Audit gap §8 records that
writer-assistant could be pointed at a page nobody was writing and flowrite could not. Building this
as a phase would have closed §4 while leaving §8 exactly as wide.

What the rejection cost: a write run's output is no longer redundancy-checked unless someone runs the
editor over it. That is the intended trade — the pass is available, not automatic.

## The design

### A standalone agent: `src/redundancy.ts`

A second `'use agent'` module beside `src/agent.ts`, deliberately small: model, writing-style skill,
sandbox, instructions. No roles, no phase tools, no `useRunBasics` — that mounts the seven-role roster
and the docKind machinery, none of which applies to an agent that delegates nothing and gates nothing.

```bash
flue run src/redundancy.ts -m "reduce redundancy in docs/reference/ledger.md" \
  --data '{"projectPath":"/path/to/checkout"}'
```

- The **page path comes from the message**, matching `agent.ts`'s principle that `--data` carries
  "only what a sentence cannot express". `--data` carries `projectPath` alone.
- If the request names no page, the agent asks and stops. Guessing means editing a file nobody asked
  about, and this run edits prose in place — a wrong guess is damage, not wasted effort.
- Tier `redundancyEditor`: Sonnet / `low`. writer-assistant used Haiku; the work looks cheap and is
  not. Every cut is a judgement about whether words carry anything, and unlike every other role here
  this one edits a page that already passed review with no gate downstream to catch it.
- `agentName = 'redundancy-editor'`, pinned as a literal for the reason `DocsWriter.agentName`
  records: storage is keyed by the identifier, so a rename orphans stored conversations.
- No `durability` static. The writer's six hours exist because a module reference drives sbt through
  eight phases; this reads one page and stops.

### Where the content lives

The skill directory is the canonical home; the agent imports its reference file as a string. This is
the repo's existing pattern — `src/runtime/kind-docs.ts` does it for six files, and states the rule:
"Each skill's `SKILL.md` is a stub pointing at the file imported here, so this module is a delivery
route and never a second copy."

```
src/skills/reduce-redundancy/SKILL.md            stub + frontmatter; nothing mounts it today
src/skills/reduce-redundancy/references/guide.md  the substance: detecting, fixing, bounds, receipt
src/instructions/redundancy.md                    who the agent is; does not restate the guide
```

Imported rather than mounted, because `kind-docs.ts` measured what mounting costs: "three tool
round-trips to activate a skill and read its resource, each re-sending its whole accumulated context …
2 round-trips wasted in `write-data-type-ref-turn20` and 5 in `write-module-ref-turn5`, which is why
`600f48a` unmounted it." A single-purpose agent needs the guide on turn 1 of every run, so progressive
disclosure buys nothing and adds a failure mode: the model declining to activate, then editing the
page without ever reading the bounds.

`writing-style` is mounted, for the mirror-image reason: its 28 rules are consulted only when a cut
happens to touch one.

It stays a skill directory so that the day the **drafter** should pre-empt redundancy instead of the
editor cleaning it up, `useSkill(reduceRedundancy)` is a one-line change with no content moved. Not
built now: it changes what the drafter produces, and nothing measures that the drafter produces
redundancy worth pre-empting.

### The bounds, and why they are the design

Over-cutting is the failure mode — writer-assistant's own "Common Mistakes" table lists it first.

**Never edit a code block.** Prose is the only target, and this single bound is what makes a standalone
editor safe. mdoc blocks share one scope down the whole page, so deleting a "duplicate" example can
break every block after it, and the compiler blames a line the editor never looked at. Nothing
downstream would catch it: there is no mdoc verify after this run. writer-assistant's strategy table
allowed exactly that cut ("repeated example: choose the best, remove others"); this port forbids it
and accepts leaving repeated examples in place as the price.

The rest, in `references/guide.md`: never delete the last of anything; a repeated definition keeps its
first occurrence and later ones become a link; transitions carrying logic ("first", "then", "because")
are not redundancy; under three occurrences a repeated phrase is not a finding; a cut removes words,
never facts; headings, frontmatter and links belong to the page's template and its reviewer.

Then the receipt: report what was cut **and what was deliberately left**. Leaving something is a
finding — it says a bound held. A report listing only cuts cannot be told apart from a pass that never
noticed the borderline cases.

### Why it gates nothing

Deliberate, and the opposite of the call made for fact-check. A fact-check drift is a statement that
is *false*: evidence, two citations, checkable. A redundancy finding is a judgement that something is
*unnecessary* — and a false positive does not merely annoy, it **removes meaning from a correct page**.

It is not in a verdict, and it is not in a write run at all, so there is nothing for it to fail.

## Files

**New:** `src/redundancy.ts`, `src/instructions/redundancy.md`,
`src/skills/reduce-redundancy/{SKILL.md,references/guide.md}`,
`test-fixtures/redundancy/{seeded-page.md,verify.sh}`.

**Modified:** `src/runtime/models.ts` (the tier), `src/app.ts` (a comment recording that the second
agent is deliberately unmounted), `src/agent.test.ts` (the archive label).

**Untouched, and that is the point:** `src/instructions/{data-type-ref,module-ref,tutorial}.md`,
`agent.ts`, `composition.ts`, `run-context.ts`, `self-report.ts`, `run-telemetry.ts`. A write run is
byte-for-byte what it was: no extra delegation, no extra context, no new way to fail.
`agent.test.ts`'s harness-tool invariant still expects exactly `['review_page', 'fact_check_page']`.

## Verification

Offline: `tsc --noEmit` clean, and the 102 existing tests pass. No new unit tests beyond the archive
label assertion — there is no budget, no schema, no parser and no derived verdict here, and the only
question this raises is behavioral.

The behavioral test is `test-fixtures/redundancy/verify.sh`, which needs a live model and is therefore
blocked until the API key renews (2026-09-01). It plants a page carrying **7 seeded redundancies and 5
decoys**, runs only this agent, and diffs:

```bash
bash test-fixtures/redundancy/verify.sh
```

The second number is the one that matters. Its mechanical checks compare code-block *text* and heading
*text* rather than line numbers, because removing a prose line shifts every number below it and a
numbered comparison would report every successful run as a failure.

- **Pass** — every seed gone; every decoy intact; code blocks byte-identical; headings unchanged.
- **Kill, not tune** — a code block is touched, a heading moves, or a decoy is cut. A pass that can
  silently delete information from a verified page has negative value.
- An empty diff means re-seed more aggressively before concluding the agent is useless.

## Risks

- **Over-cutting.** Everything in the bounds section exists for it, and the decoys are the test.
- **Unmeasured until `verify.sh` runs.** This repo has deleted every tool it wrote against an imagined
  problem. If the seeded page comes back damaged, delete the agent rather than tuning it.
- **Overlap with rule 3 will drift.** Two owners for "no filler" means one will eventually contradict
  the other. The guide points at rule 3 rather than restating it, so there is one place to change.
- **Nothing runs it.** A standalone entry point is only as useful as the habit of using it. If it goes
  unrun for a month, that is evidence about the design, not about the user.
- **The cross-page case is out of scope.** A definition repeated between a module page and its
  subpages needs a page-set input, and belongs to the unbuilt docs-gardener layer
  (`2026-07-16-docs-gardener-design.md`).
