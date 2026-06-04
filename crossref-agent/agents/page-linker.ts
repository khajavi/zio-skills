import { createAgent } from '@flue/runtime';
import pageLinkerSkill from '../skills/page-linker/SKILL.md' with { type: 'skill' };

export default createAgent(() => ({
  model: 'anthropic/claude-haiku-4-5',
  skills: [pageLinkerSkill],
}));
