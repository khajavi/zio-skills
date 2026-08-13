---
name: module-ref-structure
description: The section template and drafting rules for a ZIO module reference — documentation of a cohesive domain model of several related types (e.g. an HTTP model, resource management), flat single-page or hierarchical index+subpages. Load when planning or writing a module reference.
---

# Module Reference Structure

<!-- Nested skill resources ARE readable at runtime: Flue 2.0.3 packages a skill's whole directory and
adds `read_skill_resource` (guide/skills), verified 2026-08-12 with a throwaway probe that read a token
out of a `references/` file. The older comment here claimed the opposite — a beta.9 limitation, since
closed — and told the next maintainer to switch this skill to reading the file. Do not: the content is
injected into the task prompt on purpose. Injecting the whole corpus costs ~9,500 tokens across a
worst-case run, about $0.01, while activating and reading costs three tool round-trips (activate, then
a failed relative-path read, then the briefing path) that each re-send the delegate's accumulated
context. The file stays the single source of truth either way — it is imported, not copied. -->

The module-page template, the flat-vs-hierarchical layouts, and the per-type section shape are
provided verbatim in your task input (single source of truth: `references/structure.md`). Follow it
when planning or writing a module reference.
