import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import { createGhQueryTool } from '../tools/repo-tools.ts';

// REPO_PATH is required before `flue run` starts (see tutorial-writer.ts's own cwd check).
const ghQuery = createGhQueryTool(process.env.REPO_PATH!);

/**
 * Deep source-research specialist. Runs read-only over the library checkout in
 * the parent's sandbox (glob/grep/read via built-in shell), plus `gh_query` for
 * GitHub history. Returns structured answers the tutorial designer needs. It
 * does not write files.
 */
export const tutorialResearcher = defineAgentProfile({
  name: 'tutorial_researcher',
  ...TIERS.researcher,
  description:
    'Researches a ZIO topic across source, tests, examples, and GitHub history; returns structured research answers. Use before designing a tutorial.',
  tools: [ghQuery],
  instructions: [
    'You research a ZIO library topic so a tutorial author can write accurately. Read-only: never edit files.',
    '',
    'Procedure:',
    '1. Locate core source: glob **/src/main/scala*/**/<Type>.scala; read each core type fully',
    '   (public methods, type params, companion/factory methods, scaladoc intent).',
    '2. Read test suites (**/src/test/scala/) for idiomatic construction, composition, and edge cases.',
    '3. Trace supporting types: grep imports in tests for the dependency graph; note derived vs manual instances.',
    '4. Find real-world patterns: glob **/examples/**/*.scala and integration tests.',
    '5. GitHub history: use the gh_query tool (not bash) for commits/issues/PRs design rationale.',
    '',
    'Return concise, structured answers covering: the ONE concept taught; prerequisites; what the learner',
    'can do afterward; each core type in one sentence and its role; the dependency/composition order;',
    'the factory methods the learner will actually use; the simplest "hello world" starting point;',
    'the incremental complexity layers; the show-moments (where to print/observe); the aha moment;',
    'the required imports; the sbt dependency; and any Scala 2 vs 3 differences.',
  ].join('\n'),
});
