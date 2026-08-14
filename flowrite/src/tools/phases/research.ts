import { type FlueHarness, type FlueLogger, defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { authorHint, getRepoPath } from '../../runtime/run-context.ts';
import { readResearchCache, writeResearchCache } from '../../runtime/research-cache.ts';
import { isPhaseSkipped } from '../../runtime/skip-phases.ts';
import { delegate } from '../../runtime/delegate.ts';
import { note } from '../../runtime/log.ts';
import { recordResearch } from './phase-ledger.ts';

/**
 * The research phase: read the checkout and return structured findings for one kind of document.
 *
 * ONE body, THREE tools, for the same reasons as design-doc-plan.ts — the three result schemas
 * are unrelated (a module has `relationships`, a tutorial has `complexityLayers`, a data type has an
 * exhaustive `coreOperations`), each is embedded verbatim in the matching design and write phase's
 * input, and `KINDS` mounts only the one tool a run can use. A single tool over a `v.variant` would
 * put all three schemas in every run's registry — which every phase's scratch conversation inherits —
 * and turn "which kind of research" from a mounted fact into a branch the model picks.
 *
 * What was actually duplicated is written once here, in `researchSubject`: the skip branch, the
 * research-cache read/validate/write, the log lines and the `delegate` call.
 */

// Per-fact source provenance: the repo-relative file and line range the fact was actually read from,
// as "path:L<start>-L<end>" (e.g. "src/main/scala/optics/Prism.scala:L40-L41"). Verified downstream
// with a hybrid lookup — jump to the lines, and if the member (the fact's `name`) isn't there because
// source drifted, grep `def <name>` in the same file.
export const sourceRef = v.pipe(
  v.string(),
  v.description(
    'Repo-relative source location this fact was read from, as "path:L<start>-L<end>". ' +
      'Never guess a path or line — cite only a file you actually opened.',
  ),
);

/**
 * Why the API is shaped this way, read out of the repo's own history.
 *
 * Source and tests state WHAT a type does; they never state what it was weighed against. That
 * argument lives in commit messages, PR bodies and issue threads — zio-blocks 7c49fb9, the commit
 * this field was added for, spends 1239 lines explaining why `.await` is lexically gated and why
 * `&&`/`||` had to be rewritten to `if`. Without somewhere structured to put it, that reasoning
 * either never gets gathered or gets buried in `groundingDetail` next to the signatures.
 *
 * Empty is a legitimate answer and deliberately not validated against. A repo whose history says
 * nothing about a type must be able to say so: requiring an entry would make the model produce one,
 * which is the fabrication mode phase-ledger.ts documents. What IS validated is `provenance` — a
 * claim sourced to "the source code" or to a guessed number is not history, and the check catches it
 * without a second model pass.
 */
export const designRationale = v.pipe(
  v.array(
    v.object({
      claim: v.pipe(
        v.string(),
        v.description('The design decision or behaviour this explains, e.g. "`.await` is a compile error outside `Async.async`"'),
      ),
      why: v.pipe(v.string(), v.description('The reason the authors gave for it, in their terms')),
      provenance: v.pipe(
        v.string(),
        v.description('Exactly where it was read: "commit <shortSha>", "PR #<n>", or "issue #<n>" — never a guess'),
      ),
      quote: v.pipe(
        v.string(),
        v.description('Verbatim excerpt from that commit message / PR body / issue that states the reason'),
      ),
    }),
  ),
  v.check(
    (items) => items.every((i) => /^(commit [0-9a-f]{7,40}|PR #\d+|issue #\d+)$/.test(i.provenance)),
    'Re-run this phase and set every designRationale "provenance" to the history item you actually ' +
      'read it from, in one of exactly these forms: "commit <shortSha>", "PR #<n>", or "issue #<n>". ' +
      'A fact read from source or tests is not design rationale — drop it rather than citing a file ' +
      'path, and return an empty array if history says nothing about this type.',
  ),
  v.description(
    'Design rationale mined from commit messages, PR bodies and linked issues — WHY the type is ' +
      'shaped this way, its tradeoffs and rejected alternatives. Empty only if history genuinely ' +
      'says nothing about it; never invent an entry.',
  ),
);

// API-surface-shaped research, in contrast to the tutorial schema's narrative/pedagogical shape. A
// reference page is organized by the type's public API, so the researcher enumerates it exhaustively.
export const dataTypeResearchSchema = v.object({
  typeName: v.pipe(v.string(), v.description('The exact type name, e.g. "Chunk" or "NonEmptyChunk"')),
  signature: v.pipe(
    v.string(),
    v.description('The structural declaration: trait/class with type params, variance, extends clauses — no bodies'),
  ),
  role: v.pipe(v.string(), v.description('One or two sentences: what this type is and its core purpose')),
  typeParameters: v.array(
    v.object({ name: v.string(), meaning: v.pipe(v.string(), v.description('What this type parameter represents')) }),
  ),
  keyProperties: v.pipe(
    v.array(v.string()),
    v.description('Defining properties, e.g. "Immutable", "Lock-Free", "O(1) append" — empty if none notable'),
  ),
  constructors: v.array(
    v.pipe(
      v.object({
        name: v.pipe(v.string(), v.description('Companion factory / smart constructor, e.g. "Chunk.apply", "Chunk.empty"')),
        kind: v.pipe(
          v.picklist(['primary-constructor', 'companion-factory']),
          v.description(
            'How the value is really built: "primary-constructor" for a type (case class or plain ' +
              'class) built via its own primary constructor (no explicit apply in source), ' +
              '"companion-factory" for a real object-level method (apply/empty/from*) the source declares.',
          ),
        ),
        signature: v.pipe(
          v.string(),
          v.description(
            'The real declaration form: for primary-constructor, the verbatim class declaration ' +
              '("final case class T[..](params)", "class T(params)"); for companion-factory, the ' +
              'object method signature.',
          ),
        ),
        whenToUse: v.string(),
        source: sourceRef,
      }),
      // Deterministic guard: a primary constructor must be recorded as its real class declaration
      // (case class OR plain class — sql's DbCodecDeriver looped 6 times against the old
      // case-class-only regex), never a synthesized companion `def apply`. The Prism research
      // fabricated `def apply[...]: Prism` while correctly tagging kind=primary-constructor; a weak
      // model ignores the prose contract above, so reject it here — the rejection message is the
      // retry instruction the calling model reads, so it tells it what to emit instead.
      v.check(
        (c) =>
          c.kind !== 'primary-constructor' ||
          (/\bclass\b/.test(c.signature) && !/\bdef\s+apply\b/.test(c.signature)),
        'Re-run this phase and set every primary-constructor signature to the verbatim class ' +
          'declaration copied from the source file you read (e.g. "final case class T[..](params)" ' +
          'or "class T(params)") instead of a synthesized "def apply".',
      ),
    ),
  ),
  predefinedInstances: v.pipe(
    v.array(v.object({ name: v.string(), description: v.string(), source: sourceRef })),
    v.description('Predefined values like TypeId.int; empty if none'),
  ),
  coreOperations: v.array(
    v.object({
      name: v.pipe(v.string(), v.description('Method name, e.g. "map", "++", "head"')),
      category: v.pipe(v.string(), v.description('Grouping, e.g. "Transformations", "Combining", "Element Access"')),
      signature: v.string(),
      description: v.string(),
      exampleCode: v.pipe(v.string(), v.description('A short real usage snippet with its evaluated result')),
      caveats: v.nullable(v.pipe(v.string(), v.description('Important caveat/performance note, or null'))),
      source: sourceRef,
    }),
  ),
  subtypesOrVariants: v.pipe(
    v.array(v.object({ name: v.string(), relationship: v.string(), source: sourceRef })),
    v.description('Related subtypes like NonEmptyChunk for Chunk; empty if none'),
  ),
  comparisons: v.pipe(
    v.array(v.object({ vsType: v.string(), distinction: v.string() })),
    v.description('Analogues worth comparing (Java/Scala-stdlib/theory); empty if none'),
  ),
  imports: v.array(v.string()),
  sourceFiles: v.pipe(
    v.array(v.string()),
    v.description('Every repo-relative source file read during research (deduped); the paths cited in `source` fields.'),
  ),
  sbtDependency: v.string(),
  isTopLevelModuleType: v.pipe(
    v.boolean(),
    v.description('true if the type is a top-level module type warranting an Installation section'),
  ),
  scalaVersionNotes: v.nullable(v.pipe(v.string(), v.description('Any Scala 2 vs 3 differences, or null'))),
  designRationale,
  groundingDetail: v.pipe(
    v.string(),
    v.description(
      'Verbatim supporting detail — real signatures, scaladoc excerpts, snippets from ' +
        'source/tests/examples/GitHub history. The drafter grounds every fact in this; never let ' +
        'general knowledge substitute for what is stated here.',
    ),
  ),
});

// Module-shaped research: a module is several related types, so this enumerates the member types with
// a LIGHT per-type surface (enough to decide flat vs hierarchical and to write the module narrative)
// plus the module-level story — relationships, patterns, integration. Full per-type depth is only
// gathered later, per type, via research_data_type when the layout is hierarchical.
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
        'or depends on the others. Base this on a real multi-type TEST scenario — the sequence of calls a ' +
        'test makes across the types — not an invented flow.',
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
  designRationale,
  groundingDetail: v.pipe(
    v.string(),
    v.description(
      'Verbatim supporting detail — real signatures, scaladoc excerpts, snippets from ' +
        'source/tests/examples/commit and PR history. The drafter grounds every fact and relationship ' +
        'in this; never let general knowledge substitute for it.',
    ),
  ),
});

// Narrative/pedagogical research: a tutorial teaches one concept in a linear order, so this captures
// the learning path (prerequisites, hello-world, complexity layers, verifiable outputs) rather than an
// API surface.
export const tutorialResearchSchema = v.object({
  concept: v.pipe(v.string(), v.description('The ONE concept this tutorial should teach')),
  prerequisites: v.array(v.string()),
  postTutorialAbilities: v.pipe(
    v.array(v.string()),
    v.description('What the learner can do after this tutorial'),
  ),
  coreTypes: v.array(
    v.object({
      name: v.string(),
      role: v.pipe(v.string(), v.description('One sentence: what this type does and why it matters here')),
      source: sourceRef,
    }),
  ),
  compositionOrder: v.pipe(
    v.string(),
    v.description('The dependency/composition order concepts should be introduced in'),
  ),
  factoryMethods: v.pipe(
    v.array(v.string()),
    v.description('The factory methods/constructors the learner will actually use'),
  ),
  helloWorld: v.pipe(v.string(), v.description('The simplest possible starting example')),
  complexityLayers: v.pipe(
    v.array(v.string()),
    v.description('Incremental layers of complexity after the hello-world example'),
  ),
  verifiableOutputs: v.pipe(
    v.array(v.string()),
    v.description(
      'Verifiable outputs: points where printed or observed output lets the learner confirm the ' +
        'code behaved as claimed.',
    ),
  ),
  coreInsight: v.pipe(
    v.string(),
    v.description('The core insight: the single realization the whole tutorial drives the learner toward.'),
  ),
  imports: v.array(v.string()),
  sourceFiles: v.pipe(
    v.array(v.string()),
    v.description('Every repo-relative source file read during research (deduped); the paths cited in coreTypes `source`.'),
  ),
  sbtDependency: v.string(),
  scalaVersionNotes: v.nullable(
    v.pipe(v.string(), v.description('Any Scala 2 vs 3 differences, or null if none')),
  ),
  designRationale,
  groundingDetail: v.pipe(
    v.string(),
    v.description(
      'Verbatim supporting detail — real code snippets, exact method signatures, scaladoc excerpts, ' +
        'from source/tests/examples/GitHub history. The drafter grounds every fact in this; never let ' +
        'general knowledge substitute for what is stated here.',
    ),
  ),
});

/** The placeholder string a skipped phase fills its result with. */
const SKIPPED = '(skipped — phase already done)';

/**
 * Research one subject by delegating to the generic `researcher` subagent.
 *
 * The delegation is not incidental — see design-doc-plan.ts for why a phase must not do its own
 * work in the calling agent's conversation, and ../runtime/delegate.ts for how the role is selected now
 * that `harness.session()` is gone. The per-kind focus and result schema are supplied at the call site.
 *
 * Three behaviours live here rather than three times over:
 *  - **Skip.** A skipped head phase returns a marker-filled placeholder. Downstream consumers (design,
 *    write) are skipped in the same runs, so the placeholder only wires the phase chain together — it
 *    is never drafted from.
 *  - **Cache.** A hit still validates against the schema, so a cache written by an older schema is
 *    ignored rather than fed forward. `cacheTopic` is namespaced by document kind by its callers, so a
 *    module run and a data-type run for the same name cannot collide.
 *  - **Delegate.** One call, one label, one write-back of the result.
 */
async function researchSubject<S extends v.GenericSchema>(opts: {
  harness: FlueHarness;
  log: FlueLogger;
  /** Log/delegation label, e.g. 'researcher (module)'. */
  label: string;
  result: S;
  /** Returned verbatim when `skipPhases` includes research. */
  skipDefault: v.InferOutput<S>;
  /** Cache key, namespaced by document kind, e.g. `data-type-ref::Prism`. */
  cacheTopic: string;
  /** What the phase announces it is researching, e.g. 'data type: Prism'. */
  researching: string;
  /**
   * Called with whatever this phase returns, however it was obtained — fresh, from cache, or the skip
   * default. Only the data-type research sets it, to record the payload the write phase must draft
   * from; see research-ledger.ts.
   */
  onResult?: (research: v.InferOutput<S>) => void;
  /** The task lines; `authorHint()` is appended. */
  prompt: string[];
}): Promise<v.InferOutput<S>> {
  if (isPhaseSkipped('research')) {
    note(opts.log, 'Skipping research (skipPhases)');
    opts.onResult?.(opts.skipDefault);
    return opts.skipDefault;
  }

  const repoPath = getRepoPath();
  const cached = readResearchCache(repoPath, opts.cacheTopic);
  if (cached) {
    const parsed = v.safeParse(opts.result, cached);
    if (parsed.success) {
      note(opts.log, `Research cache hit for "${opts.cacheTopic}"`);
      opts.onResult?.(parsed.output);
      return parsed.output;
    }
  }

  note(opts.log, `Researching ${opts.researching}`);
  const research = await delegate({
    harness: opts.harness,
    log: opts.log,
    label: opts.label,
    role: 'researcher',
    result: opts.result,
    prompt: opts.prompt.join('\n') + authorHint(),
  });
  writeResearchCache(repoPath, opts.cacheTopic, research);
  opts.onResult?.(research);
  return research;
}

/**
 * Research a ZIO data type's full public API surface (constructors, operations, subtypes,
 * comparisons) for a reference page.
 */
export const researchDataType = defineTool({
  name: 'research_data_type',
  description:
    "Research a ZIO data type's full public API across source, tests, examples, and GitHub history; return structured findings.",
  harness: true,
  input: v.object({
    typeName: v.pipe(v.string(), v.description('The data type to document, e.g. "Chunk"')),
  }),
  output: dataTypeResearchSchema,
  async run({ harness, data, log }) {
    return {
      output: await researchSubject({
        harness,
        log,
        label: 'researcher (data type)',
        result: dataTypeResearchSchema,
        skipDefault: {
          typeName: data.typeName,
          signature: SKIPPED,
          role: SKIPPED,
          typeParameters: [],
          keyProperties: [],
          constructors: [],
          predefinedInstances: [],
          coreOperations: [],
          subtypesOrVariants: [],
          comparisons: [],
          imports: [],
          sourceFiles: [],
          sbtDependency: SKIPPED,
          isTopLevelModuleType: false,
          scalaVersionNotes: null,
          designRationale: [],
          groundingDetail: SKIPPED,
        },
        // Recorded so write_data_type_reference can draft from what research returned instead of from
        // what the model relays. A cache hit and a skipped phase both count as success: the first is
        // real research from an earlier run, the second an explicit human decision to resume.
        onResult: recordResearch,
        cacheTopic: `data-type-ref::${data.typeName}`,
        researching: `data type: ${data.typeName}`,
        prompt: [
          `Research the ZIO data type "${data.typeName}" in this library checkout so an API`,
          `reference page can be written accurately from real source, tests, and examples.`,
          `Enumerate the FULL public API: every companion constructor/factory, every public`,
          `method (with its real signature), predefined instances, subtypes, and worthwhile`,
          `comparisons. Reference pages must be exhaustive — do not omit operations.`,
          ``,
          `For every constructor, operation, subtype, and predefined instance, set its "source"`,
          `to the repo-relative location you actually read it from, as "path:L<start>-L<end>"`,
          `(e.g. "src/main/scala/optics/Prism.scala:L40-L41"). List every file you read in`,
          `"sourceFiles". Never guess a path or line — cite only a file you opened.`,
          ``,
          `Then mine the repo's history for WHY the type is shaped this way — run git_history on the`,
          `files you read, follow the PRs and issues those commits name, and record what you find in`,
          `"designRationale". Source and tests say what the type does; only history says what it was`,
          `weighed against. Return an empty array if history says nothing about this type.`,
        ],
      }),
    };
  },
});

/**
 * Research a ZIO module — a cohesive domain model of several related types — for a module reference
 * page. Discovers the member types (free-form scope: the caller gives only a module name) and the
 * module-level story (relationships, patterns, integration).
 */
export const researchModule = defineTool({
  name: 'research_module',
  description:
    "Research a ZIO module's member types and how they work together (relationships, patterns, integration) across source, tests, and examples; return structured findings.",
  harness: true,
  input: v.object({
    moduleName: v.pipe(v.string(), v.description('The module to document, e.g. "http-model"')),
  }),
  output: moduleResearchSchema,
  async run({ harness, data, log }) {
    return {
      output: await researchSubject({
        harness,
        log,
        label: 'researcher (module)',
        result: moduleResearchSchema,
        skipDefault: {
          moduleName: data.moduleName,
          purpose: SKIPPED,
          coreTypes: [],
          supportingTypes: [],
          types: [],
          relationships: SKIPPED,
          commonPatterns: [],
          integrationPoints: [],
          comparisons: [],
          imports: [],
          sbtDependency: SKIPPED,
          isTopLevelModule: false,
          sourceFiles: [],
          designRationale: [],
          groundingDetail: SKIPPED,
        },
        cacheTopic: `module-ref::${data.moduleName}`,
        researching: `module: ${data.moduleName}`,
        prompt: [
          `Research the ZIO module "${data.moduleName}" in this library checkout so a MODULE`,
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
          `"relationships". Find a test that exercises several of the module's types together and base the`,
          `workflow (and a candidate end-to-end usage recipe) on it; cite the test path in "groundingDetail".`,
          `Capture named module patterns and integration points too.`,
          ``,
          `For every type set its "source" to the repo-relative location you actually read it`,
          `from, as "path:L<start>-L<end>". List every file you read in "sourceFiles". Never`,
          `guess a path or line — cite only a file you opened.`,
          ``,
          `Then mine the repo's history for WHY the module is factored this way — run git_history on`,
          `the files you read, follow the PRs and issues those commits name, and record what you find`,
          `in "designRationale". Module-level rationale (why these types are separate, why one wraps`,
          `another) matters most here. Return an empty array if history says nothing about it.`,
        ],
      }),
    };
  },
});

/**
 * Research a ZIO topic's source, tests, examples, and GitHub history and return structured findings
 * for the design/write stages.
 */
export const researchTutorialTopic = defineTool({
  name: 'research_tutorial_topic',
  description:
    'Research a ZIO topic across source, tests, examples, and GitHub history; return structured findings.',
  harness: true,
  input: v.object({
    topic: v.string(),
  }),
  output: tutorialResearchSchema,
  async run({ harness, data, log }) {
    return {
      output: await researchSubject({
        harness,
        log,
        label: 'researcher (tutorial)',
        result: tutorialResearchSchema,
        skipDefault: {
          concept: SKIPPED,
          prerequisites: [],
          postTutorialAbilities: [],
          coreTypes: [],
          compositionOrder: SKIPPED,
          factoryMethods: [],
          helloWorld: SKIPPED,
          complexityLayers: [],
          verifiableOutputs: [],
          coreInsight: SKIPPED,
          imports: [],
          sourceFiles: [],
          sbtDependency: SKIPPED,
          scalaVersionNotes: null,
          designRationale: [],
          groundingDetail: SKIPPED,
        },
        // Unnamespaced, unlike the other two, because that is the key the existing tutorial caches
        // were written under. Nothing collides today (the other kinds' keys are prefixed), so
        // changing it would only invalidate working caches.
        cacheTopic: data.topic,
        researching: `tutorial topic: ${data.topic}`,
        prompt: [
          `Research "${data.topic}" in this ZIO library checkout so a tutorial can be written`,
          `accurately from real source, tests, and examples. For each core type, set its "source"`,
          `to the repo-relative location you actually read it from, as "path:L<start>-L<end>"`,
          `(e.g. "src/main/scala/optics/Lens.scala:L12-L20"), and list every file you read in`,
          `"sourceFiles". Never guess a path or line — cite only a file you opened.`,
          ``,
          `Then mine the repo's history for WHY the concept works this way — run git_history on the`,
          `files you read, follow the PRs and issues those commits name, and record what you find in`,
          `"designRationale". A tutorial's motivation and its gotchas both come from there. Return an`,
          `empty array if history says nothing about this topic.`,
        ],
      }),
    };
  },
});
