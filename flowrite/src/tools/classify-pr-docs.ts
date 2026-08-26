import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

/** A single changed file, exactly as `gh api repos/{owner}/{repo}/pulls/{N}/files` reports it. */
export interface PrFile {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | string;
}

export interface PrFacts {
  title: string;
  labels: string[];
  files: PrFile[];
}

export type DocsRequirement = 'yes' | 'no' | 'uncertain';

export interface ClassificationResult {
  requiresDocs: DocsRequirement;
  gate: string;
  reason: string;
}

// `gh api .../files` reports repo-root-relative paths with no leading slash (`src/main/...`, not
// `/src/main/...`), so every directory check below matches the segment at the START of the path too,
// not only nested under something else.
const isTestFile = (path: string): boolean =>
  /(Test|Spec|Suite)\.scala$/.test(path) || /(^|\/)src\/test\//.test(path);

const isMainScala = (path: string): boolean => path.endsWith('.scala') && /(^|\/)src\/main\//.test(path);

const isInternal = (path: string): boolean =>
  path.includes('/internal/') || path.includes('/impl/') || path.includes('/private/');

const isInfra = (path: string): boolean =>
  /\.ya?ml$/.test(path) || path.startsWith('.github/') || path.includes('/.github/') ||
  /(^|\/)Dockerfile/.test(path);

const isBuild = (path: string): boolean =>
  path === 'build.sbt' || path.endsWith('/build.sbt') || path.startsWith('project/') ||
  path.includes('/project/') || path.endsWith('.sbt');

const CC_PREFIX_RE =
  /^(feat|fix|chore|refactor|test|ci|build|docs|perf|style|revert)(\(.+\))?(!)?:/i;

const hasLabel = (labels: string[], ...names: string[]): boolean =>
  labels.some((l) => names.includes(l.toLowerCase()));

/** Whole-word, case-insensitive: guards against "add" matching inside "added" or "CI". */
const titleHasWord = (title: string, word: string): boolean =>
  new RegExp(`\\b${word}\\b`, 'i').test(title);

/**
 * The gate system from `docs-list-undocumented-prs`, ported to a pure function instead of a model
 * evaluating ~16 boolean conditions across ordered tables by hand — the same reasoning as
 * `computeMethodCoverage`: a misapplied gate order is a SILENT wrong classification, not a loud
 * failure, and that is exactly the kind of boundary CLAUDE.md says earns a contract.
 *
 * First match wins, in this order: overrides, then NO-1..NO-9, then YES-1..YES-5, then UNCERTAIN.
 */
export function classifyDocsRequirement(pr: PrFacts): ClassificationResult {
  const { title, labels, files } = pr;

  const filesTest = files.filter((f) => isTestFile(f.path));
  const filesMainScala = files.filter((f) => isMainScala(f.path) && !isTestFile(f.path));
  const filesInternal = filesMainScala.filter((f) => isInternal(f.path));
  const filesPublicMain = filesMainScala.filter((f) => !isInternal(f.path));
  const filesNewPublicMain = filesPublicMain.filter((f) => f.status === 'added');
  const filesInfra = files.filter((f) => isInfra(f.path));
  const filesBuild = files.filter((f) => isBuild(f.path));

  const ccMatch = CC_PREFIX_RE.exec(title);
  const ccPrefix = ccMatch?.[1]?.toLowerCase();
  const ccBreaking = Boolean(ccMatch?.[3]);
  const isBump =
    /^(bump|upgrade|update).*\b(to v?\d|version|dep)/i.test(title) ||
    /^build\(deps\)/i.test(title);
  const isRevert = /^Revert "/.test(title);

  // ─── Overrides ───────────────────────────────────────────────────────────
  if (ccBreaking) {
    return { requiresDocs: 'yes', gate: 'OVERRIDE-BREAKING', reason: 'Title carries a `!:` breaking-change marker.' };
  }
  if (hasLabel(labels, 'documentation-needed')) {
    return { requiresDocs: 'yes', gate: 'OVERRIDE-DOCS-NEEDED', reason: 'Labeled `documentation-needed`.' };
  }

  // ─── NO gates, first match wins ──────────────────────────────────────────
  if (isBump || hasLabel(labels, 'renovate', 'dependabot') || (ccPrefix === 'build' && filesMainScala.length === 0)) {
    return { requiresDocs: 'no', gate: 'NO-1', reason: 'Dependency update — no user-facing API change.' };
  }
  if (
    filesPublicMain.length === 0 &&
    (filesInfra.length > 0 || filesBuild.length > 0) &&
    (hasLabel(labels, 'ci', 'infrastructure') || ccPrefix === 'ci' || ccPrefix === 'build')
  ) {
    return { requiresDocs: 'no', gate: 'NO-2', reason: 'CI/infrastructure-only change, corroborated by label or commit prefix.' };
  }
  if (
    files.every((f) => isTestFile(f.path) || isInfra(f.path) || isBuild(f.path)) &&
    filesPublicMain.length === 0
  ) {
    return { requiresDocs: 'no', gate: 'NO-3', reason: 'Test/infra/build-only change — no public source touched.' };
  }
  if (ccPrefix === 'fix' && filesNewPublicMain.length === 0) {
    return { requiresDocs: 'no', gate: 'NO-4', reason: '`fix:` prefix with no new public files — existing docs remain valid.' };
  }
  if (
    ccPrefix !== undefined &&
    ['chore', 'refactor', 'test', 'ci', 'docs', 'style', 'perf', 'revert'].includes(ccPrefix) &&
    filesNewPublicMain.length === 0
  ) {
    return { requiresDocs: 'no', gate: 'NO-5', reason: `\`${ccPrefix}:\` prefix signals maintenance, no new public files.` };
  }
  if (filesPublicMain.length === 0 && filesInternal.length > 0 && hasLabel(labels, 'refactor', 'internal')) {
    return { requiresDocs: 'no', gate: 'NO-6', reason: 'Internal-only refactor — no public API touched.' };
  }
  if (
    hasLabel(labels, 'bug', 'fix', 'bugfix') &&
    filesNewPublicMain.length === 0 &&
    !hasLabel(labels, 'feature', 'enhancement', 'api-change', 'breaking-change')
  ) {
    return { requiresDocs: 'no', gate: 'NO-7', reason: 'Bug-fix label, no new public files, no offsetting feature label.' };
  }
  if (hasLabel(labels, 'chore', 'internal') && filesPublicMain.length === 0) {
    return { requiresDocs: 'no', gate: 'NO-8', reason: 'Chore/internal label with no public source changes.' };
  }
  if (isRevert) {
    return { requiresDocs: 'no', gate: 'NO-9', reason: 'Revert — the original PR\'s documentation is no longer needed.' };
  }

  // ─── YES gates, first match wins ─────────────────────────────────────────
  if (ccPrefix === 'feat') {
    return { requiresDocs: 'yes', gate: 'YES-1', reason: '`feat:` is the authoritative signal for new functionality.' };
  }
  if (filesNewPublicMain.length > 0) {
    return {
      requiresDocs: 'yes',
      gate: 'YES-2',
      reason: `New public Scala file(s) added: ${filesNewPublicMain.map((f) => f.path).join(', ')}`,
    };
  }
  if (hasLabel(labels, 'breaking-change', 'api-change')) {
    return { requiresDocs: 'yes', gate: 'YES-3', reason: 'Labeled `breaking-change` or `api-change`.' };
  }
  if (hasLabel(labels, 'feature', 'enhancement', 'new-feature') && filesMainScala.length > 0) {
    return { requiresDocs: 'yes', gate: 'YES-4', reason: 'Feature/enhancement label with actual source changes.' };
  }
  if (
    filesPublicMain.length > 0 &&
    ['introduce', 'deprecate', 'breaking', 'API'].some((w) => titleHasWord(title, w))
  ) {
    return {
      requiresDocs: 'yes',
      gate: 'YES-5',
      reason: 'Public file(s) modified with interface-change language in the title.',
    };
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────
  const signals = [
    ccPrefix ? `commit prefix \`${ccPrefix}:\`` : 'no conventional-commit prefix',
    labels.length > 0 ? `labels [${labels.join(', ')}]` : 'no labels',
    filesPublicMain.length > 0 ? `${filesPublicMain.length} public main file(s) touched` : 'no public main files touched',
    filesTest.length > 0 ? `${filesTest.length} test file(s) touched` : 'no test files touched',
  ].join('; ');
  return {
    requiresDocs: 'uncertain',
    gate: 'UNCERTAIN',
    reason: `No gate fired. Observed: ${signals}.`,
  };
}

/**
 * The same computation, model-callable. The model's job is to fetch the raw PR and file-status JSON
 * from `gh` and hand it here — not to apply the gate table by hand across a batch of PRs, the same
 * division of labor as `check_method_coverage`.
 */
export const classifyPrDocs = defineTool({
  name: 'classify_pr_docs',
  description:
    'Classify whether a merged PR requires documentation, using the fixed gate table (overrides, ' +
    'then NO-1..NO-9, then YES-1..YES-5, then UNCERTAIN). Deterministic — pass the PR title, its ' +
    'labels, and its changed files with their statuses (added/modified/removed/renamed).',
  input: v.object({
    title: v.string(),
    labels: v.array(v.string()),
    files: v.array(
      v.object({
        path: v.string(),
        status: v.string(),
      }),
    ),
  }),
  output: v.object({
    requiresDocs: v.picklist(['yes', 'no', 'uncertain']),
    gate: v.string(),
    reason: v.string(),
  }),
  run({ data }) {
    return { output: classifyDocsRequirement(data) };
  },
});
