#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(join(__dirname, '..'));
const skillsDir = join(repoRoot, 'skills');
const nodeModulesDir = join(repoRoot, 'node_modules');

async function extractSkills() {
  try {
    console.log('🔍 Extracting skills from npm packages...\n');

    // Find all SKILL.md files in @zio.dev/* packages
    const skillFiles = globSync(join(nodeModulesDir, '@zio.dev', '*', 'skills', '**', 'SKILL.md'));

    if (skillFiles.length === 0) {
      console.log('⚠️  No skills found in node_modules/@zio.dev/*/skills/');
      return;
    }

    const extracted = [];
    const updated = [];

    // Mirror directory structure
    for (const skillFile of skillFiles) {
      const relativePath = skillFile.replace(join(nodeModulesDir, '@zio.dev', '*', 'skills', '') + '/', '');
      const targetPath = join(skillsDir, relativePath);
      const targetDir = dirname(targetPath);

      await fs.mkdir(targetDir, { recursive: true });
      const content = await fs.readFile(skillFile, 'utf-8');
      const targetExists = await fs.stat(targetPath).catch(() => null);

      if (targetExists) {
        const existingContent = await fs.readFile(targetPath, 'utf-8');
        if (existingContent !== content) {
          await fs.writeFile(targetPath, content);
          updated.push(relativePath);
        }
      } else {
        await fs.writeFile(targetPath, content);
        extracted.push(relativePath);
      }
    }

    // Find skills in skills/ that are no longer in any package
    const currentSkillFiles = globSync(join(skillsDir, '**', 'SKILL.md'));
    const currentRelativePaths = currentSkillFiles.map(f =>
      f.replace(skillsDir + '/', '')
    );
    const removedSkills = [];

    for (const skillPath of currentRelativePaths) {
      const sourceExists = skillFiles.some(f => f.endsWith(skillPath));
      if (!sourceExists) {
        // Only remove if it's not a manually-created skill (check if it has @zio.dev prefix)
        if (!skillPath.startsWith('zio-') || skillPath.startsWith('zio-http-')) {
          await fs.unlink(join(skillsDir, skillPath));
          await fs.rmdir(dirname(join(skillsDir, skillPath)), { recursive: true }).catch(() => null);
          removedSkills.push(skillPath);
        }
      }
    }

    // Print summary
    console.log('\n📊 Summary:');
    if (extracted.length > 0) {
      console.log(`  ✅ Added: ${extracted.length}`);
      extracted.forEach(f => console.log(`     - ${f}`));
    }
    if (updated.length > 0) {
      console.log(`  🔄 Updated: ${updated.length}`);
      updated.forEach(f => console.log(`     - ${f}`));
    }
    if (removedSkills.length > 0) {
      console.log(`  🗑️  Removed: ${removedSkills.length}`);
      removedSkills.forEach(f => console.log(`     - ${f}`));
    }
    if (extracted.length === 0 && updated.length === 0 && removedSkills.length === 0) {
      console.log('  ℹ️  No changes needed — skills are in sync');
    }

    console.log(`\n✨ Total skills available: ${currentRelativePaths.length}`);
  } catch (e) {
    console.error(`❌ Error extracting skills: ${e.message}`);
    process.exit(1);
  }
}

extractSkills();
