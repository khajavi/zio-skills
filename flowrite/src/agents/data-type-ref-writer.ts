'use agent';
import { type AgentProps, useInitialData } from '@flue/runtime';
import * as v from 'valibot';

import instructions from './data-type-ref-writer.md';
import { docsWriterDurability, docsWriterFields, useDocsWriter } from '../shared/docs-writer.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';

// skills — the reference-page structure + checklist, plus mdoc conventions
// (writing-style comes from the shared baseline). Same skills whose reference/*.md
// the phase tools inject into the drafter/reviewer at their delegation call sites.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import dataTypeStructure from '../skills/data-type-ref-structure/SKILL.md';
import dataTypeChecklist from '../skills/data-type-ref-checklist/SKILL.md';

// phase tools
import { researchDataType } from '../phases/research-data-type.ts';
import { designDataTypeStructure } from '../phases/design-data-type-structure.ts';
import { writeDataTypeReference } from '../phases/write-data-type-reference.ts';
import { writeCompanionExamples } from '../phases/write-companion-examples.ts';
import { integrateDataTypeReference } from '../phases/integrate.ts';
import { reviewDataTypeRef } from '../phases/review-data-type-ref.ts';

// FLUE_VERBOSE_TOOLS=1 opts into full tool/delegation/turn detail. Installed here
// because the agent module is the entry point now that workflows are gone.
installVerboseObserver();

const initialData = v.object({
  ...docsWriterFields,
  typeName: v.pipe(v.string(), v.description('The data type to document, e.g. "Chunk"')),
});

/**
 * Writes exhaustive, compile-verified ZIO data type reference pages with full
 * public-API coverage.
 *
 * Run it with:
 *   flue run src/agents/data-type-ref-writer.ts --id dtr-Chunk \
 *     -m "go" --data '{"projectPath":"/path/to/checkout","typeName":"Chunk"}'
 */
export function DataTypeRefWriter(props: AgentProps) {
  const facts = v.parse(initialData, useInitialData());
  return useDocsWriter(props, {
    idLabel: 'data type',
    label: 'write-data-type-ref',
    instructions,
    skills: [mdocConventions, dataTypeStructure, dataTypeChecklist],
    tools: [
      researchDataType,
      designDataTypeStructure,
      writeDataTypeReference,
      writeCompanionExamples,
      integrateDataTypeReference,
      reviewDataTypeRef,
    ],
    runDirective:
      `Write a complete, compile-verified data type reference page for: ${facts.typeName}. ` +
      `Run the full flow (research → design → write → examples → mdoc verify → integrate → ` +
      `review; review covers method coverage + writing style + the checklist).`,
  });
}

DataTypeRefWriter.initialData = initialData;
DataTypeRefWriter.durability = docsWriterDurability;
