lazy val root = (project in file("."))
  .aggregate(tally)

lazy val tally = RootProject(file("tally"))
