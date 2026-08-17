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
 * Runtime state only. A Flue database holds conversation streams, accepted submissions and
 * attachments, and the guide is explicit that it is "not your application's business data" — so nothing
 * flowrite produces belongs here. Research findings are plain markdown under `.flowrite/research/`,
 * which also makes them readable by a human debugging a bad page.
 */
export default sqlite('./data/flue.db');
