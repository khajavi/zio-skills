import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface MdocError {
  file: string;
  line: number | null;
  message: string;
  raw: string;
}

export interface MdocRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Expand a path entry to a list of .md/.mdx files.
 * - If it's a file: return as-is (relative to projectRoot).
 * - If it's a directory: walk recursively, collect all .md/.mdx files.
 */
export function expandPath(absPath: string, projectRoot: string): string[] {
  const stat = fs.statSync(absPath);
  if (stat.isFile()) {
    return [path.relative(projectRoot, absPath)];
  }
  if (stat.isDirectory()) {
    const results: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
          results.push(path.relative(projectRoot, full));
        }
      }
    };
    walk(absPath);
    return results;
  }
  return [];
}

/**
 * Resolve and normalize path entries (string or string[]) into absolute paths,
 * then expand directories to collect all .md/.mdx files.
 */
export function resolvePaths(
  projectRoot: string,
  rawPaths?: string | string[]
): { resolvedPaths: string[]; missing: string[] } {
  const pathEntries: string[] = rawPaths ? (Array.isArray(rawPaths) ? rawPaths : [rawPaths]) : [];

  const resolvedPaths: string[] = [];
  const missing: string[] = [];

  for (const entry of pathEntries) {
    const abs = path.isAbsolute(entry) ? entry : path.join(projectRoot, entry);
    if (!fs.existsSync(abs)) {
      missing.push(entry);
      continue;
    }
    const expanded = expandPath(abs, projectRoot);
    resolvedPaths.push(...expanded);
  }

  return { resolvedPaths, missing };
}

export function buildMdocCommand(resolvedPaths: string[]): string {
  if (resolvedPaths.length === 0) {
    return 'sbt docs/mdoc';
  }
  const pairs = resolvedPaths.map((p) => `--in ${p} --out ${p.replace(/^/, 'website/')}`).join(' ');
  return `sbt "docs/mdoc ${pairs}"`;
}

/**
 * Execute an mdoc command and capture stdout/stderr/exitCode.
 */
export function runMdocCommand(command: string, projectRoot: string): MdocRunResult {
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    exitCode = error.status || 1;
    stdout = error.stdout ? String(error.stdout) : '';
    stderr = error.stderr ? String(error.stderr) : '';
  }

  return { stdout, stderr, exitCode };
}

/**
 * Parse mdoc error output and extract structured error messages.
 * Returns array of errors with file, line, message.
 */
export function parseMdocErrors(output: string): MdocError[] {
  const errors: MdocError[] = [];
  const lines = output.split('\n');

  for (const raw of lines) {
    if (!raw.includes('[error]')) continue;

    // Pattern: [error] path/to/file.md:42 message
    const fileLineMatch = raw.match(/\[error\]\s+(.+?\.mdx?):(\d+)\s+(.*)/);
    if (fileLineMatch) {
      errors.push({
        file: fileLineMatch[1],
        line: parseInt(fileLineMatch[2], 10),
        message: fileLineMatch[3].trim(),
        raw: raw.trim(),
      });
      continue;
    }

    // Pattern: [error] message (no file:line)
    const plainMatch = raw.match(/\[error\]\s+(.*)/);
    if (plainMatch) {
      errors.push({
        file: '',
        line: null,
        message: plainMatch[1].trim(),
        raw: raw.trim(),
      });
    }
  }

  return errors.slice(0, 50); // cap to avoid bloat
}
