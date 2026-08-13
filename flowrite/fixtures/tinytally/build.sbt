ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "dev.example"
ThisBuild / version      := "0.1.0"
ThisBuild / semanticdbEnabled := true
ThisBuild / semanticdbVersion := scalafixSemanticdb.revision

lazy val root = (project in file("."))
  .settings(
    name := "tinytally",
    scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked", "-Wunused"),
  )
  .aggregate(examples)

lazy val docs = (project in file("docs"))
  .enablePlugins(MdocPlugin)
  .settings(
    name := "tinytally-docs",
    target := file("target/docs-project"),
    mdocIn := file("docs"),
    mdocOut := file("website/docs"),
    scalaVersion := "2.13.18",
    semanticdbEnabled := false,
    libraryDependencies += "dev.zio" %% "zio-sbt-source" % "0.6.0",
  )
  .dependsOn(root)

lazy val examples = RootProject(file("tinytally-examples"))
