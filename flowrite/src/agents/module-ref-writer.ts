import { type AgentRouteHandler } from '@flue/runtime';

import instructions from './module-ref-writer.md' with { type: 'markdown' };
import { defineDocsWriter } from '../shared/docs-writer.ts';

// skills — the module-reference structure + checklist, plus mdoc conventions
// (writing-style comes from the profile). Same skills whose reference/*.md the
// actions inject into the drafter/designer/reviewer at their call sites.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };
import moduleRefStructure from '../skills/module-ref-structure/SKILL.md' with { type: 'skill' };
import moduleRefChecklist from '../skills/module-ref-checklist/SKILL.md' with { type: 'skill' };

// actions — the module phases, plus the two reused data-type-ref actions that
// build each per-type subpage in the hierarchical layout.
import { researchModule } from '../actions/research-module.ts';
import { designModuleStructure } from '../actions/design-module-structure.ts';
import { writeModuleOverview } from '../actions/write-module-overview.ts';
import { researchDataType } from '../actions/research-data-type.ts';
import { writeDataTypeReference } from '../actions/write-data-type-reference.ts';
import { writeCompanionExamples } from '../actions/write-companion-examples.ts';
import { integrateModuleReference } from '../actions/integrate-module.ts';
import { reviewModuleRef } from '../actions/review-module-ref.ts';

export const description =
  'Writes ZIO module reference documentation — a module narrative (how the types work together) plus per-type coverage, flat or hierarchical.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineDocsWriter({
  idLabel: 'module',
  instructions,
  skills: [mdocConventions, moduleRefStructure, moduleRefChecklist],
  actions: [
    researchModule,
    designModuleStructure,
    writeModuleOverview,
    researchDataType,
    writeDataTypeReference,
    writeCompanionExamples,
    integrateModuleReference,
    reviewModuleRef,
  ],
});
