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
import { designTutorialStructure } from '../actions/design-tutorial-structure.ts';
import { writeTutorialDraft } from '../actions/write-tutorial-draft.ts';
import { reviewAgainstChecklist } from '../actions/review-against-checklist.ts';

// subagents (agent profiles)
import { tutorialResearcher } from '../profiles/tutorial-researcher.ts';
import { examplesBuilder } from '../profiles/examples-builder.ts';
import { docsIntegrator } from '../profiles/docs-integrator.ts';
// narrow, no-action profiles the design/write/review actions delegate to
// (prevents the self-recursion hazard of harness.session() on this same agent)
import { tutorialDesigner } from '../profiles/tutorial-designer.ts';
import { tutorialDrafter } from '../profiles/tutorial-drafter.ts';
import { tutorialReviewer } from '../profiles/tutorial-reviewer.ts';

// tools (bounded sbt/git contracts, bound to the instance's repo path)
import { createSbtTools } from '../tools/sbt-tools.ts';
import { TIERS } from '../shared/models.ts';

export const description =
  'Writes learning-oriented ZIO library tutorials with compile-verified companion examples.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineAgent(({ id }) => {
  // id = tutorial topic slug; it selects the checked-out library repo to work in.
  const cwd = process.env.REPO_PATH ?? `/srv/zio-repos/${id}`;

  return {
    profile: docsAuthorBase,
    thinkingLevel: TIERS.writer.thinkingLevel,
    instructions,
    sandbox: local(),
    cwd,
    skills: [mdocConventions, tutorialStructure, tutorialChecklist],
    actions: [designTutorialStructure, writeTutorialDraft, reviewAgainstChecklist],
    tools: createSbtTools(cwd),
    subagents: [
      tutorialResearcher,
      examplesBuilder,
      docsIntegrator,
      tutorialDesigner,
      tutorialDrafter,
      tutorialReviewer,
    ],
  };
});
