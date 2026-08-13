import { sqlite } from '@flue/runtime/node';

/**
 * Where Flue stores flowrite's own conversations.
 *
 * Without this file, `flue run` writes to `node_modules/.cache/flue/run.db` (guide/database). That is
 * a cache directory: a `pnpm install --force`, a dependency bump, or any cleanup silently discards
 * every past run's conversation stream. This moves it somewhere a cleanup will not reach.
 *
 * The path is relative to the process working directory, which for every flowrite run is the flowrite
 * root — `fixtures/tinyoptics/scripts/run-*.sh` all `cd "$flowrite_root"` before exec'ing flue. The
 * adapter "creates the file (and any missing parent directories) on first boot and opens it in WAL
 * mode", so there is nothing to provision and no migration to run by hand.
 *
 * `sqlite()` adds no dependency: it runs on Node's built-in `node:sqlite`.
 *
 * This is NOT where the research cache lives, and the distinction is the whole reason that cache owns
 * its own database. A Flue database holds the runtime's own durable state — conversation streams,
 * accepted submissions, attachments — and the guide is explicit that it is "not your application's
 * business data". See src/runtime/research-cache.ts, which keeps one SQLite file per documented
 * checkout, keyed by topic.
 */
export default sqlite('./data/flue.db');
