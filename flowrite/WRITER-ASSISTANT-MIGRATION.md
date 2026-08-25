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

`workflows/crossref.ts`, `agents/page-linker.ts`, `lib/{state-store,schemas,migrate-state,config-loader}.ts`,
`workflows/utils/{link-inserter,link-validator,sidebar-parser,confidence}.ts`, `skills/cross-linker`.

Site-wide linking: four modes (`reindex` / `step` / `autopilot` / `report`), persistent
`.crossref-state/{index,suggestions}.json`, confidence-tiered suggestions, deduplication, and
link insertion that is safe around code fences, inline code, and YAML frontmatter.

flowrite has writing-style rule 7 — link a sibling type's first mention — applied by the drafter
to the one page it is writing. There is no site-wide pass, no accumulated state, and no link
validator beyond the Docusaurus build's `onBrokenLinks: 'throw'`.

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

`workflows/extract-metadata.ts`, `agents/metadata-extractor.ts`, `skills/metadata-extractor`,
`lib/metadata-extractor-utils.ts`, and two test files. Bulk frontmatter — title, description,
keywords, `sectionType` — over an *existing* docs tree, with a documented token-impact analysis.

flowrite authors frontmatter for the page it writes. Nothing retro-fits a site it did not write.

### 6. `how-to-guide` as a document kind

`skills/docs-how-to-guide/SKILL.md` + `workflows/write-how-to-guide.ts`. Goal-oriented and
task-focused, explicitly *not* pedagogical.

flowrite's `DOC_KINDS = ['data-type', 'module', 'tutorial']`. "how-to" survives only as prose
telling the tutorial writer not to become one. Cheapest gap to close: one `KINDS` row plus a
structure and a checklist skill — the table was built for exactly this.

### 7. `document-pr`

Five phases — collect the PR from GitHub, decide the doc type, write, integrate, lint — entered
with a **PR number**. flowrite's only entry point is a subject name.

### 8. Standalone check/fix entry points

`check-mdoc`, `fix-mdoc`, `check-website`, `fix-website`: callable on their own, with bounded
fixer loops (max 3 rounds) and typed results. You could point writer-assistant at an
already-broken page and say "fix its mdoc". flowrite cannot — that logic exists only inside a
full write run, as integrator instructions.

**Partly addressed.** `src/redundancy.ts` (§4) is flowrite's first standalone entry point, so the
shape now exists and `app.ts` records what mounting a second agent would take. The four mdoc/website
entry points above are still write-run-only.

### 9. `organize-types`

Auto or manual re-sorting of type pages into sidebar categories, with build verification after.

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
