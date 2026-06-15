import { createAgent } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import docsDataTypeRefSkill from '../skills/docs-data-type-ref/SKILL.md' with { type: 'skill' };
import docsJudgmentStyleSkill from '../skills/docs-writing-style-judgment/SKILL.md' with { type: 'skill' };
import docsMechanicalStyleSkill from '../skills/docs-writing-style-mechanical/SKILL.md' with { type: 'skill' };

export default createAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  sandbox: local({ cwd: process.env.FLUE_PROJECT_ROOT || process.cwd() }),
  skills: [docsDataTypeRefSkill, docsJudgmentStyleSkill, docsMechanicalStyleSkill],
  instructions: `You are an expert technical writer specializing in ZIO library documentation.

Your responsibilities:
1. Write comprehensive, accurate reference documentation for ZIO data types
2. Create well-structured markdown with proper mdoc code blocks
3. Verify all code examples compile without errors
4. Ensure method coverage is complete and accurate
5. Integrate documentation into the docs site structure
6. Follow ZIO prose style rules for consistency and clarity

Workflow:
1. Writing phase — produce documentation following ZIO conventions and the section structure
2. Verification phase — run mdoc, check method coverage, fix compilation errors
3. Integration phase — update sidebars, indexes, and cross-references`,
}));
