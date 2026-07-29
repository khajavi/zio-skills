import { defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import { docsWorkflowRoute } from '../shared/docs-workflow.ts';
import * as v from 'valibot';
import tutorialWriter from '../agents/tutorial-writer.ts';
import { writeCompanionExamplesOutput } from '../actions/write-companion-examples.ts';
import { trackTokenUsage } from '../shared/token-usage.ts';
import { trackComponentUsage } from '../shared/component-usage.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';

/**
 * Standalone "examples only" run. Builds compile-verified companion examples
 * for a tutorial that already exists on disk — no research/design/write.
 *
 * The full pipeline (write-tutorial) calls the examples phase via the
 * `write_companion_examples` action, which is skip-gated and reached only
 * after write. That phase is self-contained: the examples_builder subagent
 * reads the tutorial from `tutorialPath` and builds from it. This workflow
 * exposes that same subagent directly for fast iteration on the examples
 * generator without re-running the head phases.
 *
 * It binds the `tutorial_writer` agent purely as the host that registers the
 * examples_builder subagent and resolves the sandbox cwd from REPO_PATH;
 * `session.task(..., { agent: 'examples_builder' })` delegates straight to the
 * subagent, so the top agent's scripted flow never runs.
 */
export const route: WorkflowRouteHandler = docsWorkflowRoute;

// FLUE_VERBOSE_TOOLS=1 opts into full tool/subagent call detail.
installVerboseObserver();

export default defineWorkflow({
  agent: tutorialWriter,
  input: v.object({
    projectPath: v.pipe(
      v.string(),
      v.description('Absolute path to the ZIO library checkout (sandbox cwd)'),
    ),
    tutorialPath: v.pipe(
      v.string(),
      v.description('Path to the existing tutorial markdown, relative to projectPath, e.g. docs/guides/lens.md'),
    ),
    userPrompt: v.pipe(
      v.optional(v.string()),
      v.description('Optional free-form hint to steer the run, e.g. scope, emphasis, or known gotchas.'),
    ),
  }),
  output: writeCompanionExamplesOutput,
  async run({ harness, input, log }) {
    // The bound agent resolves its sandbox cwd from REPO_PATH at init, which
    // happens on the first harness.session() below — set it first.
    process.env.REPO_PATH = input.projectPath;

    const usage = trackTokenUsage();
    const components = trackComponentUsage();
    try {
      const session = await harness.session();
      // Same prompt the write_companion_examples action uses (kept in sync
      // deliberately — see write-companion-examples.ts). Delegated directly to
      // examples_builder, bypassing the skip-gate and the top agent's flow.
      const { data } = await session.task(
        `Build companion examples for the tutorial at ${input.tutorialPath}. Create one runnable ` +
          `example per major concept plus a complete integrated example, then compile the examples ` +
          `leaf build and run every example (each must print meaningful output).` +
          (input.userPrompt ? ` Author hint to steer this run: ${input.userPrompt}` : ''),
        { agent: 'examples_builder', result: writeCompanionExamplesOutput },
      );
      return data;
    } finally {
      const t = usage.stop();
      log.info(
        `write-examples token consumption: ${t.totalTokens} tokens ` +
          `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
          `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
        t,
      );
      log.info(`write-examples component usage: ${JSON.stringify(components.stop())}`);
    }
  },
});
