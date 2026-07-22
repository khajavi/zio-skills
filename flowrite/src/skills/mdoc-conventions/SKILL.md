---
name: mdoc-conventions
description: Reference for mdoc code-block modifiers and Docusaurus admonitions used across ZIO documentation. Load when writing any documentation that contains Scala code blocks.
---

# mdoc Conventions

Choose an mdoc modifier for every executable Scala block based on whether you need scope sharing and whether output should render.

## Modifiers

- **`mdoc:compile-only`** — Renders source only, isolated scope. **Default** for self-contained examples. Later blocks cannot reference its definitions.
- **`mdoc:silent`** — Renders nothing, scope shared with later blocks. Use to define types/values/imports later blocks reference. Cannot redefine a name later — use `silent:nest` for that.
- **`mdoc:silent:nest`** — Renders nothing, scope shared, code wrapped in an anonymous `object`. Lets you shadow/redefine names from earlier blocks.
- **`mdoc:silent:reset`** — Renders nothing, clears all prior scope. Use when switching to a completely different context mid-document. Because it clears scope, **re-declare every import (and any setup) the block's code uses** — nothing from earlier blocks carries over, so a missing `import` here is a "not found" compile error.
- **`mdoc`** (no qualifier) — Renders source + evaluated output, scope shared. Shows the code and its REPL-style result.
- **`mdoc:invisible`** — Invisible block, scope shared. Rare; prefer `silent` or `compile-only`.
- **`mdoc:embed:<path>`** — Custom modifier: replaces the block (leave its body empty) with the file at `<path>` (repo-root relative) as a titled code fence. Append `:showLineNumbers` for line numbers. Requires the docs subproject to depend on `"dev.zio" %% "zio-sbt-source"` — add it if missing.
- **Plain `` ```scala ``** (no mdoc) — Source only, not compiled. Use for pseudocode, ASCII diagrams, type-signature illustrations, or sbt config.

**Never hardcode expression output in comments** (`val x = 42 // 42`). Let `mdoc` render it.

## Choosing the Right Modifier

```
Is this real executable Scala code?
├─ NO → plain ```scala (pseudocode, ASCII art, type signatures)
└─ YES → Do later blocks need these definitions?
   ├─ NO → Show the output?  NO → mdoc:compile-only   YES → mdoc
   └─ YES → Is this a later block showing a result?
      ├─ YES → mdoc
      └─ NO → Redefining an earlier name?  YES → mdoc:silent:nest   NO → mdoc:silent
```

After a `mdoc:silent` block, if you need a completely different context, use `mdoc:silent:reset`.

## Common Patterns

- **Silent setup + output**: `mdoc:silent` block defines helpers/imports; a following `mdoc` block calls them and shows the result.
- **Self-contained**: a single `mdoc:compile-only` block that stands alone.
- **Multi-example suite**: when a page has many independent examples reusing names like `user`/`file`/`config`, start **every** example's first block with `mdoc:silent:reset` to avoid "Conflicting definitions" errors — once per independent example. Each such reset block must re-declare the imports its code uses (scope was cleared).

## For Tutorials (Linear Learning Path)

A tutorial builds one concept on the previous, so favor a shared, accumulating scope:

1. First setup block → `mdoc:silent` (imports, base types).
2. Each concept block that has meaningful output → `mdoc` (shows the result the learner should see).
3. Redefining a type to add a field mid-tutorial → `mdoc:silent:nest`.
4. "Putting It Together" final block → `mdoc:embed:<path>` pointing at the companion `CompleteExample.scala` (single source of truth; the file is compiled by the examples build).

Only `:reset` when the tutorial deliberately restarts in a new domain — rare in a linear tutorial.

## Tabbed Scala 2 / Scala 3 Examples

When syntax differs between versions, use Docusaurus tabs. Add these imports after the frontmatter:

```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
```

Use `groupId="scala-version"` (syncs all tab groups on the page) and `defaultValue="scala2"`. Keep blank lines inside `<TabItem>` so mdoc processes the fenced blocks. Use `mdoc:compile-only` inside tabs. Only use tabs when the syntax genuinely differs.

## Docusaurus Admonitions

Use admonitions **sparingly** (at most 3-4 per page) for genuinely important callouts:

```
:::note[Optional title]
Context or clarification the learner should remember.
:::

:::tip
A practical shortcut or pattern.
:::

:::caution
A common mistake to watch out for.
:::
```

## Docs classpath

mdoc compiles against the docs project's `.dependsOn(...)`. If the documented module is missing there, add it to build.sbt (match sibling style, e.g. `<module>.jvm`) and reload — never downgrade real code to plain ```` ```scala ```` over a missing dependency.

## Verifying

Always compile scoped to the files you touched, never the whole docs set
(unscoped `sbt docs/mdoc` recompiles every doc, minutes of sbt) — the sole
exception is the integrator's site-build-gate fallback (see docs-integrator):

```
sbt "docs/mdoc --in <file> --out website/<file>"
```

`mdoc` is an sbt task, not a shell binary: quote the whole `docs/mdoc …` as one argument (never bare `mdoc`, never unquoted).

One `--in`/`--out` pair per file; `out` is the same path prefixed with
`website/`, e.g. `docs/reference/x.md` → `website/docs/reference/x.md`. If the
failure output only shows a stack trace with "stack trace is suppressed; run
'last <scope>'", run that `sbt "last <scope>"` command to get the real error.

If mdoc produces more than ~3 errors, the blocks are likely not isolated — check for a missing `:reset`/`:nest` or a name collision. Strip modifiers from the reported lines, confirm the errors clear, then re-apply one at a time, re-running after each change.
