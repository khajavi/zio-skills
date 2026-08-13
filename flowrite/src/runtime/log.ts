import type { FlueLogger } from '@flue/runtime';

/**
 * Flowrite's own log lines, tagged so they can be told apart from the build's.
 *
 * A run log interleaves two unrelated sources that format themselves identically. Flue renders
 * `log.info(...)` as `[info] <message>`, and sbt renders its build chatter as `[info] <message>` too —
 * so the obvious `grep '\[info\]'` over a run log returns flowrite's phase timeline mixed with
 * "compiling 3 Scala sources". `[error]` is worse: sbt's compile errors arrive inside a verbose
 * tool-result line, so they are not even anchored to the start of a line.
 *
 * Anchoring the grep (`grep '^\[info\]'`) does separate them today — no archived run has sbt output at
 * a line start — but that holds only because the build's output always arrives embedded in a tool
 * result. It is a property of how the two happen to be interleaved, not a property either side
 * promises, and it silently stops working if a future adapter streams the build directly.
 *
 * So flowrite states which lines are its own. `grep 'flowrite:'` is then exact in both directions and
 * needs no anchor:
 *
 *   [info] flowrite: Researching data type: Iso        ← ours
 *   [info] compiling 3 Scala sources to target/...     ← sbt's
 *
 * `FlueLogger` has no prefix or child-logger facility — the interface is `info`/`warn`/`error` taking
 * a message and optional attributes — so the tag has to live in the message, which is why this is a
 * helper rather than configuration.
 *
 * Not used for the two lines that already identify themselves: `verbose-observer.ts` prefixes
 * `[verbose]`, and the end-of-run report is prefixed with the run label.
 */
export const LOG_TAG = 'flowrite';

/** Log one flowrite line at info level, tagged. */
export function note(log: FlueLogger, message: string): void {
  log.info(`${LOG_TAG}: ${message}`);
}
