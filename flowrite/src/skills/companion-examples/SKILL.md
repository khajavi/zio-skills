---
name: companion-examples
description: How to commission and verify a page's companion example files — the standalone runnable Scala a page pulls in with mdoc:embed. Use when a documentation page embeds example files rather than relying only on inline mdoc blocks.
---

# Companion Examples

A page's runnable examples come in two forms. **Inline** mdoc blocks compile as part of the page and
need nothing here. **Embedded** files — pulled in with `mdoc:embed:<path>` from a tutorial's
"Putting It Together" or a reference page's "Running the Examples" — are real `.scala` files that must
exist on disk before mdoc runs, in their own sbt build.

Delegate the build to the `examples_builder` subagent with the `task` tool. It owns the three-level
decoupled sbt layout and the compile-and-run loop; it sees none of your conversation, so name:

- the page path, since its code blocks are the only permitted source of example code,
- every `mdoc:embed:<path>` the page declares, each of which must end up at exactly that path,
- that each example prints meaningful output when run.

## Ordering

Commission the examples **before** mdoc verification. An `mdoc:embed:<path>` block fails outright when
the file it names is absent, so a page that embeds examples cannot pass mdoc until they exist.

For a module reference, prefer ONE module-level example set that exercises several types together over
one set per type — the cross-type workflow is what a module page is for.

## Verifying what came back

The delegation is done when every embedded path exists and the examples leaf compiles and runs. Check:

- each `mdoc:embed:<path>` in the page resolves to a real file,
- the example code traces to the page's own blocks — nothing invented beyond glue,
- the leaf built and each example ran, rather than only compiling.

If mdoc later reports an unresolved embed, the file is missing or at the wrong path — fix the path or
re-commission it rather than deleting the embed to make the page compile.
