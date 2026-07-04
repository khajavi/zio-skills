import { defineAction } from '@flue/runtime';
import * as v from 'valibot';

const structureSchema = v.object({
  learningObjectives: v.pipe(v.array(v.string()), v.description('3-5 objectives')),
  prerequisites: v.array(v.string()),
  sections: v.array(
    v.object({
      number: v.number(),
      title: v.pipe(v.string(), v.description('Numbered heading, e.g. "1. Creating a Scope"')),
      concept: v.pipe(v.string(), v.description('The single new concept this section teaches')),
      showMoment: v.nullable(
        v.pipe(v.string(), v.description('What output/result to show so the learner can verify')),
      ),
    }),
  ),
  ahaMoment: v.pipe(v.string(), v.description('The one key realization the learner should reach')),
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
    researchAnswers: v.pipe(
      v.string(),
      v.description('The researcher subagent answers to the tutorial research questions'),
    ),
  }),
  output: structureSchema,
  async run({ harness, input, log }) {
    log.info(`Designing tutorial structure for: ${input.topic}`);
    const session = await harness.session();
    const { data } = await session.prompt(
      [
        `Design a learning-oriented tutorial structure for "${input.topic}".`,
        `Follow the tutorial-structure skill's template and section-design rules.`,
        ``,
        `Research answers:`,
        input.researchAnswers,
        ``,
        `Produce 3-6 strictly linear sections, one new concept each, ordered by dependency`,
        `(simplest "hello world" first, then one layer of complexity per section).`,
        `State 3-5 learning objectives, the prerequisites, a show-moment per section,`,
        `and the single aha moment. No branching.`,
      ].join('\n'),
      { result: structureSchema },
    );
    return data;
  },
});
