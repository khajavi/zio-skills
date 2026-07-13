# Embedding Example Files with `SourceFile`

Guidance for the **Running the Examples** section of a data type reference page. The default is:
**always use `SourceFile.print`** to embed a standalone example file. Hand-pasting source duplicates
code and lets it drift; `SourceFile.print` reads the file at mdoc compile time so docs and examples
stay in lock-step.

## Pattern

```scala mdoc:passthrough
import docs.SourceFile

SourceFile.print("<module_name>-examples/src/main/scala/<package>/<ExampleFile>.scala")
```

This emits a fenced Scala code block with the file path shown as the title.

## Critical: Import Form

Always `import docs.SourceFile` and call `SourceFile.print(...)` — **do NOT** use
`import docs.SourceFile._` with a bare `print(...)`. The wildcard import shadows `Predef.print`
inside mdoc sessions and produces a confusing compile error.

## Optional Parameters

| Parameter         | Type              | Default | Purpose                                     |
|-------------------|-------------------|---------|---------------------------------------------|
| `lines`           | `Seq[(Int, Int)]` | none    | Include only specific 1-indexed line ranges |
| `showLineNumbers` | `Boolean`         | `false` | Render with line numbers in the gutter      |
| `showTitle`       | `Boolean`         | `true`  | Show the file path as the code-block title  |

## Common Failures

| Symptom                                  | Likely cause                              | Fix                                                            |
|------------------------------------------|-------------------------------------------|---------------------------------------------------------------|
| `not found: object docs`                 | docs subproject lacks the SourceFile helper | Verify `docs/src/main/scala/docs/SourceFile.scala` exists.    |
| `value print is not a member of Predef`  | Used `import docs.SourceFile._`           | Switch to `import docs.SourceFile` and call it qualified.     |
| Embedded file appears empty              | Path is wrong or the file moved           | Run `sbt "docs/mdoc"`; mdoc reports the missing path.         |
| `lines = Seq(...)` truncated             | Off-by-one; range is inclusive both ends  | Double-check the line numbers in the source file.             |

## When to Skip `SourceFile`

- The example is fewer than ~10 lines AND appears only here — a plain ```` ```scala mdoc ```` block is fine.
- The example is synthetic (illustrative only, not a runnable companion file) — it belongs inline.

In every other case (any "Running the Examples" section, any reused or 10+ line example), use `SourceFile.print`.
