import 'dotenv/config.js';
import type { FlueContext } from '@flue/runtime';
import pageLinkerAgent from '../agents/page-linker.js';
import { loadConfig } from '../lib/config-loader.js';
import { loadState, emptyState } from '../lib/state-store.js';
import { reindex } from './phases/reindex.js';
import { processBatch } from './phases/process.js';
import { report } from './phases/report.js';

export async function run({ init, payload }: FlueContext) {
  const { docsDir, mode, batchSize = 1, targetFile, targetDir } = payload as {
    docsDir: string;
    mode: 'reindex' | 'step' | 'autopilot' | 'report';
    batchSize?: number;
    targetFile?: string;
    targetDir?: string;
  };

  if (!docsDir) throw new Error('payload.docsDir is required');

  const harness = await init(pageLinkerAgent, { name: 'crossref' });
  const session = await harness.session();

  let state = (await loadState(docsDir)) ?? emptyState(docsDir);

  if (mode === 'reindex') {
    state = await reindex(docsDir, state, session);
    return { indexed: state.index.length };
  }

  if (mode === 'step') {
    if (state.index.length === 0) {
      console.log('[crossref] No index found. Run reindex first.');
      return { done: false };
    }
    const config = loadConfig(docsDir);
    const result = await processBatch(state, config, session, batchSize, docsDir, targetFile, targetDir);
    if (result.done) console.log('[crossref] All pages processed.');
    return result;
  }

  if (mode === 'autopilot') {
    if (state.index.length === 0) {
      console.log('[crossref] No index found. Run reindex first.');
      return { done: false };
    }
    const config = loadConfig(docsDir);
    let totalProcessed = 0;
    while (true) {
      const result = await processBatch(state, config, session, batchSize, docsDir, targetFile, targetDir);
      totalProcessed += result.processed;
      if (result.done) break;
      state = (await loadState(docsDir)) ?? state;
    }
    console.log(`\n[crossref] Autopilot complete. Total processed: ${totalProcessed}/${state.index.length}`);
    console.log(`  Total tokens — in: ${state.tokens.inputTotal.toLocaleString()}  out: ${state.tokens.outputTotal.toLocaleString()}  (~$${state.tokens.runningCost.toFixed(2)})`);
    return { done: true, totalProcessed };
  }

  if (mode === 'report') {
    const config = loadConfig(docsDir);
    const threshold = config.confidenceThreshold;
    return report(state, threshold);
  }

  throw new Error(`Unknown mode: "${mode}"`);
}
