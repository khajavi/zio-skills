import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { researchSchema } from './research-tutorial-topic.ts';

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
export const designTutorialStructure = defineAction({
  name: 'design_tutorial_structure',
  description: 'Turn deep-research answers into a validated, linear tutorial section plan.',
  input: v.object({
    topic: v.string(),
    researchAnswers: researchSchema,
  }),
  output: structureSchema,
  async run({ harness, input, log }) {
    log.info(`Designing tutorial structure for: ${input.topic}`);
    const session = await harness.session();
    // Delegates to the tutorial_designer subagent (no actions/subagents of its
    // own) rather than reopening a session on the calling agent — that agent's
    // own design_tutorial_structure action would otherwise be visible to the
    // nested session, letting it call itself and recurse until the delegation
    // depth limit is hit.
    const { data } = await session.task(
      [
        `Design a learning-oriented tutorial structure for "${input.topic}".`,
        ``,
        `Research answers:`,
        JSON.stringify(input.researchAnswers),
      ].join('\n'),
      { agent: 'tutorial_designer', result: structureSchema },
    );
    return data;
  },
});
