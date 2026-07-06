ThisBuild / scalaVersion := "2.13.14"
ThisBuild / organization := "dev.example"
ThisBuild / version      := "0.1.0"

lazy val root = (project in file("."))
  .settings(
    name := "tinyoptics",
    scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked"),
  )

lazy val docs = (project in file("mdocs"))
  .enablePlugins(MdocPlugin)
  .settings(
    name := "tinyoptics-docs",
    mdocIn := file("mdocs"),
    mdocOut := file("docs"),
  )
  .dependsOn(root)
