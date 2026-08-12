import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * The research cache: one SQLite file per documented checkout.
 *
 * SQLite rather than Flue's `db.ts`, deliberately. Flue's database stores the runtime's own durable
 * state — conversation streams, accepted submissions, attachments — and its guide is explicit that it
 * is "not your application's business data"; the adapter contract exposes exactly three stores
 * (`ConversationStreamStore`, `AgentSubmissionStore`, `AttachmentStore`) and no general key-value
 * space. Writing research results into those tables would mean writing into a schema that stamps a
 * format version and refuses to start when it does not match. `usePersistentState` is the other
 * durable channel and does not fit either: it is a hook, so it is unreachable from a phase tool's
 * body, and it is scoped to one conversation while this cache must outlive every run.
 *
 * So this owns its own database, using `node:sqlite` — the same engine Flue's built-in `sqlite()`
 * adapter runs on, and part of Node, so it costs no dependency. What it buys over the directory of
 * hash-named JSON files it replaces: one file instead of one per topic, a real key rather than a
 * sha256 of the path plus the topic, an atomic upsert instead of a truncate-and-rewrite, and a cache
 * whose contents can be listed and read by a human debugging a suspicious hit.
 */

/** All flowrite artifacts live under the checkout's `.flowrite/`, so they stay out of its top level. */
const dbPath = (repoPath: string) => path.join(repoPath, '.flowrite', 'cache', 'research.db');

/**
 * Open handles, one per checkout.
 *
 * A module-level map for the same reason `run-context.ts` holds a module-level slot: one OS process
 * per run (each `run-*.sh` execs a fresh node), so there is nothing to reset between runs and no
 * second run to collide with. A long-lived server would want these closed on a per-run boundary.
 */
const open = new Map<string, DatabaseSync>();

function connect(repoPath: string): DatabaseSync {
  const file = dbPath(repoPath);
  const existing = open.get(file);
  if (existing) return existing;

  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // WAL for the same reason Flue's adapter opens its own database that way: a reader is never
  // blocked by the writer, which matters here because a hierarchical module run researches one type
  // while the page for the previous one is still being written.
  db.exec('PRAGMA journal_mode = WAL');
  // `topic` is the whole key: the file already belongs to one checkout, so the old sha256 of
  // `<repoPath>::<topic>` was hashing a constant into every key. Callers namespace the topic by
  // document kind (`data-type-ref::Prism`), which is what keeps two kinds' differing schemas apart.
  db.exec(`
    CREATE TABLE IF NOT EXISTS research (
      topic TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      written_at INTEGER NOT NULL
    ) STRICT
  `);
  open.set(file, db);
  return db;
}

/**
 * The JSON file the previous cache would have written for this topic.
 *
 * Its name is the sha256 the old code used, so a legacy entry is still findable — which matters
 * because those filenames carry no topic, making a bulk migration impossible. Entries move over one
 * at a time, on the first read that wants them.
 */
function legacyFile(repoPath: string, topic: string): string {
  const key = createHash('sha256').update(`${repoPath}::${topic}`).digest('hex');
  return path.join(repoPath, '.flowrite', 'cache', 'research', `${key}.json`);
}

/**
 * The cached research for a topic, or null.
 *
 * Keyed on checkout plus topic and deliberately NOT on the commit revision: the same topic against
 * the same checkout always reuses the cached research, across commits and source edits. It never
 * auto-invalidates — delete `<repo>/.flowrite/cache/research.db` to force a fresh re-research after
 * the library's sources meaningfully change.
 */
export function readResearchCache(repoPath: string, topic: string): unknown | null {
  const row = connect(repoPath).prepare('SELECT payload FROM research WHERE topic = ?').get(topic) as
    | { payload: string }
    | undefined;
  if (row) {
    try {
      return JSON.parse(row.payload);
    } catch {
      return null;
    }
  }

  // Fall back to the pre-SQLite entry and carry it over, so switching stores does not silently throw
  // away research that has already been paid for.
  const legacy = legacyFile(repoPath, topic);
  if (!existsSync(legacy)) return null;
  try {
    const data = JSON.parse(readFileSync(legacy, 'utf8'));
    writeResearchCache(repoPath, topic, data);
    rmSync(legacy, { force: true });
    return data;
  } catch {
    return null;
  }
}

/** Store a topic's research, replacing any earlier entry for it. */
export function writeResearchCache(repoPath: string, topic: string, data: unknown): void {
  connect(repoPath)
    .prepare(
      `INSERT INTO research (topic, payload, written_at) VALUES (?, ?, ?)
       ON CONFLICT(topic) DO UPDATE SET payload = excluded.payload, written_at = excluded.written_at`,
    )
    .run(topic, JSON.stringify(data), Date.now());
}

/** Every cached topic, newest first. For inspecting a cache, not used by the pipeline. */
export function listResearchCache(repoPath: string): { topic: string; writtenAt: number }[] {
  const rows = connect(repoPath)
    .prepare('SELECT topic, written_at FROM research ORDER BY written_at DESC')
    .all() as { topic: string; written_at: number }[];
  return rows.map((r) => ({ topic: r.topic, writtenAt: r.written_at }));
}
