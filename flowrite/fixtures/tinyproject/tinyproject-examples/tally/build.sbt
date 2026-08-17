lazy val root = (project in file("."))
  .settings(
    name := "tally-examples",
    scalaVersion := "2.13.14",
    libraryDependencies ++= Seq(),
  )
  .dependsOn(ProjectRef(file("../.."), "tally"))
