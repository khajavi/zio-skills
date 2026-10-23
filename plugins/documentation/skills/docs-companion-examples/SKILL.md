---
name: docs-companion-examples
description: How to commission and verify a page's companion example files — the standalone runnable Scala a page pulls in with mdoc:embed or SourceFile.print. Use when a documentation page embeds example files rather than relying only on inline mdoc blocks, to delegate the build and check what came back.
allowed-tools: Read, Grep, Glob, Bash(sbt:*), Bash(scala-cli:*), Task, Skill
---

# Companion Examples

A page's runnable examples come in two forms. **Inline** mdoc blocks compile as part of the page and
need nothing here. **Embedded** files — pulled in with `mdoc:embed:<path>` or `SourceFile.print` — are
real `.scala` files that must exist on disk before mdoc runs. `docs-examples` owns every rule about
them.

Delegate the build to the **`docs-examples-builder`** agent with the `Task` tool — it must NOT share
your conversation, so its only knowledge of the page is what you tell it:

```
Task(
  description: "Build companion examples for <page-id>",
  subagent_type: "documentation:docs-examples-builder",
  prompt: "Page: <path to the page being documented>
           Page shape: <one-program | recipes, from the page plan; reference pages: reference>
           Embeds this page declares: <every mdoc:embed:<path> or SourceFile.print path it names,
             each of which must end up at exactly that path>"
)
```

## Ordering

Commission the examples **before** mdoc verification. An `mdoc:embed:<path>` block fails outright when
the file it names is absent, so a page that embeds examples cannot pass mdoc until they exist.

## Verifying what came back

The delegation is done when:

- every `mdoc:embed:<path>` or `SourceFile.print` call in the page resolves to a real file,
- the builder ran every file and reported no output that contradicts the page — fix the page or the
  file for each difference it lists,
- everything the builder added beyond page code is named on the page (e.g. in the section's
  `<summary>` or the "Putting It Together" prose).

If mdoc later reports an unresolved embed, the file is missing or at the wrong path — fix the path or
re-commission it rather than deleting the embed to make the page compile.
