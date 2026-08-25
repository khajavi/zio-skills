import type { ThinkingLevel } from '@flue/runtime';

/**
 * Central model + reasoning-effort selection, one place to edit. Each tier is
 * env-overridable per run without touching code, e.g.
 * `RESEARCHER_MODEL=openai/gpt-5.5 RESEARCHER_EFFORT=medium flue run ...`.
 */
interface Tier {
  model: string;
  thinkingLevel: ThinkingLevel;
}

const effort = (value: string | undefined, fallback: ThinkingLevel): ThinkingLevel =>
  (value as ThinkingLevel) ?? fallback;

export const TIERS: Record<
  | 'writer'
  | 'researcher'
  | 'examples'
  | 'integrator'
  | 'designer'
  | 'reviewer'
  | 'factChecker'
  | 'redundancyEditor',
  Tier
> = {
  writer: {
    model: process.env.WRITER_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.WRITER_EFFORT, 'high'),
  },
  researcher: {
    model: process.env.RESEARCHER_MODEL ?? 'anthropic/claude-haiku-4-5',
    thinkingLevel: effort(process.env.RESEARCHER_EFFORT, 'low'),
  },
  examples: {
    model: process.env.EXAMPLES_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.EXAMPLES_EFFORT, 'medium'),
  },
  integrator: {
    model: process.env.INTEGRATOR_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.INTEGRATOR_EFFORT, 'medium'),
  },
  designer: {
    model: process.env.DESIGNER_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.DESIGNER_EFFORT, 'medium'),
  },
  reviewer: {
    model: process.env.REVIEWER_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.REVIEWER_EFFORT, 'low'),
  },
  // Not the researcher's tier, though the work looks similar. Both read source, but a researcher's
  // miss is recoverable downstream — the drafter can still be corrected — while this role's answer
  // IS the gate: a fabricated drift fails a correct page, and a missed one passes a wrong page.
  // Haiku was the obvious cheap choice and is deliberately not the default, because the whole value
  // of the phase is that its evidence can be trusted without a second opinion.
  factChecker: {
    model: process.env.FACT_CHECKER_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.FACT_CHECKER_EFFORT, 'low'),
  },
  // writer-assistant ran this on Haiku, and the work looks cheap: find repetition, delete it. What
  // makes it not cheap is that every cut is a judgement about whether the words carry anything —
  // and unlike every other role here, this one EDITS a page that already passed review, with no
  // gate downstream to catch it. A wrong cut ships.
  redundancyEditor: {
    model: process.env.REDUNDANCY_EDITOR_MODEL ?? 'anthropic/claude-sonnet-4-6',
    thinkingLevel: effort(process.env.REDUNDANCY_EDITOR_EFFORT, 'low'),
  },
};
