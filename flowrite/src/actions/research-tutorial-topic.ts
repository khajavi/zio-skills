import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { readResearchCache, writeResearchCache } from '../shared/research-cache.ts';

export const researchSchema = v.object({
  concept: v.pipe(v.string(), v.description('The ONE concept this tutorial should teach')),
  prerequisites: v.array(v.string()),
  postTutorialAbilities: v.pipe(
    v.array(v.string()),
    v.description('What the learner can do after this tutorial'),
  ),
  coreTypes: v.array(
    v.object({
      name: v.string(),
      role: v.pipe(v.string(), v.description('One sentence: what this type does and why it matters here')),
    }),
  ),
  compositionOrder: v.pipe(
    v.string(),
    v.description('The dependency/composition order concepts should be introduced in'),
  ),
  factoryMethods: v.pipe(
    v.array(v.string()),
    v.description('The factory methods/constructors the learner will actually use'),
  ),
  helloWorld: v.pipe(v.string(), v.description('The simplest possible starting example')),
  complexityLayers: v.pipe(
    v.array(v.string()),
    v.description('Incremental layers of complexity after the hello-world example'),
  ),
  showMoments: v.pipe(
    v.array(v.string()),
    v.description('Points where printed/observed output verifies behavior'),
  ),
  ahaMoment: v.pipe(v.string(), v.description('The one realization the tutorial should drive toward')),
  imports: v.array(v.string()),
  sbtDependency: v.string(),
  scalaVersionNotes: v.nullable(
    v.pipe(v.string(), v.description('Any Scala 2 vs 3 differences, or null if none')),
  ),
  groundingDetail: v.pipe(
    v.string(),
    v.description(
      'Verbatim supporting detail — real code snippets, exact method signatures, scaladoc excerpts, ' +
        'from source/tests/examples/GitHub history. The drafter grounds every fact in this; never let ' +
        'general knowledge substitute for what is stated here.',
    ),
  ),
});

/**
 * Research a ZIO topic's source, tests, examples, and GitHub history and return
 * structured findings for the design/write stages.
 * Reliability-critical: enforces the same well-formed-output guarantee as
 * design_tutorial_structure and review_against_checklist.
 */
export const researchTutorialTopic = defineAction({
  name: 'research_tutorial_topic',
  description:
    'Research a ZIO topic across source, tests, examples, and GitHub history; return structured findings.',
  input: v.object({
    topic: v.string(),
  }),
  output: researchSchema,
  async run({ harness, input, log }) {
    const repoPath = process.env.REPO_PATH!;
    const cached = readResearchCache(repoPath, input.topic);
    if (cached) {
      const parsed = v.safeParse(researchSchema, cached);
      if (parsed.success) {
        log.info(`Research cache hit for "${input.topic}"`);
        return parsed.output;
      }
    }

    log.info(`Researching tutorial topic: ${input.topic}`);
    const session = await harness.session();
    // Delegates to the tutorial_researcher subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      `Research "${input.topic}" in this ZIO library checkout so a tutorial can be written ` +
        `accurately from real source, tests, and examples.`,
      { agent: 'tutorial_researcher', result: researchSchema },
    );
    writeResearchCache(repoPath, input.topic, data);
    return data;
  },
});
