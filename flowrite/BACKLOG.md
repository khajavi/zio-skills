# flowrite backlog

Open findings, each measured on a fixture run rather than guessed. Every entry names the run that
produced the evidence, so a fix can be checked against the same shape.

Opened 2026-08-17 from `tinyproject-archive/write-tutorial-turn1`, the first tutorial run since the
phase-tool conversion. Ranked by whether the agent currently ships something wrong.

---

## 1. A run invents artifacts to satisfy a check it broke — FIXED in `9406235`, unverified

Fixed at the four sites that could each have prevented it (integrator prohibition broadened, the
tutorial integrate step, "Where to Go Next", writing-style rule 7), plus a deterministic detector:
`pages-outside-one-root` flags a run whose pages land under more than one docs root, and the report now
prints every page path. **Not yet confirmed by a run** — the next tutorial run should write only under
`docs/guides/`, and the flag must stay silent on a hierarchical module run's three pages under one root.


**Evidence — `write-tutorial-turn1`.** A *tutorial* run shipped two stub *reference* pages,
`docs/reference/tally/Ledger.md` and `Window.md`, and wired both into `sidebars.js`. The chain:

1. the drafter wrote links as `{{< tally_reference_path "Ledger" >}}` — a Hugo shortcode, invented, in a
   Docusaurus page
2. those became `../reference/tally/Ledger.md`, which did not exist, and `docusaurus.config.js` sets
   `onBrokenLinks: 'throw'`, so the build would fail
3. the root agent's integrate brief said: *"ensure they have reference pages and link to them … If not,
   **create stub reference pages** with placeholder content"*
4. the integrator obliged — 26 lines each, PascalCase filenames against the kebab rule, unreviewed,
   because review only covers the page the run was asked to write

**Why it matters.** Two defects ship at once: content nobody reviewed, and `Ledger.md` colliding with the
module run's `ledger.md` on any case-insensitive filesystem. It is also the second instance of one repair
pattern — #66 hardcoded `0.1.0` when `@VERSION@` failed rather than fixing the build. The model satisfies
the check by creating something, instead of removing the cause.

**Fix.** State the rule where a run can act on it — a broken link is fixed by not making the claim, never
by inventing the target:
✅ drop the link, or link a page this run wrote ❌ create a stub so the build passes
Then remove the stub-creation licence from the integrate brief, and give the drafter the Docusaurus link
form so it stops reaching for shortcode syntax.

---

## 2. The examples phase has never run since the conversion — FIXED in `c08c5d9`, unverified

Both hedges removed: the write step now states the embed requirement as the template states it and says
not to soften it, and step 5 is unconditional — a draft that came back inlined is a defect to fix, not a
reason to skip the phase. The tutorial checklist gained items for the embed pattern and for every
embedded path existing, so inlining fails review instead of passing as it did on turn1. **Not yet
confirmed by a run** — the next tutorial run should delegate to `examples_builder`, leave `.scala` files
under `tinyproject-examples/`, and carry embeds rather than inlined blocks.

**Evidence — `write-tutorial-turn1`.** Four delegations: researcher, designer, drafter, docs_integrator.
No `examples_builder`, and `tinyproject-examples/` contains no `.scala` file.

The cause is a hedge, not a broken phase. `tutorial-structure` requires
`mdoc:embed:<path>:show-line-numbers` per concept plus one for "Putting It Together"; the delegation brief
downgraded it to *"Putting It Together: Complete Workflow (may include embedded examples)"*. No embed
means nothing to build, so the phase has no reason to fire:

```
"may include" → drafter inlines code → no mdoc:embed → examples phase skipped → 93-line role untested
```

**Why it matters.** `examples-builder.md` is the largest untested surface in the project, and the
`mdoc:embed` single-source-of-truth arrangement is bypassed entirely — the page duplicates code the
examples module is supposed to own.

**Fix.** Make the brief say what the template says. Then re-run and check `tinyproject-examples/` is
non-empty and the page carries embeds rather than inlined blocks.

---

## 3. The structure template's list numbers become headings

**Evidence — `write-tutorial-turn1`.** `tutorial-structure/references/structure.md` enumerates its spec as
`1. Introduction`, `2. Background`, `3. Concept sections (3-6, one new idea each)`. The page emitted twelve
numbered `##` headings, with two schemes colliding:

```
## 6. Concept 4: Bounded Windows and Automatic Removal
## 7. Concept 5: Detecting Window Saturation
## 9. Putting It Together: Complete Workflow
## 11. What You've Learned
```

**Why it matters.** Not fabrication and not a stale rule — an ambiguity in how the template represents
itself. A numbered list reads as prescribed output, and nothing says the digits order the spec. The same
ambiguity exists in the data-type and module templates, which are numbered the same way.

**Fix.** Say once, in each template, that the numbering orders the template and is not heading text; or
renumber the templates as bullets. Add a checklist item for numbered headings so the reviewer can catch it.

---

## 4. Tutorial mdoc guidance is wrong for concept-per-section tutorials

**Evidence — `write-tutorial-turn1`, from the run's own retrospective.**

> "The initial draft used inline mdoc blocks with shared scope, causing variable redefinition errors
> across independent concept examples … Switched all concept examples to `mdoc:compile-only` …
> **Tutorial guidance should explicitly recommend `mdoc:compile-only`**"

`mdoc-conventions` says the opposite: *"A tutorial builds one concept on the previous, so favor a shared,
accumulating scope."* Where each concept redefines `ledger`/`window`, accumulation fails to compile, and
the model worked around its own instructions.

**Why it matters.** The model paid compile errors and edit turns to discover what the skill could have
told it. The advice is right for a tutorial that genuinely accumulates and wrong for one built as
independent concepts — and the template asks for independent concepts.

**Fix.** Split the advice by shape: accumulate when later blocks reuse earlier definitions; isolate with
`mdoc:compile-only` when each concept restates its own setup. Name the redefinition error as the signal.

---

## 5. The reviewer can only check what its checklist names — and one item is over-strict

**Evidence — `write-tutorial-turn1`.** Both defects above (missing embeds, numbered headings) **passed**
review, because no checklist item covers either. Meanwhile an item failed the page for something correct:

> "Sections 1 (Introduction) and 11 (What You've Learned) are pure prose with no code examples.
> **The checklist exempts only Background sections**"

An introduction and a summary are legitimately code-free. **That half is fixed in `c08c5d9`** — the item
now exempts Introduction, Background, "What You've Learned" and "Where to Go Next" — and the missing
embed item landed with it. What remains open here is the numbered-headings gap and the model-generated
item list.

Related, and measured across three runs: the reviewer **synthesises its own item list** — round 1
enumerated 46 items, round 2 enumerated 44, the module run 41 — inventing per-section instances like
`rule 8 (Section 3)`. So `42/46` and `42/44` are not comparable, and a "N/M items passed" line cannot be
tracked across rounds or runs.

**Why it matters.** The checklist is the reviewer's entire competence: it does not have the structure
skill mounted. Anything a page must have, and anything a reviewer must be able to do, has to appear in the
item that demands it — the lesson `4fcb7cd` already learned for the mdoc command.

**Fix.** Add items for the embed pattern and for numbered headings; exempt Introduction, What You've
Learned and Where to Go Next from the code-example rule. Separately, decide whether the item list should
be fixed rather than model-generated — a stable denominator is what makes the pass count a metric.

---

## Verified working, and worth not breaking

Measured on `write-module-ref-turn1` and `write-tutorial-turn1`:

- method coverage 100% with `missing: []`; no fabricated API on a fixture whose names are invented
- the frontmatter contract reproduced from prose, with its validator deleted
- `@VERSION@` resolved by the build rather than hardcoded
- a refused review round no longer reports as a failed phase (`e18c78d`)
- the confirming round earns a post-fix verdict on all three kinds (`f15f64a`)
- the `flowrite:` phase timeline, rebuilt from delegation events (`4a32380`)
- `pagesWritten` caught finding 1 as `research-draft-mismatch`, counting pages rather than delegations

## Older items

Pre-existing findings live in the session task list, not here — notably the unpassable-item class
(#60 `read_skill_resource` failing on `references/*.md`), waste (#44 `cd` violations, #45 failed reads),
and #55 per-type research re-discovering the module. Move one here when a run gives it fresh evidence.
