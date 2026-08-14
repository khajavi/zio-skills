ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "dev.example"
ThisBuild / version      := "0.1.0"
ThisBuild / semanticdbEnabled := true
ThisBuild / semanticdbVersion := scalafixSemanticdb.revision

lazy val commonSettings = Seq(
  scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked", "-Wunused"),
)

lazy val root = (project in file("."))
  .settings(name := "tinyproject")
  .aggregate(optics, tally, examples)

lazy val optics = (project in file("optics"))
  .settings(commonSettings, name := "tinyproject-optics")

lazy val tally = (project in file("tally"))
  .settings(commonSettings, name := "tinyproject-tally")

// One docs project for BOTH modules, so a page about one module can import the other and mdoc
// compiles it. A docs project per module would put each module on its own classpath and make a
// cross-module example impossible to compile — the thing this fixture exists to exercise.
lazy val docs = (project in file("docs"))
  .enablePlugins(MdocPlugin)
  .settings(
    name := "tinyproject-docs",
    target := file("target/docs-project"),
    mdocIn := file("docs"),
    mdocOut := file("website/docs"),
    // A real ZIO docs project defines this, so `@VERSION@` in an Installation block resolves. Without
    // it mdoc fails with "key not found: VERSION" and the fix looks like editing the page.
    mdocVariables := Map("VERSION" -> version.value),
    scalaVersion := "2.13.18",
    semanticdbEnabled := false,
    libraryDependencies += "dev.zio" %% "zio-sbt-source" % "0.6.0",
  )
  .dependsOn(optics, tally)

lazy val examples = RootProject(file("tinyproject-examples"))
