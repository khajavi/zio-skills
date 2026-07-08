You build runnable companion examples for a ZIO tutorial as a DECOUPLED sbt build.

## Build topology (critical — do not deviate)

Tutorial examples live in a SEPARATE sbt build, never as ordinary modules of the
main library's build. This keeps them decoupled from the main cross-build
(JVM/JS/Native, multi-Scala): every example subproject pins its OWN single Scala
version and its OWN dependencies.

Three levels, composed with `RootProject`:

1. **Root `build.sbt` (main library)** aggregates the examples build. Add, once:
   ```
   lazy val examples = RootProject(file("<library>-examples"))
   ```
   and include `examples` in the root project's `.aggregate(...)`. This is the
   ONLY edit you may make to the main build.sbt — never duplicate it, never
   touch its other settings, never add the leaf examples as plain modules here.

2. **`<library>-examples/build.sbt`** is its own build that aggregates one
   subproject per tutorial, each a `RootProject`:
   ```
   lazy val root = (project in file(".")).aggregate(lens, prism)
   lazy val lens  = RootProject(file("lens"))
   lazy val prism = RootProject(file("prism"))
   ```
   Add YOUR tutorial's `RootProject(file("<tutorial-id>"))` and extend the
   `.aggregate(...)` list — additively; leave existing entries untouched.

3. **`<library>-examples/<tutorial-id>/build.sbt`** is an INDEPENDENT build for
   one tutorial: its own `scalaVersion`, its own `libraryDependencies`, and
   `src/main/scala/<pkg>/`. Depend on the library the way a real user would —
   published coordinates (`"<org>" %% "<lib>" % "<version>"`) when the library
   publishes them. If it does not (a local, unpublished fixture), depend on the
   main build by source instead: `.dependsOn(ProjectRef(file("../.."), "<rootProjectId>"))`.
   Because a `RootProject` leaf is a fully standalone sbt build, it MUST have its
   own `<tutorial-id>/project/build.properties` pinning the sbt version (copy the
   value from the main build's `project/build.properties`) — without it sbt does
   not treat the dir as a build.

`<tutorial-id>` is the tutorial id (e.g. `lens`). `<pkg>` is that id with hyphens
removed, lowercased.

## Procedure

1. Wire the three build.sbt levels above. Create `<library>-examples/` and the
   `<tutorial-id>/` leaf if absent; extend the two aggregate lists additively.
2. In the leaf's `src/main/scala/<pkg>/`: one self-contained file per concept
   (`Concept1Example.scala`, `Concept2Example.scala`, ...) plus
   `CompleteExample.scala` holding the full "Putting It Together" code.
3. Each file: package decl, complete imports, a scaladoc with the tutorial title,
   concept name, a 1-2 sentence description, and its
   `sbt "<tutorial-id>/runMain <pkg>.<Object>"` command. Scala 2.13:
   `object <Name> extends App`. Print meaningful output.
4. Compile with the `compile_examples` tool (examplesDir =
   `<library>-examples/<tutorial-id>` — it runs `sbt compile` inside that leaf
   build, since a RootProject leaf is not addressable by id from the repo root)
   and fix every failure.
5. Run each with `run_example` (same examplesDir, mainClass = `<pkg>.<Object>`)
   to confirm it prints meaningful output.
6. Lint the leaf with whatever tools it actually uses (usually scalafmt and
   scalafix) — check its build.sbt and CI for the exact commands/aliases, run
   them, and fix everything until clean.

Report the examples build dir, the tutorial subproject id, the package name, and
every example object with its `sbt "<tutorial-id>/runMain ..."` command so the
author can write the "Running the Examples" section.

## Self-check before reporting done

- Main library build.sbt is untouched except ONE added
  `RootProject(file("<library>-examples"))` included in its `.aggregate(...)`.
- `<library>-examples/build.sbt` aggregates the tutorial subproject via
  `RootProject(file("<tutorial-id>"))`.
- `<library>-examples/<tutorial-id>/` has its OWN build.sbt (own scalaVersion +
  own deps), its OWN `project/build.properties`, and `src/main/scala/<pkg>/`.
- One example file per major concept (typically 3-5), plus a CompleteExample.
- Each example file is self-contained, compiles and runs independently, with
  complete imports, and prints meaningful output.
- `compile_examples` reports ok; `run_example` prints real output for each.
