import { defineWorkflow, observe, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import tutorialWriter from '../agents/tutorial-writer.ts';
import { resolveReviewCommentsOutput, resolveReviewPrompt } from '../actions/resolve-review-comments.ts';
import { trackTokenUsage } from '../shared/token-usage.ts';
import { trackComponentUsage } from '../shared/component-usage.ts';

/**
 * Standalone "resolve reviewer comments" run. A human has marked up an
 * existing article with `<!-- REVIEW ... -->` comments; this workflow applies
 * each directed fix in place, strips the markers, and returns a report of what
 * was resolved (including which writing-style rule each comment enforced, or a
 * suggested new rule when none covers it).
 *
 * It binds the `tutorial_writer` agent purely as the host that registers the
 * review_resolver subagent and resolves the sandbox cwd from REPO_PATH;
 * `session.task(..., { agent: 'review_resolver' })` delegates straight to the
 * subagent, so the top agent's scripted flow never runs.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next();

// See write-tutorial.ts: flue's CLI printer never renders tool args/results.
// Opt into full detail with FLUE_VERBOSE_TOOLS=1.
if (process.env.FLUE_VERBOSE_TOOLS === '1') {
  const startedAt = new Map<string, number>();

  observe((event) => {
    if (event.type === 'tool_start') {
      startedAt.set(event.toolCallId, Date.now());
      const kind = event.toolName === 'task' ? 'subagent-task' : 'tool';
      console.log(`[verbose] ${kind} start ${event.toolName} args: ${JSON.stringify(event.args)}`);
      return;
    }

    if (event.type === 'tool') {
      const start = startedAt.get(event.toolCallId);
      startedAt.delete(event.toolCallId);
      const durationMs = start ? Date.now() - start : undefined;
      const kind = event.toolName === 'task' ? 'subagent-task' : 'tool';
      console.log(
        `[verbose] ${kind} end ${event.toolName} durationMs=${durationMs} isError=${event.isError} ` +
          `result: ${JSON.stringify(event.result)}`,
      );
    }
  });
}

export default defineWorkflow({
  agent: tutorialWriter,
  input: v.object({
    projectPath: v.pipe(
      v.string(),
      v.description('Absolute path to the ZIO library checkout (sandbox cwd)'),
    ),
    articlePath: v.pipe(
      v.string(),
      v.description(
        'Path to the article markdown with embedded <!-- REVIEW --> comments, relative to projectPath, e.g. docs/guides/schedule.md',
      ),
    ),
  }),
  output: resolveReviewCommentsOutput,
  async run({ harness, input, log }) {
    // The bound agent resolves its sandbox cwd from REPO_PATH at init, which
    // happens on the first harness.session() below — set it first.
    process.env.REPO_PATH = input.projectPath;

    const usage = trackTokenUsage();
    const components = trackComponentUsage();
    try {
      const session = await harness.session();
      // Same prompt the resolve_review_comments action uses (shared via
      // resolveReviewPrompt). Delegated directly to review_resolver, bypassing
      // the top agent's flow.
      const { data } = await session.task(resolveReviewPrompt(input.articlePath), {
        agent: 'review_resolver',
        result: resolveReviewCommentsOutput,
      });
      return data;
    } finally {
      const t = usage.stop();
      log.info(
        `resolve-review token consumption: ${t.totalTokens} tokens ` +
          `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
          `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
        t,
      );
      log.info(`resolve-review component usage: ${JSON.stringify(components.stop())}`);
    }
  },
});
