import { defineSubagent, useSkill } from '@flue/runtime';
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import asciiDiagram from '../skills/ascii-diagram/SKILL.md';
import markdownTable from '../skills/markdown-table/SKILL.md';
import { TIERS } from '../runtime/models.ts';
import { docKind } from '../runtime/run-context.ts';
import { structureBlock, styleBlock } from '../runtime/kind-docs.ts';
import instructions from './drafter.md';

/**
 * Generic documentation-prose writer, shared across document kinds. Declares no
 * tools or delegates of its own, so it cannot re-enter the pipeline that called it.
 *
 * The kind's section template and the writing-style rules are read HERE, at this render, rather than
 * pasted into every delegation prompt by the calling phase tool. `docKind()` is reachable from a
 * subagent render — run-context.ts's module holder exists for exactly that, and a role renders at
 * delegation time, after the root render published the kind. So the render can select the right
 * template itself, and the caller no longer has to.
 *
 * That matters because the caller is becoming the model. Once the writer delegates with the built-in
 * `task` tool instead of through a phase tool, only the model could paste a template into the prompt —
 * and a model asked to reproduce 103 lines of structure.md verbatim paraphrases it.
 *
 * `mdoc-conventions` is still MOUNTED rather than returned, because its content lives in its
 * `SKILL.md` with no `references/` file behind it — the mount is its only delivery path. `ascii-diagram`
 * and `markdown-table` are mounted for the same reason, and stay mounts rather than joining the returned
 * blocks: only some pages contain a diagram or a table, so their bodies should load on the model's
 * decision rather than ride every drafting delegation.
 *
 * `writing-style` must stay unmounted here. Its `SKILL.md` is a pointer saying "the complete numbered
 * rule list is provided verbatim in your task input", so mounting it costs an activation round-trip to
 * be told the rules are in the prompt already being read — measured at 2 round-trips in
 * write-data-type-ref-turn20 and 5 in write-module-ref-turn5, each re-sending this delegate's whole
 * accumulated context. `styleBlock()` below is that delivery, so a mount would only re-add the waste.
 *
 * The root agent keeps its own `writing-style` mount (docs-author-base.ts): nothing delivers the rules
 * there, so for the root the mount is the only access, and it does activate it.
 */
export function Drafter() {
  useSkill(mdocConventions);
  useSkill(asciiDiagram);
  useSkill(markdownTable);
  const kind = docKind();
  return [instructions, ``, structureBlock(kind), ``, styleBlock()].join('\n');
}

export const drafter = defineSubagent({
  name: 'drafter',
  ...TIERS.writer,
  description:
    'Writes a complete ZIO documentation page as Docusaurus markdown from a given plan and research findings.',
  agent: Drafter,
});
