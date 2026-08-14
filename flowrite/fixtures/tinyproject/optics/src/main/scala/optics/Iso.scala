package optics

/**
 * An `Iso` (isomorphism) is a lossless, reversible conversion between two types `S` and `A`. It witnesses that `S` and
 * `A` carry exactly the same information, just in different shapes — every `S` maps to an `A` and back with no loss.
 *
 * A lawful `Iso` satisfies `from(to(s)) == s` and `to(from(a)) == a`.
 *
 * A common use is wrapping and unwrapping a single-field case class:
 *
 * {{{
 * final case class Meters(value: Double)
 * val metersIso: Iso[Meters, Double] = Iso(_.value, Meters(_))
 * metersIso.to(Meters(3.0))   // 3.0
 * metersIso.from(3.0)         // Meters(3.0)
 * }}}
 *
 * @param to
 *   convert an `S` into its equivalent `A`
 * @param from
 *   rebuild the `S` from an `A`
 */
final case class Iso[S, A](to: S => A, from: A => S) {

  /** Flip the direction: an `Iso[A, S]` that swaps `to` and `from`. */
  def reverse: Iso[A, S] = Iso(from, to)

  /** Transform the focused `A` and rebuild the `S`. */
  def modify(f: A => A): S => S = s => from(f(to(s)))

  /** Compose with another `Iso` to look one level deeper. */
  def andThen[B](that: Iso[A, B]): Iso[S, B] = Iso(s => that.to(to(s)), b => from(that.from(b)))

  /** View this `Iso` as a `Lens`; `set` simply replaces the focus. */
  def asLens: Lens[S, A] = Lens(to, a => _ => from(a))
}
