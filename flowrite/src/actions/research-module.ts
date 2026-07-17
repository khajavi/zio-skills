import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { sourceRef } from './research-data-type.ts';
import { readResearchCache, writeResearchCache } from '../shared/research-cache.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';

// Module-shaped research: a module is several related types, so this enumerates
// the member types with a LIGHT per-type surface (enough to decide flat vs
// hierarchical and to write the module narrative) plus the module-level story —
// relationships, patterns, integration. Full per-type depth is only gathered
// later, per type, via research_data_type when the layout is hierarchical.
export const moduleResearchSchema = v.object({
  moduleName: v.pipe(v.string(), v.description('The module name as given, e.g. "http-model" or "resource-management"')),
  purpose: v.pipe(v.string(), v.description('1-3 sentences: what this module provides and its domain')),
  coreTypes: v.pipe(
    v.array(v.string()),
    v.description('Primary exported type names — the ones a reader comes for, e.g. ["Request", "Response", "URL"]'),
  ),
  supportingTypes: v.pipe(
    v.array(v.string()),
    v.description('Helper/auxiliary type names used by the core types; empty if none'),
  ),
  types: v.array(
    v.object({
      name: v.pipe(v.string(), v.description('The type name, e.g. "Request"')),
      kind: v.pipe(v.picklist(['core', 'supporting']), v.description('"core" for a primary export, "supporting" for a helper')),
      signature: v.pipe(
        v.string(),
        v.description('The structural declaration: trait/class with type params, variance, extends — no bodies'),
      ),
      role: v.pipe(v.string(), v.description('One or two sentences: what this type is and its role in the module')),
      keyConstructors: v.pipe(
        v.array(v.string()),
        v.description('The main ways to build a value (names only), e.g. ["Request.apply", "Request.get"]; empty if none'),
      ),
      operationGroups: v.pipe(
        v.array(
          v.object({
            category: v.pipe(v.string(), v.description('e.g. "Parsing", "Key Operations", "Rendering"')),
            methods: v.pipe(v.array(v.string()), v.description('Method names in this group')),
          }),
        ),
        v.description('The public operations grouped concisely (light — this is not exhaustive per-method research)'),
      ),
      keyExampleCode: v.pipe(v.string(), v.description('One short representative usage snippet with its evaluated result')),
      source: sourceRef,
    }),
  ),
  relationships: v.pipe(
    v.string(),
    v.description(
      'How the types work together: the typical workflow / data flow and how each type uses, contains, ' +
        'or depends on the others. This grounds the mandatory "How They Work Together" section — be concrete.',
    ),
  ),
  commonPatterns: v.pipe(
    v.array(v.object({ name: v.string(), description: v.string() })),
    v.description('Named module-specific patterns (e.g. "Shared Singletons", "Per-Request Instances"); empty if none'),
  ),
  integrationPoints: v.pipe(
    v.array(v.string()),
    v.description('How types relate internally and how the module integrates with other modules; empty if none'),
  ),
  comparisons: v.pipe(
    v.array(v.object({ vsType: v.string(), distinction: v.string() })),
    v.description('Module-level analogues worth comparing (stdlib / other libs / theory); empty if none'),
  ),
  imports: v.array(v.string()),
  sbtDependency: v.string(),
  isTopLevelModule: v.pipe(
    v.boolean(),
    v.description('true if the module is a top-level published artifact warranting an Installation section'),
  ),
  sourceFiles: v.pipe(
    v.array(v.string()),
    v.description('Every repo-relative source file read during research (deduped); the paths cited in `source` fields.'),
  ),
  groundingDetail: v.pipe(
    v.string(),
    v.description(
      'Verbatim supporting detail — real signatures, scaladoc excerpts, snippets from source/tests/examples. ' +
        'The drafter grounds every fact and relationship in this; never let general knowledge substitute for it.',
    ),
  ),
});

/**
 * Research a ZIO module — a cohesive domain model of several related types — for
 * a module reference page. Discovers the member types (free-form scope: the
 * caller gives only a module name) and the module-level story (relationships,
 * patterns, integration). Delegates to the generic `researcher` subagent,
 * supplying the module-surface focus and result schema here. Mirrors
 * research-data-type.ts, but module-shaped.
 */
export const researchModule = defineAction({
  name: 'research_module',
  description:
    "Research a ZIO module's member types and how they work together (relationships, patterns, integration) across source, tests, and examples; return structured findings.",
  input: v.object({
    moduleName: v.pipe(v.string(), v.description('The module to document, e.g. "http-model"')),
  }),
  output: moduleResearchSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('research')) {
      log.info('Skipping research (skipPhases)');
      const s = '(skipped — phase already done)';
      return {
        moduleName: input.moduleName,
        purpose: s,
        coreTypes: [],
        supportingTypes: [],
        types: [],
        relationships: s,
        commonPatterns: [],
        integrationPoints: [],
        comparisons: [],
        imports: [],
        sbtDependency: s,
        isTopLevelModule: false,
        sourceFiles: [],
        groundingDetail: s,
      };
    }

    const repoPath = process.env.REPO_PATH!;
    // Namespace the cache topic by document kind so a module-ref run and a
    // data-type-ref run for the same name never collide (their schemas differ).
    const cacheTopic = `module-ref::${input.moduleName}`;
    const cached = readResearchCache(repoPath, cacheTopic);
    if (cached) {
      const parsed = v.safeParse(moduleResearchSchema, cached);
      if (parsed.success) {
        log.info(`Research cache hit for "${cacheTopic}"`);
        return parsed.output;
      }
    }

    log.info(`Researching module: ${input.moduleName}`);
    const session = await harness.session();
    // Delegates to the generic researcher subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await session.task(
      [
        `Research the ZIO module "${input.moduleName}" in this library checkout so a MODULE`,
        `reference page can be written accurately from real source, tests, and examples.`,
        ``,
        `A module is a cohesive domain model of several related types. First DISCOVER which`,
        `types belong to the module (explore packages/source — the scope is free-form, only`,
        `the module name was given). Classify each as "core" (a primary export) or`,
        `"supporting" (a helper). For each type give a light surface: structural signature,`,
        `role, key constructors, operations grouped concisely, and one representative example.`,
        `Do NOT exhaustively research every method here — that happens per type later.`,
        ``,
        `The heart of a module reference is HOW THE TYPES WORK TOGETHER: capture the typical`,
        `workflow / data flow and how each type uses, contains, or depends on the others in`,
        `"relationships". Capture named module patterns and integration points too.`,
        ``,
        `For every type set its "source" to the repo-relative location you actually read it`,
        `from, as "path:L<start>-L<end>". List every file you read in "sourceFiles". Never`,
        `guess a path or line — cite only a file you opened.`,
      ].join('\n') + authorHint(),
      { agent: 'researcher', result: moduleResearchSchema },
    );
    writeResearchCache(repoPath, cacheTopic, data);
    return data;
  },
});
