'use agent';
import { type AgentProps, useInitialData } from '@flue/runtime';
import * as v from 'valibot';

import instructions from './module-ref-writer.md';
import { docsWriterFields, useDocsWriter } from '../shared/docs-writer.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';

// skills — the module-reference structure + checklist, plus mdoc conventions
// (writing-style comes from the shared baseline). Same skills whose reference/*.md
// the phase tools inject into the drafter/designer/reviewer at their call sites.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import moduleRefStructure from '../skills/module-ref-structure/SKILL.md';
import moduleRefChecklist from '../skills/module-ref-checklist/SKILL.md';

// phase tools — the module phases, plus the two reused data-type-ref tools that
// build each per-type subpage in the hierarchical layout.
import { researchModule } from '../phases/research-module.ts';
import { designModuleStructure } from '../phases/design-module-structure.ts';
import { writeModuleOverview } from '../phases/write-module-overview.ts';
import { researchDataType } from '../phases/research-data-type.ts';
import { writeDataTypeReference } from '../phases/write-data-type-reference.ts';
import { writeCompanionExamples } from '../phases/write-companion-examples.ts';
import { integrateModuleReference } from '../phases/integrate-module.ts';
import { reviewModuleRef } from '../phases/review-module-ref.ts';

// FLUE_VERBOSE_TOOLS=1 opts into full tool/delegation/turn detail. Installed here
// because the agent module is the entry point now that workflows are gone.
installVerboseObserver();

const initialData = v.object({
  ...docsWriterFields,
  moduleName: v.pipe(v.string(), v.description('The module to document, e.g. "http-model" or "resource-management"')),
  layout: v.pipe(
    v.optional(v.picklist(['flat', 'hierarchical'])),
    v.description('Force the page layout; omit to let the design phase decide via the auto-rule.'),
  ),
  shapeOverride: v.pipe(
    v.optional(v.picklist(['single-core', 'core-family', 'multi-domain', 'dsl'])),
    v.description(
      'Force the module shape instead of letting the design phase classify. ' +
        'single-core = one dominant core type (flat); core-family = several co-equal core types, one domain (hierarchical); ' +
        'multi-domain = core types across ≥2 sub-domains (hierarchical + nesting); dsl = no dominant core, co-equal types combined (one task-organized page). ' +
        'Wins over `layout`.',
    ),
  ),
});

/**
 * Writes ZIO module reference documentation — a module narrative (how the types
 * work together) plus per-type coverage, flat or hierarchical.
 *
 * Run it with:
 *   flue run src/agents/module-ref-writer.ts --id mod-http-model \
 *     -m "go" --data '{"projectPath":"/path/to/checkout","moduleName":"http-model"}'
 */
export function ModuleRefWriter(props: AgentProps) {
  const facts = v.parse(initialData, useInitialData());
  return useDocsWriter(props, {
    idLabel: 'module',
    instructions,
    skills: [mdocConventions, moduleRefStructure, moduleRefChecklist],
    tools: [
      researchModule,
      designModuleStructure,
      writeModuleOverview,
      researchDataType,
      writeDataTypeReference,
      writeCompanionExamples,
      integrateModuleReference,
      reviewModuleRef,
    ],
    runDirective:
      `Write a complete, compile-verified module reference for the module: ${facts.moduleName}. ` +
      (facts.shapeOverride
        ? `Classify this module as the "${facts.shapeOverride}" shape (pass it as shapeOverride to design). `
        : '') +
      (facts.layout ? `Use the "${facts.layout}" layout (pass it as layoutOverride to design). ` : '') +
      `Run the full flow (research → design → write module page → per-type subpages if hierarchical → ` +
      `examples → mdoc verify → integrate → review; review covers per-type method coverage + writing ` +
      `style + the module checklist).`,
  });
}

ModuleRefWriter.initialData = initialData;
