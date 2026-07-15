import { type AgentRouteHandler } from '@flue/runtime';

import instructions from './tutorial-writer.md' with { type: 'markdown' };
import { defineDocsWriter } from '../shared/docs-writer.ts';

// skills — writing-style comes from the profile.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };
import tutorialStructure from '../skills/tutorial-structure/SKILL.md' with { type: 'skill' };
import tutorialChecklist from '../skills/tutorial-checklist/SKILL.md' with { type: 'skill' };

// actions
import { researchTutorialTopic } from '../actions/research-tutorial-topic.ts';
import { designTutorialStructure } from '../actions/design-tutorial-structure.ts';
import { writeTutorialDraft } from '../actions/write-tutorial-draft.ts';
import { writeCompanionExamples } from '../actions/write-companion-examples.ts';
import { integrateTutorial } from '../actions/integrate.ts';
import { reviewTutorial } from '../actions/review-tutorial.ts';

export const description =
  'Writes learning-oriented ZIO library tutorials with compile-verified companion examples.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

export default defineDocsWriter({
  idLabel: 'tutorial',
  instructions,
  skills: [mdocConventions, tutorialStructure, tutorialChecklist],
  actions: [
    researchTutorialTopic,
    designTutorialStructure,
    writeTutorialDraft,
    writeCompanionExamples,
    integrateTutorial,
    reviewTutorial,
  ],
});
