import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { readResearchCache, writeResearchCache } from '../shared/research-cache.ts';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { authorHint } from '../shared/author-hint.ts';
import { delegate } from '../shared/delegate.ts';

// Per-fact source provenance: the repo-relative file and line range the fact
// was actually read from, as "path:L<start>-L<end>" (e.g.
// "src/main/scala/optics/Prism.scala:L40-L41"). Verified downstream with a
// hybrid lookup — jump to the lines, and if the member (the fact's `name`)
// isn't there because source drifted, grep `def <name>` in the same file.
export const sourceRef = v.pipe(
  v.string(),
  v.description(
    'Repo-relative source location this fact was read from, as "path:L<start>-L<end>". ' +
      'Never guess a path or line — cite only a file you actually opened.',
  ),
);

// API-surface-shaped research, in contrast to research-tutorial-topic.ts's
// narrative/pedagogical schema. A reference page is organized by the type's
// public API, so the researcher enumerates it exhaustively.
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
      // Deterministic guard: a primary constructor must be recorded as its real class
      // declaration (case class OR plain class — sql's DbCodecDeriver looped 6 times
      // against the old case-class-only regex), never a synthesized companion
      // `def apply`. The Prism research fabricated `def apply[...]: Prism` while
      // correctly tagging kind=primary-constructor; a weak model ignores the prose
      // contract above, so reject it here — the rejection message is the retry
      // instruction the calling model reads, so it tells it what to emit instead.
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
  groundingDetail: v.pipe(
    v.string(),
    v.description(
      'Verbatim supporting detail — real signatures, scaladoc excerpts, snippets from ' +
        'source/tests/examples/GitHub history. The drafter grounds every fact in this; never let ' +
        'general knowledge substitute for what is stated here.',
    ),
  ),
});

/**
 * Research a ZIO data type's full public API surface (constructors, operations,
 * subtypes, comparisons) for a reference page. Delegates to the generic
 * `researcher` subagent, supplying the API-surface focus and result schema here.
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
    if (isPhaseSkipped('research')) {
      log.info('Skipping research (skipPhases)');
      const s = '(skipped — phase already done)';
      return {
        output: {
          typeName: data.typeName,
          signature: s,
          role: s,
          typeParameters: [],
          keyProperties: [],
          constructors: [],
          predefinedInstances: [],
          coreOperations: [],
          subtypesOrVariants: [],
          comparisons: [],
          imports: [],
          sourceFiles: [],
          sbtDependency: s,
          isTopLevelModuleType: false,
          scalaVersionNotes: null,
          groundingDetail: s,
        },
      };
    }

    const repoPath = process.env.REPO_PATH!;
    // Namespace the cache topic by document kind so a data-type-ref run and a
    // tutorial run for the same type name never collide (their schemas differ).
    const cacheTopic = `data-type-ref::${data.typeName}`;
    const cached = readResearchCache(repoPath, cacheTopic);
    if (cached) {
      const parsed = v.safeParse(dataTypeResearchSchema, cached);
      if (parsed.success) {
        log.info(`Research cache hit for "${cacheTopic}"`);
        return { output: parsed.output };
      }
    }

    log.info(`Researching data type: ${data.typeName}`);
    // Delegates to the generic researcher subagent rather than letting the
    // harness's own scratch conversation answer — see ../shared/delegate.ts for
    // how the role is selected now that harness.session() is gone.
    const research = await delegate({
      harness,
      log,
      label: 'researcher (data type)',
      role: 'researcher',
      result: dataTypeResearchSchema,
      prompt:
        [
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
        ].join('\n') + authorHint(),
    });
    writeResearchCache(repoPath, cacheTopic, research);
    return { output: research };
  },
});
