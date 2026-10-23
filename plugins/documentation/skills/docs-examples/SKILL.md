---
name: docs-examples
description: Shared rules for companion example files — where they live, which sections get one, the file template, shared code, the complete example, verification, formatting, and how a page embeds them. Used by docs-data-type-ref, docs-module-ref, docs-how-to-guide, docs-tutorial, and the docs-examples-builder agent.
allowed-tools: Read, Glob, Grep, Bash(sbt:*), Bash(scala-cli:*), Bash(scalafmt), Bash(git)
---

**Never invent example code.** Every line in an example file traces back to a code block already in
the documentation page being written — package declaration, imports, a runnable wrapper, and `println`
calls for output the page renders are the only things you may add beyond what the page's blocks
already contain. If the page doesn't show it, the example doesn't invent it.

**Coverage runs both ways.** Every code block of a section that gets a file lands in that file.
✅ the page's `println(rawYaml)` is in the example ❌ an example that keeps only the fixed end state

## Where Examples Live

**The project's conventions win.** Before creating anything, read the project's `AGENTS.md` /
`CONTRIBUTING.md` and one existing examples build, and copy their layout, Scala version, dependency
coordinates, run command and format command. Use the fallback layouts below only when the project has
no examples convention yet.

✅ zio-blocks: flat standalone `schema-examples/` build, one package per page, run with
`cd schema-examples && sbt "runMain <pkg>.<Obj>"` ❌ creating `zio-blocks-examples/<page-id>/` because
the fallback below shows it

**A shared examples build is shared.** A dependency or import you add can break other pages' files
(✅ compile the whole build after adding one ❌ compile only your package).

### Fallback: a decoupled examples build, one leaf per page

```
root build.sbt          — ONE addition: aggregates <library>-examples, nothing else, ever
<library>-examples/build.sbt
  └─ aggregates one RootProject per documented page (webauthn, lens, prism, ...)
     <library>-examples/<page-id>/build.sbt   — its OWN scalaVersion, its OWN deps
```

```scala
// root build.sbt — the only edit this makes to the main build, ever
lazy val examples = RootProject(file("<library>-examples"))
// include `examples` in the root project's own .aggregate(...)

// <library>-examples/build.sbt — grows by one line per new page, additively
lazy val root = (project in file(".")).aggregate(webauthn, lens)
lazy val webauthn = RootProject(file("webauthn"))
lazy val lens      = RootProject(file("lens"))
```

Each leaf is an independent sbt build: its own `build.sbt` (own `scalaVersion`, depending on the
library's published coordinates, or `.dependsOn(ProjectRef(file("../.."), "<rootProjectId>"))` for an
unpublished fixture) and its own `project/build.properties` (copy the main build's value — without it
sbt does not treat the directory as a build). A leaf is not addressable from the repo root: run sbt
inside it.

## Which Sections Get a File

**Guides and tutorials:** one file per section that has code to run. Skip a section when it:

- has no runnable code (prose, a diagram, a build/install snippet),
- is an `mdoc:fail` compile-error demo,
- only repeats code an earlier section's file already runs.

**Reference pages:** `BasicUsage.scala`, `AdvancedPatterns.scala`, … or descriptive names
(`CompleteHttpRequest.scala`); for a module reference, prefer files that exercise several types together.

**Names.** How-to: `Step<N><Topic>Example.scala`; tutorial: `Concept<N><Topic>Example.scala`; `N` counts
only sections that have a file. ✅ `Step3UpsertRowsExample` ❌ `Step3Example` ❌ `UpsertRowsExample`

**Package** = page id, lowercased, hyphens removed: `query-dsl-sql` → `querydslsql`,
`upsert-and-paginate-with-keyset-cursors` → `upsertandpaginatewithkeysetcursors`.

**Cumulative pages.** When a section builds on earlier sections' state, the file starts from that state,
labelled. ✅ `// Setup from sections 1–2: table created, three books inserted` ❌ re-seeding different data,
so the file prints something other than the page.

**Shared code.** A model or helper used by 2+ files of a page lives once in the package (`Model.scala`,
no `main`) and each user names it with `//> using file Model.scala`. A helper used by several pages lives
once per examples build (`shared/`). Each file contains only what it uses.
✅ `//> using file ../shared/JdkHttp.scala` ❌ five diverging copies of `JdkHttp.scala`
❌ copying a whole setup block, unused JVM-only calls included, into a file meant for Scala.js

## File Template

```scala
//> using scala <the examples build's scalaVersion>
//> using dep <org>::<artifact>:<version>   // exactly what the examples build resolves for that Scala version
//> using file Model.scala                  // only when the file uses shared code
// Run from this folder:  scala-cli run Step3UpsertRowsExample.scala
// Or from <module-dir>:  sbt "runMain <packagename>.Step3UpsertRowsExample"

package <packagename>

import <requiredImports>

/**
 * <Page title> — <Section heading>
 *
 * <1–2 sentences on what this file demonstrates.>
 */
object Step3UpsertRowsExample {
  def main(args: Array[String]): Unit = {
    // section code
  }
}
```

- **Header.** The `//> using` lines make the file run alone with scala-cli, with no clone. Copy the
  artifact name from the build's dependency helper, never guess it (✅ zio-blocks on Scala 3.9:
  `zio-blocks-next-schema` ❌ `zio-blocks-schema`). A module that needs a newer JDK adds `//> using jvm 21`.
- **Run commands go in `//` comments, never in Scaladoc.** Scalafmt rewraps Scaladoc and splits the
  command across two lines.
- **Always `object X { def main(args: Array[String]): Unit }`**, on Scala 2.13 and 3.
  ❌ `extends App`: deprecated on Scala 3.8+, and its body runs inside the class initializer, so a thread
  that touches the object's fields (a server handler, a joined task, a stream's async stage) deadlocks.
- **Label output; print evidence, not claims.**
  ✅ `println(s"after upsert: $books")` ❌ `println(true)`
  ✅ `println(s"map runs on ${Thread.currentThread.getName}")` ❌ `println("Running in background")`
- **Servers.** Forked `run` has no stdin. ✅ fixed port, block until Ctrl+C (or run a scripted demo and
  stop) ❌ `StdIn.readLine()` to keep serving.
- **Clean up** temp files and directories the example creates.

## The Complete Example

Only when the page plan records `page shape: one-program`; a `recipes` page has none.
`CompleteExample.scala` is assembled from the section files' code in page order. Every difference from
the sections (a real `EnvSource` instead of the page's map stand-in, a resource file instead of a temp
dir) is named in the page's "Putting It Together" prose.
❌ new domain types, payloads, helpers or defaults the page never shows (e.g. a default `db.password`)

## Verify

1. Run every new main, batched (`sbt "runMain a.A" "runMain a.B"`), plus `src/test` if present. A shared
   build: compile all of it.
2. Compare each run's output with the page's quoted output and prose claims, line by line.
3. `scala-cli compile <file>` for each new file — this proves the `//> using` header.

**Never kill sbt by pattern** (`pkill -f sbt`, `pkill -f sbt-launch`, `pkill java`). The caller
and other sessions usually run their own sbt servers on the same machine (e.g. the docs build's
mdoc), and a pattern kill takes them down mid-task ("sbt server disconnected"). Stop only what you
started: `sbt --client shutdown` from your own build directory, or use batch-mode `sbt`, which exits
on its own.

## Format

Use the project's documented format command, scoped to the files you created
(✅ zio-blocks standalone builds: `scala-cli fmt --scalafmt-conf <repo>/.scalafmt.conf <files>`
❌ formatting a whole `src/`, which reflows other pages' files). Examples inside the main build:
`sbt fmtChanged`, then `sbt check`. If formatting changes code that is also on the page, mirror the
change into the page block.

## Embedding in the Page

There are two ways to pull a companion file's source into a page, and they are not interchangeable —
use whichever this project already has wired up, and check before introducing the other:

- **`SourceFile.print` inside `mdoc:passthrough`** — a project-local helper. Use this when the
  project's docs subproject already defines `docs.SourceFile`.
- **`mdoc:embed:<path>`** (see `docs-mdoc-conventions`) — a built-in mdoc modifier requiring the docs
  subproject to depend on `"dev.zio" %% "zio-sbt-source"`. Prefer this for a project that has neither.

Either way, the embedded file must exist on disk **before** mdoc runs. Commission every example file
before the page's own mdoc verification pass, never after.

### Guides and tutorials

At the end of each section that has a file (never in a separate section at the end of the page):

````markdown
<details>
  <summary>Runnable version, with setup from sections 1–2: <code>Step3UpsertRowsExample.scala</code></summary>

```scala mdoc:embed:<module-dir>/src/main/scala/<packagename>/Step3UpsertRowsExample.scala:show-line-numbers
```

</details>
````

The summary says what the file adds beyond the inline code (setup from earlier sections, a real
`EnvSource`, a running server). A shared file (`Model.scala`) is embedded once, in the first section
that uses it.

"Running the Examples" is a short pointer, nothing more:

```markdown
## Running the Examples

All runnable code from this guide is in [`<module-dir>/src/main/scala/<packagename>/`](https://github.com/zio/<repo>/tree/main/<module-dir>/src/main/scala/<packagename>).
Run any file from that folder with `scala-cli run <File>.scala`, or from `<module-dir>` with
`sbt "runMain <packagename>.<ObjectName>"`.
```

### Reference pages

Place "Running the Examples" at the end of the page, one entry per example file:

```
    ## Running the Examples

    All code from this page is available as runnable examples in the `<examples-module>` module.

    ### <Example Title>

    <Short description of what this example demonstrates. For module examples, explain which types
    work together. For type examples, describe the usage pattern.>

    ```scala mdoc:passthrough
    import docs.SourceFile

    SourceFile.print("<examples-module>/src/main/scala/<package>/<ObjectName>.scala")
    ```

    ([source](https://github.com/zio/<repo-name>/blob/main/<examples-module>/src/main/scala/<package>/<ObjectName>.scala))

    Run with `scala-cli run <ObjectName>.scala` from that folder, or the project's sbt command.
```

`SourceFile.print` options: `lines = Seq((from, to))` (1-indexed ranges), `showLineNumbers = true`,
`showTitle = false`.
