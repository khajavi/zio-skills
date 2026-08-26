# Porting crossref / page-linker as instructions and skills

## The problem it solves

flowrite links a sibling type's first mention on the page it is writing — writing-style rule 7, applied
by the drafter. Nothing retro-fits links into a documentation tree flowrite did not write. So a page can
be complete, reviewed, fact-checked, wired into `sidebars.js`, and still unreachable: nothing in any
page's prose sends a reader to it.

That is not hypothetical. Measured on `~/sources/scala/zio-2.x-new/docs` while writing this spec: of
**220** pages under `docs/reference`, **84** have zero inbound links of any kind, and **137** have no
inbound link from a prose page. Site-wide, 130 of 299 pages have zero inbound links.

`WRITER-ASSISTANT-MIGRATION.md` §3 is the gap: crossref, "a whole subsystem" — six modes, a persistent
state store, confidence tiers, a link inserter, five model-facing tools.

## Why the original existed, and why that changes the port

**crossref ran, and its output is merged upstream.** Unlike the how-to port's source, this is not a
design on paper. Commit `d058fcd26` (zio/zio PR #10986) applied its work across 94 files — 28 new
`## See Also` sections and roughly 40 inline links. The run state is recoverable:

```bash
git -C ~/sources/scala/zio-2.x-new show a249ee4f7:docs/.crossref-state/state.json
```

**293** pages indexed, **49** processed (17%, then abandoned), **147** suggestions, **40 applied / 19
skipped / 88 pending**, `runningCost: 0.3583`. A hand-supervised partial run, titled "(Part One)".

Three things about that run reshaped the port.

**The audit's file list is wrong.** `workflows/crossref.ts` is a 228-line dispatcher with **six** modes,
not the four the audit names. The engine is `workflows/phases/process.ts` (499 lines, zero tests) and
the fence-safety code is `lib/markdown-parser.ts`. Neither appears in the audit.

**Its direction was backwards.** The pass read a source page and linked out to whatever it mentioned.
Across the 24 source pages that produced suggestions it proposed `reference/fiber/index` as a target
**12 times** — a page that already had 8 inbound links. An outbound pass enriches hubs; it does not
make anything reachable that was not already.

**Its worst output is still live.** `docs/reference/services/random.md:14`, at HEAD:

```
Each random number generator functions return a `[URIO](../core/zio/urio.md)[Random, T]` value.
```

A markdown link spliced inside an inline-code span. It renders as literal text. Mechanism:
`process.ts:354-356` computes safe zones with `{ includeInlineCode: false }`, so backtick spans are
deliberately unprotected; `link-inserter.ts:26-29` treats a backtick as a word boundary, so `URIO`
inside `` `URIO[Random, T]` `` matches; the guard at `link-inserter.ts:172-179` requires the following
character to be a backtick, and here it is `[`.

## What is deliberately not ported

| dropped | why |
|---|---|
| the state store (`.crossref-state/{index,suggestions}.json`) | no staleness detection anywhere: `indexBuiltAt` is written and never compared, `processed` membership is permanent, so an edited page is never re-analysed; `absPath` is stored absolute, so the state is not portable between checkouts. The inverted design replaces it with a test that reads the files. |
| the six modes | `autopilot` is `while (true)` with no iteration cap and no cost ceiling; with `targetFile` it reprocesses one page forever, which is visible in the real state where `stm/stm` appears 7× in `processed`. |
| confidence tiers | `workflows/utils/confidence.ts` is 7 lines of ordinal comparison with **no scoring**. The tier is emitted verbatim by Haiku, never audited, and at the default threshold `high` the cheapest model alone decides what reaches disk. Zero tests. Also: the medium→high promotion at `process.ts:379-390` sits *after* the threshold `continue`, so it is unreachable at the default — confirmed in the real state, where all 84 `medium` suggestions are still `pending`. |
| `sidebar-parser.ts` (adjacency) | **always returns `{}`**: it builds a one-element array at `:90` and indexes `[1]` at `:104`, throwing into a catch that warns and returns empty. Adjacency was the skill's strongest HIGH-confidence trigger and was dead in every run — `adjacentPages` is empty in **0 of 293** and **0 of 3748** real index entries. Zero tests, which is why it shipped. |
| `link-inserter.ts` and its five-strategy fuzzy fallback | `:84-93` splits a multi-word anchor and links a single keyword, case-insensitively, so `"models an \`IO\` value"` becomes a link on the bare word **"value"**. Live risk, not theoretical: 34 of 60 real inline anchors exceeded three words, up to eight. Untested. |
| `computeSafeZones` | 14 tests, and measurably wrong on the target corpus — its fence regex diverges from a line-based scan on 7 of 299 files, leaving the *interior* of a ` ````scala mdoc:passthrough ` block unprotected in `docs/reference/test/installation.md`. It protects none of: setext headings, MDX `import`/`export`, JSX blocks, link reference definitions (112 in the corpus), 4-backtick fences. |
| the five model-facing tools | `search_pages`, `search_page_content`, `get_adjacent_pages`, `extract_page_structure`, `validate_anchor` — audit §12, already deleted deliberately: "grep and read beat a wrapper". |
| `report.ts`'s orphan detection | it defines an orphan as "a page this run never proposed as a target", ignoring real links entirely. `existingLinkCount` is computed at `reindex.ts:93`, persisted, and read by nothing. |
| anchor links (`file.md#heading`) | forbidden. This costs nothing: **0 of 147** real suggestions contained `#`, so it is a restatement of measured behaviour rather than a tightening. |

## The design

### One orphan target per run, not one source page

The unit of work is "make this page reachable", not "add links to this page's mentions". Four things
follow.

**The completion test reads the files.** Does anything link here yet? That is a grep over the tree — a
total function of the files, exactly the property `scripts/backfill-metadata.sh`'s frontmatter grep has
and the reason its loop is safe to re-run. An outbound pass cannot have it: zero links may be correct,
existing links may be hand-written, and "at most N links" is not a file invariant, so a second sweep
would add more links monotonically forever.

**The diff is reviewable.** Every line a run adds contains the *same* target path. The failure in
`random.md:14` got through a 94-file human review; a diff whose every addition names one page does not
have that problem.

**It fixes what is actually broken.** See the numbers above: an outbound pass demonstrably enriched a
page that already had 8 inbound links while 84 had none.

**It bounds the run without a config value.** The original's `maxLinksPerPage` was interpolated into the
prompt at `process.ts:188` and enforced nowhere. Here the bound is structural — one target, a handful
of sources, one link per source.

### An index link is not discoverability

A section index lists every page beneath it, so almost no page has zero inbound links, and counting
them hides the problem. The guide's recipe tags each inbound link `IDX` or `PRO` by whether its source
is an index page, and defines an orphan as **no `PRO` inbound**. That is the 84 → 137 difference, and
137 is the number that describes what a reader experiences.

### The deleted TypeScript becomes shell recipes in the skill

`flowrite/CLAUDE.md` states the test: wrap a command only when breaking the contract would be silent,
and instruct otherwise — ✅ a command in the role's instructions, ❌ a tool whose only enforcement is
something the shell already does. So `reindex`, `report`, and the page-navigation tools become four
recipes in `src/skills/cross-linker/references/guide.md`: the one-target inbound check, the tree-wide
`IDX`/`PRO` split, candidate discovery, and post-edit verification.

Each was run against the 299-page corpus before being written down. The one that matters is href
resolution: a link's path is relative to the page holding it, so a hit must be resolved against the
*source* page's directory. A basename grep is wrong because `index.md` exists in many directories —
and that resolution is precisely the step `report.ts` skipped.

### The safety rules are ✅/❌ pairs, because they are failures that shipped

`flowrite/CLAUDE.md`: "examples teach the boundary faster and cost fewer tokens." The guide's first pair
is the real published line and its correct form:

- ❌ ``return a `[URIO](../core/zio/urio.md)[Random, T]` value``
- ✅ ``return a [`URIO`](../core/zio/urio.md)`[Random, T]` value``

One character of position apart. The verification grep for it — `` grep -nE '`\[[^]]*\]\([^)]+\)' `` —
was checked both ways during planning: **exactly one hit** across all 299 pages, and it does not match
the correct `` [`URIO`](path) `` construct, which is common. Then fences of any length, frontmatter,
nested links, and headings (a link in a heading changes the page's anchors, silently breaking links
elsewhere that targeted them).

The bound that removes the whole safe-zone question: **link a mention in prose, and if the only
mentions are in code or headings, add nothing and say so.** A run reporting "no suitable prose mention"
is a correct run.

### Sonnet, and this is the first tier chosen against a measured failure

Every other tier in `src/runtime/models.ts` was argued from the shape of the work. This one has a
published defect behind it: writer-assistant ran the page-linker on Haiku and produced `random.md:14`
plus eight-word anchors against its own skill's "1-5 words". Same risk shape as `redundancyEditor` —
edits pages that already passed review with nothing downstream re-checking — except that there Sonnet
was a prediction and here it is evidence.

## Verification

**Offline, and done.** `tsc --noEmit` clean; 105 tests pass, including the new `RUN_LABEL` assertion
(`cross-link-page`), which matters because `archive-docs.sh` greps `<label> token consumption:` and a
typo would fail silently. No other unit test: there is no parser, no schema and no decision logic here.

**The recipes are verified, which is the part that counts** — they are the ported logic, so a wrong
recipe is a wrong instruction. Against `~/sources/scala/zio-2.x-new/docs`:

| recipe | result |
|---|---|
| one-target inbound | `docs/reference/stm/tref.md` → 2 inbound, both index pages; `docs/reference/fiber/fiber.md` → 11, matching an independent walk |
| tree-wide `IDX`/`PRO` | 220 reference pages; 84 with zero inbound; **137 with no prose inbound** |
| corruption grep | exactly **1** hit corpus-wide, `docs/reference/services/random.md:14`; does not match the correct linked-code construct |
| nested-link grep | 1 hit, a legitimate `[![badge](svg)](url)` — recorded in the guide as the allowed exception |

**Live: not done.** The Anthropic key is exhausted until 2026-09-01; issues #57, #59, #63, #65, #68 and
the #66 umbrella already queue there. `BACKLOG.md` finding 12 lists what a first run must answer.

The fixture cannot exercise this: `fixtures/tinyproject/docs/` has four pages, three of them
`index.md`, and pointing a writing agent at it would rewrite tracked files, which `flowrite/CLAUDE.md`
forbids. Reading it is fine, and it is a useful adversarial read-only case — its
`docs/reference/index.md` names modules that have no pages, which is exactly the setup for
`BACKLOG.md` finding 1, so a correct run refuses to create a target there.

## Site-wide coverage: a named batch (added 2026-08-26)

A request may name several targets. Each is handled exactly as one target is, in order of how much
material it has, with its receipt block filed as it finishes.

### The agent must not pick its own targets

The obvious design — run the survey, take the first N orphans — was designed and rejected. Recording it
so it is not re-proposed.

Measured on `~/sources/scala/zio-2.x-new/docs` (299 pages, 181 non-index pages with no prose inbound
link):

- **The survey's head is unlinkable.** In emission order: `adopters.md`, `canfail.md`,
  `code-of-conduct.md`, `contributing-to-documentation.md`, then 27 `ecosystem/community/*` listing
  pages. Thirty-two site-meta entries before the first real candidate.
- **Narrowing does not rescue it.** Restricted to `docs/reference`, the first three are
  `architecture/functional-design-patterns.md`, `architecture/non-functional-requirements.md` and
  `architecture/programming-paradigm.md`, whose subject phrases appear in **1, 0 and 3** other files.
  Two of three are guaranteed no-ops.
- **A correct no-op is sticky.** 80 of the 181 orphans (44%) have their subject phrase in no other page,
  so "added nothing" is right — but the page stays orphaned, so the next invocation's survey returns it
  **first again**. That is `autopilot`, whose recorded `processed` array holds `stm/stm` 7 times.

The root cause is structural, which is why no prose fixes it: the file-derived completion test records
the *edit* outcome and cannot record "processed, correctly empty". The state store that could was
deliberately dropped. `src/crossref.ts` already named the missing piece — the survey "prints the list a
human picks from". **The human is the filter.** A sweep deletes the filter and keeps the list.

### The window binds before the cost does

Re-sending earlier targets in one conversation is cheap here: `README.md` records 33,357 fresh input
tokens against 6,180,078 cache reads across 248 turns for $1.94, and `run-telemetry.ts:38` puts the
usual ratio at ~0.78. At ~20k durable context per target the extra cache read is quadratic — roughly
$0.72 at three targets (+58% over three separate runs), $10.80 at ten (+270%). So cost rules out ten and
does not rule out one.

The context window is the real limit. Candidate sets measured on the same tree: `TRef` 6 files (178 KB),
`Promise` 24 (489 KB), `Task` 45 (643 KB), `ZLayer` 63 (743 KB ≈ 186k tokens). One `ZLayer`-class target
read exhaustively is most of a window. Hence the guide's candidate budget: rank by mention density, read
a handful, and read the matched region rather than the file for anything over ~40 KB.

### Four rules exist only because of batches

- **One link per source page across the run**, not per target. Three real orphans' candidate sets
  overlapped on three pages, one shared by all three. The corpus norm is ≤7 internal links per page, and
  nothing in the files records the total — so per-target accounting is how a batch reintroduces the
  monotonic growth that disqualified an outbound pass in the first place.
- **A nested-link check.** Two targets' anchors on one page can nest, and the inline-code grep is blind
  to it. Verified both ways; the single legitimate match is an image inside a link.
- **A candidate-read budget**, above.
- **A whole-diff audit at the end**, against the declared targets. A single-target run gets this free —
  every added line contains the one target's path — and that invariant was this design's only
  compensating control. With several targets it must be run deliberately.

### Both halts are required output

"Stop after the batch" and "abandon the remaining targets on a failed grep" are compliance-by-absence,
which is the one class this repo has measured failing: `src/agent.ts` records prose-only "ask and stop"
writing a whole page over 53 turns and $0.38, against 1 turn when the alternative was named as a tool.
`BACKLOG.md` finding 1 is the other half — when a check failed mid-run, the model created artifacts to
satisfy it. So both are required receipt lines. A missing line is visible; silent compliance is not.

### What a batch cannot fix

`component-usage.ts:240-243` populates `pagesWritten` only from the `write` tool, and this agent's whole
mandate is to wrap an existing phrase — it calls `edit`. So `activity.pagePaths` is always empty,
`pages-outside-one-root` is dead for this agent, and **the run report has no record of which pages a
cross-link run touched.** The model-authored receipt is the only account, which is the "cursor written by
the same model that decided it was finished" that `scripts/backfill-metadata.sh` rejects by name. At one
target `git diff` is small and compensates; at three it is larger and unattributed, which is why the
whole-diff audit is not optional.

## Risks

- **The failure this agent must not repeat is invisible to every gate**, and once got through human
  review. The one-target-per-run bound is the main mitigation, because it is what keeps the diff small
  enough to actually read. It is a safety property, not a convenience.
- **`git diff` on a clean tree is the only safety net**, as with the other two standalone agents. Every
  added line should contain the target's path; anything else is a bug in the agent.
- **Two standalone passes now touch links with overlapping mandates.**
  `src/skills/reduce-redundancy/references/guide.md:37` has the redundancy editor replacing a repeated
  definition with a link, while `:73` tells it "links are not yours". Both unmeasured. Worth
  reconciling before a third arrives.
- **Telemetry will misreport this run.** `pages-outside-one-root`
  (`src/runtime/run-telemetry.ts:220-233`) reads `activity.pagePaths`, populated only from the `write`
  tool — so an `edit`-based pass is invisible to it, and a `write`-based one would fire "one run
  documents one thing, so the extra pages were not asked for", which is exactly wrong here. Also
  `review-not-run` and `fact-check-not-run` fire unconditionally on every standalone run.
- **Fifth unmeasured port, third standalone in-place editor.** Findings 7, 9, 10, 11 are open with no
  live measurement; 1, 2, 6, 8 are fixed-but-unverified. Worth spending the first post-renewal runs on
  findings 1, 9 and 10: if the metadata backfiller turns out to touch page bodies, the "instruct, don't
  wrap" argument this whole design rests on needs revisiting.
