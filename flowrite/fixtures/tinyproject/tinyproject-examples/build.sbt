lazy val root = (project in file("."))
  .aggregate(optics, tally)

lazy val optics = RootProject(file("optics"))

lazy val tally = RootProject(file("tally"))
