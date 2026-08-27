---
name: docs-companion-examples
description: How to commission and verify a page's companion example files — the standalone runnable Scala a page pulls in with mdoc:embed or SourceFile.print. Use when a documentation page embeds example files rather than relying only on inline mdoc blocks, to delegate the build and check what came back.
allowed-tools: Read, Grep, Glob, Bash(sbt:*), Task, Skill
---

# Companion Examples

A page's runnable examples come in two forms. **Inline** mdoc blocks compile as part of the page and
need nothing here. **Embedded** files — pulled in with `mdoc:embed:<path>` or `SourceFile.print` from a
tutorial's "Putting It Together" or a reference page's "Running the Examples" — are real `.scala` files
that must exist on disk before mdoc runs, in their own sbt build.

Delegate the build to a fresh subagent with the `Task` tool — it must NOT share your conversation, so
its only knowledge of the page is what you tell it. Point it at the **`docs-examples`** skill for the
mechanical procedure (the decoupled sbt build topology, file templates, compile, lint), and name:

```
Task(
  description: "Build companion examples for <page-id>",
  subagent_type: "general-purpose",
  prompt: "Build the companion example files for a ZIO documentation page. Use the docs-examples skill
           for the build topology, file templates, and compile/lint procedure.

           Page: <path to the page being documented>
           Embeds this page declares: <every mdoc:embed:<path> or SourceFile.print path it names,
             each of which must end up at exactly that path>
           Requirement: every example must print meaningful output when run, not just compile.

           The page's own code blocks are the only permitted source of example code — never invent
           example code beyond a package declaration, imports, a runnable wrapper, and printlns for
           output the page renders.

           Report: the examples build dir, the subproject id, the package name, and every example
           object with its run command."
)
```

## Ordering

Commission the examples **before** mdoc verification. An `mdoc:embed:<path>` block fails outright when
the file it names is absent, so a page that embeds examples cannot pass mdoc until they exist.

For a module reference, prefer ONE module-level example set that exercises several types together over
one set per type — the cross-type workflow is what a module page is for.

## Verifying what came back

The delegation is done when every embedded path exists and the examples leaf compiles and runs. Check:

- each `mdoc:embed:<path>` or `SourceFile.print` call in the page resolves to a real file,
- the example code traces to the page's own blocks — nothing invented beyond glue,
- the leaf built and each example ran, rather than only compiling.

If mdoc later reports an unresolved embed, the file is missing or at the wrong path — fix the path or
re-commission it rather than deleting the embed to make the page compile.
