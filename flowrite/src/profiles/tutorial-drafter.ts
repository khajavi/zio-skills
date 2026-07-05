import { defineAgentProfile } from '@flue/runtime';
import writingStyle from '../skills/writing-style/SKILL.md' with { type: 'skill' };
import mdocConventions from '../skills/mdoc-conventions/SKILL.md' with { type: 'skill' };

/**
 * Narrow, single-purpose profile for `write_tutorial_draft`. No actions/subagents
 * of its own — see tutorial-designer.ts for why that matters.
 */
export const tutorialDrafter = defineAgentProfile({
  name: 'tutorial_drafter',
  description: 'Writes a complete learning-oriented tutorial as Docusaurus markdown from a section plan.',
  skills: [writingStyle, mdocConventions],
  instructions: [
    'You write complete learning-oriented tutorials as Docusaurus markdown from a given section plan.',
    'Load and follow the writing-style skill (prose, Scala 2.13 default, @VERSION@)',
    'and the mdoc-conventions skill (mdoc modifiers, admonitions).',
    'You will receive both a section plan and the full research findings. The plan',
    'tells you WHAT to cover; the research answers tell you the REAL facts (imports,',
    'signatures, method names, working examples) to write it with. Never fall back on',
    'general Scala/ZIO/library knowledge when the research answers already state the',
    'real fact — copy it exactly.',
    'Rules: one concept per section; explain the concept before its code;',
    'annotate every code block line-by-line; show intermediate output; warm tone;',
    'never branch. End with "What You\'ve Learned" and "Where to Go Next".',
    'content is the raw file, not a chat reply: starts with \'---\', no preamble, no surrounding fence.',
  ].join('\n'),
});
