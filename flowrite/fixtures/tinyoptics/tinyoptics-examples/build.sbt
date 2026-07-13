lazy val root = (project in file("."))
  .aggregate(optics)

lazy val optics = RootProject(file("optics"))
