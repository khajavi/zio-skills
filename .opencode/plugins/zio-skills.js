import { readFileSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function ZioSkillsPlugin(api) {
  const skillsDir = resolve(join(__dirname, '..', '..', 'skills'));

  try {
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const skillDir of skillDirs) {
      const skillPath = join(skillsDir, skillDir, 'SKILL.md');
      try {
        const skillContent = readFileSync(skillPath, 'utf-8');
        api.injectSystemPrompt(`\n\n# ZIO Skill: ${skillDir}\n\n${skillContent}`);
      } catch (e) {
        console.warn(`Failed to load skill ${skillDir}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`Failed to load ZIO Skills plugin: ${e.message}`);
  }
}
