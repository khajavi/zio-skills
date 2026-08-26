# Tutorial Review Checklist

After writing, verify every item on this checklist:

## Content Quality

- [ ] The tutorial clearly states who it is for (newcomer, assumed prior knowledge)
- [ ] Learning objectives are stated upfront as a bullet list
- [ ] Learning objectives are restated at the end in "What You've Learned"
- [ ] The tutorial follows a strict linear path (no branching, no "alternatively")
- [ ] Every section introduces exactly one new concept or builds incrementally
- [ ] No section is pure prose without a code example
- [ ] Every code example is annotated line-by-line with bullet-point explanations
- [ ] Intermediate results are shown (printed or observed) after each major step
- [ ] The running example is simple and clearly demonstrates the core concepts
- [ ] Types and APIs are introduced only as needed (no front-loaded theory)
- [ ] The tone is warm and welcoming (uses "welcome", "let's", "notice that")
- [ ] The "Putting It Together" section is a complete, self-contained, copy-paste-ready example
- [ ] The "Background" section (if present) explains motivation without code

## Technical Accuracy

- [ ] All method signatures and type names match the actual source code
- [ ] All code examples use correct mdoc modifiers and would compile
- [ ] Imports are complete and correct in every code block
- [ ] The sbt dependency (if mentioned) is correct
- [ ] No deprecated methods or outdated patterns are used
- [ ] Run `sbt "docs/mdoc --in docs/guides/<tutorial-id>.md --out website/docs/guides/<tutorial-id>.md"` and confirm zero `[error]` lines (this is mandatory before claiming the tutorial is done). Note the path: tutorials live in `docs/guides/`, not `docs/tutorials/` — this checklist previously disagreed with SKILL.md's own file-location instructions on this.
- [ ] "Putting It Together" is delivered as an EMPTY block fenced `scala mdoc:embed:<path-to-CompleteExample.scala>` (or the project's `SourceFile.print` equivalent — see `docs-examples`), never code inlined directly in the page. The embedded file is what the examples build actually compiles; inlining ships code no build has verified as standalone.

## Companion Examples

- [ ] A package directory exists in `<examples-module>/src/main/scala/<packagename>/` (the module name comes from the tutorial's own examples setup, not a fixed name — see `docs-examples`)
- [ ] There is one example file per major tutorial concept (typically 3-5 files)
- [ ] There is a `CompleteExample.scala` (or descriptively named equivalent) with the full "Putting It Together" code
- [ ] Each example file is fully self-contained (compiles and runs independently)
- [ ] Each example file has complete imports
- [ ] Each example file has a scaladoc with tutorial title, concept name, description, and `sbt runMain` command
- [ ] Each example file includes `println` output showing meaningful results
- [ ] All examples compile successfully (`sbt "<examples-module>/compile"`)

## Running the Examples Section

- [ ] The tutorial includes a "Running the Examples" section after "Putting It Together"
- [ ] The section clones and `cd`s in one path straight into the examples module dir (`cd <repo>/<examples-module>`, not a separate `cd <repo>` then `cd <examples-module>`)
- [ ] Every companion example file is embedded, per concept in order, inside a collapsible `<details><summary>` via `mdoc:embed:<path>:show-line-numbers` (same pattern as "Putting It Together"), with a short sentence on how to run it and its `sbt "<examples-module>/runMain ..."` command
- [ ] The section includes `sbt "<examples-module>/compile"` as an alternative

## Style and Integration

- [ ] The frontmatter `id` matches the filename
- [ ] The tutorial is in `docs/guides/` (same directory as how-to guides)
- [ ] The tutorial is added to `sidebars.js` under the "Guides" category
- [ ] The tutorial is linked from `docs/index.md`
- [ ] Related reference pages link back to this tutorial
- [ ] Every link in "Where to Go Next" points at a page that actually exists — check before linking, and leave a mention unlinked (never a placeholder) when it doesn't. Never accept a stub page written just to make a link resolve.
- [ ] Writing style follows the rules (warm tone, present tense, "we"/"you", concise, no emojis)
- [ ] Admonitions are used sparingly and for genuinely important callouts
