package optics

/**
 * An `Optional` focuses on a part `A` that *may be absent* inside `S`, yet can be replaced when present. It is the meet
 * of [[Lens]] (which can always `set`) and [[Prism]] (whose focus may not match): it has `getOption` like a prism and
 * `set` like a lens.
 *
 * `Optional` is what you get when you compose a lens with a prism — for example, "the radius of the shape stored in a
 * person's favourite field", where the field is always present but the shape might not be a circle:
 *
 * {{{
 * val favouriteShape: Lens[Person, Shape] = ...
 * val circle: Prism[Shape, Double]        = ...
 * val favouriteRadius: Optional[Person, Double] = favouriteShape.andThen(circle)
 * favouriteRadius.modify(_ * 2)(person)
 * }}}
 *
 * `set` is a no-op when the focus is absent, mirroring [[Prism.asOptional]].
 *
 * @param getOption
 *   try to extract the focus from the whole
 * @param set
 *   replace the focus, returning the whole unchanged if absent
 */
final case class Optional[S, A](getOption: S => Option[A], set: A => S => S) {

  /** Update the focus if present; otherwise return `s` unchanged. */
  def modify(f: A => A): S => S = s => getOption(s).fold(s)(a => set(f(a))(s))

  /** Like [[modify]] but reports whether the update applied. */
  def modifyOption(f: A => A): S => Option[S] = s => getOption(s).map(a => set(f(a))(s))

  /** Compose with a deeper `Optional`; either focus may be absent. */
  def andThen[B](that: Optional[A, B]): Optional[S, B] = Optional(
    s => getOption(s).flatMap(that.getOption),
    b => s => getOption(s).fold(s)(a => set(that.set(b)(a))(s))
  )
}
