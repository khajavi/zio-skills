import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';
import instructions from './style-fixer.md' with { type: 'markdown' };

/**
 * Narrow, single-purpose profile for the fixing pass in `fix_writing_style`.
 * The todo tools it works through are supplied per-operation by the action,
 * not registered here, so they exist only during that delegated task.
 */
export const styleFixer = defineAgentProfile({
  name: 'style_fixer',
  ...TIERS.writer,
  description: 'Fixes listed writing style violations in a documentation page, one todo task at a time.',
  instructions,
});
