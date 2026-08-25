# Adding `how-to` as flowrite's fourth document kind

## The problem it solves

flowrite wrote three of the four Diátaxis genres. It could produce an exhaustive reference page for a
type, a module reference, and a learning-oriented tutorial. It could not produce the genre a
practitioner actually reaches for: a **how-to guide** — one concrete task, one canonical path, a
working result at the end, for a reader who already knows the library.

The gap was recorded as §6 of `WRITER-ASSISTANT-MIGRATION.md`, the audit taken before the predecessor
repo was deleted, with an estimate attached: "one `KINDS` row plus a structure and a checklist skill —
the table was built for exactly this." Half of the value of doing this was finding out whether that
estimate was true.

Until now "how-to" existed in flowrite only as a negation. Three instruction files told their writer
not to become one; `writing-style/SKILL.md` listed how-to guides among the genres it covers; the
tutorial template told its author to link out to how-to guides that nothing could write.

## Why the source differs from the port

The predecessor had `workflows/write-how-to-guide.ts` and `skills/docs-how-to-guide/SKILL.md`, and
neither is the document you want to read.

**The substance was somewhere else.** `writer-assistant`'s skill is a 30-line conceptual summary, the
residue of a de-duplication refactor. The doctrine — a Problem-section template with three mandated
parts, 20 research questions, a 43-item checklist — lives in
`plugins/documentation/skills/docs-how-to-guide/`, a tree that is **not** being deleted. So this port
took its content from a source that survives, and its *shape* from flowrite.

**Part of the predecessor's how-to path never ran.**
`writer-assistant/workflows/phases/verify.ts` instructed the model to "use the checklist in the
docs-how-to-guide skill to self-verify all items." That skill had no checklist in that tree, and
`agents/docs-writer.ts` imported only its `SKILL.md`. `ARCHITECTURE.md` asserted the checklist
existed and was consulted. No how-to page was ever written by the workflow, anywhere in the repo or
its history — a search for a page carrying a "The Problem" heading returns only the skill files that
describe one.

That matters beyond this port: for the remaining audit gaps, a `writer-assistant` file is not
evidence that the behaviour it describes ever ran.

**Three contradictions had to be resolved rather than carried.**

1. *How the Introduction opens.* The plugin skill supplies "In this guide, we will build [thing]… By
   the end, you will have [result]"; the newer workflow prompt says "Start immediately with the goal —
   no warm-up, no 'in this guide we will'." The port takes the newer, **as a preference and not as a
   rule**: writing-style rule 3 forbids *named* filler phrases, and rule 2 explicitly blesses
   "promises about the reader's future… ('By the end of this tutorial, you will...')". Both forms are
   permitted here, so a reviewer holding `rules.md` will not fail the older one. The sources agree on
   substance — lead with the outcome — and differ only on spending a clause announcing it.
2. *The "Running the Examples" format.* The plugin checklist describes a flat `git clone` + `sbt
   runMain` list. flowrite mandates per-example `<details><summary>` blocks embedding source via
   `mdoc:embed:<path>:show-line-numbers`. The port follows flowrite; copying the old checklist would
   have shipped a document that fails correct pages.
3. *Which spelling of the line-numbers modifier.* Four files in `src/skills/` say
   `:show-line-numbers`; `mdoc-conventions/SKILL.md:22` says `:showLineNumbers`. One does not resolve.
   The how-to files use kebab, matching the majority — but the discrepancy is filed rather than fixed,
   because no fixture archive contains a built page with either form (`BACKLOG.md` finding 2 records
   the examples phase never having run since the conversion), and a 4-to-1 vote is not evidence.

## What is deliberately not ported

| dropped | why |
|---|---|
| the eight numbered sections | the template emits literal heading text and forbids its own vocabulary in headings — see "The template must not name itself" below |
| `focus: 'guide'` in the research phase | flowrite's researcher is kind-neutral by design (`researcher.ts:8-12`); the how-to's research asks live in its instruction file instead |
| the separate `verify` and `style` phases | flowrite's `review_page` evaluates the kind's checklist and every writing-style rule in one pass |
| the four-mode payload and `skipPhases` re-plumbing | `skipPhases` already exists and is kind-independent |
| the plugin skill's 20 research questions, verbatim | front-loading 20 questions into a prompt was criticised in the source repo's own skill review; the substance is compressed into the instruction file's step 2 |
| the plugin checklist's 43 items, verbatim | several would fail a correct flowrite page (see contradiction 2) |
| the Introduction fill-in template | see contradiction 1 |

## The design

### The table absorbed the kind; the prose around it did not

Adding `how-to` required: `'how-to'` in `DOC_KINDS`, one `KINDS` row, two entries in `STRUCTURES` and
`CHECKLISTS`, and three prose files. No phase, no delegation, no schema, no new entry point, and **no
subagent changed** — `designer` and `drafter` both read `structureBlock(docKind())` at their own
render, so both picked up the new template untouched. `researcher`, `reviewer`, `fact-checker`,
`review-page.ts` and `fact-check.ts` are explicitly kind-neutral and needed nothing.

`tsc` enforces more of that than expected. The plan assumed only the two `Record<DocKind, string>`
maps were type-forced; in fact a missing `KINDS` row also fails at the `KINDS[kind]` index in
`agent.ts` and in `agent.test.ts`. The wiring cannot be left half-done.

What `tsc` cannot reach is every place three kinds had been written out in text, and that is where the
work was:

- `GATE_INSTRUCTIONS` — hand-written prose enumerating the kinds for the model
- `set_document_kind`'s `subject` description — a schema description, read on the classifying turn
- `examples_builder` and `docs_integrator`'s **role descriptions** — the roster text a delegating
  model reads
- `examples-builder.md`'s two enumerations of which page kinds have which sections
- `fixtures/tinyproject/AGENTS.md` — workspace-discovered into the writer's prompt

So the audit's estimate was right about the architecture and undercounted the prose. That asymmetry is
the finding worth keeping: a fifth kind will cost the same three files plus the same hand-search.

### Classification is the riskiest step, and it fails silently

A how-to and a tutorial land in the same directory (`docs/guides/`) under the same sidebar category.
They are distinguished only by the reader's intent. That is inherited doctrine and it is right — a
reader browsing "Guides" should not have to know which internal genre a page belongs to — but it makes
the gate's decision genuinely hard, and a wrong decision invisible:

- `run-telemetry.ts:212-233` is the only telemetry reasoning about where a page landed, and it is
  "kind-agnostic on purpose" — it keys on the last `docs/` path segment, which is `guides` for both.
- The reviewer is handed whichever checklist the gate chose (`review-page.ts:338`).

A how-to misfiled as a tutorial is therefore reviewed against the tutorial checklist, passes, and
files `verdict: passed`. The operator gets a complete, compile-verified, fact-checked page in the
wrong genre, reported as a success.

There is a second-order effect that disguises it further. The log prefix is the label of the kind the
gate **classified**, not the one the launcher asked for. `archive-docs.sh` greps
`"<label> token consumption:"` and every grep is individually guarded, so a mismatch silently no-ops
— no `token-usage.json`, no verdict, no insights, no run report, and a closing summary
indistinguishable from a clean archive. The natural diagnosis is a crash.

The response is prose plus one warning, not a validator:

- the `tutorial` bullet lost the words "of a task", which were the how-to's definition and left
  `tutorial` a superset absorbing every how-to request;
- both guide bullets now name the reader's intent — UNDERSTAND versus FINISH — with the discriminator
  stated and one ✅/❌ pair;
- the worked ambiguity example moved from `data-type`/`tutorial` to `tutorial`/`how-to`: the easy pair
  gave its example to the hard one;
- `archive-docs.sh` gained an `else` branch naming misclassification as the likely cause of an
  artifact-free archive.

`ask_for_clarification` already exists and is measured (`agent.ts:206-209`): prose-only "ask and stop"
wrote a whole page anyway at 53 turns and $0.38, while naming the tool halted in 1 turn and 3.2k
tokens. The escape hatch works; what is unproven is whether the discriminator is good enough to use
it at the right moment.

### The "before" block is `mdoc:compile-only`, not a plain fence

The Problem section is the only section no other kind has, and it carries a "before" example showing
what the reader writes today. Both sources fence that block as plain ` ```scala `, reasoning that
painful code need not compile. **In flowrite that is forbidden, and it fails silently.**
`mdoc-conventions/SKILL.md:10` restricts plain fences to "abstract signature blocks (declarations with
no bodies), pseudocode, ASCII diagrams, sbt/config" and adds "Never downgrade a real example to plain
` ```scala ` to dodge a compile error — fix the example"; `:41` makes it a closing sweep over every
fence. `mdoc-conventions` is on the how-to row, so the drafter would hold both mandates, obey the
sweep, hit the compile error, and then obey "fix the example" by rewriting the pain away. The
contrast the section exists for disappears and review passes.

The resolution needs no edit to any shared file, because the premise was wrong: **"what you write
without this library" is ordinarily verbose *working* code.** Hand-rolled `copy()` chains, a match over
every case, three lines repeated per field — it compiles. The pain is the volume, so there was never a
compile error to dodge. The default form is therefore `mdoc:compile-only` real code that does not
reference the library being documented. Plain fences survive only for the case the plugin source
itself carved out: an architectural problem no runnable code shows, expressed as pseudocode or prose.

Form 1 also defuses a second hazard, which is why it is the default rather than one of two equals.
`fact-checker.md:16` tells the checker that plain ` ```scala ` blocks "matter most … the one place a
wrong signature can sit in a finished, verified page and never be caught. Check every one, character
by character." A before-block in a plain fence would be the most scrutinized text on the page, a
`not-in-source` drift is severity `high`, and `review-page.ts:200` computes
`passed = reviewFailures.length === 0 && !factCheck.blocking` — so a *correct* page could fail its own
run. Compiled blocks are exempt by that same file's own reasoning.

One content rule closes the rest, in the template and the checklist rather than in code: **the
before-block never uses the documented library's API.** Which is also just what "before" means.

`fact-checker.md` was deliberately **not** edited. That failure mode is loud — the run fails — and the
standing rule is to instruct first and wrap only what has been watched to fail. If a live run reports
a drift on a before-block, that is when the clause is earned.

### The template must not name itself

`BACKLOG.md` finding 3 records a run emitting `## 6. Concept 4: Bounded Windows` and blames the
template's numbered list. The diagnosis is wrong, and the mitigation follows the diagnosis: `## 1.`
was *compliant*, because `tutorial-structure/references/structure.md:46` mandates
"Use '## 1. Topic', '## 2. Next Topic'". What leaked was the template's **placeholder label** — its
item 3 reads `Concept sections (3-6, one new idea each)`, and the page emitted `Concept 4:`. That is
writing-style rule 27's category ("Never surface internal organizing vocabulary in the doc"), but rule
27 enumerates specific terms, so no reviewer item covered it.

The how-to template therefore gives literal heading text for every fixed section, describes its
capability-section group without a name a drafter could echo, and forbids `Step`, `Capability`,
`Section`, `Concept` and template-supplied ordinals in headings. The old source invites the failure
straight back by calling them "Step-by-step sections", which yields `## Step 1:` by the identical
mechanism.

The **checklist** carries that rule too, and that is the load-bearing half: `BACKLOG.md:136-138`
records that "the checklist is the reviewer's entire competence: it does not have the structure skill
mounted."

### `plainTools` is empty, and the reason is sharper than the tutorial's

`check_method_coverage` counts documented methods against a type's real public API. A how-to guide
documents real API — but only the API its one task needs, deliberately — so coverage would report a
large miss on a correct page. `agent.test.ts` already states the reasoning for tutorial ("offering the
tool would invite a check that should fail"); it transfers, and the test now asserts it for both.

## Verification

**Offline, and complete for what it covers.** `./node_modules/.bin/tsc --noEmit` plus
`node --import ./test-setup/md-imports.mjs --test src/**/*.test.ts` — 105 tests, all passing. Note
`npm run` cannot invoke either: `devEngines` requires pnpm, so `npm test` and the new
`npm run typecheck` both die with `EBADDEVENGINES`.

Five existing tests loop over `DOC_KINDS` and began covering the new kind for free. Three edits made
hardcoded tests derive from `DOC_KINDS` instead — most importantly the pairwise-distinctness test,
which existed to catch "one kind's map entry pointing at another kind's import" and, as three named
assertions, covered nothing a fourth kind added. Three new assertions close gaps that were silent:

- `GATE_INSTRUCTIONS` names every `DOC_KINDS` member — the one enumeration with no type behind it.
- Every mounted skill has a non-empty `name`; a `SKILL.md` missing `name:` loads as `undefined`, and
  the duplicate-skill test then compares `undefined` to `undefined` and passes.
- Each of the four fixture launchers archives under its own row's label. The pin above it was titled
  "labels match what archive-docs.sh greps for" while opening no script; this is that assertion, and
  it was verified by breaking a label and watching it fail.

**Live: not done, and blocked.** The Anthropic key is exhausted until 2026-09-01; issues #57, #59,
#63, #65 and the #66 umbrella already queue on that date. Nothing genre-shaped is proven — see
`BACKLOG.md` finding 11 for the four questions, in priority order.

The cheap first check needs no new code: start `fixtures/tinyproject/scripts/run-how-to-guide.sh` and
Ctrl-C once the classification line appears — the launcher's INT trap archives, so one turn buys the
answer to the riskiest question. A `classifyOnly` flag on `docsWriterFields` would make it a clean
assertion in about five lines (`skipPhases` cannot do it: it enumerates only the seven document phases
and is read *after* classification), but that is production code for a test affordance and should wait
until the interrupt proves unreliable.

## Risks

- **A misclassified run looks like a success.** The mitigations are prose and one shell warning. The
  live gate check is what would actually establish the discriminator works.
- **The fixture cannot ground the Problem section.** `fixtures/tinyproject` is dependency-free with
  seven types and no boilerplate to suffer, so the before-block has nothing real to be painful about
  and the drafter will invent it — the one thing fact-check can neither confirm nor deny. A passing run
  proves the plumbing, not the genre. Judging the genre needs a library with real boilerplate.
- **Two kinds now share `docs/guides/`.** An `id` collision overwrites a page, and nothing checks. The
  instruction file and the fixture's `AGENTS.md` both say to list the directory first; that is an
  instruction, not a guarantee.
- **The checklist is the only genre gate.** A how-to checklist weaker than the tutorial's would make
  how-to the easy path and pull pages into it. It was written at least as strict, which is a judgement
  no test can confirm.
- **The how-to doctrine now exists in two trees.**
  `plugins/documentation/skills/docs-how-to-guide/` is untouched by this work and is longer and older
  than flowrite's copy. flowrite's is the live one; a reader finding the 299-line version will
  reasonably assume otherwise.
- **Finding 3's label mechanism is still open for the other three kinds.** Fixing it there changes the
  drafting prompt for every existing kind and needs its own run.
