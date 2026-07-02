import * as v from 'valibot';
import { defineWorkflow } from '@flue/runtime';
import codingAgent from '../agents/coding-agent.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

export default defineWorkflow({
  agent: codingAgent,
  input: v.looseObject({}),
  run: (async (ctx: any) => {
    const { input, log } = ctx;
    let { harness } = ctx;
    const { pwd, prompt } = input as { pwd?: string; prompt?: string };

    if (!pwd || !prompt) {
      return {
        status: 'error',
        message: 'Missing required parameters: pwd and prompt',
      };
    }

    console.log(`\n📁 Working directory: ${pwd}`);
    console.log(`📝 Task: ${prompt}\n`);

    // Track token usage, cost, and wall-clock time for this run
    const tracker = createRunSummaryTracker(harness, { workflowName: 'coding-agent' });
    harness = tracker.harness;
    tracker.beginPhase('prompt');

    const session = await harness.session();

    const response = await session.prompt(
      `You are working in the project directory: ${pwd}\n\nWhen using bash, execute commands in the project directory: ${pwd}\n\nTask: ${prompt}`
    );

    const summary = tracker.finish();
    console.log(formatSummaryReport(summary));
    log.info('Run summary', {
      wallClockMs: summary.wallClockMs,
      totalTokens: summary.totals.totalTokens,
      inputTokens: summary.totals.input,
      outputTokens: summary.totals.output,
      costUsd: summary.totals.costUsd,
      phases: summary.phases.map((p) => ({
        name: p.name,
        durationMs: p.durationMs,
        costUsd: p.costUsd,
      })),
    });

    // Return the prompt response unchanged — this workflow does not return a plain result object.
    return response;
  }) as (ctx: any) => any,
});
