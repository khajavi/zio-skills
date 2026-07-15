import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// All flowrite-generated artifacts live under the checkout's `.flowrite/` dir
// (alongside `.flowrite/pre-review/`), so they stay together and out of the
// target repo's top level.
function cacheDir(repoPath: string): string {
  return path.join(repoPath, '.flowrite', 'cache', 'research');
}

// Keyed only on checkout path + topic — deliberately NOT on the commit
// revision. Same topic against the same checkout always reuses the cached
// research, across commits and source edits. It never auto-invalidates:
// `rm -rf <repo>/.flowrite/cache/research` to force a fresh re-research after
// the library's sources meaningfully change.
function cacheKey(repoPath: string, topic: string): string {
  return createHash('sha256').update(`${repoPath}::${topic}`).digest('hex');
}

export function readResearchCache(repoPath: string, topic: string): unknown | null {
  const file = path.join(cacheDir(repoPath), `${cacheKey(repoPath, topic)}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeResearchCache(repoPath: string, topic: string, data: unknown): void {
  const dir = cacheDir(repoPath);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${cacheKey(repoPath, topic)}.json`);
  writeFileSync(file, JSON.stringify(data));
}
