---
name: zio-documentation-conventions
description: ZIO-specific documentation conventions and style rules beyond the 25 standard prose rules
---

# ZIO Documentation Conventions

This skill defines ZIO-specific conventions that complement the standard 25 prose style rules. Both documentation writers and validators must follow these conventions to ensure consistency across ZIO documentation.

## Implicit Trace Parameters

**Never include `implicit trace: Trace` in documented method signatures.**

This is a compiler implementation detail managed by ZIO's macros at compile time. It is not part of the public API contract that users need to understand or provide.

### Bad — Violates Convention
```scala
trait Dequeue[+A] {
  def take(implicit trace: Trace): UIO[A]
  def poll(implicit trace: Trace): UIO[Option[A]]
  def shutdown(implicit trace: Trace): UIO[Unit]
}
```

### Good — Correct
```scala
trait Dequeue[+A] {
  def take(): UIO[A]
  def poll(): UIO[Option[A]]
  def shutdown(): UIO[Unit]
}
```

### Why This Matters

- **User Focus**: Developers using these methods don't pass `Trace` explicitly; it's injected automatically by the macro
- **Clarity**: Hiding compiler details keeps method signatures clean, readable, and focused on the actual API
- **API Contract**: Documents only what users actually need to know and do
- **Consistency**: Maintains consistent documentation style across all ZIO libraries
- **Reduces Confusion**: Prevents readers from thinking they need to import or provide `Trace` objects

### Implementation

This convention applies to:
- Method signatures shown in documentation
- Trait/class definitions in reference pages
- Code examples demonstrating ZIO operations
- All ZIO library documentation (zio, zio-http, zio-schema, etc.)

### Detection

Documentation validation will flag violations with a message like:
```
[ZIO Convention] Method signature includes implicit trace: Trace
Bad:  def take(implicit trace: Trace): UIO[A]
Good: def take(): UIO[A]
```

---

## Future Conventions

Additional ZIO-specific conventions will be added here as they're established. This is the central reference for all ZIO documentation rules beyond the standard 25 prose rules.
