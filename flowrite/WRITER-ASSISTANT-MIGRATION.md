# What flowrite inherited from `writer-assistant`, and what it did not

`../writer-assistant` is flowrite's predecessor: a Flue 1.x agent framework built around 21
`defineWorkflow` entry points. flowrite replaced it with **one agent, one entry point, and a
data table**. This file records the audit taken on 2026-08-24, immediately before
`writer-assistant` was deleted, so that "we dropped that on purpose" and "we forgot that"
stay tellable apart later.

Nothing in either repo cross-references the other — there is no migration log, no TODO list,
no shared module. This is the only record.

## Shape of the two designs

|  | writer-assistant | flowrite |
|---|---|---|
| Entry points | 21 workflows, each `flue run <workflow> --input '{…}'` | 1 agent, `flue run src/agent.ts -m "…"` |
| Phase order | TypeScript control flow inside each workflow | prose in `src/instructions/*.md`; the model finds the path |
| Roles | 10 `defineAgent` modules | 8 `defineSubagent` roles in `src/subagents/` |
| Structured results | regex-parsed out of prose (`/\[REDUNDANCY\]\s*Type:…/`) | `valibot` schemas via `harness.prompt(text, { result })` |
| Wrapped commands | 10 tools (`run_mdoc`, `build_website`, `search_pages`, …) | 2 (`gh_query`, `check_method_coverage`) — the rest deleted on purpose |

The consequence worth keeping in mind while reading the gap list: **a missing workflow is not
the same as a missing capability.** mdoc checking and site building survived the migration as
*instructions* in `src/subagents/docs-integrator.md`, not as code. What genuinely did not
survive is the ability to invoke them on their own.

## Migrated

| writer-assistant | flowrite |
|---|---|
| `write-data-type-ref.ts`, `write-module-ref.ts`, `write-tutorial.ts` | one `docs-writer` agent + the `KINDS` table in `src/agent.ts` |
| `agents/docs-{researcher,writer,reviewer,integrator}.ts`, `diagram-designer.ts` | `src/subagents/{researcher,drafter,reviewer,docs-integrator,designer}.ts` |
| `write-examples.ts` | `examples-builder` role + `companion-examples` skill |
| `check-mdoc.ts`, `fix-mdoc.ts`, `check-website.ts`, `fix-website.ts` | steps 4–5 of `src/subagents/docs-integrator.md` (scoped `sbt docs/mdoc`, then the full site build) |
| `report-method-coverage.ts` (shelled out to `plugins/**/extract-members.scala`) | `src/tools/check-method-coverage.ts` — self-contained TypeScript, no external scripts |
| `tools/github-research.ts` | `gh_query` in `src/tools/repo-tools.ts`; **narrower** — issue/PR search only, no commit search, no `keyInsights`/`designRationale` synthesis |
| `workflows/utils/{cost,run-summary}.ts` | `runtime/{token-usage,usage-report,run-telemetry}.ts` + `scripts/run-report.mjs` |
| `skipPhases` input | `skipPhases` in run context, surfaced to the model by `skippedPhases()` |
| structure / checklist / mdoc-conventions / writing-style skills | `src/skills/*` — rewritten, and **renumbered** (see the rule-26 trap below) |

flowrite additionally has machinery writer-assistant never had: the fact-check gate, the phase
guard, per-phase round budgets, a verdict *derived* from evidence rather than claimed, and the
run retrospective.

## Not migrated

Ordered by what it would cost to lose.

### 1. Mechanical style checker — `skills/docs-writing-style/check-docs-style.sh` (569 lines)

Deterministic awk/perl checks for **16 of the 28 writing-style rules** (2, 3, 4, 7, 8, 10, 11,
12, 13, 15, 16, 18, 19, 21, 22, 23, 25, 26), emitting `<file>:<line>: [Rule N] <description>`.
Plus `skills/docs-mdoc-conventions/check-mdoc-conventions.sh` (80 lines).

flowrite has **no shell checkers at all**. Every style rule is judged by the reviewer model —
at token cost, non-deterministically, and only once per review round. `src/agent.ts` states the
argument for the other side itself: plain tools exist so the writer "can iterate against them
instead of waiting for the review phase to discover a gap". This is the single highest-value
file in the old repo.

### 2. Rule 26 — the implicit-trace checker

`lib/rule-26-implicit-trace.ts` + 27 tests + `tools/rule-26-checker.ts` (check/fix/report) +
`workflows/phases/rule-26.ts`. The rule: **never include `implicit trace: Trace` in a documented
method signature** — ZIO-specific, mechanical, and unambiguous.

flowrite has no implicit-trace rule in any form (`grep -ri 'implicit trace' src/` → 0 hits), and
**reused the number 26** for "Frame by audience tier". So a reference to "rule 26" means two
different things in the two repos. This is a silent loss, not a rename.

### 3. Crossref / page-linker — a whole subsystem

**PARTLY PORTED** — `src/crossref.ts`, a standalone agent that makes one orphan page reachable:
`flue run src/crossref.ts -m "Make docs/reference/stm/tref.md reachable"`. The judgement survives —
which pages should link to a target, what anchor to wrap, and where a link may sit — in
`src/skills/cross-linker/references/guide.md`. The subsystem does not.

**Correct the file list above before using it.** `workflows/crossref.ts` is a 228-line dispatcher with
**six** modes, not four (`verify` and `verify-and-fix` are missing here, and the latter's custom-verify
branch is dead code). The engine is `workflows/phases/process.ts` — 499 lines, **zero tests** — and the
fence-safety code is `lib/markdown-parser.ts`. The audit named neither.

**The direction is inverted, and that is the one place the port improves on its source.** crossref read
a source page and linked out to what it mentioned. Measured: across the 24 source pages that produced
suggestions it proposed `reference/fiber/index` as a target 12 times — a page that already had 8 inbound
links — while 84 of 220 reference pages had none. An outbound pass enriches hubs. So the unit here is one
orphan *target*, which also buys a completion test that reads the files ("does anything link here yet"),
the property `scripts/backfill-metadata.sh`'s skip grep has and an outbound pass cannot.

Dropped, with reasons in the spec: the state store (no staleness detection anywhere — `indexBuiltAt` is
written and never compared, `processed` membership is permanent, `absPath` is absolute so the state is
not portable); all six modes (`autopilot` is `while (true)` with no cap, and with `targetFile` it
reprocesses one page forever — `stm/stm` appears 7× in the real `processed`); confidence tiers
(`utils/confidence.ts` is 7 lines with no scoring, the tier is emitted verbatim by Haiku and never
audited, and the medium→high promotion is unreachable at the default threshold); `sidebar-parser.ts`,
which **always returns `{}`** and so left adjacency — the skill's strongest confidence trigger — dead in
every run; `link-inserter.ts`'s fuzzy fallback, which splits a multi-word anchor and links one keyword;
`computeSafeZones`, which has 14 tests and diverges from a line-based scan on 7 of 299 files; the five
model-facing tools (already §12); and `report.ts`'s orphan detection, which never measured real links.

**Unlike §6's source, this one demonstrably ran** — commit `d058fcd26` (zio/zio PR #10986), 94 files, 28
`## See Also` sections, ~40 inline links, from a 49-of-293-page hand-supervised run. That is also where
its worst output is: `docs/reference/services/random.md:14` still has a markdown link spliced inside an
inline-code span, rendering as literal text, invisible to `mdoc` (not a fenced block) and to
`onBrokenLinks` (not a link), eleven weeks and one 94-file human review later. That line is now a ❌
example in the guide, and the reason this agent runs on Sonnet rather than the original's Haiku.

**Site-wide coverage is a named batch, not a sweep.** A request may name several targets and the run
works them one at a time. The agent does **not** pick targets from the survey, and that is a measured
decision rather than caution: on a real 299-page tree the survey's head is `adopters.md`,
`code-of-conduct.md` and 27 ecosystem listing pages, and 44% of the orphans it finds have their subject
in no other page — so a *correct* no-op leaves the page orphaned and the next invocation's survey
returns it first again, which is `autopilot` reprocessing `stm/stm` 7 times. The completion test records
the edit outcome only; it cannot record "processed, correctly empty", and the state store that could was
dropped. So the survey stays a report and the requester stays the filter.

Still not ported, named rather than implied:

- **the state store** — no `.crossref-state`, no persistence of any kind
- **confidence tiers** — the model links or it does not
- **`link-inserter.ts`** — insertion is an `edit` the model makes, bounded by the guide's ✅/❌ pairs
- **`report` mode** — the guide's survey recipe is the report
- **any durable record of a correctly-empty target** — the gap above, and the reason target selection
  is the requester's
- **link validation beyond** the Docusaurus build's `onBrokenLinks: 'throw'` plus the guide's four
  verification greps

Unmeasured against a live model — see `docs/superpowers/specs/2026-08-25-crossref-port-design.md` and
`BACKLOG.md` finding 12.

### 4. `reduce-redundancy`

`agents/docs-redundancy-fixer.ts`, `skills/docs-reduce-redundancy/SKILL.md`,
`workflows/reduce-redundancy.ts`, `workflows/phases/reduce-redundancy.ts`. Lexical / structural /
semantic redundancy, scanned and fixed in a bounded loop, repeated definitions replaced by
cross-references.

**PORTED** — `src/redundancy.ts`, a standalone agent rather than a phase of the write flow:
`flue run src/redundancy.ts -m "reduce redundancy in docs/reference/ledger.md"`. The three-kind
classification and the fixing strategies survive in `src/skills/reduce-redundancy/references/guide.md`;
the scan/fix session loop and its regex protocol did not. One bound was tightened against the
original: removing a repeated code block is forbidden here, because mdoc blocks share one scope and
nothing downstream would catch the break. Unmeasured against a live model — see
`docs/superpowers/specs/2026-08-24-reduce-redundancy-design.md` and `BACKLOG.md` finding 9.

### 5. `extract-metadata`

**PORTED** — `src/metadata.ts`, a standalone agent filling one page's missing `description` and
`keywords`, with `scripts/backfill-metadata.sh` as the loop:
`bash scripts/backfill-metadata.sh <checkout>/docs`. The judgement survives — which fields are
missing, what a 50-150 character description says, which 3-6 terms a reader would search for, in
`src/skills/page-metadata/references/rules.md`.

Most of the original did not, and the reason is in its own spec: `docs/specs/2026-06-06-metadata-extraction-modular-design.md`
§1 says it existed because the crossref `page-linker` paid "~5-6.5k tokens per page" extracting
metadata inline, and pre-enriching dropped that to "~3.5-4.5k". Crossref never came to flowrite, so
what was ported is the *residual* capability rather than the optimization. Dropped with it:
`sectionType` (fed link suggestion; nothing reads it here — and the original was already inconsistent,
its skill emitting three fields while the code path crossref used parsed two), `generateContextualTitle`
(crossref's "See Also" lists), the fs walk and its realpath containment checks (`find` under a named
directory generates the paths, so there is nothing to escape from), the four-mode payload, and the
valibot result schema plus deterministic YAML writer — `BACKLOG.md` files the deleted frontmatter
validator under "Verified working, and worth not breaking", and this port does not re-add it.

One bound is stricter than the original's: a populated field is never overwritten by default, and the
page body is out of bounds entirely. Unmeasured against a live model — see
`docs/superpowers/specs/2026-08-25-extract-metadata-design.md` and `BACKLOG.md` finding 10.

### 6. `how-to-guide` as a document kind

**PORTED** — `DOC_KINDS` now reads `['data-type', 'module', 'tutorial', 'how-to']`, with
`src/instructions/how-to-guide.md`, the `how-to-structure` and `how-to-checklist` skills, and
`fixtures/tinyproject/scripts/run-how-to-guide.sh`. Ask for it in words like any other kind:
`-m "Please write a how-to guide for this task: …"`.

The audit's estimate — "one `KINDS` row plus a structure and a checklist skill" — held for the
*architecture* and undercounted the prose. No phase, no delegation, no schema, and no subagent
changed: `designer` and `drafter` read `structureBlock(docKind())` at their own render, so both picked
the new template up untouched. `tsc` forced the row, both `Record<DocKind, string>` maps and the
`KINDS[kind]` index. What it could not reach was every place three kinds had been written out in
text — `GATE_INSTRUCTIONS`, two subagent *descriptions*, the fixture's `AGENTS.md` — and that is
where the work was.

**The substance did not come from this repo.** `writer-assistant/skills/docs-how-to-guide/SKILL.md` is
a 30-line conceptual summary; the doctrine worth porting — the Problem-section template, the research
questions, a 43-item checklist — lives in `plugins/documentation/skills/docs-how-to-guide/`, which is
*not* being deleted. Worse, `workflows/phases/verify.ts` instructed the model to "use the checklist in
the docs-how-to-guide skill" and that skill never had one in this tree, while `ARCHITECTURE.md`
asserted it did. Treat the predecessor's how-to path as a source of claims, not of proven behaviour.

Two contradictions between the sources were resolved rather than carried: the plugin skill's "In this
guide, we will build…" opening against the newer prompt's "no warm-up" (took the newer, as a
preference — writing-style rule 2 explicitly permits both), and the plugin checklist's flat
`git clone` + `runMain` "Running the Examples" format against flowrite's `<details>` +
`mdoc:embed:…:show-line-numbers` (took flowrite's; copying the old one would have shipped a checklist
that fails correct pages).

One design decision is stricter than both sources. They fence the Problem section's "before" example
as plain ` ```scala `, on the reasoning that painful code need not compile. `mdoc-conventions` forbids
exactly that and sweeps for it, so the drafter would have added a modifier, hit a compile error, and
obeyed "fix the example" by rewriting the pain away — silently. Here the before block is
`mdoc:compile-only` real code that does not touch the documented library, which compiles (verbose
working code does), keeps the contrast, and sidesteps the fact-checker's character-by-character
scrutiny of uncompiled fences. Plain fences survive for pseudocode only.

Dropped: the eight-section numbering (the template emits literal headings and forbids its own
vocabulary in them — see `BACKLOG.md` finding 3), the `focus: 'guide'` research switch (flowrite's
researcher is kind-neutral, so the asks live in the instruction file), and the separate
`verify`/`style` phases (flowrite's review covers the checklist and every style rule in one pass).
Unmeasured against a live model — see `docs/superpowers/specs/2026-08-25-how-to-guide-design.md` and
`BACKLOG.md` finding 11.

### 7. `document-pr`

**NOT NEEDED** — and this entry was wrong. It read "flowrite's only entry point is a subject name" as
though a capability were missing. Four of the five phases already exist, and the fifth is a sentence.

| phase | flowrite |
|---|---|
| collect the PR from GitHub | the root agent's `local()` sandbox is an unrestricted shell, so `gh pr view <n> --repo <slug> --json title,body,files` just runs. writer-assistant needed `tools/github-research.ts` because it had no general shell. Note `gh_query` is **not** the path — it is `gh search`, returning only number/title/url/state, so it cannot read a diff |
| decide the doc type | the only real gap, now closed by two lines in `GATE_INSTRUCTIONS`: a PR, issue or commit is a SOURCE, not a subject |
| write | the four `KINDS` rows |
| integrate | `docs_integrator` |
| lint | `review_page` + the 28 style rules + scoped mdoc + the site build |

flowrite already reads PRs on **every** run, as grounding rather than as an entry point: all four
instruction files ask the researcher for "what the commit history states", and
`src/subagents/researcher.md:40` handles the merge-commit case where a squashed PR leaves no `(#N)` in
file history.

Before the gate clause the workaround was to classify in the sentence — `-m "Write a data-type
reference page for ZStream#groupByKey, using zio/zio PR #42 as the source"` — which worked with no
changes at all. Without it the gate hit its genuinely-ambiguous branch and asked, which was correct
behaviour rather than a failure.

Two cases that look like gaps and are not. A PR touching several types across a module is several runs,
one page each — that is what `pages-outside-one-root` already enforces, since one run documents one
thing. A PR that is a dependency bump or an internal refactor has no right answer among four document
kinds, and "no page" is the correct output; the gate clause says so explicitly.

### 8. Standalone check/fix entry points

`check-mdoc`, `fix-mdoc`, `check-website`, `fix-website`: callable on their own, with bounded
fixer loops (max 3 rounds) and typed results. You could point writer-assistant at an
already-broken page and say "fix its mdoc". flowrite cannot — that logic exists only inside a
full write run, as integrator instructions.

**Partly addressed.** `src/redundancy.ts` (§4) is flowrite's first standalone entry point and
`src/metadata.ts` (§5) is the second, so the shape now exists twice and `app.ts` records what mounting
them over HTTP would take. §5 also establishes how a standalone pass runs over a *set* of pages: the
loop lives in `scripts/backfill-metadata.sh`, one process per page, with the "already done?" test
reading the files rather than a cursor a model maintains. The four mdoc/website entry points above are
still write-run-only.

### 9. `organize-types`

**PORTED** — `src/organize.ts`, renamed **organize-reference-docs** because it organizes reference
pages rather than types as such: `flue run src/organize.ts -m "Organize docs/reference into
categories"`. The judgement survives — what a group of pages is *for*, what a category should be
called, which pages do not belong in one — in
`src/skills/organize-reference-docs/references/guide.md`.

The original had **no skill**: 495 lines of TypeScript with its prompts inline, including a table that
grouped by name substring ("contains chunk, list, vector" → Collections). That table is not ported; a
substring cannot see that two differently-named types serve one purpose, and it is what a cheap model
reaches for when it cannot hold a dozen pages' purposes at once. The guide requires reading what each
page says the type is for, and that judgement is the only reason this is an agent rather than a script.

**Nothing moves.** A page's links are relative to where it sits, so relocating one breaks every
reference to it and every `../` inside it, and `onBrokenLinks: 'throw'` then fails the build with a list
that does not name the cause. So a category is a sidebar grouping plus an index page. This also drops
the original's sharpest defect: it emitted sidebar ids of the form `reference/<category>/<type>` while
moving no files, pointing entries at paths it never created — and its build-repair phase was licensed to
*"either create the missing file or remove the entry"*, which is `BACKLOG.md` finding 1's failure
verbatim. Its prompt also cited a `docs-organize-types` skill that never existed in the repo, the same
dangling reference §6 found.

Dropped with it: the `auto` / manual mode split and `minConfidence` (the request either names the
category and its members or asks for a proposal — one sentence, not a payload), and the build-error
parser plus repair loop (`review_page` and the site build already cover it, and the repair licence was
the defect above).

Unmeasured against a live model — see `docs/superpowers/specs/2026-08-25-organize-reference-docs-design.md`
and `BACKLOG.md` finding 13.

### 10. `preview-website`

A live dev server (Docusaurus or MkDocs), optionally running `sbt docs/mdoc` first. flowrite
builds the site but never serves it.

### 11. `coding-agent`

A generic "here is a cwd and a prompt, fix the build" agent (`agents/coding-agent.ts`,
`workflows/coding-agent.ts`), backed by `lib/{auto-fixer,build-runner,build-error-extractor}.ts`.

### 12. Page-navigation tools

`search_pages`, `search_page_content`, `get_adjacent_pages`, `extract_page_structure`,
`validate_anchor`, `build_website`, `run_mdoc`.

Mostly a **deliberate** deletion — flowrite's doctrine is that grep and read beat a wrapper, and
thirteen phase tools were removed on the same reasoning. One real gap survives the argument:
`validate_anchor` has no equivalent, so an anchor link is only ever checked by the full site
build.

### 13. Infrastructure

`flake.nix`, `nix/`, `docs/NIX_INTEGRATION.md`, `eslint.config.js`, `.prettierrc.json`.

### 14. Prose worth keeping

`ARCHITECTURE.md` (44 KB), `AGENT_RUNNING_GUIDE.md` (23 KB), `README.md` (37 KB),
`docs/plans/adaptive-research-architecture.md`,
`docs/specs/2026-06-06-metadata-extraction-modular-design.md`.

## Recovering any of it after the delete

`writer-assistant` was a subdirectory of the `zio-skills-modern` repository, so a `git rm -r`
leaves every file reachable from the parent commit:

```bash
git log --oneline -1 -- writer-assistant          # last commit that still had it
git show <sha>:writer-assistant/lib/rule-26-implicit-trace.ts
git checkout <sha> -- writer-assistant/skills/docs-writing-style/check-docs-style.sh
```

No copy was made and none is needed.
