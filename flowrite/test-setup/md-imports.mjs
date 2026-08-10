// Lets `node --test` import the `.md` files the agents import.
//
// Flue's build transform resolves markdown imports in-process when you run `flue run`, so plain
// Node knows nothing about them and throws ERR_UNKNOWN_FILE_EXTENSION. Without this, no test can
// even load src/agents/docs-writer.ts, because the KINDS table imports three instruction files and
// seven SKILL.md files at module scope.
//
// It reproduces the two documented cases (guide/skills.md:62-64):
//   - `<dir>/SKILL.md` → a SkillReference, with `name`/`description` from the frontmatter
//   - any other `.md`  → the file's text as a default-exported string
//
// This is a test-only stand-in, deliberately minimal: it validates nothing and packages nothing.
// Tests that depend on more than a skill's name or a string's length do not belong here — run the
// real thing under `flue run` instead.
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

/** Pull `name:` and `description:` out of leading YAML frontmatter. Flat keys only. */
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.md')) return nextLoad(url, context);

    const text = readFileSync(fileURLToPath(url), 'utf8');

    if (url.endsWith('/SKILL.md')) {
      const { name, description } = frontmatter(text);
      const reference = { __flueSkillReference: true, id: name, name, description };
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(reference)};`,
      };
    }

    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(text)};`,
    };
  },
});
