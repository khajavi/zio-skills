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
- [ ] "Putting It Together" matches the page shape: present only on a `one-program` guide, as prose naming every difference from the sections plus an EMPTY `scala mdoc:embed:<path-to-CompleteExample.scala>` block (or the project's `SourceFile.print` equivalent); absent on a `recipes` guide
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

- [ ] The companion examples and their embeds pass every item of the `docs-examples` "Checklist"

## Style and Integration

- [ ] The frontmatter `id` matches the filename, and the id names the task rather than a type (`docs/guides/` also holds tutorials — check the directory listing before settling on an id; a path that already exists belongs to another page)
- [ ] The guide is added to `sidebars.js`
- [ ] The guide is linked from `docs/index.md`
- [ ] Related reference pages link back to this guide
- [ ] Writing style follows the rules (present tense, "we"/"you", concise, no emojis)
- [ ] The prose is direct and imperative ("Define a schema", "Run the effect") — fail warm, tutorial register ("Welcome", "Let's", "notice that"); that belongs to `docs-tutorial`
- [ ] Admonitions are used sparingly and for genuinely important callouts
