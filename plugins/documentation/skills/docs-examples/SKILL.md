---
name: docs-examples
description: Shared procedure for creating and documenting companion examples. Covers directory structure, file templates, example creation, compilation, linting, and embedding with SourceFile. Used by docs-data-type-ref, docs-module-ref, docs-how-to-guide, and docs-tutorial.
allowed-tools: Read, Glob, Grep, Bash(sbt:*), Bash(scalafmt), Bash(git)
---

## Setup Example Sub-module

**Never invent example code.** Every line in an example file traces back to a code block already in
the documentation page being written — package declaration, imports, a runnable wrapper, and `println`
calls for output the page renders are the only things you may add beyond what the page's blocks
already contain. If the page doesn't show it, the example doesn't invent it.

### Preferred: a decoupled examples build, one per documented page

Adding each page's examples as a plain `RootProject` straight into the root build (below) works for a
single one-off example module, but it doesn't scale: every later page's examples become another
permanent entry in the ROOT build.sbt, forever, and each one can pin its own Scala version only by
becoming its own top-level aggregate — which is what makes it pile up. Prefer nesting instead, so the
root build gains exactly ONE addition, ever, no matter how many pages get examples later:

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
```

```scala
// <library>-examples/build.sbt — grows by one line per new page, additively
lazy val root = (project in file(".")).aggregate(webauthn, lens)
lazy val webauthn = RootProject(file("webauthn"))
lazy val lens      = RootProject(file("lens"))
```

Each leaf (`<library>-examples/<page-id>/`) is a fully independent sbt build — its own `build.sbt`
(own `scalaVersion`, own `libraryDependencies`, depending on the library the way a real user would:
published coordinates when the library publishes them, or `.dependsOn(ProjectRef(file("../.."),
"<rootProjectId>"))` by source for an unpublished fixture) and its own
`project/build.properties` pinning the sbt version (copy the value from the main build's), since a
`RootProject` leaf with no `build.properties` isn't recognized as a build at all. This is why the
approach is decoupled: every page's examples pin their own Scala version and dependencies, isolated
from the main library's cross-build (JVM/JS/Native, multiple Scala versions) and from each other.

### Simpler alternative: a single flat sub-module

For a genuinely one-off example set with no expectation of more pages gaining examples later, adding
it straight into the root build is fine:

```scala
lazy val `zio-http-example-webauthn` =
  RootProject(file("zio-http-example-webauthn"))

lazy val root = (project in file("."))
  .aggregate(
    // other sub-modules
    `zio-http-example-webauthn`
  )
```

Inside the example project directory, create a standard Scala project structure, including a `build.sbt` with necessary dependencies.


## Creating Example Files

### Step 1: Directory and Package Structure

Create a package directory matching the following pattern:

```
<examples-module>/src/main/scala/<packagename>/
```

Where `<examples-module>` is one of:
- `<module>-examples` (for module references, e.g., `http-model-examples`)
- `<library-name>-examples` (for guides and tutorials, or integration examples spanning multiple modules)

**Name conversion rule**: Drop hyphens. e.g.:
- `query-dsl-sql` → `querydsl` (lowercase, hyphens removed)
- `http-model` → `httpmodel`
- `scope-resource-management` → `scoperesourcemanagement`

### Step 2: Example File Structure

Create **one Scala file per major step/concept/use case**, plus a final file for the complete example. Each file should be a standalone runnable program, either an `object` extending `App` or a Scala 3 `@main def` function.

**Naming convention depends on document type:**

| Document Type | File Naming |
|---------------|------------|
| How-to guides | `Step1BasicExample.scala`, `Step2AdvancedExample.scala`, ..., `CompleteExample.scala` |
| Tutorials | `Concept1Example.scala`, `Concept2Example.scala`, ..., `CompleteExample.scala` |
| Data type refs | `BasicUsage.scala`, `AdvancedPatterns.scala`, `CompleteExample.scala` (or descriptive names like `CompleteHttpRequest.scala`) |
| Module refs | `MultiTypeComposition.scala`, `CommonPattern1.scala`, ..., `CompleteExample.scala` (titles emphasizing multi-type usage) |

Create 3-5 files total (feel free to write more examples if number of concepts warrants it).

### Step 3: Example File Template

Each example file follows this pattern:

For Scala 3:

```scala
package <packagename>

import <requiredImports>

/**
 * <Documentation Title> — Step/Concept/Pattern: <Title>
 *
 * <1-2 sentence description of what this example demonstrates.>
 *
 * Run with: sbt "<examples-module>/runMain <packagename>.<FunctionName>"
 */
@main def <FunctionName>(): Unit = {
   // Example code
}
```

For Scala 2.13:

```scala
package <packagename>

import <requiredImports>

/**
 * <Documentation Title> — Step/Concept/Pattern: <Title>
 *
 * <1-2 sentence description of what this example demonstrates.>
 *
 * Run with: sbt "<examples-module>/runMain <packagename>.<ObjectName>"
 */
object <ObjectName> extends App {
   // Example code
}
```

### Step 4: The Complete Example

The final example file (`CompleteExample.scala` or descriptively-named equivalent like `CompleteHttpRequest.scala`) must contain the **entire "Putting It Together" or most complex code block** from the document, wrapped in a runnable program (either a Scala 3 `@main def` function or a Scala 2.13 `object` extending `App`). This is the most important example file.

### Step 5: Verify Examples Compile

After creating all example files, verify they compile:

```bash
sbt "<examples-module>/compile"
```

Fix any compilation failures before proceeding. The examples must compile successfully.

### Step 6: Lint Check (Mandatory Before Integration)

After all examples compile, stage them in git, then run Scalafmt:

```bash
git add <examples-module>/src/main/scala/**/*.scala
sbt fmtChanged
```

If any files were reformatted, commit them immediately:

```bash
git add -A
git commit -m "docs(<doc-id>): apply scalafmt to examples"
```

Verify the CI lint gate locally:

```bash
sbt check
```

**Success criterion**: Zero formatting violations reported.

---

### Step 7: Documenting Examples

#### When Examples Use SourceFile Embedding

There are two ways to pull a companion file's source into a page, and they are not interchangeable —
use whichever this project already has wired up, and check before introducing the other:

- **`SourceFile.print` inside `mdoc:passthrough`** (below) — a project-local helper. Use this when the
  project's docs subproject already defines `docs.SourceFile`, which is the common case for an
  established ZIO docs site.
- **`mdoc:embed:<path>`** (see `docs-mdoc-conventions`) — a built-in mdoc modifier requiring the docs
  subproject to depend on `"dev.zio" %% "zio-sbt-source"`. Prefer this for a project that has neither
  convention yet — it needs no custom Scala utility to maintain.

Either way, the embedded file must exist on disk **before** mdoc runs — both mechanisms fail outright
if the path they name is absent. Commission every example file (this whole skill) before running the
page's own mdoc verification pass, never after.

For data type references and module references where examples need detailed documentation:

Place the "Running the Examples" section at the end of the documentation, after all type/module documentation. Use this template:

```
    ## Running the Examples
    
    All code from this guide is available as runnable examples in the `<examples-module>` module.
    
    **1. Clone the repository and navigate to the project:**
    
    ```bash
    git clone https://github.com/zio/<repo-name>.git
    cd <repo-name>
    ```
    
    **2. Run individual examples with sbt:**
    
    ### <Example Title>
    
    <Short description of what this App demonstrates and the use case it covers. For module examples, explain which types work together. For type examples, describe the usage pattern.>
    
    ```scala mdoc:passthrough
    import docs.SourceFile
    
    SourceFile.print("<examples-module>/src/main/scala/<package>/<ObjectName>.scala")
    ```
    
    ([source](https://github.com/zio/<repo-name>/blob/main/<examples-module>/src/main/scala/<package>/<ObjectName>.scala))
    
    ```bash
    sbt "<examples-module>/runMain <package>.<ObjectName>"
    ```
    
    ### <Next Example Title>
    
    <Short description highlighting key patterns or type composition.>
    
    ```scala mdoc:passthrough
    import docs.SourceFile
    
    SourceFile.print("<examples-module>/src/main/scala/<package>/<ObjectName2>.scala")
    ```
    
    ([source](https://github.com/zio/<repo-name>/blob/main/<examples-module>/src/main/scala/<package>/<ObjectName2>.scala))
    
    ```bash
    sbt "<examples-module>/runMain <package>.<ObjectName2>"
    ```
```

**Optional parameters:**
- `lines = Seq((from, to))` — include only specific line ranges (1-indexed)
- `showLineNumbers = true` — render with line numbers
- `showTitle = false` — suppress the file path title

#### When Examples Use Basic Shell Commands

For how-to guides and tutorials where examples are listed simply:

```markdown
    ## Running the Examples
    
    All code from this guide/tutorial is available as runnable examples in the `<examples-module>` module.
    
    **1. Clone the repository and navigate to the project:**
    
    ```bash
    git clone https://github.com/zio/<repo-name>.git
    cd <repo-name>
    ```
    
    **2. Run individual examples with sbt:**
    
    ```bash
    # Step/Concept 1: <brief description>
    sbt "<examples-module>/runMain <packagename>.<Step1ObjectName>"
    
    # Step/Concept 2: <brief description>
    sbt "<examples-module>/runMain <packagename>.<Step2ObjectName>"
    
    # ...additional steps/concepts...
    
    # Complete example
    sbt "<examples-module>/runMain <packagename>.<CompleteObjectName>"
    ```
    
    **3. Or compile all examples at once:**
    
    ```bash
    sbt "<examples-module>/compile"
    ```
```

    
- List **every `App` object** in the examples module, one entry per object
- For each entry: use a `###` heading (simple, concise title), followed by a short descriptive paragraph
- The paragraph explains what the example demonstrates and the use case/pattern it covers
- For modules: emphasize which types compose in each example
- Embed full source with `SourceFile.print` (keeps docs and examples in sync automatically)
- Include source link and run command
- Keep the two numbered steps (clone, run individually) in that order
