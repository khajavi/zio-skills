import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { researchSchema } from './research-tutorial-topic.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';
import { delegate } from '../shared/delegate.ts';
// Injected into the generic designer's task (skills can't vary per delegated
// task); the SKILL.md points here. Same source-of-truth split as rules.md.
import tutorialStructureDoc from '../skills/tutorial-structure/references/structure.md';

export const structureSchema = v.object({
  learningObjectives: v.pipe(v.array(v.string()), v.description('3-5 objectives')),
  prerequisites: v.array(v.string()),
  sections: v.array(
    v.object({
      number: v.number(),
      title: v.pipe(v.string(), v.description('Numbered heading, e.g. "1. Creating a Scope"')),
      concept: v.pipe(v.string(), v.description('The single new concept this section teaches')),
      verifiableOutput: v.nullable(
        v.pipe(
          v.string(),
          v.description(
            'A verifiable output: a point where printed or observed output lets the learner confirm ' +
              'the code behaved as claimed.',
          ),
        ),
      ),
    }),
  ),
  coreInsight: v.pipe(
    v.string(),
    v.description('The core insight: the single realization the whole tutorial drives the learner toward.'),
  ),
});

/**
 * Turn the researcher's answers into a validated, strictly linear section plan.
 * Reliability-critical: the output shape is enforced so the writer stage always
 * receives a well-formed structure.
 */
export const designTutorialStructure = defineTool({
  name: 'design_tutorial_structure',
  description: 'Turn deep-research answers into a validated, linear tutorial section plan.',
  harness: true,
  input: v.object({
    topic: v.string(),
    researchAnswers: researchSchema,
  }),
  output: structureSchema,
  async run({ harness, data, log }) {
    // Resume support — see research-tutorial-topic.ts.
    if (isPhaseSkipped('design')) {
      log.info('Skipping design (skipPhases)');
      return {
        output: {
          learningObjectives: [],
          prerequisites: [],
          sections: [],
          coreInsight: '(skipped — phase already done)',
        },
      };
    }

    log.info(`Designing tutorial structure for: ${data.topic}`);
    // Delegates to the generic designer subagent (no tools/subagents of its
    // own) rather than letting the work happen in the calling agent's own
    // conversation — that agent's own design_tutorial_structure tool would
    // otherwise be visible to whoever does the designing, letting it call
    // itself and recurse until the delegation depth limit is hit. `delegate`
    // still prompts through the calling agent (harness.prompt), so the lead-in
    // it prepends is what pushes the work out to the narrow role instead.
    const structure = await delegate({
      harness,
      log,
      label: 'designer (tutorial)',
      role: 'designer',
      result: structureSchema,
      prompt:
        [
          `Design a learning-oriented tutorial structure for "${data.topic}".`,
          ``,
          `Follow this tutorial-structure template exactly:`,
          ``,
          tutorialStructureDoc,
          ``,
          `Research answers:`,
          JSON.stringify(data.researchAnswers),
        ].join('\n') + authorHint(),
    });
    return { output: structure };
  },
});
