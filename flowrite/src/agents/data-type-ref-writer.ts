import { defineAgent, type AgentRouteHandler } from '@flue/runtime';
import { local } from '@flue/runtime/node';

import instructions from './data-type-ref-writer.md' with { type: 'markdown' };

// reusable baseline profile (supplies model + the writing-style skill)
import { docsAuthorBase } from '../profiles/docs-author-base.ts';

// skills — the reference-page structure + checklist, plus mdoc conventions
// (writing-style comes from the profile). Same skills whose reference/*.md the
// actions inject into the drafter/reviewer at their call sites.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };
import dataTypeStructure from '../skills/data-type-ref-structure/SKILL.md' with { type: 'skill' };
import dataTypeChecklist from '../skills/data-type-ref-checklist/SKILL.md' with { type: 'skill' };

// actions
import { researchDataType } from '../actions/research-data-type.ts';
import { designDataTypeStructure } from '../actions/design-data-type-structure.ts';
import { writeDataTypeReference } from '../actions/write-data-type-reference.ts';
import { writeCompanionExamples } from '../actions/write-companion-examples.ts';
import { integrateDataTypeReference } from '../actions/integrate.ts';
import { reviewDataTypeRef } from '../actions/review-data-type-ref.ts';

// subagents (agent profiles) — the generic, document-kind-neutral role profiles
// shared with tutorial-writer; the reference-page focus/schema/checklist is
// supplied by this agent's actions at each delegation call site.
import { researcher } from '../profiles/researcher.ts';
import { designer } from '../profiles/designer.ts';
import { drafter } from '../profiles/drafter.ts';
import { reviewer } from '../profiles/reviewer.ts';
import { examplesBuilder } from '../profiles/examples-builder.ts';
import { docsIntegrator } from '../profiles/docs-integrator.ts';
import { reviewResolver } from '../profiles/review-resolver.ts';
import { styleChecker } from '../profiles/style-checker.ts';
import { styleFixer } from '../profiles/style-fixer.ts';

import { createGhQueryTool } from '../tools/repo-tools.ts';
import { TIERS } from '../shared/models.ts';

export const description =
  'Writes exhaustive, compile-verified ZIO data type reference pages with full public-API coverage.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(({ id }) => {
  // id = type name slug, used only for logging; REPO_PATH must be set before
  // `flue run` starts — this agent's cwd is resolved once at init, before
  // workflow run() executes, so setting REPO_PATH inside run() is too late.
  const cwd = process.env.REPO_PATH;
  if (!cwd) {
    throw new Error(`REPO_PATH must be set before running (data type id: ${id})`);
  }

  return {
    profile: docsAuthorBase,
    thinkingLevel: TIERS.writer.thinkingLevel,
    instructions,
    sandbox: local(),
    cwd,
    skills: [mdocConventions, dataTypeStructure, dataTypeChecklist],
    actions: [
      researchDataType,
      designDataTypeStructure,
      writeDataTypeReference,
      writeCompanionExamples,
      integrateDataTypeReference,
      reviewDataTypeRef,
    ],
    tools: [createGhQueryTool(cwd)],
    subagents: [
      researcher,
      designer,
      drafter,
      reviewer,
      examplesBuilder,
      docsIntegrator,
      reviewResolver,
      styleChecker,
      styleFixer,
    ],
  };
});
