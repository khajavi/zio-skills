lazy val root = (project in file("."))
  .settings(
    name := "optics-examples",
    scalaVersion := "2.13.14",
    libraryDependencies ++= Seq(),
  )
  .dependsOn(ProjectRef(file("../.."), "optics"))
