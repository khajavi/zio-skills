import { type AgentRouteHandler } from '@flue/runtime';

import instructions from './data-type-ref-writer.md';
import { defineDocsWriter } from '../shared/docs-writer.ts';

// skills — the reference-page structure + checklist, plus mdoc conventions
// (writing-style comes from the profile). Same skills whose reference/*.md the
// actions inject into the drafter/reviewer at their call sites.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import dataTypeStructure from '../skills/data-type-ref-structure/SKILL.md';
import dataTypeChecklist from '../skills/data-type-ref-checklist/SKILL.md';

// actions
import { researchDataType } from '../actions/research-data-type.ts';
import { designDataTypeStructure } from '../actions/design-data-type-structure.ts';
import { writeDataTypeReference } from '../actions/write-data-type-reference.ts';
import { writeCompanionExamples } from '../actions/write-companion-examples.ts';
import { integrateDataTypeReference } from '../actions/integrate.ts';
import { reviewDataTypeRef } from '../actions/review-data-type-ref.ts';

export const description =
  'Writes exhaustive, compile-verified ZIO data type reference pages with full public-API coverage.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineDocsWriter({
  idLabel: 'data type',
  instructions,
  skills: [mdocConventions, dataTypeStructure, dataTypeChecklist],
  actions: [
    researchDataType,
    designDataTypeStructure,
    writeDataTypeReference,
    writeCompanionExamples,
    integrateDataTypeReference,
    reviewDataTypeRef,
  ],
});
