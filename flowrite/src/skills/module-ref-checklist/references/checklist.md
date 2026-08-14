# Module Reference Review Checklist

Verify every item. The module reference is not done until all pass. This checklist reviews the
**module page** (the flat page, or the hierarchical index). Per-type member coverage is checked
separately and deterministically (a method-coverage gate runs per type before this checklist) — do
not attempt to re-count members here.

## Module Narrative (the reason a module reference exists)

- Opening definition appears immediately after the frontmatter with NO heading, states the module's
  purpose, and lists the core types as inline code.
- The opening includes a plain ```scala structural block (no bodies) showing the shape of the main types.
- A **"How They Work Together"** section is present — this is the centerpiece. It shows the typical
  workflow / data flow (numbered steps) AND an ASCII diagram of the type relationships. A module
  reference missing this section FAILS.
- Common Patterns are documented when the module has named patterns (decision trees / multi-type
  composition), with realistic cross-type examples — not just single-type snippets.
- Integration Points explain how the types relate internally and to other modules, with
  relative-path cross-references.

## Layout & Structure

- The layout matches the shape the design chose: `single-core` and `dsl` are one flat page,
  `core-family` and `multi-domain` are an index plus subpages. Check that consistency only — the shape
  follows reader intent and is the design phase's call, so a type count is never grounds to fail a page.
- Flat: every core and supporting type has an `##` section, in a sensible order; each covers every
  public member grouped concisely (one example per operation group).
- Hierarchical: the index links to every type subpage; the Overview introduces each core type in
  2-3 sentences with a working relative-path link.
- Sections appear in template order (definition → motivation → installation → overview →
  how they work together → common patterns → integration → type-level → running the examples).
- Between any two code blocks there is an explanatory paragraph — no two fenced blocks are adjacent.

## Coverage & Accuracy

- Every core type discovered in research is documented (flat section or hierarchical subpage) — none dropped.
- Relationships and composition shown in the narrative reflect the real source, not invented links.
- The writing style rules are evaluated in the same review pass — report their violations as
  failing items too.
- mdoc verification reports zero `[error]` lines for the page (flat) or the whole directory
  (hierarchical) — mandatory before done.

## Review Cadence

- Fix every failing item in one editing pass.
- The run has a bounded number of review rounds and the review tool's description states how many.
  With the default of one there is no confirming pass, so treat the first review as the only one:
  fix what it reports, then finish.
- Name every item you could not fix in the final summary, and report the run as failed when any
  remain. An unverified fix is not a pass.
