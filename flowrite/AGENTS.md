# flowrite — Agent & Workflow Conventions

## Keep `plugins/documentation` in sync with flowrite

flowrite is the source of truth for the Claude Code marketplace's `documentation` plugin
(`plugins/documentation/`). Whenever you change any of:

- `src/skills/*/SKILL.md` (and their `references/*.md`)
- `src/instructions/*.md` (the standalone-agent workflows)
- `src/subagents/*.md` and its paired `.ts` wrapper (instructions, `model`/`thinkingLevel` tier,
  `useSkill` mounts)
- `scripts/generate-plugin-skill.mjs` itself

... `plugins/documentation` may now be stale. Do not let a plugin skill or agent silently drift from
its flowrite source — that already happened once this project's history (`docs-backfill-metadata`
briefly forked into a differently-named, un-cross-referenced copy) and cost a dedicated cleanup pass.

### The workflow

1. Run `node scripts/generate-plugin-skill.mjs` from `flowrite/` (or let it run automatically — see
   `.git-hooks/post-commit`, which regenerates `flowrite/dist/plugin-export/` on any commit touching
   the paths above, but never touches the live plugin itself).
2. Diff the output against the live plugin:
   ```bash
   diff -rq flowrite/dist/plugin-export/ ../plugins/documentation/skills/
   diff -rq flowrite/dist/plugin-export/agents/ ../plugins/documentation/agents/
   ```
3. **For anything with a `MANIFEST`/`AGENT_MANIFEST` entry, flowrite has already won — promote the
   generator's output, don't re-litigate it.** The migration that required a side-by-side editorial
   read of every skill (comparing flowrite's version against a pre-existing, independently-evolved
   plugin skill to decide which was actually better) is done; that discipline caught real bugs at the
   time (`docs-organize-types`' broken categorization, an `sbt docs/mdoc --watch` hang, and others) but
   it was a one-time migration task, not a standing posture. Going forward, treat the diff as a
   mechanical check, not an editorial one: does every substitution still fire (a throw from
   `applySubstitutions()` means the source drifted and the substitution needs updating, not that
   flowrite's new content is wrong), does the output look structurally sane, and — the one case that
   still needs a human decision — does a *new* flowrite skill or subagent need a *new* manifest entry
   (the generator only emits what's already listed; it won't notice a new source file on its own).
   Three plugin skills are the standing exception, not because their flowrite counterpart might be
   wrong, but because there is no flowrite counterpart to promote from at all:
   - `docs-organize-types` vs. flowrite's `organize-reference-docs` (→ `docs-organize-reference-docs`)
     — differently scoped tools that coexist on purpose, not a fork to reconcile.
   - `docs-examples` vs. `docs-companion-examples`/`docs-examples-builder` — a mechanical procedure
     skill vs. a delegation wrapper around the matching flowrite subagent; both stay.
   - `docs-research`/`docs-integrate` — pre-existing plugin skills with **no** flowrite skill or
     subagent-name match at all (`researcher`/`docs_integrator` are subagents, not skills). They are
     out of scope for mechanical generation entirely; don't merge or delete them on the assumption
     they're a stale fork of something in flowrite.
4. **Naming convention.** A flowrite skill named `X` maps to plugin skill `docs-X` under
   `plugins/documentation/skills/`. A flowrite subagent named `X` maps to plugin agent `docs-X` (or its
   already-`docs-`-prefixed name, e.g. `docs-integrator`) under `plugins/documentation/agents/`. If you
   add a new flowrite skill or subagent and its plugin counterpart doesn't exist yet, that's a real gap
   — add it, following this convention, rather than leaving the marketplace behind.
5. **Flue-specific content never copies verbatim.** A source file mentioning `.flowrite/`, `useSkill`,
   `useTool`, `task()`, a Flue tool name (`write`/`read` should read `Write`/`Read`, Claude Code's real
   tool names), or a Flue structured-output primitive (a `finish` call) needs a `substitutions` entry
   in `MANIFEST`/`AGENT_MANIFEST` translating it — never a blind copy. `applySubstitutions()` throws if
   a substitution's target text no longer matches, by design: a stale substitution fails loudly at
   generation time rather than silently emitting content that still leaks Flue internals.
6. A subagent whose `.ts` wrapper composes per-invocation content at render time (`drafter.ts` and
   `designer.ts` both do `structureBlock(docKind())`) has no static-file equivalent in Claude Code —
   document that gap in the `AGENT_MANIFEST` comment (see the existing note) rather than trying to fake
   it; the calling skill supplies that material in its `Task()` prompt instead.
