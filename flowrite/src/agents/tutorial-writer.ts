'use agent';
import { type AgentProps, useInitialData } from '@flue/runtime';
import * as v from 'valibot';

import instructions from './tutorial-writer.md';
import { docsWriterFields, useDocsWriter } from '../shared/docs-writer.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';

// skills — writing-style comes from the shared baseline.
import mdocConventions from '../skills/mdoc-conventions/SKILL.md';
import tutorialStructure from '../skills/tutorial-structure/SKILL.md';
import tutorialChecklist from '../skills/tutorial-checklist/SKILL.md';

// phase tools
import { researchTutorialTopic } from '../phases/research-tutorial-topic.ts';
import { designTutorialStructure } from '../phases/design-tutorial-structure.ts';
import { writeTutorialDraft } from '../phases/write-tutorial-draft.ts';
import { writeCompanionExamples } from '../phases/write-companion-examples.ts';
import { integrateTutorial } from '../phases/integrate.ts';
import { reviewTutorial } from '../phases/review-tutorial.ts';

// FLUE_VERBOSE_TOOLS=1 opts into full tool/delegation/turn detail. Installed here
// because the agent module is the entry point now that workflows are gone.
installVerboseObserver();

const initialData = v.object({
  ...docsWriterFields,
  topic: v.pipe(v.string(), v.description('Tutorial title or topic description')),
});

/**
 * Writes learning-oriented ZIO library tutorials with compile-verified companion
 * examples.
 *
 * Run it with:
 *   flue run src/agents/tutorial-writer.ts --id tut-streams \
 *     -m "go" --data '{"projectPath":"/path/to/checkout","topic":"Streaming basics"}'
 */
export function TutorialWriter(props: AgentProps) {
  const facts = v.parse(initialData, useInitialData());
  return useDocsWriter(props, {
    idLabel: 'tutorial',
    label: 'write-tutorial',
    instructions,
    skills: [mdocConventions, tutorialStructure, tutorialChecklist],
    tools: [
      researchTutorialTopic,
      designTutorialStructure,
      writeTutorialDraft,
      writeCompanionExamples,
      integrateTutorial,
      reviewTutorial,
    ],
    runDirective:
      `Write a complete, compile-verified tutorial for: ${facts.topic}. ` +
      `Run the full flow (research → design → write → examples → mdoc verify → integrate → review).`,
  });
}

TutorialWriter.initialData = initialData;
