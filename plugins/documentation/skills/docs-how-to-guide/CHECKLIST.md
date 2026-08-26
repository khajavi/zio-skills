# How-To Guide Review Checklist

After writing, verify every item on this checklist:

## Content Quality

- [ ] The guide has a clear, stated goal in the introduction
- [ ] The guide has a "Problem" section that concretely states what problem is being solved
- [ ] The problem section explains why the problem matters (real consequences)
- [ ] The problem section includes an example of the pain (code or concrete scenario)
- [ ] A reader who follows every step will have a working result at the end
- [ ] Every section introduces exactly one new concept or capability
- [ ] No section is pure prose without a code example (Introduction, The Problem's prose, and Going Further are prose by design)
- [ ] The running example is realistic and relatable
- [ ] Types and APIs are introduced only when needed (no front-loaded theory dumps)
- [ ] The Introduction has no conceptual preamble and no theory — a guide that opens by explaining what a type is has become a tutorial; fail this item, not the type explanation
- [ ] The "before" example in The Problem section is an `mdoc:compile-only` block (the default — real, compiling, non-library code showing what the reader writes today) or a plain `scala` pseudocode fence only when the problem is architectural — and it does NOT use the API of the library being documented. Fail this when the block uses the library: a "before" written with the tool the guide is selling has no contrast in it
- [ ] The "before" example is genuinely verbose or error-prone, not code a reader would be happy to keep — otherwise the problem isn't real
- [ ] No heading contains this template's own vocabulary or a supplied ordinal — no "Step", "Capability", "Section", "Concept", no leading digit. Heading text names what the section delivers, in the reader's words
- [ ] The "Putting It Together" section is a complete, self-contained, copy-paste-ready example, delivered as an EMPTY block fenced `scala mdoc:embed:<path-to-CompleteExample.scala>` (or the project's `SourceFile.print` equivalent) — never code inlined in the page. The embedded file is what the examples build actually compiles; inlining ships code no build has verified as standalone
- [ ] "Going Further" (if present) links only to pages that exist — mention a page in prose, unlinked, when it doesn't exist yet, and never accept a stub written to make a link resolve

## Technical Accuracy

- [ ] All method signatures and type names match the actual source code
- [ ] All code examples use correct mdoc modifiers and would compile — a runnable block in a plain `scala` fence is a failing item, since the compiler never saw it
- [ ] Imports are complete and correct in every code block
- [ ] The sbt dependency in Prerequisites is correct
- [ ] No deprecated methods or outdated patterns are used
- [ ] The composition order the steps follow is the order the types actually compose in
- [ ] Run `sbt "docs/mdoc --in docs/guides/<guide-id>.md --out website/docs/guides/<guide-id>.md"` and confirm zero `[error]` lines (this is mandatory before claiming the guide is done)

## Companion Examples

- [ ] A package directory exists in `<examples-module>/src/main/scala/<packagename>/` (the module name comes from this guide's own examples setup, not a fixed name — see `docs-examples`)
- [ ] There is one example file per major guide step (typically 3-5 files)
- [ ] There is a `CompleteExample.scala` (or descriptively named equivalent) with the full "Putting It Together" code
- [ ] Each example file is fully self-contained (compiles and runs independently)
- [ ] Each example file has complete imports
- [ ] Each example file has a scaladoc with guide title, step description, and `sbt runMain` command
- [ ] Each example file includes `println` output showing meaningful results
- [ ] All examples compile successfully (`sbt "<examples-module>/compile"`)

## Running the Examples Section

- [ ] The guide includes a "Running the Examples" section after "Putting It Together"
- [ ] The section clones and `cd`s in one path straight into the examples module dir (`cd <repo>/<examples-module>`, not a separate `cd <repo>` then `cd <examples-module>`)
- [ ] Every companion example file is embedded, per step in order, inside a collapsible `<details><summary>` via `mdoc:embed:<path>:show-line-numbers` (same pattern as "Putting It Together"), with a short sentence on how to run it and its `sbt "<examples-module>/runMain ..."` command
- [ ] The section includes `sbt "<examples-module>/compile"` as an alternative

## Style and Integration

- [ ] The frontmatter `id` matches the filename, and the id names the task rather than a type (`docs/guides/` also holds tutorials — check the directory listing before settling on an id; a path that already exists belongs to another page)
- [ ] The guide is added to `sidebars.js`
- [ ] The guide is linked from `docs/index.md`
- [ ] Related reference pages link back to this guide
- [ ] Writing style follows the rules (present tense, "we"/"you", concise, no emojis)
- [ ] The prose is direct and imperative ("Define a schema", "Run the effect") — fail warm, tutorial register ("Welcome", "Let's", "notice that"); that belongs to `docs-tutorial`
- [ ] Admonitions are used sparingly and for genuinely important callouts
