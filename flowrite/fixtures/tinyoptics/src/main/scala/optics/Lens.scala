package optics

/**
 * A `Lens` focuses on one part `A` that is *always present* inside a larger
 * product `S` — typically a field of a case class. It can read that part
 * (`get`) and produce an updated copy of the whole with a new part (`set`).
 *
 * Lens laws (get-set, set-get, set-set) make updates predictable:
 *   - `set(get(s))(s) == s`
 *   - `get(set(a)(s)) == a`
 *   - `set(a2)(set(a1)(s)) == set(a2)(s)`
 *
 * Because `set` returns a new `S`, lenses give immutable, deeply-nested updates
 * without hand-written `copy` chains:
 *
 * {{{
 * final case class Address(city: String)
 * final case class Person(name: String, address: Address)
 * val address = Lens[Person, Address](_.address, a => p => p.copy(address = a))
 * val city    = Lens[Address, String](_.city, c => a => a.copy(city = c))
 * val personCity = address.andThen(city)
 * personCity.set("Berlin")(Person("Ana", Address("Rome")))
 * }}}
 *
 * @param get extract the focused part from the whole
 * @param set produce an updated whole given a new part
 */
final case class Lens[S, A](get: S => A, set: A => S => S) {

  /** Update the focus by applying `f` to the current value. */
  def modify(f: A => A): S => S = s => set(f(get(s)))(s)

  /** Compose with a deeper `Lens`; both foci are always present. */
  def andThen[B](that: Lens[A, B]): Lens[S, B] =
    Lens(
      s => that.get(get(s)),
      b => s => set(that.set(b)(get(s)))(s),
    )

  /**
   * Compose with an [[Optional]] (or a [[Prism]] via [[Prism.asOptional]]).
   * The deeper focus may be absent, so the result is an `Optional`.
   */
  def andThen[B](that: Optional[A, B]): Optional[S, B] =
    Optional(
      s => that.getOption(get(s)),
      b => s => set(that.set(b)(get(s)))(s),
    )

  /** Compose with a [[Prism]], yielding an [[Optional]]. */
  def andThen[B](that: Prism[A, B]): Optional[S, B] =
    andThen(that.asOptional)

  /** Widen this `Lens` to an [[Optional]] whose focus is always present. */
  def asOptional: Optional[S, A] =
    Optional(s => Some(get(s)), set)
}
