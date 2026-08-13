package tally

/**
 * An append-only count of named events.
 *
 * A `Ledger` never loses a tally: recording the same name twice adds to it rather than replacing it,
 * and merging two ledgers sums every shared name. That is the whole contract — there is deliberately
 * no removal, so a ledger's counts only ever grow.
 *
 * @param counts the accumulated count per event name
 */
final case class Ledger(counts: Map[String, Long]) {

  /** Add `by` to `name`'s tally, starting from zero when the name is new. */
  def record(name: String, by: Long): Ledger =
    Ledger(counts.updated(name, counts.getOrElse(name, 0L) + by))

  /** The tally for `name`, or zero when nothing was ever recorded under it. */
  def tallyOf(name: String): Long =
    counts.getOrElse(name, 0L)

  /** Sum this ledger with `that`, adding the tallies of every name they share. */
  def absorb(that: Ledger): Ledger =
    Ledger(that.counts.foldLeft(counts) { case (acc, (name, count)) =>
      acc.updated(name, acc.getOrElse(name, 0L) + count)
    })
}

object Ledger {

  /** A ledger with nothing recorded yet. */
  val blank: Ledger = Ledger(Map.empty)

  /** A ledger holding a single starting tally. */
  def seeded(name: String, count: Long): Ledger = Ledger(Map(name -> count))
}
