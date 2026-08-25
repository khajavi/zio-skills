import { createAgentRouter } from '@flue/runtime/routing';
import { DocsWriter } from './agent.ts';

/**
 * The route map.
 *
 * Flue mounts nothing on its own — "Registering an agent … makes it addressable inside your
 * application; serving it over HTTP is a separate, explicit decision" (guide/routing) — so this file
 * is what makes the writer reachable over HTTP.
 *
 * flowrite's own runs do not go through here. They are `flue run src/agent.ts`, which invokes the
 * agent directly and never reads this module. It exists so that `vite build` produces a server, and so
 * channels, schedules and the SDK have something to talk to when they are wanted.
 *
 * One route, mounted at the root, and now a deliberate choice rather than the only option: there are
 * two agents. `src/redundancy.ts` is registered by its own `'use agent'` directive and is left
 * UNMOUNTED — dispatch-only, in the guide's terms ("An agent that is registered but never mounted is
 * simply unreachable over HTTP — `dispatch(...)` and schedules can still drive it").
 *
 * Not an oversight, and not laziness about the two-line change:
 *
 *   - Mounting two agents needs a Hono instance with a `route(...)` each, and `hono` is not a
 *     dependency here — it reaches this repo only as @flue/runtime's peer. Adding it to package.json
 *     to expose an agent nobody calls over HTTP is a dependency bought for a comment.
 *   - Hand-rolling a `Fetchable` that dispatches by path prefix avoids the dependency and replaces
 *     it with untested routing code on the one path flowrite's own runs never take.
 *
 * `flue run src/redundancy.ts` reaches the editor directly, which is how it is actually used. When
 * something genuinely needs it over HTTP — a channel, a schedule, a webhook — add `hono` then and
 * mount both, as the routing guide's multi-agent example shows.
 */
export default createAgentRouter(DocsWriter);
