# Skills-only flowrite

*A design for a developer who has not worked on flowrite or Flue before. Concepts first, then the
code, then how to measure it, then how to undo it.*

Scope: **data-type-ref only.** `module-ref` and `tutorial` keep the current architecture until this
one is measured. Nothing is deleted in this change.

---

## 0. Vocabulary

Every claim below is quoted from the docs that ship inside the repo. Read them at
`node_modules/@flue/runtime/docs/`, or run `./node_modules/.bin/flue docs read <path>`.

**Agent.** A function returning instructions, plus hook calls declaring what it can do (`useModel`,
`useSandbox`, `useTool`, `useSkill`, `useSubagent`). flowrite's is `src/agent.ts`. It runs one
conversation with a model — the *root conversation*.

**Skill.** Expertise loaded on demand. A `SKILL.md` with frontmatter; the model pulls it in when the
description matches what it is doing. Costs nothing until used.

**Plain tool.** A function the model calls: input in, output out, no model involved.
`check_method_coverage` is one. Deterministic and free.

**Harness tool.** A tool declared `harness: true`. It gets its own private conversation with a model
— a *scratch conversation*. flowrite calls these **phases**.

> "Runs a model operation in the harness's own scratch conversation — separate from the agent's
> public conversation … **Repeated calls within one harness continue that conversation**"
> — `reference/agent-api.md:402`

That sentence is the cost problem. A phase's scratch conversation does not reset between the model
calls it makes. It grows, and every turn re-sends all of it.

**Subagent.** A named delegate with its own instructions, model, and context.

> "The delegate works in its own fresh context, with its own instructions and capabilities, and only
> its final answer returns to the parent's conversation." — `guide/subagents.md:7`

**The `task` tool.** How delegation actually happens.

> "Every agent's tool set includes a framework-owned `task` tool, and the declared delegates are
> cataloged by name and description in an 'Available Agents' section of the system prompt."
> — `guide/subagents.md:40`

> "The `task` tool is always present, but its required `agent` parameter only resolves against
> declared delegates." — `guide/subagents.md:46`

**This is the fact the whole design rests on: delegation does not need a harness tool.** The root
agent can call `task` itself. The harness tool was only ever a wrapper that added schemas and guards
around a delegation the root agent could already perform.

**Relay.** What flowrite does today, and what has no name in Flue because Flue does not ask for it.
A phase's scratch conversation receives "delegate this to the researcher", calls `task`, receives the
answer, then calls `finish` to hand validated data back to TypeScript. Two assistant turns of
scratch-conversation overhead per delegation, in a conversation that never resets.

---

## 1. Why

### 1.1 The relay is most of the cost

`fixtures/tinyoptics-archive/write-module-ref-turn9/token-usage.json`, a 4-type module run,
416 turns, $3.30:

| component | shape | tokens | tok% | cost | cost% |
|---|---|--:|--:|--:|--:|
| `agent:default` | one conversation that never resets | 3,309,097 | 34% | $1.2988 | **39%** |
| `subagent:drafter` | fresh per call (8) | 4,133,264 | 43% | $1.1730 | 36% |
| `subagent:researcher` | fresh per call (6) | 1,719,716 | 18% | $0.5994 | 18% |
| `subagent:docs_integrator` | fresh (1) | 417,123 | 4% | $0.1304 | 4% |
| `subagent:designer` | fresh (3) | 96,060 | 1% | $0.0983 | 3% |

`agent:default` made **zero phase calls** — it is pure orchestration and relay — and cost more than
research, design and integrate combined.

Measured directly on the review phase of turn 11:

```
relay turns                       38
scratch context grew  18,671 → 143,214 tokens
the 17 delegation payloads       ~46k
tokens actually spent           ~3.25M
```

70× amplification to move 46k of payload.

### 1.2 The bug class dissolves

Three shipped bugs, all one defect: *a phase drafting from a value no component produced.*

| phase | relayed value | fixed in |
|---|---|---|
| module subpage plan | a plan the model composed itself | `b43d5b1` |
| data-type research | a payload for a type whose research had errored | `2463411` |
| module plan | a plan the design phase never returned | `6760c3d` + `9870589` |

Roughly 300 lines exist to police that handoff — `phase-ledger.ts` (`requireResearch`,
`requireModulePlan`, `planShape`, `operationNames`) and `phase-guard.ts`.

**A skills-only path performs no such handoff.** There is no structured object passing through the
model's conversation between two tool calls, so there is nothing to substitute. The failure mode
degrades from "silently substituted object" to ordinary hallucination, which method coverage and
review already catch.

This is removing the thing being guarded, not removing the guard.

### 1.3 Give-ups disappear

`ResultUnavailableError` fires when a delegate cannot satisfy a `result` schema:

> "When the model gives up or exhausts its follow-up attempts, the call rejects with
> `ResultUnavailableError`." — `reference/agent-api.md:404`

Measured across the archives: **20 give-ups in 8 of 31 runs.**

```
module-turn3 3 · turn4 1 · turn5 3 · turn7 1
dtr-turn7 4 · turn8 2 · turn9 3 · turn10 3
```

No `result` schema, no re-ask loop, no exhaustion path.

### 1.4 What the objection was

Harness tools are over-engineering here. flowrite already carries eight skills holding the real
expertise — `data-type-ref-structure`, three checklists, `writing-style`, `mdoc-conventions`. The 15
harness tools sequence and police those skills; they do not contain knowledge.

---

## 2. What we build

```
BEFORE                                     AFTER (data-type-ref only)

root agent                                 root agent  (sonnet@high)
 ├─ research_data_type      [harness]       ├─ skill: data-type-ref        ← the procedure
 │   └─ scratch conv                        ├─ skill: data-type-ref-structure
 │       └─ task → researcher               ├─ skill: data-type-ref-checklist
 │           (result schema, re-ask)        ├─ skill: writing-style
 ├─ design_data_type_plan   [harness]       ├─ skill: mdoc-conventions
 │   └─ … → designer                        ├─ built-ins: read write edit bash grep glob
 ├─ write_data_type_reference [harness]     ├─ plain: check_method_coverage, gh_query
 │   └─ … → drafter                         └─ task → researcher (haiku/low)
 ├─ write_companion_examples [harness]             writes .flowrite/research/<type>.md
 ├─ integrate_data_type_ref  [harness]
 ├─ review_page             [harness]      no harness tools · no schemas · no ledger
 ├─ phase-guard  (AsyncLocalStorage)       no phase-guard · no delegate.ts on this path
 ├─ phase-ledger (record / require)
 └─ delegate.ts  (relay + give-up retry)
```

### 2.1 The filesystem replaces the ledger

> "Because parent and child share a sandbox, files are a natural hand-off surface: `Reproducer`
> writes `report.md`, and the parent reads it after the task returns." — `guide/subagents.md:92`

So the researcher writes its findings to `.flowrite/research/<type>.md` and returns one line naming
the path. This is better than returning prose through the conversation on four counts:

- The root conversation grows by a path, not by a research dump.
- The findings are durable and inspectable by a human debugging a bad page.
- It *is* the research cache — no `research-cache.ts`, no SQLite, no schema-validate-on-read.
- Combined with `subagents.md:44` ("not the child's intermediate reasoning, tool calls, or file
  reads" enter the parent), the reading cost stays entirely inside the child.

### 2.2 What each old phase becomes

**The subagents stay.** What goes is the harness-tool layer wrapping them — the scratch conversation,
the schemas, the relay. Every role keeps its own instructions, model and fresh context, and the root
agent reaches it with the built-in `task` tool instead of through a phase tool.

| old phase | becomes |
|---|---|
| `research_data_type` | `task` → `researcher`, which writes `.flowrite/research/<type>.md` |
| `design_data_type_plan` | `task` → `designer` |
| `write_data_type_reference` | `task` → `drafter` |
| `write_companion_examples` | `task` → `examplesBuilder` |
| mdoc verify | unchanged — already agent-driven `bash` |
| `integrate_data_type_reference` | `task` → `docsIntegrator` |
| `review_page` | `task` → `reviewer` |

So the delegation count is unchanged and the **relay** is what disappears: today a phase's scratch
conversation spends two turns per delegation relaying work it then re-sends on every later turn
(38 turns for 17 delegations, 18,671 → 143,214 tokens). The root agent calling `task` directly spends
one tool call.

### 2.3 Why the roles are not folded into the agent

An earlier draft of this file had five of them stop being used, with the agent doing the work and
reviewing its own page. That is rejected: separate roles are what give per-subject context isolation
and independent judgement. Isolated researchers are what kept `Ledger`'s methods off `Window`'s page,
and a reviewer with its own clean context judges a page the author cannot judge — tinytally turn1 had
the author file `passed` over 14 failures the independent reviewer had just reported.

Delegation was never the expensive part. The wrapper around it was.

---

## 3. Decisions taken — do not re-open

1. **Keep every subagent.** `researcher`, `designer`, `drafter`, `examplesBuilder`, `docsIntegrator`
   and `reviewer` all stay, each reached with the built-in `task` — no harness tool, no schema.
   Stated 2026-08-14: separate agents for drafting, reviewing and researching are wanted. This also
   keeps model tiering (`researcher` on haiku/low was $0.0977 of turn1's $0.7935) and keeps review
   independent of the author.
2. **Keep deterministic plain tools.** `check_method_coverage` and `gh_query` are not harness tools,
   so they are outside the objection, and code beats prose for a countable check.
3. **data-type-ref only.** One variable.
4. **Delete nothing.** The phase tools stay mounted for the other two kinds. Deletion is a later
   change, conditional on the measurement.
5. **In place on `refactor/simplify-flowrite`.** `main @ 729b6bb` is the baseline; A/B is a checkout.
6. **The procedure stays in `instructions`, not in a new skill.** Skills load on demand, so a
   procedure packaged as one can simply fail to load — and an instruction telling the model to load
   it is the kind of directive this project has measured at 0/9 compliance (`cd`, 300 violations).
   `instructions` are present on every turn by construction. The eight existing skills keep doing
   what skills are good at: reference material pulled in when the step needs it. Override this if you
   specifically want the procedure packaged as a skill — it is a one-file move either way.

---

## 4. The code

### 4.1 `src/instructions/data-type-ref.md` — the rewritten procedure

No new file. The existing 62-line instruction set keeps its identity and guardrail sections; only the
numbered flow changes, because the phase-tool calls become ordinary work and the research briefing
becomes prose (there is no schema left to carry it).

Unchanged: the "What a good reference page is" section, and the Guardrails. Replaced, steps 2–8:

```markdown
You write **data type reference pages** — the exhaustive API map of a single type. A reader lands
here to look up any constructor or operation, so completeness is the point.

You own the goal. Drive the flow below and adapt when reality differs; do not follow a step that no
longer fits.

## 1. Confirm the type
If the request named no type, ask. Never invent one.

## 2. Research it
Delegate to the `researcher` subagent with the `task` tool. The child sees none of your
conversation, so the prompt is the entire briefing — say the type name, the checkout path, and
this:

    Research the ZIO data type "<Type>" in this checkout and write your findings to
    `.flowrite/research/<type-kebab>.md`. Return only that path and a one-line summary.

    Cover, with a repo-relative `path:L<start>-L<end>` citation for each fact:
    - the structural declaration (trait/class, type params, variance, extends — no bodies)
    - what the type is for, in one or two sentences
    - every companion constructor and factory. For a type built by its own primary
      constructor, copy the verbatim class declaration (`final case class T(...)`,
      `class T(...)`) — never a synthesized `def apply`.
    - EVERY public operation with its verbatim signature, a short real usage snippet with
      its evaluated result, and any caveat. Reference pages are exhaustive; omit nothing.
    - predefined instances, subtypes, and worthwhile comparisons
    - the imports a reader needs and the sbt dependency
    - verbatim supporting detail — real signatures, scaladoc excerpts, test snippets — that a
      writer can copy from instead of reasoning from general knowledge

    Never guess a path or a line. Cite only files you opened.

Read the file it wrote before going further. If it is missing or thin, say so and re-delegate
rather than filling the gap from memory.

## 3. Plan the page
Load the `data-type-ref-structure` skill and decide, from the research: which optional sections
apply, and how the operations group into Core Operations categories. Give no category a single
member — fold it into a neighbour.

## 4. Write it
Write `docs/reference/<type-kebab>.md` with the `write` tool. Ground every signature, example and
claim in the research file. Load `writing-style` and follow it. Load `mdoc-conventions` for the
fence forms.

## 5. Companion examples
If the page embeds standalone files with `mdoc:embed`, write them and build the examples leaf
before mdoc runs — an `mdoc:embed:<path>` block fails unless the file already exists on disk.
Skip this when the page uses only inline mdoc blocks.

## 6. Verify with mdoc
Check that the docs project's `.dependsOn(...)` includes this type's module, and add it if
missing. Then compile the page:

    sbt "docs/mdoc --in docs/reference/<file>.md --out website/docs/reference/<file>.md"

One quoted argument — see `mdoc-conventions`. Fix every `[error]`. The page is not done until
this reports zero.

## 7. Integrate
Wire the page under the **Reference** category of `docs/sidebars.js`, and link it from
`docs/index.md`. Reference, never Guides.

## 8. Review
Run `check_method_coverage` for the type and document anything it reports missing, or justify each
omission. Then load `data-type-ref-checklist` and `writing-style` and check the page you wrote
against every item. Fix what fails. Name anything still failing in your summary, and report the
run as failed when something is.

## 9. Retrospective
In your final result, report the real obstacles you hit, how you resolved each, and — where you
can name one — the instruction or tool change that would prevent it next time. Report only
friction you actually hit.

## Guardrails
- Your shell starts in the repo root; you are already inside the checkout. Run `sbt`, `mdoc` and
  everything else with repo-relative paths. `cd` only *into* a subdirectory a build truly needs.
- Every signature and example traces to real source.
- The page lives at `docs/reference/<type-kebab>.md`, and its `id` matches the filename.
```

### 4.2 `src/agent.ts` — the `data-type` row

The `KINDS` table already holds everything that differs between kinds. Exactly one field changes:

```ts
  'data-type': {
    label: 'write-data-type-ref',
    instructions: dataTypeRefMd,
    skills: [mdocConventions, dataTypeStructure, dataTypeChecklist],
    // Emptied. The procedure in dataTypeRefMd now does this work directly: the built-in sandbox
    // tools write and verify the page, and one `task` delegation researches it. `task` needs no
    // declaration — it is always present and resolves against whatever useSubagent declared
    // (guide/subagents.md:40,46), so removing these six tools removes the harness layer without
    // removing the researcher.
    tools: [],
    plainTools: [checkMethodCoverage],
    directive: (subject: string, _facts: DirectiveFacts) =>
      `Write a complete, compile-verified data type reference page for: ${subject}. ` +
      `Research it by delegating to the researcher subagent, then write, verify with mdoc, ` +
      `integrate and review it yourself.`,
  },
```

Three things deliberately stay as they are:

- **`skills`** — `mdocConventions`, `dataTypeStructure`, `dataTypeChecklist` were already the
  on-demand reference material and keep that job.
- **`writing-style` is not listed**, and must not be added: `useDocsAuthorBase()` already mounts it
  for every kind (`composition.ts:12`). Commit `600f48a` removed a second mounting of it from the
  drafter for this reason.
- **`plainTools: [checkMethodCoverage]`** — unchanged. `gh_query` reaches the researcher through
  `Researcher()`'s own `useTool` (`subagents/researcher.ts:17`), so it needs no row entry.

`useSubagent(researcher)` stays where it is in `composition.ts` — **after `useSandbox`**. Declared
before it, roles never reach the model at all; that ordering cost a whole run to isolate and the
comment at `composition.ts:133` records it.

### 4.3 What is NOT touched

`research.ts`, `design-doc-plan.ts`, `write-doc.ts`, `integrate.ts`, `review-page.ts`,
`write-companion-examples.ts`, `phase-guard.ts`, `phase-ledger.ts`, `delegate.ts`,
`research-cache.ts` — all stay, all still used by `module-ref` and `tutorial`. Their tests stay
green.

---

## 5. Verification

### 5.1 There is no baseline yet — make one first

The archives hold `tinytally` runs for **module-ref only** (turns 1 and 2). No `tinytally`
data-type-ref run exists, so there is nothing to compare against. Step one is a baseline run on
the *current* architecture:

```bash
cd /home/milad/sources/zio-skills/flowrite
bash fixtures/tinytally/scripts/run-data-type-ref.sh Ledger
# then, BEFORE staging anything:
bash fixtures/tinytally/scripts/archive-docs.sh <log> dtr-baseline
```

`archive-docs.sh` lives per fixture and **resets the fixture** when it finishes, so commit any edits
to the fixture's own scripts *before* archiving or they are destroyed.

Runs use haiku via `--env .env.testing`, need `NODE_USE_ENV_PROXY=1` and
`no_proxy=localhost,127.0.0.1`, and want `FLUE_VERBOSE_TOOLS=1`. The script handles all three.
**Print the log path unprompted.**

### 5.2 Then the same type on the new path

| metric | why it matters |
|---|---|
| cost, turns | the point of the change |
| `agent:default` share | the relay is gone; this is where the saving should appear |
| **method coverage %** | **the quality gate.** If the 98 deleted field descriptions were load-bearing, this is where it shows |
| give-ups | should be 0, structurally |
| mdoc `[error]` count at finish | must be 0, as today |
| invented API | tinytally's names are made up, so fabrication is visible |
| review verdict vs the shipped page | does the verdict describe what was written |

### 5.3 The two risks to watch, named in advance

**The verdict is now evidence, and it will read worse.** `d700d2b` made `report_run_result` derive the
verdict from what the reviewer returned rather than accept one, so a run that hits the round cap with
failures records `failed` instead of `passed`. Expect the skills-only run's `verdict.json` to look
worse than older archives while describing the same or better pages — the older ones were self-reported
and turn1's was the inverse of its review. Compare coverage and fabrication across the A/B, and read
verdicts only against other post-`d700d2b` runs.

**One deterministic seam disappears.** `recordedVerdict()` works because `review_page` is a harness
tool, so TypeScript holds the reviewer's result. Once review is a direct `task` delegation, the root
agent gets prose and nothing in TypeScript observes it — so the verdict becomes self-reported again by
construction. This is unresolved, and it is the one place where dropping harness tools costs something
real rather than dissolving a problem. Options, none chosen yet: keep `review_page` as the last
harness tool; have `reviewer` write its findings to a file the way `researcher` will, and parse that;
or accept a self-reported verdict and rely on `check_method_coverage` as the only hard gate. Decide
before converting review, not after.

**One growing conversation.** Design, writing, integration and review all land in the root
conversation now. Research does not (`subagents.md:44`), which is the expensive part — but a
multi-type run would still accumulate. data-type-ref is one type, so this change cannot measure it;
do not generalize the result to `module-ref` without running `module-ref`.

---

## 6. Build order — one commit each

| # | commit | contents |
|--:|---|---|
| 1 | `test(fixture): baseline data-type-ref run on tinytally` | the archived baseline only; no source change |
| 2 | `refactor(instructions): drive data-type-ref without phase tools` | `src/instructions/data-type-ref.md`. Still unreached — the row's `tools` are what the model sees, so behaviour is unchanged until commit 3. |
| 3 | `refactor(agent): empty the data-type row's phase tools` | one field. The switch. |
| 4 | `docs(flowrite): record the skills-only result` | measured numbers into this file |

Commit 2 is inert at runtime, which is deliberate: the risky change is commit 3 alone — a single
field — and reverting it leaves a working tree.

Note the ordering trap: committing 3 before 2 leaves a run with no phase tools *and* instructions
telling it to call them, which fails in a way that looks like a Flue problem rather than a sequencing
mistake.

---

## 7. How to undo it

```bash
git log --oneline refactor/simplify-flowrite | head
git revert <sha>
```

- **Commit 2** is inert — the model only sees the tools the row mounts, and commit 2 does not change
  the row.
- **Commit 3** is the only behavioural change, and it is one field. Reverting restores the six phase
  tools for `data-type` exactly as they are on `main`; no other kind was touched, no data migrated,
  nothing to unwind. `.flowrite/research/*.md` files left behind are ignorable — the old path reads
  its own SQLite cache and never looks there.
- **The fixture** is never committed. Archive first, then stage source paths explicitly
  (`git add src/`). Never `git add -A` with run output in the tree — it has caused two history
  rewrites.

**Revert triggers, decided now:** method coverage below the baseline reverts commit 3. Any invented
API on a fixture whose names are fabricated reverts commit 3. Cost rising without a quality gain
reverts commit 3.

---

## 8. Deliberately not in scope

- **`module-ref` and `tutorial`.** They keep the phase tools. Converting them is a separate change,
  and `module-ref` is the one that would actually test the growing-context question.
- **Deleting the phase tools, `phase-guard.ts`, `phase-ledger.ts`, `delegate.ts`, and the ~2,374
  lines under `src/tools/phases/`.** Earned only after all three kinds are converted and measured.
- **`research-cache.ts`.** The new path caches by writing `.flowrite/research/<type>.md`; the SQLite
  cache stays for the unconverted kinds.
- **Model tiering for writing.** The root agent is one model, so the write step cannot be tiered the
  way `drafter` was. Not a regression today (`drafter` was already sonnet@high), but it forecloses
  cheapening the write step later without re-adding a subagent.
- **`report_run_result` and its `v.check`.** Not a phase; untouched.
