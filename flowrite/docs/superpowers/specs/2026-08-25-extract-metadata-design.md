# Porting `extract-metadata` to flowrite

**Status:** Implemented as `src/metadata.ts` plus `scripts/backfill-metadata.sh` — a standalone agent
and a shell loop, unmeasured against a live model. See `BACKLOG.md` finding 10 for the measurement
this still owes.
**Source:** `writer-assistant/{workflows/extract-metadata.ts,agents/metadata-extractor.ts,skills/metadata-extractor,lib/metadata-extractor-utils.ts,workflows/utils/metadata-utilities.ts}`
and its own spec `docs/specs/2026-06-06-metadata-extraction-modular-design.md`, audited in
[`WRITER-ASSISTANT-MIGRATION.md`](../../../WRITER-ASSISTANT-MIGRATION.md) §5 before that repo was
deleted.

## The problem it solves

flowrite's drafter opens every page it writes with four frontmatter fields — `id`, `title`,
`description`, `keywords` (`src/subagents/drafter.md:11-30`). Docusaurus reads the last two for search
and for page listings.

Nothing filled them in on a page flowrite did not write. A docs tree that predates flowrite carries
`id` and `title` only, and `fixtures/tinyproject/docs/` is that shape exactly: four committed pages,
no `description`, no `keywords`.

## Why the original existed, and why that changes the port

writer-assistant's spec §1 is explicit. The crossref `page-linker` agent paid "~5-6.5k tokens per
page" extracting metadata inline; splitting extraction into its own agent let you pre-enrich a tree
once so subsequent crossref runs read frontmatter instead of re-deriving it, dropping to "~3.5-4.5k".

**Most of its value was as a cache-warmer for crossref, and crossref never came to flowrite.** What
was ported is the residual capability — bulk retrofit — which is the half worth having. This is also
why the port is so much smaller than the original: a 310-line workflow plus 234 lines of library code
became one agent module, one instruction file, one rules file and a shell script.

## What is deliberately not ported

| writer-assistant | here | why |
|---|---|---|
| `sectionType` | dropped | fed crossref's link suggestion. The original was already inconsistent about it: the skill emitted three fields, the code path crossref used (`metadata-utilities.ts:74-86`) parsed two |
| `generateContextualTitle` | dropped | rewrote generic titles for crossref's "See Also" lists |
| `walkDocs` / `walkDir` + realpath containment | dropped | those checks existed because `targetFile` arrived in a payload from outside. `find` under a named directory generates the paths, so there is nothing to escape from |
| `mode: 'all' \| 'missing' \| 'file' \| 'dir'` | one flag | `missing` is the default and is a grep; `all` is `--all`; `file` and `dir` are what a shell loop already does |
| `validateMetadata` (valibot) + `updateFrontmatter` (YAML writer) | dropped | `BACKLOG.md` files the deleted frontmatter validator under *Verified working, and worth not breaking*. The same assertions live in the fixture instead |
| `config.excludePatterns` | `find -prune` | one line, no config loader |
| 745 lines of tests | one label assertion | they tested the walk, the containment checks and the schema validators — all three of which are gone |

## The design

### One page per run, and the loop in the shell

Three places the loop could live, and this was the decision the rest followed from.

**Chosen: one `flue run` per page, driven by `scripts/backfill-metadata.sh`.** The "already done?"
test reads the file — does its frontmatter carry both fields — rather than a cursor a model maintains.
That distinction is the whole argument: a cursor is written by the same model that decided it was
finished, so a run that stopped at page twelve records twelve and reports success, while a grep over
the frontmatter cannot disagree with reality. Re-running is therefore both safe and resumable. Each
page also gets a fresh process, so page 60 pays nothing for pages 1-59 — the accumulation
`src/runtime/kind-docs.ts` measured, in a different form.

Startup is the price and it is small: 1.4s measured, and `flue run` "executes one agent module in the
local Node.js process … No server is created and no build artifacts are written"
(`@flue/cli/docs/cli/run.md:15`), so nothing is bundled per invocation.

**Rejected: one long-lived agent enumerating the tree and delegating per page.** Flue has the
primitives — parallel `task` delegations (`docs/guide/subagents.md:51`), durable
`usePersistentState` (`docs/guide/agent-hooks.md:106`), resumable interrupted children
(`docs/guide/durability.md`) — and drift is unproven at this repo's measured sizes
(`src/runtime/run-telemetry.test.ts:88` covers a run with 5 researcher and 5 drafter delegations).
The honest claim is narrower than "a model would lose track": at N≈10-40 this is a real option, and at
N≈200 it needs a `next_batch` tool, which is the rejected third option in different clothes.

**Rejected: writer-assistant's harness tool + TypeScript YAML writer.** See the table above.

What the choice gives up: no aggregate receipt from the model, and no cross-page keyword vocabulary.
writer-assistant did not coordinate keywords either.

### `src/metadata.ts`

`useModel` / `useSkill(writingStyle)` / `useSandbox(local({cwd}))` / `useUsageReport('backfill-metadata')`,
returning `[instructions, '', '# The fields you write', '', rules].join('\n')`. Hook order copied from
`src/redundancy.ts:65-81`. No roles, no phase tools, no `useRunBasics` — it delegates nothing and gates
nothing.

The page path comes from the message; `--data` carries `projectPath` alone, optional so a run from
inside a checkout needs none. `agentName = 'metadata-writer'` pinned as a literal. No `durability`.
Unmounted in `app.ts`, for the reason recorded there: a second route needs `hono`, which reaches this
repo only as a peer dependency.

**Tier: Haiku**, and the contrast with `redundancyEditor`'s Sonnet is the reasoning. That agent
*deletes* sentences from a finished page, where a wrong cut destroys information permanently. This one
fills fields that are empty, so its worst ordinary output is a dull description where there was none —
visible in `git diff`, and better than absent. writer-assistant also used Haiku; here it is a decision
rather than an inheritance.

### Two files state the frontmatter limits, on purpose

An earlier draft of this design moved `drafter.md`'s `## Frontmatter` section into a shared file joined
into both agents' instructions. **Dropped**, and the reasons generalise:

1. **The two readers need different prose.** The drafter authors four fields from nothing on a page it
   is creating. This agent preserves `id` and `title` exactly and writes only what is absent, on a page
   a stranger wrote. One text serving both would hedge every sentence.
2. **The current arrangement is measured.** `BACKLOG.md` lists the frontmatter contract's present form
   under *Verified working, and worth not breaking*. Editing a working prompt to serve a new consumer
   is a cost paid by the write flow.
3. **The move would break a deliberate adjacency.** `drafter.md:30` ("leave exactly one blank line
   between the closing `---` and the body") sits immediately before `:34` ("the body starts immediately
   after the frontmatter"), and nothing protects the ordering —
   `src/runtime/kind-docs.test.ts:8-9` states that the line joining these documents is "tsc's business".

The cost is a real drift risk: two files now say 50-150 and 3-6. `drafter.md` is the named owner, and
`src/skills/page-metadata/references/rules.md` says so in its opening lines. Recorded in `BACKLOG.md`.

### Why the driver does not check its own results

The strongest objection to a model editing files directly is that a mangled page is silent. An earlier
version of this design answered it in the driver: copy each page first, assert afterwards that the body
was untouched and the new fields well-formed, restore the copy on failure.

**Dropped**, on `flowrite/CLAUDE.md`'s rule — "Instruct first, run it, wrap only what you WATCHED
fail" — and its consequence: "every tool written against an imagined problem in this repo has been
deleted again". Nobody has watched this agent damage a page. `src/redundancy.ts` edits finished pages
with nothing re-checking it either, and the repo's answer there was `BACKLOG.md` finding 9, not a new
mechanism.

What stands in its place is louder and costs nothing: **git**. The driver warns when the target
directory is already dirty, warns when it is not in a repository at all, prints the `git diff` command
to run afterwards, and prints the `git checkout --` that undoes one page. The mechanical assertions
live in `test-fixtures/metadata/verify.sh`, which is where the evidence would come from — and if that
fixture shows the agent touching bodies, the check has been earned and belongs in the driver.

### Bounds

- only the frontmatter block changes; the body is out of bounds entirely
- a field with a value is never overwritten (`--all` opts into it, and says so)
- no other key is added, reordered or rewritten
- no frontmatter block at all, or no `title`: report and stop — inventing an `id` is not this agent's
  call, and such a file may not be a doc page
- keywords come from terms the page uses
- the receipt names what was filled *and* what was left, the rule the redundancy editor carries: a
  report listing only writes cannot be told apart from a pass that noticed nothing

## Verification

Offline, and all of it done: `tsc --noEmit` clean; 102 unit tests pass; `vite build` succeeds and the
bundle contains `metadata-writer`; the agent verified to render and submit, reaching the API and
emitting `backfill-metadata run report:` with the right label before failing on the usage limit; the
driver exercised against a scratch tree (`build/` pruned, a complete page skipped, a page with decoy
`description:`/`keywords:` lines in its *body* correctly not skipped, a missing env file failing once
before the walk rather than N times inside it).

One new unit assertion, in `src/agent.test.ts`: `RUN_LABEL === 'backfill-metadata'`. The archive script
greps `<label> token consumption:`, so a typo breaks archiving quietly.

The behavioral test is `test-fixtures/metadata/verify.sh`, blocked until the key renews (2026-09-01):

```bash
bash test-fixtures/metadata/verify.sh
```

Five pages, four of which test restraint — `complete.md` (has both, must be skipped untouched),
`no-frontmatter.md` (decoys in the body, must come back identical), `keywords-missing.md` (must keep
its own description byte for byte), `code-heavy.md` (three fences, a table, and a `---` inside a yaml
fence). Twenty checks, compared on text rather than line numbers. Replayed offline against a simulated
good run (20/20) and a simulated bad one (12/8, non-zero exit) — every planted misbehaviour caught,
including a body edit hidden inside the yaml fence.

- **Pass** — all twenty.
- **Kill, not tune** — a page body changes, `complete.md` is edited, or a pre-existing key is
  reordered or rewritten.
- **Empty diff everywhere** — the driver's skip grep is too eager; check it before concluding anything
  about the agent.

## Risks

- **Unmeasured until `verify.sh` runs**, and it is the third feature waiting on the same key renewal
  (#59, #63). Do not point the driver at a real docs tree before the fixture passes.
- **Nothing gates description quality.** A run can fill sixty pages with valid, useless summaries. If
  the fixture produces filler, raise the tier rather than lowering the floor.
- **No real target exists on this machine.** No checkout under `~/sources` has a docs tree of the
  target shape, and `REPO_PATH` points at a fixture. The bounds can be proven; the demand cannot.
- **Two files state the same limits.** Deliberate, owned, recorded.
- **The driver's frontmatter reader is awk, not a YAML parser.** It reads the block between the opening
  `---` and the first closing delimiter, which is why `code-heavy.md` carries a `---` inside a fence.
- **Cross-page consistency is out of scope.** Two pages can pick overlapping keywords with no
  knowledge of each other. Coordinating them means one growing context, which is the design this
  rejected.
