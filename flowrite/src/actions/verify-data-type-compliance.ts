import { defineAction } from '@flue/runtime';
import * as v from 'valibot';
import { isPhaseSkipped } from '../shared/skip-phases.ts';
import { withTransientRetry } from '../shared/style-loop.ts';
// Structural template, injected so the reviewer checks the page against it.
import dataTypeStructureDoc from '../skills/data-type-ref-structure/references/structure.md' with { type: 'markdown' };

const complianceSchema = v.object({
  compliant: v.pipe(v.boolean(), v.description('true only when the page conforms structurally to the template')),
  problems: v.pipe(
    v.array(v.string()),
    v.description('Specific structural problems: missing/misordered sections, opening definition with a heading, etc.'),
  ),
});

/**
 * Early structural gate: confirm the drafted reference page conforms to the
 * data-type-ref template (all required sections present and ordered, opening
 * definition unheaded) BEFORE the expensive method-coverage and mdoc steps.
 * Reuses the generic `reviewer` subagent with a structure-only prompt — a
 * distinct phase from review_data_type_ref (which runs the full content
 * checklist + style loop at the end).
 */
export const verifyDataTypeCompliance = defineAction({
  name: 'verify_data_type_compliance',
  description: 'Check a drafted reference page conforms to the data-type-ref structural template (sections present and ordered).',
  input: v.object({
    path: v.pipe(v.string(), v.description('Path to the reference markdown, e.g. docs/reference/chunk.md')),
  }),
  output: complianceSchema,
  async run({ harness, input, log }) {
    if (isPhaseSkipped('verify-compliance')) {
      log.info('Skipping compliance check (skipPhases)');
      return { compliant: true, problems: [] };
    }

    log.info(`Checking structural compliance: ${input.path}`);
    const content = await harness.fs.readFile(input.path);

    const session = await harness.session();
    // Delegates to the generic reviewer subagent — see design-tutorial-structure.ts
    // for why bare harness.session() on the calling agent is unsafe here.
    const { data } = await withTransientRetry(log, 'reviewer', () =>
      session.task(
        [
          `Check ONLY the structural conformance of the reference page below against this template.`,
          `Do not judge prose quality or API coverage — only: are all required sections present, in`,
          `template order, and does the opening definition appear with NO heading?`,
          ``,
          dataTypeStructureDoc,
          ``,
          `--- REFERENCE PAGE (${input.path}) ---`,
          content,
        ].join('\n'),
        { agent: 'reviewer', result: complianceSchema },
      ),
    );
    return data;
  },
});
