/**
 * ZIO Skills plugin for OpenCode.ai
 *
 * Registers the ZIO skills directory via config hook so OpenCode can discover
 * and install skills automatically (just like superpowers plugin does).
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ZioSkillsPlugin = async () => {
  const skillsDir = path.resolve(path.join(__dirname, '..', '..', 'skills'));

  return {
    // Register skills path so OpenCode discovers and installs ZIO skills
    // This works because Config.get() returns a cached singleton — modifications
    // here are visible when skills are lazily discovered later.
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
        console.log(`✓ Registered ZIO skills directory: ${skillsDir}`);
      }
    }
  };
};

export default ZioSkillsPlugin;
