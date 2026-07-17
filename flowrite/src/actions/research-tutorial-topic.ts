import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { readResearchCache, writeResearchCache } from '../shared/research-cache.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';
import { sourceRef } from './research-data-type.ts';

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
      source: sourceRef,
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
  verifiableOutputs: v.pipe(
    v.array(v.string()),
    v.description(
      'Verifiable outputs: points where printed or observed output lets the learner confirm the ' +
        'code behaved as claimed.',
    ),
  ),
  coreInsight: v.pipe(
    v.string(),
    v.description('The core insight: the single realization the whole tutorial drives the learner toward.'),
  ),
  imports: v.array(v.string()),
  sourceFiles: v.pipe(
    v.array(v.string()),
    v.description('Every repo-relative source file read during research (deduped); the paths cited in coreTypes `source`.'),
  ),
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
 * design_tutorial_structure and review_tutorial.
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
    // Resume support: a skipped head phase returns a marker-filled placeholder.
    // Downstream consumers (design, write) are skipped in the same runs, so the
    // placeholder only wires the action chain — it is never drafted from.
    if (isPhaseSkipped('research')) {
      log.info('Skipping research (skipPhases)');
      const s = '(skipped — phase already done)';
      return {
        concept: s,
        prerequisites: [],
        postTutorialAbilities: [],
        coreTypes: [],
        compositionOrder: s,
        factoryMethods: [],
        helloWorld: s,
        complexityLayers: [],
        verifiableOutputs: [],
        coreInsight: s,
        imports: [],
        sourceFiles: [],
        sbtDependency: s,
        scalaVersionNotes: null,
        groundingDetail: s,
      };
    }

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
    // Delegates to the generic researcher subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here. The
    // tutorial-specific focus and result schema are supplied here at the call site.
    const { data } = await session.task(
      `Research "${input.topic}" in this ZIO library checkout so a tutorial can be written ` +
        `accurately from real source, tests, and examples. For each core type, set its "source" ` +
        `to the repo-relative location you actually read it from, as "path:L<start>-L<end>" ` +
        `(e.g. "src/main/scala/optics/Lens.scala:L12-L20"), and list every file you read in ` +
        `"sourceFiles". Never guess a path or line — cite only a file you opened.` +
        authorHint(),
      { agent: 'researcher', result: researchSchema },
    );
    writeResearchCache(repoPath, input.topic, data);
    return data;
  },
});
