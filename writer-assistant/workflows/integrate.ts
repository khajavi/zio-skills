import * as v from 'valibot';
import 'dotenv/config.js';
import * as path from 'node:path';
import { defineWorkflow } from '@flue/runtime';
import docsIntegratorAgent from '../agents/docs-integrator.js';
// TODO: pageLinkerAgent (Phase 2) is a secondary agent — Flue 1.0 removed multi-agent init.
// Migrate Phase 2 to a separate workflow via invoke(), or restructure using Actions.
import pageLinkerAgent from '../agents/page-linker.js';
import { loadConfig } from '../lib/config-loader.js';
import { loadState, emptyState } from '../lib/state-store.js';
import { reindex } from './phases/reindex.js';
import { processBatch } from './phases/process.js';
import { createRunMdoc } from '../tools/run_mdoc.js';
import { createBuildWebsite } from '../tools/build_website.js';
import { createRunSummaryTracker, formatSummaryReport } from './utils/run-summary.js';

export default defineWorkflow({
  agent: docsIntegratorAgent,
  input: v.looseObject({}),
  run: integrateRun as (ctx: any) => any,
});

async function integrateRun({ harness, input, log }: { harness: any; input: any; log: any }) {
  const { projectRoot, docPath } = input as {
    projectRoot: string;
    docPath: string; // path to the new doc, relative to projectRoot (e.g. "docs/reference/chunk.md")
  };

  if (!projectRoot) throw new Error('input.projectRoot is required');
  if (!docPath) throw new Error('input.docPath is required');

  const docsDir = path.join(projectRoot, 'docs');
  const absDocPath = path.resolve(projectRoot, docPath);

  console.log(`[integrate] Integrating: ${docPath}`);

  // Track token usage, cost, and per-phase timing across every session in this run
  const tracker = createRunSummaryTracker(harness, { workflowName: 'integrate' });
  harness = tracker.harness;

  // Phase 1: Wire into site (sidebars.js, index.md, mdoc + build verification)
  tracker.beginPhase('siteIntegration');
  console.log('\n[integrate] Phase 1: Site integration (sidebar, index, compilation gate)');
  process.env.FLUE_PROJECT_ROOT = projectRoot;

  const integratorSession = await harness.session('docs-integrate');

  const integratePrompt = `Integrate the newly written documentation page into the Docusaurus site.

Project root: ${projectRoot}
New page path: ${docPath}

Follow the docs-integrate checklist:
1. Add to sidebars.js under the correct category
2. Add link in docs/index.md under the correct section
3. Run run_mdoc to verify compilation — fix any errors before continuing
4. Run build_website to verify the full site builds — fix any errors before continuing

Do not proceed to the next step until the current one succeeds.`;

  await integratorSession.prompt(integratePrompt, {
    tools: [createRunMdoc(projectRoot), createBuildWebsite(projectRoot)],
  });

  console.log('\n[integrate] Phase 1 complete.');

  // Phase 2: Cross-reference — find inbound link candidates for the new page
  tracker.beginPhase('crossReferencing');
  console.log('\n[integrate] Phase 2: Cross-referencing (find inbound See Also candidates)');

  // TODO: pageLinkerAgent is a different agent — can't use harness.session() here.
  // Proper fix: split Phase 2 into a separate workflow, call via invoke().
  const linkerSession = null as any; // placeholder until multi-agent migration
  void pageLinkerAgent; // suppress unused import warning

  // Reindex to include the new page
  let state = (await loadState(docsDir)) ?? emptyState(docsDir);
  state = await reindex(docsDir, state, linkerSession);

  const config = loadConfig(docsDir);
  const result = await processBatch(state, config, linkerSession, 1, docsDir, absDocPath);

  console.log(
    `\n[integrate] Phase 2 complete. Cross-ref: processed=${result.processed}, remaining=${result.remaining}`
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

  return {
    summary,
    docPath,
    phases: {
      integration: 'complete',
      crossRef: { processed: result.processed, remaining: result.remaining },
    },
  };
}
