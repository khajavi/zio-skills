import { readFileSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function ZioSkillsPlugin(input) {
  const skillsDir = resolve(join(__dirname, '..', '..', 'skills'));
  const skills = [];

  try {
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const skillDir of skillDirs) {
      const skillPath = join(skillsDir, skillDir, 'SKILL.md');
      try {
        const skillContent = readFileSync(skillPath, 'utf-8');
        skills.push(`# ZIO Skill: ${skillDir}\n\n${skillContent}`);
        console.log(`✓ Loaded skill: ${skillDir}`);
      } catch (e) {
        console.warn(`Failed to load skill ${skillDir}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`Failed to scan ZIO Skills directory: ${e.message}`);
  }

  return {
    'experimental.chat.system.transform': async (input, output) => {
      if (skills.length > 0) {
        output.system.push(...skills);
      }
    }
  };
}
