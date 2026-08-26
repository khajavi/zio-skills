---
name: enrich-section
description: Expand a thin documentation section — one with a signature and a toy example but no motivation — into one that explains why a reader would choose this API, using the five-part expansion pattern (opening sentence, motivation, contrast, signature, realistic example). Load when a section exists but reads as reference-only, not when it is entirely absent.
---

# Enrich a Documentation Section

The five-part expansion pattern is provided verbatim in the enrich-section agent's instructions
(single source of truth: [`references/pattern.md`](references/pattern.md)). It carries the shape each
part takes, the contrast-table format, the realistic-example checklist, and the common mistakes that
turn an enrichment into bloat instead of improvement.

Nothing mounts this skill today: `src/enrich-section.ts` imports the reference directly, because a
single-purpose agent needs the pattern on turn 1 of every run and progressive disclosure would only
add a turn and a way to skip it. The directory is a skill so that a consumer which needs it
*sometimes* — the drafter, checking a section it just wrote is not itself thin — can mount it without
moving content.
