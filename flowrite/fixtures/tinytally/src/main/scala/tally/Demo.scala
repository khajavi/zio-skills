package tally

/**
 * Runnable usage examples for the TinyTally library, demonstrating both core patterns: accumulating
 * event counts with [[Ledger]], and keeping only the recent past with [[Window]].
 *
 * Run with: `sbt "runMain tally.Demo"`
 */
object Demo {

  /** Accumulate three page views and one signup, then read one tally back. */
  def counting(): Long = {
    val ledger = Ledger.blank
      .record("view", 2L)
      .record("signup", 1L)
      .record("view", 1L)

    ledger.tallyOf("view")
  }

  /** Merge two ledgers kept by separate collectors; shared names are summed. */
  def merging(): Ledger = {
    val morning = Ledger.seeded("view", 4L)
    val evening = Ledger.seeded("view", 6L).record("signup", 2L)

    morning.absorb(evening)
  }

  /** Fill a window past its capacity, so the oldest reading is dropped. */
  def recentOnly(): List[String] =
    Window
      .sized(2)
      .admit("a")
      .admit("b")
      .admit("c")
      .readings

  /** Summarize a window's retained readings as counts. */
  def windowCounts(): Map[String, Long] =
    Window.sized(3).admit("hit").admit("miss").admit("hit").tallied.counts

  def main(args: Array[String]): Unit = {
    println(s"view tally: ${counting()}")
    println(s"merged: ${merging().counts}")
    println(s"recent: ${recentOnly()}")
    println(s"window counts: ${windowCounts()}")
  }
}
