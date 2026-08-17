package tally

/**
 * The most recent `capacity` readings, oldest dropped first.
 *
 * A `Window` is bounded: pushing past its capacity discards the oldest reading rather than growing.
 * It pairs with [[Ledger]] — a ledger accumulates forever, a window remembers only the recent past —
 * and `tallied` is the bridge between them.
 *
 * @param capacity how many readings to keep; readings past this are dropped oldest-first
 * @param readings the retained readings, oldest first
 */
final case class Window(capacity: Int, readings: List[String]) {

  /** Add `reading` as the newest, dropping the oldest if that would exceed `capacity`. */
  def admit(reading: String): Window =
    Window(capacity, (readings :+ reading).takeRight(capacity))

  /** True when the window holds exactly `capacity` readings, so the next admit drops one. */
  def saturated: Boolean =
    readings.sizeIs == capacity

  /** Count the retained readings by value, as a [[Ledger]]. */
  def tallied: Ledger =
    readings.foldLeft(Ledger.blank)((ledger, reading) => ledger.record(reading, 1L))
}

object Window {

  /** An empty window that will retain at most `capacity` readings. */
  def sized(capacity: Int): Window = Window(capacity, Nil)
}
