import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), '.cache', 'research');

/**
 * The checkout's current commit, only if it's an independent git repo (not
 * nested inside another one without its own .git — the tinyoptics fixture is
 * exactly this case). Returns null when there's nothing safe to key a cache
 * on, so the caller skips caching rather than guessing.
 */
export async function commitRevision(repoPath: string): Promise<string | null> {
  try {
    const { stdout: toplevel } = await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--show-toplevel']);
    if (path.resolve(toplevel.trim()) !== path.resolve(repoPath)) return null;
    const { stdout: head } = await execFileAsync('git', ['-C', repoPath, 'rev-parse', 'HEAD']);
    return head.trim();
  } catch {
    return null;
  }
}

function cacheKey(repoPath: string, topic: string, revision: string): string {
  return createHash('sha256').update(`${repoPath}::${topic}::${revision}`).digest('hex');
}

export function readResearchCache(repoPath: string, topic: string, revision: string): unknown | null {
  const file = path.join(CACHE_DIR, `${cacheKey(repoPath, topic, revision)}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeResearchCache(repoPath: string, topic: string, revision: string, data: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${cacheKey(repoPath, topic, revision)}.json`);
  writeFileSync(file, JSON.stringify(data));
}
