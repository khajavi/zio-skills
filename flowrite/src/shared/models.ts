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

export const TIERS: Record<'writer' | 'researcher' | 'examples' | 'integrator', Tier> = {
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
};
