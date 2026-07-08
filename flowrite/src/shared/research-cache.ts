import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), '.cache', 'research');

/**
 * The HEAD of whatever git repo contains repoPath — its own dedicated repo,
 * or (e.g. the tinyoptics fixture) nested inside an enclosing one. Either way
 * this is a safe fingerprint: the cache key also includes repoPath itself, so
 * two different checkouts can never collide just because they happen to
 * share an enclosing repo's HEAD. Nested checkouts just get a coarser
 * fingerprint (invalidates on any commit anywhere in the outer repo, not
 * only to that subtree) — never an incorrect one. Returns null only when
 * repoPath isn't inside a git repo at all.
 */
export async function commitRevision(repoPath: string): Promise<string | null> {
  try {
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
