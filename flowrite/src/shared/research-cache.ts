import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'research');

// Keyed only on checkout path + topic — deliberately NOT on the commit
// revision. Same topic against the same checkout always reuses the cached
// research, across commits and source edits. It never auto-invalidates:
// `rm -rf .cache/research` to force a fresh re-research after the library's
// sources meaningfully change.
function cacheKey(repoPath: string, topic: string): string {
  return createHash('sha256').update(`${repoPath}::${topic}`).digest('hex');
}

export function readResearchCache(repoPath: string, topic: string): unknown | null {
  const file = path.join(CACHE_DIR, `${cacheKey(repoPath, topic)}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeResearchCache(repoPath: string, topic: string, data: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${cacheKey(repoPath, topic)}.json`);
  writeFileSync(file, JSON.stringify(data));
}
