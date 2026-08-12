// Run the mechanical style checks against a page from the command line.
//
//   node --experimental-strip-types scripts/grade-page.ts <path-to-page.md>
//
// Same graders the review phase uses, so this is how you see what review will say about a page without
// paying for a run — and how a new grader gets sanity-checked against real output rather than a fixture.
import { readFileSync } from 'node:fs';
import type { FlueHarness, FlueLogger } from '@flue/runtime';
import type { CheckContext } from '../src/review/check.ts';
import { CODE_CHECKS } from '../src/review/code/index.ts';
import { applyFixes } from '../src/review/fix.ts';

const path = process.argv[2];
if (path === undefined) {
  console.error('usage: node --experimental-strip-types scripts/grade-page.ts <page.md>');
  process.exit(2);
}

const content = readFileSync(path, 'utf8');
const ctx: CheckContext = {
  path,
  content,
  lines: content.split('\n'),
  harness: undefined as unknown as FlueHarness,
  log: { info() {} } as unknown as FlueLogger,
};

let failures = 0;
for (const check of CODE_CHECKS) {
  for (const item of await check.run(ctx)) {
    if (item.pass) continue;
    failures++;
    console.log(`FAIL ${item.item}\n     ${item.issue}`);
  }
}

const fixed = applyFixes(content);
console.log(`\n${failures} mechanical violation(s) in ${path}`);
console.log(`auto-fixable now: ${fixed.fixed.length > 0 ? fixed.fixed.join(', ') : 'none'}`);
