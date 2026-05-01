# Embedding Example Files with `SourceFile`

Detailed guidance for embedding full Scala source files into a reference page using `SourceFile.print`. Load this file when writing the **Running the Examples** section of a `docs-data-type-ref` page, or when an existing page's embeds need to be reformatted.

The default for the `docs-data-type-ref` skill is: **always use `SourceFile.print`** to embed examples. Hand-pasting source into the doc duplicates code and lets it drift; `SourceFile.print` reads the file at mdoc compile time so docs and examples stay in lock-step automatically.

## Pattern

```scala mdoc:passthrough
import docs.SourceFile

SourceFile.print("<module_name>-examples/src/main/scala/<package>/<ExampleFile>.scala")
```

This emits a fenced Scala code block with the file path shown as the title.

## Critical: Import Form

Always import as `import docs.SourceFile` and call `SourceFile.print(...)` — **do NOT** use `import docs.SourceFile._` with a bare `print(...)`. The wildcard import shadows `Predef.print` inside mdoc sessions, and the resulting compile error is confusing because the obvious culprit (`print`) appears to be defined.

✅ Good:

```scala mdoc:passthrough
import docs.SourceFile

SourceFile.print("schema-examples/src/main/scala/example/Person.scala")
```

❌ Bad (shadows `Predef.print`):

```scala mdoc:passthrough
import docs.SourceFile._

print("schema-examples/src/main/scala/example/Person.scala")
```

## Optional Parameters

| Parameter           | Type            | Default | Purpose                                          |
|---------------------|-----------------|---------|--------------------------------------------------|
| `lines`             | `Seq[(Int, Int)]` | none  | Include only specific 1-indexed line ranges     |
| `showLineNumbers`   | `Boolean`       | `false` | Render with line numbers in the gutter          |
| `showTitle`         | `Boolean`       | `true`  | Show the file path as the code-block title      |

### Examples

Embed only lines 10–25 of a file:

```scala mdoc:passthrough
SourceFile.print(
  "schema-examples/src/main/scala/example/Person.scala",
  lines = Seq((10, 25))
)
```

Embed the whole file with line numbers and no title:

```scala mdoc:passthrough
SourceFile.print(
  "schema-examples/src/main/scala/example/Person.scala",
  showLineNumbers = true,
  showTitle = false
)
```

## Common Failures

| Symptom                                                    | Likely cause                                                  | Fix                                                                                  |
|------------------------------------------------------------|---------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `not found: object docs`                                   | The docs subproject does not include the `SourceFile` helper. | Verify `docs/src/main/scala/docs/SourceFile.scala` exists; if not, copy it from the project's docs scaffold. |
| `value print is not a member of Predef`                    | Used `import docs.SourceFile._`                               | Switch to `import docs.SourceFile` and call `SourceFile.print(...)` qualified.       |
| Embedded file appears empty                                | Path is wrong, or the file moved                              | Run the doc build (`sbt "docs/mdoc"`) — mdoc will report the missing path.           |
| `lines = Seq(...)` shows truncated output                  | Range is exclusive of the upper bound or off-by-one           | Range is inclusive on both ends; double-check the line numbers in the source file.   |

## When to Skip `SourceFile`

- The example is **fewer than ~10 lines** AND is the only place that snippet appears. A plain ```` ```scala mdoc ```` block is fine.
- The example is **synthetic** (illustrative only, not a runnable companion file). It belongs inline.

In every other case (any "Running the Examples" section, any reused snippet, any example over ~10 lines), use `SourceFile.print`.
