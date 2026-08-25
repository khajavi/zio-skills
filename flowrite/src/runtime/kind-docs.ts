import type { DocKind } from './run-context.ts';

// The per-kind reference docs, imported at compile time. Each skill's SKILL.md is a stub pointing at
// the file imported here, so this module is a delivery route and never a second copy.
import dataTypeStructureDoc from '../skills/data-type-ref-structure/references/structure.md';
import moduleStructureDoc from '../skills/module-ref-structure/references/structure.md';
import tutorialStructureDoc from '../skills/tutorial-structure/references/structure.md';
import howToStructureDoc from '../skills/how-to-structure/references/structure.md';
import dataTypeChecklistDoc from '../skills/data-type-ref-checklist/references/checklist.md';
import moduleChecklistDoc from '../skills/module-ref-checklist/references/checklist.md';
import tutorialChecklistDoc from '../skills/tutorial-checklist/references/checklist.md';
import howToChecklistDoc from '../skills/how-to-checklist/references/checklist.md';
import writingStyleRules from '../skills/writing-style/references/rules.md';

/**
 * The reference docs a role needs, keyed by document kind.
 *
 * Imported here rather than by each consumer, so the per-kind mapping lives in one place. Roles
 * read them at their own render, which works because `docKind()` is reachable from a subagent render
 * (see run-context.ts: the module holder exists because "the readers are phase-tool bodies AND subagent
 * renders", and the root render runs "before every phase tool and subagent render … correctly ordered
 * by construction").
 *
 * Why a role render and not `useSkill`: mounting costs the delegate three tool round-trips to
 * activate a skill and read its resource, each re-sending its whole accumulated context. That was
 * measured — mounting `writing-style` on the drafter wasted 2 round-trips in write-data-type-ref-turn20
 * and 5 in write-module-ref-turn5, which is why 600f48a unmounted it. A doc returned as part of the
 * render's instruction string costs nothing extra: it is already in the system prompt the delegate
 * starts from.
 *
 * Why a role render and not the caller's prompt: once the writer delegates with the built-in `task`
 * tool rather than through a phase tool, the only party that could paste a template is the MODEL —
 * and a model asked to reproduce 103 lines of structure.md verbatim paraphrases it.
 */
export const STRUCTURES: Record<DocKind, string> = {
  'data-type': dataTypeStructureDoc,
  module: moduleStructureDoc,
  tutorial: tutorialStructureDoc,
  'how-to': howToStructureDoc,
};

/** Each kind's review checklist. Moved here from review-page.ts, which now imports it. */
export const CHECKLISTS: Record<DocKind, string> = {
  'data-type': dataTypeChecklistDoc,
  module: moduleChecklistDoc,
  tutorial: tutorialChecklistDoc,
  'how-to': howToChecklistDoc,
};

/** The numbered writing-style rules — kind-independent, unlike the two maps above. */
export const STYLE_RULES = writingStyleRules;

/**
 * The template block a role prepends to its instructions.
 *
 * Carries a framing sentence so the delegate is told the template is binding, rather than being handed
 * an unlabelled wall of markdown.
 */
export const structureBlock = (kind: DocKind): string =>
  [`Follow this ${kind} structure template and its drafting rules exactly:`, ``, STRUCTURES[kind]].join('\n');

/** The writing-style block, in the same shape as `structureBlock`. */
export const styleBlock = (): string =>
  [`Writing-style rules — apply every rule to the prose you write:`, ``, STYLE_RULES].join('\n');
