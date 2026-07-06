ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "dev.example"
ThisBuild / version      := "0.1.0"

lazy val root = (project in file("."))
  .settings(
    name := "tinyoptics",
    scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked"),
  )

lazy val docs = (project in file("docs"))
  .enablePlugins(MdocPlugin)
  .settings(
    name := "tinyoptics-docs",
    target := file("target/docs-project"),
    mdocIn := file("docs"),
    mdocOut := file("website/docs"),
  )
  .dependsOn(root)
