#!/usr/bin/env node
//
// run-report.mjs — print an archived run's report as readable tables.
//
// The run emits one JSON line, which archive-docs.sh saves as run-report.json. Formatting lives here
// rather than in the agent so the run log stays terse and the layout can change without touching
// anything that executes during a run.
//
// Usage:
//   node scripts/run-report.mjs            # the most recent archived turn
//   node scripts/run-report.mjs 14         # a specific turn number, any workflow
//   node scripts/run-report.mjs write-module-ref-turn4
//
// Lives outside fixtures/ deliberately: archive-docs.sh resets the fixture to committed HEAD, so a
// script kept in there is reverted by the very run it reports on.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARCHIVE = join(dirname(dirname(fileURLToPath(import.meta.url))), 'fixtures/tinyoptics-archive');
const money = (n) => `$${n.toFixed(4)}`;
const pct = (n) => `${(100 * n).toFixed(1)}%`;
const thousands = (n) => n.toLocaleString('en-US');

function resolveTurn(arg) {
  const turns = readdirSync(ARCHIVE).filter((d) => /-turn\d+$/.test(d));
  if (!arg) {
    // Most recent by mtime, not by turn number: numbering restarts per workflow label, so
    // write-tutorial-turn9 and write-data-type-ref-turn14 are not comparable by number.
    return turns
      .map((d) => ({ d, at: statSync(join(ARCHIVE, d)).mtimeMs }))
      .sort((a, b) => b.at - a.at)[0]?.d;
  }
  if (/^\d+$/.test(arg)) {
    const matches = turns.filter((d) => d.endsWith(`-turn${arg}`));
    if (matches.length > 1) {
      console.error(`turn ${arg} is ambiguous — pass a full name: ${matches.join(', ')}`);
      process.exit(1);
    }
    return matches[0];
  }
  return turns.find((d) => d === arg);
}

const turn = resolveTurn(process.argv[2]);
if (!turn) {
  console.error(`no such archived turn: ${process.argv[2] ?? '(latest)'}`);
  process.exit(1);
}

const reportPath = join(ARCHIVE, turn, 'run-report.json');
if (!existsSync(reportPath)) {
  // Older turns predate this report. Say so plainly rather than half-reconstructing it from the log
  // — a guessed number here would be indistinguishable from a measured one.
  console.error(`${turn}: no run-report.json (this turn predates the run report)`);
  process.exit(1);
}

const r = JSON.parse(readFileSync(reportPath, 'utf8'));

const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

console.log(`\n${turn}`);
console.log(
  `  ${money(r.totals.cost)}   ${r.totals.turns} turns   ${thousands(r.totals.tokens)} tokens   ` +
    `${pct(r.totals.cacheHitRate)} re-sent context`,
);
const worst = r.phases.find((p) => !p.phase.startsWith('('));
if (worst) console.log(`  costliest phase   ${worst.phase} (${money(worst.totalCost)}, ${pct(worst.share)})`);
// Archives written before the verdict left this report still carry one, so render it when present.
// Newer turns keep their (self-reported) verdict in verdict.json instead.
if (r.verdict) {
  console.log(
    `  verdict           ${r.verdict.passed === null ? 'not reviewed' : r.verdict.passed ? 'passed' : `failed (${r.verdict.failingItems.length} item(s))`}`,
  );
}
console.log(`  flags             ${r.flags.length}`);

const w = Math.max(20, ...r.phases.map((p) => p.phase.length));
console.log(`\ncost by phase`);
console.log(
  `  ${pad('phase', w)} ${padL('own', 10)} ${padL('delegate', 10)} ${padL('total', 10)} ${padL('share', 7)} ${padL('tok/turn', 9)}`,
);
for (const p of r.phases) {
  console.log(
    `  ${pad(p.phase, w)} ${padL(money(p.ownCost), 10)} ${padL(money(p.delegateCost), 10)} ` +
      `${padL(money(p.totalCost), 10)} ${padL(pct(p.share), 7)} ${padL(thousands(p.tokensPerOwnTurn), 9)}`,
  );
}

if (r.roles.length) {
  console.log(`\ncost by role`);
  for (const role of r.roles) {
    console.log(`  ${pad(role.role, 18)} ${padL(`${role.calls} call(s)`, 10)} ${padL(money(role.cost), 10)}`);
  }
}

const tools = Object.entries(r.activity.tools).sort((a, b) => b[1] - a[1]);
if (tools.length) console.log(`\nactivity   ${tools.map(([n, c]) => `${n} ${c}`).join('   ')}`);
if (r.activity.skills.length) console.log(`skills     ${r.activity.skills.join(', ')}`);
const errors = Object.entries(r.activity.toolErrors);
if (errors.length) console.log(`errors     ${errors.map(([n, c]) => `${n} ${c}`).join('   ')}`);

console.log(`\nflags`);
if (!r.flags.length) console.log(`  none`);
for (const f of r.flags) {
  console.log(`  ! ${pad(f.code, 22)} ${f.phase ? `${f.phase}: ` : ''}${f.detail}`);
}
console.log();
