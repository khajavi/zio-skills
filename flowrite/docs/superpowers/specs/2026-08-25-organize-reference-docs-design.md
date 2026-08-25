# Porting `organize-types` as organize-reference-docs

## The problem it solves

A reference section grows one page per run. Past a dozen pages the sidebar is a flat alphabetical list,
and a reader who does not already know the type's name cannot find it. flowrite has no pass that gives
an existing section shape: `docs-integrator` adds one page to one category during a write run, and
`module-subpages` writes sub-domain index pages for a module it is *currently creating*. Neither
regroups pages that already exist.

`WRITER-ASSISTANT-MIGRATION.md` §9 is the gap: "auto or manual re-sorting of type pages into sidebar
categories, with build verification after."

Renamed **organize-reference-docs** because it organizes reference *pages*, not types as such — the
unit is a documentation page, and a category holds pages.

## Why the original existed, and why that changes the port

**It had no skill.** 495 lines of TypeScript in `workflows/organize-types.ts`, prompts inline, plus a
build-error parser and a repair loop. So there was no prose to port — the guide is new content derived
from those prompts.

**Its prompt cited a skill that never existed.** `"Categorization guidance (from docs-organize-types
skill)"`, and no such directory is in the repo. This is the second instance after §6's how-to
checklist, which makes it a property of the predecessor rather than an accident: **a `writer-assistant`
prompt naming a skill is not evidence the skill was there.**

**Its central defect is one flowrite already has a finding for.** The workflow emitted sidebar ids of
the form `reference/<category-kebab>/<type-name>` while performing **no file move anywhere in its 495
lines** — so entries pointed at paths it never created. Its build-repair phase was then told to *"either
create the missing file or remove the entry"*. That is `BACKLOG.md` finding 1's failure — a run
inventing artifacts to satisfy a check it broke — shipped as a design rather than as a bug.

**Its grouping heuristic was substring matching.** The table read "name contains chunk, list, vector"
→ Collections. That files `ChunkBuilder` under Collections and cannot see that two differently-named
types serve one purpose.

## What is deliberately not ported

| dropped | why |
|---|---|
| any file movement, and ids implying it | a page's links are relative to where it sits, so relocating one breaks every reference to it and every `../` inside it; `onBrokenLinks: 'throw'` then fails the build with a list that does not name the cause. A category here is a sidebar grouping plus an index page. |
| the build-error parser + repair loop | `review_page`, scoped mdoc and the site build already cover verification, and the repair licence was the defect above |
| the `auto` / manual mode split, `minConfidence` | the request either names the category and its members or asks for a proposal. One sentence, not a payload with two mutually exclusive modes and four validation errors |
| the substring categorization table | see above; the guide requires reading what each page says the type is *for* |

## The design

### A skill alone would have been unreachable

The premise this port was proposed under — "we only need a new skill" — is right that no new machinery
is needed, and wrong about reachability. `flue run <path>` executes *an agent module*;
`src/subagents/docs-integrator.ts` is a `defineSubagent` and cannot be run directly, only delegated to
from a running agent; and the root agent's gate accepts only the four `DOC_KINDS`, so "organize the
reference docs" hits ask-and-stop. A skill with no importer is dead content.

So this is a module plus a skill — the shape `redundancy.ts`, `metadata.ts` and `crossref.ts` already
use, with the instruction file carrying the mandate and the guide carrying the reference.

### Nothing moves, and that is the design

Stated above. The consequence worth naming: a category is **not a directory**. If a request asks for
pages to be relocated, the agent says relocation is out of bounds and offers the grouping instead. Every
sidebar id is read from where the page actually is, never composed from the category name.

### The bounds are what make a grouping reviewable

Three pages minimum per category — a category of one or two is sidebar noise. One home per page, since
a page in two categories renders twice and the second entry usually loses its label. Leftovers stay at
the top level, and **no "Miscellaneous"** invented to reach full coverage; the receipt names what was
left ungrouped and why. Category names describe the reader's concern, not the implementation
(✅ `Resource Management`, ❌ `Scope And Friends`).

### `require()` is not the sidebar verification it appears to be

Found while testing the guide's recipes against the fixture, and it affects existing instructions.
`docs-integrator.md` step 1 says to verify `sidebars.js` with `node -e "require('<its path>')"`. That
does catch a syntax error — a deliberately broken file throws `SyntaxError`. But
`flowrite/package.json` sets `"type": "module"` and `fixtures/tinyproject/` has no `package.json` of its
own, so `docs/sidebars.js` is loaded as **ESM** and `require()` returns `{}`, with no error, for a file
whose `module.exports` never took effect.

So the guide keeps the parse check, states plainly that it is not proof the sidebar loaded, and
enumerates ids by **text extraction** instead — which is unaffected by module system and covers both the
`id:` form and a bare items string. `docs-integrator.md` is left alone: it is a working prompt, the
check still catches the common failure, and changing it affects every write run.

### Sonnet at medium effort

Medium is unique among the standalone agents. The other three act on one page at a time; grouping
requires holding every page in a section simultaneously to see the shape. And the risk here is not a
damaged sentence but a bad **taxonomy**, which is durable in a way a bad link is not — readers navigate
by it, and later pages get filed into it. The substring table is what a model reaches for when it cannot
hold a dozen pages' purposes at once.

## Verification

**Offline, and done.** `tsc --noEmit` clean; 105 tests pass, including the new `RUN_LABEL` assertion
(`organize-reference-docs`), which matters because `archive-docs.sh` greps `<label> token consumption:`
and a typo fails silently.

**The guide's recipes were verified against `fixtures/tinyproject` before being written down:**

| recipe | result |
|---|---|
| page list with titles | lists `docs/reference/index.md` → "TinyProject API Reference" |
| sidebar parse check | passes; **and** shown not to be sufficient — `require()` returns `{}` here, while a deliberately broken file throws `SyntaxError` |
| id resolution by text extraction | 3 ids, all resolving; catches a planted `reference/nope` in a negative control |

**Live: not done.** Key exhausted until 2026-09-01. `BACKLOG.md` finding 13 lists what a first run must
answer.

The fixture cannot exercise the grouping itself — `docs/reference/` holds a single `index.md`, so there
is nothing to group. It *is* the right place to check the bounds: a correct run reports the section is
too small and proposes no change. Judging a real grouping needs a section with a dozen or more pages.

## Risks

- **A bad taxonomy is durable.** Readers navigate by it and later pages get filed into it, so it
  outlives the run in a way a wrong link does not. The bounds are the whole defence and they are
  unmeasured prose.
- **`sidebars.js` is a single shared file.** Every write run edits it too. This agent's rule is that a
  page it did not group keeps its entry byte for byte — the one edit here that could lose a sibling's
  work where nobody sees it is missing.
- **The build is the only gate.** There is no review phase on a category index page, so the prose in it
  ships unreviewed — the same exposure `redundancy.ts` and `crossref.ts` carry, and the reason the
  receipt has to name every page written.
- **Sixth unmeasured port, fourth standalone in-place editor.** Findings 7, 9, 10, 11, 12 are open with
  no live measurement; 1, 2, 6, 8 are fixed-but-unverified. The ordering argument in #66 still applies:
  run the metadata backfiller first, since its invariant is mechanical and it is the cheapest test of
  the "instruct, don't wrap" premise all four editors rest on.
