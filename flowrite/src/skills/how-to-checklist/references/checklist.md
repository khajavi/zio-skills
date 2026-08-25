# How-To Guide Review Checklist

Verify every item. The guide is not done until all pass.

## Content Quality

- The Introduction states the concrete outcome the reader will have, in one paragraph.
- The Introduction contains no conceptual preamble and no theory. A guide that opens by explaining
  what a type is has become a tutorial — fail this item, not the type explanation.
- A "The Problem" section exists, and carries all three parts: the problem stated concretely, what it
  costs the reader, and a "before" example.
- The "before" example is a `mdoc:compile-only` block — or a plain `scala` fence holding pseudocode
  when the problem is architectural — and it does **not** use the API of the library being
  documented. Fail this when the block uses the library: a "before" written with the tool the guide
  is selling has no contrast in it.
- The "before" example is genuinely verbose or error-prone. Fail it when the code looks like
  something a reader would be happy to keep, because then the guide's problem is not real.
- Prerequisites names the sbt dependency with `@VERSION@`, puts base imports in one `mdoc:silent`
  block, and states the assumed knowledge.
- The Core Model introduces the domain types in `mdoc:silent`, small, with a reason for each.
- Every capability section covers exactly one new capability and leaves the reader closer to a
  working result.
- No section is pure prose without a code example — excepting Introduction, The Problem's prose, and
  Going Further, which are prose by design.
- The result is shown after each step (printed output or the type produced), not merely described.
- Types and APIs are introduced only where the goal needs them (no front-loaded theory, no
  exhaustive API coverage — that is a reference page's job).
- One canonical path throughout: no "alternatively", no "if you need X instead".
- The prose is direct and imperative ("Define a schema", "Run the effect"). Fail warm, tutorial
  register — "Welcome", "Let's", "notice that".
- A reader who follows every step ends with a working result.
- Scope is held to the single goal; nothing is covered because it was nearby.
- **No heading contains this template's vocabulary or an ordinal it supplied** — no `Step`,
  `Capability`, `Section`, `Concept`, and no leading digit. Heading text names what the section
  delivers, in the reader's words.
- "Putting It Together" is a complete, self-contained, copy-paste-ready example, delivered as an
  EMPTY block fenced `scala mdoc:embed:<path-to-CompleteExample.scala>` — never code inlined in the
  page. Fail this when the section inlines its example: the embedded file is what the examples build
  compiles and a reader runs, so inlining ships code no build has verified as standalone.
- "Running the Examples" embeds each step's file the same way, inside a collapsible
  `<details><summary>` with `:show-line-numbers`, and every embedded path exists.
- "Going Further", if present, links only to pages that exist.
- The writing style rules are evaluated in the same review pass — report their violations as failing
  items too.

## Technical Accuracy

- All method signatures and type names match the actual source code. Verify against each type's cited
  `source` (`path:L<start>-L<end>`) in the research: jump to those lines; if the type isn't there
  (source drifted), `grep` its name in that same file. Never trust the guide's prose alone.
- Every code block carries a correct mdoc modifier, and imports are complete in each. A runnable
  block in a plain `scala` fence is a failing item — the compiler never saw it.
- The composition order the steps follow is the order the types actually compose in.
- No deprecated methods or outdated patterns.
- `sbt "docs/mdoc --in docs/guides/<id>.md --out website/docs/guides/<id>.md"` reports zero `[error]`
  lines (mandatory before done).

## Review Cadence

- Fix every failing item in one editing pass.
- The run has a bounded number of review rounds and the review tool's description states how many.
  When a review reports failing items, fix them all and call review ONCE more: that confirming round
  is what records the page as passing, since the verdict is whatever the last review found. A review
  that reported nothing needs no confirmation — finish instead.
- Name every item you could not fix in the final summary, and report the run as failed when any
  remain. An unverified fix is not a pass.
