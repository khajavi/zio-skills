---
name: critique
description: A coordinator-only critique-fix loop for driving an existing documentation page to approval — a fresh critic delegate reports severity-tagged findings, a fresh fixer delegate resolves them, capped at three rounds with HIGH findings iterating longest and MEDIUM getting one chance. Load when reviewing an already-written page against source, siblings, and consistency, not when writing new content.
---

# Documentation Critique Loop

The full procedure is provided verbatim in [`references/review-loop.md`](references/review-loop.md):
role separation (coordinator never edits directly), how to gather critic context from paths rather
than content, the critic's required findings/verdict format, the severity-based iteration rules, and
multi-file handling.

Originally ported from a `docs-critique` plugin skill (since removed from `plugins/documentation` as
unneeded — the pattern here stands on its own and doesn't depend on that file existing), translated
from Claude Code's `Agent(...)` tool calls to Flue's own delegation primitive — a coordinator that
mounts this skill delegates to a critic or fixer with the built-in `task` tool, the same way every
subagent delegation in this project works, rather than a named role under `src/subagents/`.

**Not currently mounted by any flowrite agent.** This is reference material only: the pattern is
documented and ready, but no standalone entry point or `KINDS` row wires it into a run. A future
coordinator that wants a critique-fix loop over an already-written page can mount this skill; nothing
here runs on its own.
