import { defineAgent, type AgentRouteHandler } from '@flue/runtime';
import { local } from '@flue/runtime/node';

import instructions from './tutorial-writer.md' with { type: 'markdown' };

// reusable baseline profile (supplies model + the writing-style skill)
import { docsAuthorBase } from '../profiles/docs-author-base.ts';

// skills — renamed, docs- prefix dropped (writing-style comes from the profile)
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };
import tutorialStructure from '../skills/tutorial-structure/SKILL.md' with { type: 'skill' };
import tutorialChecklist from '../skills/tutorial-checklist/SKILL.md' with { type: 'skill' };

// actions
import { researchTutorialTopic } from '../actions/research-tutorial-topic.ts';
import { designTutorialStructure } from '../actions/design-tutorial-structure.ts';
import { writeTutorialDraft } from '../actions/write-tutorial-draft.ts';
import { writeCompanionExamples } from '../actions/write-companion-examples.ts';
import { integrateTutorial } from '../actions/integrate-tutorial.ts';
import { reviewTutorial } from '../actions/review-tutorial.ts';

// subagents (agent profiles)
import { researcher } from '../profiles/researcher.ts';
import { examplesBuilder } from '../profiles/examples-builder.ts';
import { docsIntegrator } from '../profiles/docs-integrator.ts';
// narrow, no-action profiles the design/write/review actions delegate to
// (prevents the self-recursion hazard of harness.session() on this same agent).
// researcher/drafter/reviewer are the generic, document-kind-neutral role
// profiles shared with data-type-ref-writer; the tutorial focus/schema/checklist
// is supplied by the tutorial actions at the delegation call site.
import { designer } from '../profiles/designer.ts';
import { drafter } from '../profiles/drafter.ts';
import { reviewer } from '../profiles/reviewer.ts';
import { reviewResolver } from '../profiles/review-resolver.ts';
import { styleChecker } from '../profiles/style-checker.ts';
import { styleFixer } from '../profiles/style-fixer.ts';

import { createGhQueryTool } from '../tools/repo-tools.ts';
import { TIERS } from '../shared/models.ts';

export const description =
  'Writes learning-oriented ZIO library tutorials with compile-verified companion examples.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(({ id }) => {
  // id = tutorial topic slug, used only for logging; REPO_PATH must be set
  // before `flue run` starts — this agent's cwd is resolved once at init,
  // before workflow run() executes, so setting REPO_PATH inside run() is too late.
  const cwd = process.env.REPO_PATH;
  if (!cwd) {
    throw new Error(`REPO_PATH must be set before running (tutorial id: ${id})`);
  }

  return {
    profile: docsAuthorBase,
    thinkingLevel: TIERS.writer.thinkingLevel,
    instructions,
    sandbox: local(),
    cwd,
    skills: [mdocConventions, tutorialStructure, tutorialChecklist],
    actions: [
      researchTutorialTopic,
      designTutorialStructure,
      writeTutorialDraft,
      writeCompanionExamples,
      integrateTutorial,
      reviewTutorial,
    ],
    tools: [createGhQueryTool(cwd)],
    subagents: [
      researcher,
      examplesBuilder,
      docsIntegrator,
      designer,
      drafter,
      reviewer,
      reviewResolver,
      styleChecker,
      styleFixer,
    ],
  };
});
