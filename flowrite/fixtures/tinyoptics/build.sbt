ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "dev.example"
ThisBuild / version      := "0.1.0"
ThisBuild / semanticdbEnabled := true
ThisBuild / semanticdbVersion := scalafixSemanticdb.revision

lazy val root = (project in file("."))
  .settings(
    name := "tinyoptics",
    scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked", "-Wunused"),
  )
  .aggregate(examples)

lazy val docs = (project in file("docs"))
  .enablePlugins(MdocPlugin)
  .settings(
    name := "tinyoptics-docs",
    target := file("target/docs-project"),
    mdocIn := file("docs"),
    mdocOut := file("website/docs"),
    // Provides the `mdoc:embed:<path>[:show-line-numbers]` StringModifier used
    // to embed companion example sources into tutorial pages. 0.6.0 requires a
    // scala-library newer than the root's 2.13.14, so the docs project runs on
    // a newer compiler (binary compatible with the 2.13 root).
    scalaVersion := "2.13.18",
    // Docs are never scalafixed; skip semanticdb so the newer compiler needs no
    // matching semanticdb-scalac artifact.
    semanticdbEnabled := false,
    libraryDependencies += "dev.zio" %% "zio-sbt-source" % "0.6.0",
  )
  .dependsOn(root)

lazy val examples = RootProject(file("tinyoptics-examples"))
