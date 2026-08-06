# ZIO Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `newsletter` Flue workflow that gathers the last seven days of ZIO ecosystem activity through deterministic collectors and has a single `newsletter-editor` agent write a digest-with-commentary markdown post to `newsletters/YYYY-MM-DD.md`, with a deterministic link-check guaranteeing every cited URL was actually gathered or fetched.

**Architecture:** Deterministic layer (`src/collectors/`) fans out to six sources in parallel, normalizes to one `RawItem` schema, dedupes by canonical URL, and writes the run's evidence feed (`items.json`). The workflow then opens one editor-agent session (triage + write), runs a code-side link-check with at most 2 fix rounds, and fails loudly if any URL survives unverified. Spec: `docs/superpowers/specs/2026-07-17-zio-newsletter-design.md`, RFC: zio/zio-skills#40.

**Tech Stack:** TypeScript (ESM, `nodenext`, `.ts`-extension imports), `@flue/runtime`/`@flue/cli` `1.0.0-beta.9`, `valibot`, `yaml` (new dep), Node 24 built-in `node:test` runner (native type stripping — no test framework dep), pnpm.

## Global Constraints

- Package manager: pnpm (`devEngines.packageManager` pins `^11.9.0`). Never npm/npx for installs.
- Flue CLI invoked as `./node_modules/.bin/flue` (`pnpm exec flue` is broken on this machine).
- Local `flue run` needs `NODE_USE_ENV_PROXY=1 no_proxy=localhost,127.0.0.1` on this machine; always add `FLUE_VERBOSE_TOOLS=1` for dev runs.
- Dev/test LLM runs use Haiku via `--env .env.testing`; production model comes from `TIERS.writer` (`anthropic/claude-sonnet-4-6` unless `WRITER_MODEL` overrides).
- All collector code is zero-LLM plain TypeScript; every collector accepts an injectable `fetcher: typeof fetch` (default `fetch`) so unit tests run on recorded responses with no live network.
- A failed collector never kills the run; it contributes zero items and is named in the provenance footer.
- Every URL in the output markdown must be in `items.json` ∪ the editor's `web_fetch` trace (canonicalized). Max 2 fix rounds, then the run throws.
- Output file naming: `newsletters/<to-date YYYY-MM-DD>.md`; evidence at `newsletters/evidence/<to-date>.items.json`. Re-running the same window overwrites the same files.
- Agent behavior changes go in instructions/skill markdown, not TypeScript; code exists only for deterministic gating (collectors, link-check).
- Unit tests: `pnpm test` (added in Task 1) must pass after every task.
- Type/build gate: `./node_modules/.bin/tsc` and `./node_modules/.bin/flue build` must pass before the workflow task is considered done.

## File Structure

```
newsletter.sources.yaml                  # curation config (repos, feeds, queries, thresholds)
src/collectors/types.ts                  # RawItem schema, Window, inWindow, canonicalizeUrl, dedupeByUrl
src/collectors/feed-parser.ts            # minimal RSS/Atom entry extraction (regex, no dep)
src/collectors/sources.ts                # load + valibot-validate newsletter.sources.yaml
src/collectors/github-api.ts             # ghJson() fetch helper (auth header, UA, error on !ok)
src/collectors/github-releases.ts        # releases per org repo (pushed-in-window) + extra repos
src/collectors/github-prs.ts             # merged PRs in core repos, bot/Steward filtered
src/collectors/blogs.ts                  # RSS/Atom feeds
src/collectors/hackernews.ts             # Algolia HN API, date-bounded, comment threshold
src/collectors/reddit.ts                 # subreddit search.json, UA header, score threshold
src/collectors/youtube.ts                # channel RSS feeds, optional keyword filter
src/collectors/index.ts                  # collectAll(): parallel allSettled + statuses + dedupe
src/collectors/test-helpers.ts           # fakeFetch() for recorded-response tests
src/collectors/*.test.ts                 # colocated node:test unit tests
src/shared/link-check.ts                 # extractUrls, findUnverifiedUrls
src/tools/web-tools.ts                   # web_search (DDG html) + web_fetch (records fetchTrace)
src/skills/newsletter-style/SKILL.md     # digest format, voice, section order, triage bar
src/agents/newsletter-editor.md          # editor identity + operating rules
src/agents/newsletter-editor.ts          # wiring: model tier, sandbox, skill, web tools
src/workflows/newsletter.ts              # entry: window → collect → evidence → editor → link-check
scripts/collect.ts                       # standalone collector run (freeze fixtures, debug)
fixtures/newsletter/items.json           # frozen real week — editor fixture (Task 16)
.github/workflows/zio-newsletter.yml     # weekly cron, reference deployment
newsletters/                             # output archive (created by first run)
```

---

### Task 1: RawItem schema, window filter, URL canonicalization, dedupe

**Files:**
- Create: `src/collectors/types.ts`
- Test: `src/collectors/types.test.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Produces: `rawItemSchema`, `rawItemsSchema`, `type RawItem`, `interface Window { from: string; to: string }` (ISO timestamps, inclusive), `inWindow(publishedAt: string, window: Window): boolean`, `canonicalizeUrl(raw: string): string`, `dedupeByUrl(items: RawItem[]): RawItem[]`. Every later task consumes these.

- [ ] **Step 1: Add the test script (setup folded into this task)**

In `package.json`, replace the `scripts` block:

```json
  "scripts": {
    "test": "node --test \"src/**/*.test.ts\""
  },
```

Node 24 runs `.ts` test files natively (type stripping); no framework or transpile step.

- [ ] **Step 2: Write the failing test**

Create `src/collectors/types.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inWindow, canonicalizeUrl, dedupeByUrl, type RawItem } from './types.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const item = (over: Partial<RawItem>): RawItem => ({
  source: 'blog',
  title: 't',
  url: 'https://example.com/a',
  publishedAt: '2026-07-02T00:00:00.000Z',
  author: null,
  repo: null,
  excerpt: null,
  ...over,
});

test('inWindow is inclusive on both ends and rejects outside', () => {
  assert.equal(inWindow('2026-07-01T00:00:00.000Z', window), true);
  assert.equal(inWindow('2026-07-08T00:00:00.000Z', window), true);
  assert.equal(inWindow('2026-06-30T23:59:59.000Z', window), false);
  assert.equal(inWindow('2026-07-08T00:00:01.000Z', window), false);
});

test('canonicalizeUrl strips hash, utm params, www, trailing slash', () => {
  assert.equal(
    canonicalizeUrl('https://www.example.com/post/?utm_source=x&utm_medium=y#top'),
    'https://example.com/post',
  );
  assert.equal(canonicalizeUrl('not a url'), 'not a url');
});

test('dedupeByUrl keeps the earliest item and notes the duplicate source', () => {
  const a = item({ source: 'blog', publishedAt: '2026-07-02T00:00:00.000Z' });
  const b = item({
    source: 'reddit',
    url: 'https://www.example.com/a/',
    publishedAt: '2026-07-03T00:00:00.000Z',
    excerpt: 'ignored',
  });
  const out = dedupeByUrl([b, a]);
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'blog');
  assert.match(out[0].excerpt ?? '', /Also seen via reddit/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./types.ts`.

- [ ] **Step 4: Write the implementation**

Create `src/collectors/types.ts`:

```ts
import * as v from 'valibot';

/**
 * The normalized shape every collector emits. `url` is the canonical link
 * fetched from the source, never synthesized — the link-check later verifies
 * the newsletter cites only these (plus the editor's own fetch trace).
 */
export const rawItemSchema = v.object({
  source: v.picklist(['github-release', 'github-pr', 'blog', 'hackernews', 'reddit', 'youtube', 'web']),
  title: v.string(),
  url: v.pipe(v.string(), v.url()),
  publishedAt: v.pipe(v.string(), v.isoTimestamp()),
  author: v.nullable(v.string()),
  repo: v.nullable(v.string()),
  excerpt: v.nullable(v.string()),
});

export const rawItemsSchema = v.array(rawItemSchema);
export type RawItem = v.InferOutput<typeof rawItemSchema>;

/** ISO timestamps, inclusive on both ends. */
export interface Window {
  from: string;
  to: string;
}

export function inWindow(publishedAt: string, window: Window): boolean {
  const t = Date.parse(publishedAt);
  return t >= Date.parse(window.from) && t <= Date.parse(window.to);
}

/**
 * Equality key for dedupe and for the link-check: tracking params, fragments,
 * www, and trailing slashes never distinguish two links to the same page.
 * Non-URLs pass through unchanged so callers never throw on garbage input.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (/^utm_/.test(p)) u.searchParams.delete(p);
    }
    u.hostname = u.hostname.replace(/^www\./, '');
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

/**
 * One item per canonical URL. The earliest publication wins (it is the
 * original announcement); later duplicates survive as a cross-link note in
 * the excerpt so the editor can mention "discussed on Reddit/HN".
 */
export function dedupeByUrl(items: RawItem[]): RawItem[] {
  const byUrl = new Map<string, RawItem>();
  for (const item of items) {
    const key = canonicalizeUrl(item.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, item);
      continue;
    }
    const [keep, drop] = existing.publishedAt <= item.publishedAt ? [existing, item] : [item, existing];
    const note = `Also seen via ${drop.source}: ${drop.url}`;
    byUrl.set(key, { ...keep, excerpt: keep.excerpt ? `${keep.excerpt}\n${note}` : note });
  }
  return [...byUrl.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json src/collectors/types.ts src/collectors/types.test.ts
git commit -m "feat(newsletter): RawItem schema, window filter, URL dedupe"
```

---

### Task 2: Minimal RSS/Atom feed parser

**Files:**
- Create: `src/collectors/feed-parser.ts`
- Test: `src/collectors/feed-parser.test.ts`

**Interfaces:**
- Produces: `interface FeedEntry { title: string; link: string; publishedAt: string | null; author: string | null; summary: string | null }`, `parseFeed(xml: string): FeedEntry[]`. Consumed by `blogs.ts` (Task 6) and `youtube.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

Create `src/collectors/feed-parser.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from './feed-parser.ts';

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[ZIO 2.2 released]]></title>
    <link>https://example.com/zio-2-2</link>
    <pubDate>Thu, 02 Jul 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Big &amp; fast release.</p>]]></description>
  </item>
</channel></rss>`;

const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Streaming with ZIO</title>
    <link rel="alternate" href="https://example.com/streaming"/>
    <published>2026-07-03T09:00:00Z</published>
    <author><name>Jane Dev</name></author>
    <summary>All about streams.</summary>
  </entry>
</feed>`;

test('parses RSS items: CDATA title, link, pubDate to ISO, html-stripped summary', () => {
  const [entry] = parseFeed(rss);
  assert.equal(entry.title, 'ZIO 2.2 released');
  assert.equal(entry.link, 'https://example.com/zio-2-2');
  assert.equal(entry.publishedAt, '2026-07-02T10:00:00.000Z');
  assert.equal(entry.summary, 'Big & fast release.');
});

test('parses Atom entries: href link, published date, author name', () => {
  const [entry] = parseFeed(atom);
  assert.equal(entry.link, 'https://example.com/streaming');
  assert.equal(entry.publishedAt, '2026-07-03T09:00:00.000Z');
  assert.equal(entry.author, 'Jane Dev');
});

test('drops entries without a link and survives an unparseable date', () => {
  const broken = '<rss><channel><item><title>no link</title><pubDate>gibberish</pubDate></item></channel></rss>';
  assert.deepEqual(parseFeed(broken), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./feed-parser.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/feed-parser.ts`:

```ts
/**
 * Deliberately tiny RSS/Atom extraction — regex over the handful of tags the
 * collectors need, instead of an XML-parser dependency. Feeds that defeat it
 * contribute zero items, which the provenance footer reports; that failure
 * mode is acceptable for a weekly digest, a new dependency is not (yet).
 */
export interface FeedEntry {
  title: string;
  link: string;
  publishedAt: string | null;
  author: string | null;
  summary: string | null;
}

const decode = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(xml);
  return m ? decode(m[1]) : null;
};

const toIso = (raw: string | null): string | null => {
  if (raw === null || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
};

export function parseFeed(xml: string): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>]([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
  return blocks
    .map((block) => {
      // Atom: <link href="..."/> (self-closing); RSS: <link>...</link>
      const atomLink = /<link[^>]*href="([^"]+)"/i.exec(block);
      const link = atomLink ? atomLink[1] : (tag(block, 'link') ?? '');
      const summaryRaw =
        tag(block, 'description') ?? tag(block, 'summary') ?? tag(block, 'media:description');
      return {
        title: tag(block, 'title') ?? '',
        link,
        publishedAt: toIso(tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated')),
        author: tag(block, 'dc:creator') ?? tag(block, 'name') ?? tag(block, 'author'),
        summary: summaryRaw
          ? summaryRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
          : null,
      };
    })
    .filter((e) => e.link !== '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/feed-parser.ts src/collectors/feed-parser.test.ts
git commit -m "feat(newsletter): minimal RSS/Atom feed parser"
```

---

### Task 3: `newsletter.sources.yaml` + validated loader

**Files:**
- Create: `newsletter.sources.yaml`
- Create: `src/collectors/sources.ts`
- Test: `src/collectors/sources.test.ts`
- Modify: `package.json` (adds `yaml` dependency, via pnpm)

**Interfaces:**
- Produces: `sourcesSchema`, `type SourcesConfig` (shape below), `loadSources(path: string): Promise<SourcesConfig>`. Every collector (Tasks 4–9) takes `cfg: SourcesConfig` as its first parameter.

```ts
// SourcesConfig shape (inferred from sourcesSchema):
{
  github: { orgs: string[]; extraRepos: string[]; coreRepos: string[] };
  blogs: { feeds: string[] };
  hackernews: { query: string; minComments: number };
  reddit: { subreddits: string[]; query: string; minScore: number };
  youtube: { channelIds: string[]; keyword: string | null };
}
```

- [ ] **Step 1: Add the yaml dependency**

Run: `pnpm add yaml`
Expected: `yaml ^2.x` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Discover the real feed URL and channel id for the seed config**

These two are external facts, checked now so the seed config starts valid:

Run: `curl -s https://ziverge.com/blog | grep -oE '(href|src)="[^"]*(rss|atom|feed)[^"]*"' | head -3`
Decision: if a feed URL appears, use it in the yaml below; if nothing appears, omit the Ziverge feed line (the dev.to tag feed still seeds the blogs collector) and note it as a config PR follow-up.

Run: `curl -s https://www.youtube.com/@Ziverge | grep -oE '"channelId":"[^"]*"' | head -1`
Decision: use the discovered `UC…` id in `youtube.channelIds`; if the page yields nothing, seed `channelIds: []` (collector handles empty lists) and note the follow-up.

- [ ] **Step 3: Write the failing test**

Create `src/collectors/sources.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSources } from './sources.ts';

test('loads and validates the checked-in newsletter.sources.yaml', async () => {
  const cfg = await loadSources(new URL('../../newsletter.sources.yaml', import.meta.url).pathname);
  assert.ok(cfg.github.orgs.includes('zio'));
  assert.ok(cfg.github.coreRepos.length >= 1);
  assert.ok(cfg.blogs.feeds.every((f) => f.startsWith('https://')));
  assert.ok(cfg.hackernews.minComments >= 0);
});

test('rejects a config with a missing section', async () => {
  const { writeFile, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'sources-'));
  const bad = join(dir, 'bad.yaml');
  await writeFile(bad, 'github:\n  orgs: [zio]\n');
  await assert.rejects(loadSources(bad));
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./sources.ts`.

- [ ] **Step 5: Write the seed config and the loader**

Create `newsletter.sources.yaml` (single curation point — extending coverage is a config PR, the agent never invents repos or feeds). Use the URLs discovered in Step 2; the Ziverge lines below are placeholders for *those discovered values only*:

```yaml
# Curated sources for the weekly ZIO newsletter. The agent never invents
# repos or feeds; add coverage here via PR.
github:
  orgs: # every repo in these orgs, releases checked when pushed in-window
    - zio
  extraRepos: # ecosystem repos outside the orgs above
    - ghostdogpr/caliban
    - com-lihaoyi/fastparse # example ecosystem repo — replace/extend via PR
  coreRepos: # merged-PR coverage ("notable features in progress")
    - zio/zio
    - zio/zio-http
blogs:
  feeds:
    - https://dev.to/feed/tag/zio
    # - <ziverge feed URL from discovery step, if found>
hackernews:
  query: zio
  minComments: 3
reddit:
  subreddits: [scala]
  query: zio
  minScore: 5
youtube:
  channelIds:
    # - <Ziverge channelId from discovery step, if found>
  keyword: null # set to a word to filter mixed-topic channels
```

If discovery produced no YouTube channel id, write `channelIds: []` on one line.

Create `src/collectors/sources.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import * as v from 'valibot';

export const sourcesSchema = v.object({
  github: v.object({
    orgs: v.array(v.string()),
    extraRepos: v.array(v.string()),
    coreRepos: v.array(v.string()),
  }),
  blogs: v.object({ feeds: v.array(v.pipe(v.string(), v.url())) }),
  hackernews: v.object({ query: v.string(), minComments: v.number() }),
  reddit: v.object({ subreddits: v.array(v.string()), query: v.string(), minScore: v.number() }),
  youtube: v.object({ channelIds: v.array(v.string()), keyword: v.nullable(v.string()) }),
});

export type SourcesConfig = v.InferOutput<typeof sourcesSchema>;

export async function loadSources(path: string): Promise<SourcesConfig> {
  return v.parse(sourcesSchema, parse(await readFile(path, 'utf8')));
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 8 tests total.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml newsletter.sources.yaml src/collectors/sources.ts src/collectors/sources.test.ts
git commit -m "feat(newsletter): curated sources config with validated loader"
```

---

### Task 4: GitHub API helper + releases collector

**Files:**
- Create: `src/collectors/github-api.ts`
- Create: `src/collectors/github-releases.ts`
- Create: `src/collectors/test-helpers.ts`
- Test: `src/collectors/github-releases.test.ts`

**Interfaces:**
- Consumes: `SourcesConfig` (Task 3), `RawItem`/`Window`/`inWindow` (Task 1).
- Produces: `ghJson<T>(path: string, fetcher?: typeof fetch): Promise<T>` (Task 5 reuses it); `collectGithubReleases(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<RawItem[]>`; `fakeFetch(responses: Record<string, unknown>): typeof fetch` — test helper matching by URL substring, reused by every collector test after this.

- [ ] **Step 1: Write the test helper**

Create `src/collectors/test-helpers.ts`:

```ts
/**
 * Recorded-response stand-in for global fetch: each key is a URL substring,
 * each value the body to return (objects are JSON-encoded). Unmatched URLs
 * throw, so a test fails loudly when a collector calls something unexpected.
 */
export const fakeFetch = (responses: Record<string, unknown>): typeof fetch =>
  (async (url: RequestInfo | URL) => {
    const target = String(url);
    const key = Object.keys(responses).find((k) => target.includes(k));
    if (!key) throw new Error(`unexpected fetch: ${target}`);
    const body = responses[key];
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
```

- [ ] **Step 2: Write the failing test**

Create `src/collectors/github-releases.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectGithubReleases } from './github-releases.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const cfg = {
  github: { orgs: ['zio'], extraRepos: ['ghostdogpr/caliban'], coreRepos: [] },
  blogs: { feeds: [] },
  hackernews: { query: 'zio', minComments: 3 },
  reddit: { subreddits: [], query: 'zio', minScore: 5 },
  youtube: { channelIds: [], keyword: null },
} satisfies SourcesConfig;

const fetcher = fakeFetch({
  'orgs/zio/repos': [
    { full_name: 'zio/zio', pushed_at: '2026-07-05T00:00:00Z', archived: false, fork: false },
    { full_name: 'zio/dormant', pushed_at: '2026-01-01T00:00:00Z', archived: false, fork: false },
  ],
  'repos/zio/zio/releases': [
    {
      html_url: 'https://github.com/zio/zio/releases/tag/v2.2.0',
      name: 'v2.2.0',
      tag_name: 'v2.2.0',
      published_at: '2026-07-05T12:00:00Z',
      draft: false,
      body: 'Notes here',
      author: { login: 'adamgfraser' },
    },
    {
      html_url: 'https://github.com/zio/zio/releases/tag/v2.1.0',
      name: 'v2.1.0',
      tag_name: 'v2.1.0',
      published_at: '2026-05-01T12:00:00Z',
      draft: false,
      body: null,
      author: null,
    },
  ],
  'repos/ghostdogpr/caliban/releases': [],
});

test('collects in-window releases from pushed org repos plus extra repos', async () => {
  const items = await collectGithubReleases(cfg, window, fetcher);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'github-release');
  assert.equal(items[0].title, 'zio/zio v2.2.0');
  assert.equal(items[0].url, 'https://github.com/zio/zio/releases/tag/v2.2.0');
  assert.equal(items[0].repo, 'zio/zio');
  assert.equal(items[0].author, 'adamgfraser');
});
```

Note the dormant repo: pushed in January, so its releases endpoint is never called — `fakeFetch` would throw `unexpected fetch` if it were. The pushed-at pre-filter is what keeps a ~100-repo org to a handful of API calls.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./github-releases.ts`.

- [ ] **Step 4: Write the implementation**

Create `src/collectors/github-api.ts`:

```ts
/**
 * Direct REST calls to api.github.com instead of shelling out to `gh`: the
 * injectable fetcher is what lets collector tests run on recorded responses
 * with no gh binary and no network. GITHUB_TOKEN is honored when present
 * (required in CI for rate limits, optional locally).
 */
export async function ghJson<T>(path: string, fetcher: typeof fetch = fetch): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'zio-newsletter/1.0',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetcher(`https://api.github.com/${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}
```

Create `src/collectors/github-releases.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import { inWindow } from './types.ts';
import type { SourcesConfig } from './sources.ts';
import { ghJson } from './github-api.ts';

interface Repo {
  full_name: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
}

interface Release {
  html_url: string;
  name: string | null;
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  body: string | null;
  author: { login: string } | null;
}

/**
 * Releases across the configured orgs plus the named ecosystem repos. Org
 * repos are pre-filtered by pushed_at (a repo not pushed in the window cannot
 * have released in it), keeping API calls proportional to active repos.
 */
export async function collectGithubReleases(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<RawItem[]> {
  const orgRepos = (
    await Promise.all(
      cfg.github.orgs.map((org) => ghJson<Repo[]>(`orgs/${org}/repos?sort=pushed&per_page=100`, fetcher)),
    )
  )
    .flat()
    .filter((r) => !r.archived && !r.fork && r.pushed_at >= window.from)
    .map((r) => r.full_name);

  const repos = [...new Set([...orgRepos, ...cfg.github.extraRepos])];

  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      const releases = await ghJson<Release[]>(`repos/${repo}/releases?per_page=10`, fetcher);
      return releases
        .filter((r) => !r.draft && r.published_at !== null && inWindow(r.published_at, window))
        .map(
          (r): RawItem => ({
            source: 'github-release',
            title: `${repo} ${r.name?.trim() || r.tag_name}`,
            url: r.html_url,
            publishedAt: new Date(r.published_at!).toISOString(),
            author: r.author?.login ?? null,
            repo,
            excerpt: r.body ? r.body.slice(0, 800) : null,
          }),
        );
    }),
  );
  return perRepo.flat();
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 9 tests total.

- [ ] **Step 6: Commit**

```bash
git add src/collectors/github-api.ts src/collectors/github-releases.ts src/collectors/test-helpers.ts src/collectors/github-releases.test.ts
git commit -m "feat(newsletter): github releases collector on recorded-response tests"
```

---

### Task 5: Merged-PRs collector (core repos, bot-filtered)

**Files:**
- Create: `src/collectors/github-prs.ts`
- Test: `src/collectors/github-prs.test.ts`

**Interfaces:**
- Consumes: `ghJson` (Task 4), `SourcesConfig` (Task 3), `RawItem`/`Window`/`inWindow` (Task 1).
- Produces: `collectGithubPrs(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<RawItem[]>`.

Significance filter (spec open question #1, resolved for v1): author-based bot exclusion here, semantic triage stays with the editor. Label/size heuristics can come later as config.

- [ ] **Step 1: Write the failing test**

Create `src/collectors/github-prs.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectGithubPrs } from './github-prs.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const cfg = {
  github: { orgs: [], extraRepos: [], coreRepos: ['zio/zio'] },
  blogs: { feeds: [] },
  hackernews: { query: 'zio', minComments: 3 },
  reddit: { subreddits: [], query: 'zio', minScore: 5 },
  youtube: { channelIds: [], keyword: null },
} satisfies SourcesConfig;

const pull = (over: object) => ({
  html_url: 'https://github.com/zio/zio/pull/1',
  title: 'Add feature',
  merged_at: '2026-07-04T00:00:00Z',
  user: { login: 'human' },
  body: 'Adds a feature.',
  ...over,
});

const fetcher = fakeFetch({
  'repos/zio/zio/pulls': [
    pull({}),
    pull({ merged_at: null, title: 'closed unmerged' }),
    pull({ user: { login: 'zio-scala-steward[bot]' }, title: 'Update dep' }),
    pull({ user: { login: 'scala-steward' }, title: 'Update dep 2' }),
    pull({ merged_at: '2026-06-01T00:00:00Z', title: 'old' }),
  ],
});

test('keeps only human PRs merged inside the window', async () => {
  const items = await collectGithubPrs(cfg, window, fetcher);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'github-pr');
  assert.equal(items[0].title, 'Add feature');
  assert.equal(items[0].author, 'human');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./github-prs.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/github-prs.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import { inWindow } from './types.ts';
import type { SourcesConfig } from './sources.ts';
import { ghJson } from './github-api.ts';

const BOT_AUTHOR = /\[bot\]$|scala-steward|renovate|dependabot/i;

interface Pull {
  html_url: string;
  title: string;
  merged_at: string | null;
  user: { login: string } | null;
  body: string | null;
}

/**
 * Merged PRs in the core repos — the "notable features in progress" section
 * feed. Bot/Steward bumps are excluded here; whether a human PR is
 * newsletter-worthy stays an editor (triage) decision.
 */
export async function collectGithubPrs(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<RawItem[]> {
  const perRepo = await Promise.all(
    cfg.github.coreRepos.map(async (repo) => {
      const pulls = await ghJson<Pull[]>(
        `repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
        fetcher,
      );
      return pulls
        .filter((p) => p.merged_at !== null && inWindow(p.merged_at, window))
        .filter((p) => p.user !== null && !BOT_AUTHOR.test(p.user.login))
        .map(
          (p): RawItem => ({
            source: 'github-pr',
            title: p.title,
            url: p.html_url,
            publishedAt: new Date(p.merged_at!).toISOString(),
            author: p.user!.login,
            repo,
            excerpt: p.body ? p.body.slice(0, 500) : null,
          }),
        );
    }),
  );
  return perRepo.flat();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 10 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/github-prs.ts src/collectors/github-prs.test.ts
git commit -m "feat(newsletter): merged-PR collector with bot exclusion"
```

---

### Task 6: Blogs collector

**Files:**
- Create: `src/collectors/blogs.ts`
- Test: `src/collectors/blogs.test.ts`

**Interfaces:**
- Consumes: `parseFeed` (Task 2), `SourcesConfig` (Task 3), `RawItem`/`Window`/`inWindow` (Task 1), `fakeFetch` (Task 4).
- Produces: `collectBlogs(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<RawItem[]>`. One broken feed contributes zero items; the collector throws only when *every* feed fails (so the run's provenance can distinguish "blogs down" from "one feed down").

- [ ] **Step 1: Write the failing test**

Create `src/collectors/blogs.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectBlogs } from './blogs.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const cfg = (feeds: string[]) =>
  ({
    github: { orgs: [], extraRepos: [], coreRepos: [] },
    blogs: { feeds },
    hackernews: { query: 'zio', minComments: 3 },
    reddit: { subreddits: [], query: 'zio', minScore: 5 },
    youtube: { channelIds: [], keyword: null },
  }) satisfies SourcesConfig;

const goodFeed = `<rss><channel><item>
  <title>ZIO in prod</title>
  <link>https://blog.example.com/zio-in-prod</link>
  <pubDate>Fri, 03 Jul 2026 08:00:00 GMT</pubDate>
</item></channel></rss>`;

test('collects in-window posts and survives one broken feed', async () => {
  const fetcher = fakeFetch({ 'good.example.com': goodFeed });
  const items = await collectBlogs(cfg(['https://good.example.com/rss', 'https://down.example.com/rss']), window, fetcher);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'blog');
  assert.equal(items[0].url, 'https://blog.example.com/zio-in-prod');
});

test('throws when every feed fails', async () => {
  const fetcher = fakeFetch({});
  await assert.rejects(collectBlogs(cfg(['https://down.example.com/rss']), window, fetcher));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./blogs.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/blogs.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import { inWindow } from './types.ts';
import type { SourcesConfig } from './sources.ts';
import { parseFeed } from './feed-parser.ts';

/**
 * RSS/Atom blog feeds. Per-feed failures degrade to zero items from that
 * feed; the collector as a whole fails only when every feed does, so the
 * provenance footer can tell "blogs broken" from "one feed hiccuped".
 */
export async function collectBlogs(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<RawItem[]> {
  if (cfg.blogs.feeds.length === 0) return [];
  const settled = await Promise.allSettled(
    cfg.blogs.feeds.map(async (feed) => {
      const res = await fetcher(feed, { headers: { 'User-Agent': 'zio-newsletter/1.0' } });
      if (!res.ok) throw new Error(`feed ${feed} -> ${res.status}`);
      return parseFeed(await res.text())
        .filter((e) => e.publishedAt !== null && inWindow(e.publishedAt, window))
        .map(
          (e): RawItem => ({
            source: 'blog',
            title: e.title,
            url: e.link,
            publishedAt: e.publishedAt!,
            author: e.author,
            repo: null,
            excerpt: e.summary,
          }),
        );
    }),
  );
  const fulfilled = settled.filter(
    (s): s is PromiseFulfilledResult<RawItem[]> => s.status === 'fulfilled',
  );
  if (fulfilled.length === 0) {
    const reasons = settled
      .map((s) => (s.status === 'rejected' ? String(s.reason) : ''))
      .filter(Boolean);
    throw new Error(`all blog feeds failed: ${reasons.join('; ')}`);
  }
  return fulfilled.flatMap((s) => s.value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 12 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/blogs.ts src/collectors/blogs.test.ts
git commit -m "feat(newsletter): blogs collector with per-feed degradation"
```

---

### Task 7: Hacker News collector

**Files:**
- Create: `src/collectors/hackernews.ts`
- Test: `src/collectors/hackernews.test.ts`

**Interfaces:**
- Consumes: `SourcesConfig` (Task 3), `RawItem`/`Window` (Task 1), `fakeFetch` (Task 4).
- Produces: `collectHackernews(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<RawItem[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/collectors/hackernews.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectHackernews } from './hackernews.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const cfg = {
  github: { orgs: [], extraRepos: [], coreRepos: [] },
  blogs: { feeds: [] },
  hackernews: { query: 'zio', minComments: 3 },
  reddit: { subreddits: [], query: 'zio', minScore: 5 },
  youtube: { channelIds: [], keyword: null },
} satisfies SourcesConfig;

const hit = (over: object) => ({
  title: 'ZIO 2.2 released',
  url: 'https://zio.dev/news/zio-2-2',
  objectID: '100',
  created_at: '2026-07-05T00:00:00Z',
  points: 50,
  num_comments: 20,
  author: 'hnuser',
  ...over,
});

const fetcher = fakeFetch({
  'hn.algolia.com': {
    hits: [
      hit({}),
      hit({ objectID: '101', num_comments: 1, title: 'ZIO quiet post' }),
      hit({ objectID: '102', title: 'Zionism history', url: 'https://example.com/x' }),
      hit({ objectID: '103', url: null, title: 'Ask HN: ZIO vs cats-effect?' }),
    ],
  },
});

test('keeps word-matching stories above the comment threshold; Ask HN falls back to the item page', async () => {
  const items = await collectHackernews(cfg, window, fetcher);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://zio.dev/news/zio-2-2');
  assert.match(items[0].excerpt ?? '', /discussion: https:\/\/news\.ycombinator\.com\/item\?id=100/);
  assert.equal(items[1].url, 'https://news.ycombinator.com/item?id=103');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./hackernews.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/hackernews.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import type { SourcesConfig } from './sources.ts';

interface HnHit {
  title: string;
  url: string | null;
  objectID: string;
  created_at: string;
  points: number;
  num_comments: number;
  author: string;
}

/**
 * Algolia HN search, date-bounded server-side. Substring queries surface
 * false positives ("Zionism"), so titles must contain the query as a word.
 * The story's outbound URL is the item URL (dedupes against the same release
 * or post from other sources); the HN discussion link rides in the excerpt.
 */
export async function collectHackernews(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<RawItem[]> {
  const fromEpoch = Math.floor(Date.parse(window.from) / 1000);
  const toEpoch = Math.floor(Date.parse(window.to) / 1000);
  const url =
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(cfg.hackernews.query)}` +
    `&tags=story&numericFilters=created_at_i>=${fromEpoch},created_at_i<=${toEpoch}&hitsPerPage=100`;
  const res = await fetcher(url, { headers: { 'User-Agent': 'zio-newsletter/1.0' } });
  if (!res.ok) throw new Error(`HN Algolia -> ${res.status}`);
  const { hits } = (await res.json()) as { hits: HnHit[] };
  const word = new RegExp(`\\b${cfg.hackernews.query}\\b`, 'i');
  return hits
    .filter((h) => h.num_comments >= cfg.hackernews.minComments)
    .filter((h) => word.test(h.title))
    .map((h): RawItem => {
      const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
      return {
        source: 'hackernews',
        title: h.title,
        url: h.url ?? discussion,
        publishedAt: new Date(h.created_at).toISOString(),
        author: h.author,
        repo: null,
        excerpt: `${h.points} points, ${h.num_comments} comments — discussion: ${discussion}`,
      };
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 13 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/hackernews.ts src/collectors/hackernews.test.ts
git commit -m "feat(newsletter): hackernews collector via Algolia API"
```

---

### Task 8: Reddit collector

**Files:**
- Create: `src/collectors/reddit.ts`
- Test: `src/collectors/reddit.test.ts`

**Interfaces:**
- Consumes: `SourcesConfig` (Task 3), `RawItem`/`Window`/`inWindow` (Task 1), `fakeFetch` (Task 4).
- Produces: `collectReddit(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<RawItem[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/collectors/reddit.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectReddit } from './reddit.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const cfg = {
  github: { orgs: [], extraRepos: [], coreRepos: [] },
  blogs: { feeds: [] },
  hackernews: { query: 'zio', minComments: 3 },
  reddit: { subreddits: ['scala'], query: 'zio', minScore: 5 },
  youtube: { channelIds: [], keyword: null },
} satisfies SourcesConfig;

const child = (over: object) => ({
  data: {
    title: 'ZIO 2.2 discussion',
    permalink: '/r/scala/comments/abc/zio_22/',
    url: 'https://zio.dev/news/zio-2-2',
    created_utc: 1783296000, // 2026-07-05T16:00:00Z
    score: 42,
    author: 'redditor',
    selftext: '',
    ...over,
  },
});

const fetcher = fakeFetch({
  'reddit.com/r/scala/search.json': {
    data: {
      children: [
        child({}),
        child({ score: 1, title: 'low score' }),
        child({ created_utc: 1750000000, title: 'old post' }),
        child({
          title: 'Self post about ZIO',
          url: 'https://www.reddit.com/r/scala/comments/def/self_post/',
          permalink: '/r/scala/comments/def/self_post/',
          selftext: 'Question about layers',
        }),
      ],
    },
  },
});

test('link posts use the outbound URL with the discussion in the excerpt; self posts use the permalink', async () => {
  const items = await collectReddit(cfg, window, fetcher);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://zio.dev/news/zio-2-2');
  assert.match(items[0].excerpt ?? '', /discussion: https:\/\/www\.reddit\.com\/r\/scala\/comments\/abc/);
  assert.equal(items[1].url, 'https://www.reddit.com/r/scala/comments/def/self_post/');
  assert.equal(items[1].excerpt, 'Question about layers');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./reddit.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/reddit.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import { inWindow } from './types.ts';
import type { SourcesConfig } from './sources.ts';

interface RedditChild {
  data: {
    title: string;
    permalink: string;
    url: string;
    created_utc: number;
    score: number;
    author: string;
    selftext: string;
  };
}

/**
 * Subreddit keyword search. Reddit rejects requests without a real
 * User-Agent, hence the explicit header. Link posts normalize to their
 * outbound URL (so they dedupe against the same item from other sources);
 * the Reddit discussion rides in the excerpt.
 */
export async function collectReddit(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<RawItem[]> {
  const perSub = await Promise.all(
    cfg.reddit.subreddits.map(async (sub) => {
      const url =
        `https://www.reddit.com/r/${sub}/search.json` +
        `?q=${encodeURIComponent(cfg.reddit.query)}&restrict_sr=1&sort=new&limit=100`;
      const res = await fetcher(url, {
        headers: { 'User-Agent': 'zio-newsletter/1.0 (github.com/zio/zio-skills)' },
      });
      if (!res.ok) throw new Error(`reddit r/${sub} -> ${res.status}`);
      const body = (await res.json()) as { data: { children: RedditChild[] } };
      return body.data.children
        .map((c) => c.data)
        .filter(
          (d) =>
            inWindow(new Date(d.created_utc * 1000).toISOString(), window) &&
            d.score >= cfg.reddit.minScore,
        )
        .map((d): RawItem => {
          const discussion = `https://www.reddit.com${d.permalink}`;
          const isSelfPost = d.url.includes(d.permalink);
          return {
            source: 'reddit',
            title: d.title,
            url: isSelfPost ? discussion : d.url,
            publishedAt: new Date(d.created_utc * 1000).toISOString(),
            author: d.author,
            repo: null,
            excerpt: isSelfPost
              ? d.selftext
                ? d.selftext.slice(0, 500)
                : null
              : `${d.score} points — discussion: ${discussion}`,
          };
        });
    }),
  );
  return perSub.flat();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 14 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/reddit.ts src/collectors/reddit.test.ts
git commit -m "feat(newsletter): reddit collector with score threshold"
```

---

### Task 9: YouTube collector

**Files:**
- Create: `src/collectors/youtube.ts`
- Test: `src/collectors/youtube.test.ts`

**Interfaces:**
- Consumes: `parseFeed` (Task 2), `SourcesConfig` (Task 3), `RawItem`/`Window`/`inWindow` (Task 1), `fakeFetch` (Task 4).
- Produces: `collectYoutube(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<RawItem[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/collectors/youtube.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectYoutube } from './youtube.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

const cfg = (keyword: string | null) =>
  ({
    github: { orgs: [], extraRepos: [], coreRepos: [] },
    blogs: { feeds: [] },
    hackernews: { query: 'zio', minComments: 3 },
    reddit: { subreddits: [], query: 'zio', minScore: 5 },
    youtube: { channelIds: ['UCabc'], keyword },
  }) satisfies SourcesConfig;

const feed = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>ZIO HTTP deep dive</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=111"/>
    <published>2026-07-04T00:00:00Z</published>
    <author><name>Ziverge</name></author>
  </entry>
  <entry>
    <title>Unrelated stream</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=222"/>
    <published>2026-07-04T00:00:00Z</published>
  </entry>
</feed>`;

const fetcher = fakeFetch({ 'channel_id=UCabc': feed });

test('keyword filters mixed-topic channels', async () => {
  const items = await collectYoutube(cfg('zio'), window, fetcher);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'youtube');
  assert.equal(items[0].url, 'https://www.youtube.com/watch?v=111');
});

test('null keyword keeps every in-window video', async () => {
  const items = await collectYoutube(cfg(null), window, fetcher);
  assert.equal(items.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./youtube.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/youtube.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import { inWindow } from './types.ts';
import type { SourcesConfig } from './sources.ts';
import { parseFeed } from './feed-parser.ts';

/**
 * YouTube publishes a free Atom feed per channel — no API key. `keyword`
 * (nullable in config) filters mixed-topic channels like conference channels;
 * a dedicated channel sets it to null and keeps everything.
 */
export async function collectYoutube(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<RawItem[]> {
  const keyword = cfg.youtube.keyword;
  const word = keyword === null ? null : new RegExp(`\\b${keyword}\\b`, 'i');
  const perChannel = await Promise.all(
    cfg.youtube.channelIds.map(async (id) => {
      const res = await fetcher(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, {
        headers: { 'User-Agent': 'zio-newsletter/1.0' },
      });
      if (!res.ok) throw new Error(`youtube channel ${id} -> ${res.status}`);
      return parseFeed(await res.text())
        .filter((e) => e.publishedAt !== null && inWindow(e.publishedAt, window))
        .filter((e) => word === null || word.test(`${e.title} ${e.summary ?? ''}`))
        .map(
          (e): RawItem => ({
            source: 'youtube',
            title: e.title,
            url: e.link,
            publishedAt: e.publishedAt!,
            author: e.author,
            repo: null,
            excerpt: e.summary,
          }),
        );
    }),
  );
  return perChannel.flat();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 16 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/youtube.ts src/collectors/youtube.test.ts
git commit -m "feat(newsletter): youtube channel-feed collector"
```

---

### Task 10: `collectAll()` + standalone freeze script

**Files:**
- Create: `src/collectors/index.ts`
- Create: `scripts/collect.ts`
- Test: `src/collectors/index.test.ts`

**Interfaces:**
- Consumes: all six collectors (Tasks 4–9), `dedupeByUrl` (Task 1).
- Produces: `interface SourceStatus { source: string; ok: boolean; count: number; error: string | null }`; `collectAll(cfg: SourcesConfig, window: Window, fetcher?: typeof fetch): Promise<{ items: RawItem[]; statuses: SourceStatus[] }>`. The workflow (Task 15) and freeze script consume both. Source names in statuses: `github-releases`, `github-prs`, `blogs`, `hackernews`, `reddit`, `youtube`.

- [ ] **Step 1: Write the failing test**

Create `src/collectors/index.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectAll } from './index.ts';
import { fakeFetch } from './test-helpers.ts';
import type { SourcesConfig } from './sources.ts';

const window = { from: '2026-07-01T00:00:00.000Z', to: '2026-07-08T00:00:00.000Z' };

// Only HN is wired up; every other source's endpoints are unmatched, so those
// collectors reject — exactly the degraded-run shape the workflow must survive.
const cfg = {
  github: { orgs: ['zio'], extraRepos: [], coreRepos: ['zio/zio'] },
  blogs: { feeds: ['https://down.example.com/rss'] },
  hackernews: { query: 'zio', minComments: 0 },
  reddit: { subreddits: ['scala'], query: 'zio', minScore: 5 },
  youtube: { channelIds: ['UCabc'], keyword: null },
} satisfies SourcesConfig;

const fetcher = fakeFetch({
  'hn.algolia.com': {
    hits: [
      {
        title: 'ZIO 2.2 released',
        url: 'https://zio.dev/news/zio-2-2',
        objectID: '100',
        created_at: '2026-07-05T00:00:00Z',
        points: 50,
        num_comments: 20,
        author: 'hnuser',
      },
    ],
  },
});

test('failed collectors degrade to ok:false statuses; survivors still deliver', async () => {
  const { items, statuses } = await collectAll(cfg, window, fetcher);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'hackernews');
  const bySource = Object.fromEntries(statuses.map((s) => [s.source, s]));
  assert.equal(bySource['hackernews'].ok, true);
  assert.equal(bySource['hackernews'].count, 1);
  assert.equal(bySource['github-releases'].ok, false);
  assert.ok(bySource['github-releases'].error);
  assert.equal(statuses.length, 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./index.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/collectors/index.ts`:

```ts
import type { RawItem, Window } from './types.ts';
import { dedupeByUrl } from './types.ts';
import type { SourcesConfig } from './sources.ts';
import { collectGithubReleases } from './github-releases.ts';
import { collectGithubPrs } from './github-prs.ts';
import { collectBlogs } from './blogs.ts';
import { collectHackernews } from './hackernews.ts';
import { collectReddit } from './reddit.ts';
import { collectYoutube } from './youtube.ts';

const COLLECTORS: {
  source: string;
  run: (cfg: SourcesConfig, window: Window, fetcher: typeof fetch) => Promise<RawItem[]>;
}[] = [
  { source: 'github-releases', run: collectGithubReleases },
  { source: 'github-prs', run: collectGithubPrs },
  { source: 'blogs', run: collectBlogs },
  { source: 'hackernews', run: collectHackernews },
  { source: 'reddit', run: collectReddit },
  { source: 'youtube', run: collectYoutube },
];

export interface SourceStatus {
  source: string;
  ok: boolean;
  count: number;
  error: string | null;
}

/**
 * Run every collector in parallel; a failed source contributes zero items and
 * an ok:false status instead of killing the run. The provenance footer turns
 * these statuses into "sources covered: … (reddit unavailable this week)".
 */
export async function collectAll(
  cfg: SourcesConfig,
  window: Window,
  fetcher: typeof fetch = fetch,
): Promise<{ items: RawItem[]; statuses: SourceStatus[] }> {
  const settled = await Promise.allSettled(COLLECTORS.map((c) => c.run(cfg, window, fetcher)));
  const statuses: SourceStatus[] = [];
  const gathered: RawItem[] = [];
  settled.forEach((result, i) => {
    const source = COLLECTORS[i].source;
    if (result.status === 'fulfilled') {
      statuses.push({ source, ok: true, count: result.value.length, error: null });
      gathered.push(...result.value);
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      statuses.push({ source, ok: false, count: 0, error: message });
    }
  });
  return { items: dedupeByUrl(gathered), statuses };
}
```

Create `scripts/collect.ts`:

```ts
// Standalone collector run — freeze a week's evidence feed for the editor
// fixture, or debug sources without an LLM in the loop.
//   node scripts/collect.ts [fromISO] [toISO] > items.json
// Statuses go to stderr, items to stdout.
import { loadSources } from '../src/collectors/sources.ts';
import { collectAll } from '../src/collectors/index.ts';

const to = process.argv[3] ?? new Date().toISOString();
const from = process.argv[2] ?? new Date(Date.parse(to) - 7 * 86_400_000).toISOString();

const sources = await loadSources(new URL('../newsletter.sources.yaml', import.meta.url).pathname);
const { items, statuses } = await collectAll(sources, { from, to });
console.error(JSON.stringify(statuses, null, 2));
console.log(JSON.stringify(items, null, 2));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 17 tests total.

- [ ] **Step 5: Smoke the freeze script live (writes nothing)**

Run: `node scripts/collect.ts > /dev/null`
Expected: statuses JSON on stderr; every source `ok: true` or an honest `error` (e.g. GitHub rate limit without `GITHUB_TOKEN` — acceptable here, collectors degrade by design).

- [ ] **Step 6: Commit**

```bash
git add src/collectors/index.ts src/collectors/index.test.ts scripts/collect.ts
git commit -m "feat(newsletter): parallel collectAll with per-source statuses"
```

---

### Task 11: Deterministic link-check

**Files:**
- Create: `src/shared/link-check.ts`
- Test: `src/shared/link-check.test.ts`

**Interfaces:**
- Consumes: `canonicalizeUrl` (Task 1).
- Produces: `extractUrls(markdown: string): string[]`, `findUnverifiedUrls(markdown: string, allowed: Set<string>): string[]`. **Contract:** `allowed` contains *canonicalized* URLs; `findUnverifiedUrls` canonicalizes each extracted URL before membership testing and returns the offending URLs as written in the markdown. The workflow (Task 15) builds `allowed` from `items.json` ∪ fetch trace.

- [ ] **Step 1: Write the failing test**

Create `src/shared/link-check.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUrls, findUnverifiedUrls } from './link-check.ts';
import { canonicalizeUrl } from '../collectors/types.ts';

const markdown = `# This Week in ZIO

- **[ZIO 2.2](https://github.com/zio/zio/releases/tag/v2.2.0)** — big release.
- Bare link https://zio.dev/news/zio-2-2, mid-sentence.
- Angle link <https://example.com/talk>.
`;

test('extractUrls finds markdown, bare, and angle-bracket links without trailing punctuation', () => {
  assert.deepEqual(extractUrls(markdown), [
    'https://github.com/zio/zio/releases/tag/v2.2.0',
    'https://zio.dev/news/zio-2-2',
    'https://example.com/talk',
  ]);
});

test('findUnverifiedUrls flags only URLs outside the allowed set, comparing canonicalized', () => {
  const allowed = new Set([
    canonicalizeUrl('https://github.com/zio/zio/releases/tag/v2.2.0'),
    canonicalizeUrl('https://www.zio.dev/news/zio-2-2/'), // www + slash — must still match
  ]);
  assert.deepEqual(findUnverifiedUrls(markdown, allowed), ['https://example.com/talk']);
});

test('clean document yields no violations', () => {
  assert.deepEqual(findUnverifiedUrls('no links here', new Set()), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./link-check.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/shared/link-check.ts`:

```ts
import { canonicalizeUrl } from '../collectors/types.ts';

/**
 * The hallucination guard's deterministic half: every URL in the finished
 * newsletter must be a member of items.json ∪ the editor's fetch trace.
 * Extraction is by URL shape, not markdown structure, so bare and
 * angle-bracket links can't slip past the check.
 */
export function extractUrls(markdown: string): string[] {
  const urls = markdown.match(/https?:\/\/[^\s)\]>"'`]+/g) ?? [];
  return urls.map((u) => u.replace(/[.,;:!?]+$/, ''));
}

/** `allowed` holds canonicalized URLs; returns offenders as written in the markdown. */
export function findUnverifiedUrls(markdown: string, allowed: Set<string>): string[] {
  const bad = new Set<string>();
  for (const url of extractUrls(markdown)) {
    if (!allowed.has(canonicalizeUrl(url))) bad.add(url);
  }
  return [...bad];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 20 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/shared/link-check.ts src/shared/link-check.test.ts
git commit -m "feat(newsletter): deterministic link-check for output URLs"
```

---

### Task 12: Editor web tools (`web_search` + `web_fetch` with fetch trace)

**Files:**
- Create: `src/tools/web-tools.ts`
- Test: `src/tools/web-tools.test.ts`

**Interfaces:**
- Consumes: `canonicalizeUrl` (Task 1), `defineTool` from `@flue/runtime`.
- Produces: `fetchTrace: Set<string>` (module-level, canonicalized URLs), `resetFetchTrace(): void`, `createWebTools(fetcher?: typeof fetch)` returning `[webSearch, webFetch]` tool definitions, plus pure helpers `parseDdgResults(html: string): { title: string; url: string }[]` and `stripHtml(html: string): string` (exported for tests — tool `run` bodies stay thin wrappers). The agent (Task 14) passes the tools; the workflow (Task 15) calls `resetFetchTrace()` at run start and reads `fetchTrace` for the link-check.

Flue ships no built-in web-search tool (checked `@flue/runtime` docs), so both are custom tools. Search hits DuckDuckGo's HTML endpoint — no API key; a search result alone does **not** verify a link, only `web_fetch` records into the trace (spec: "every gap-fill item must carry a URL the editor actually fetched").

- [ ] **Step 1: Write the failing test**

Create `src/tools/web-tools.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDdgResults, stripHtml } from './web-tools.ts';

const ddgHtml = `
<div class="result">
  <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fzio.dev%2Fevents&rut=x">ZIO <b>Events</b></a>
</div>
<div class="result">
  <a rel="nofollow" class="result__a" href="https://direct.example.com/page">Direct hit</a>
</div>`;

test('parseDdgResults decodes uddg redirects and strips markup from titles', () => {
  assert.deepEqual(parseDdgResults(ddgHtml), [
    { title: 'ZIO Events', url: 'https://zio.dev/events' },
    { title: 'Direct hit', url: 'https://direct.example.com/page' },
  ]);
});

test('stripHtml drops scripts, styles, tags and collapses whitespace', () => {
  const html = '<style>.x{}</style><script>let a;</script><p>Conf  on <b>Sept 3</b></p>';
  assert.equal(stripHtml(html), 'Conf on Sept 3');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module` for `./web-tools.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/tools/web-tools.ts`:

```ts
import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { canonicalizeUrl } from '../collectors/types.ts';

/**
 * Gap-fill web access for the newsletter editor (events, conferences, X
 * discussion the collectors can't reach). `fetchTrace` records every URL the
 * editor actually fetched this run — the link-check accepts those URLs in the
 * output alongside the evidence feed. Search results alone verify nothing.
 */
export const fetchTrace = new Set<string>();

/** Call at workflow-run start; a long-lived dev server would otherwise leak trace across runs. */
export function resetFetchTrace(): void {
  fetchTrace.clear();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** DuckDuckGo html endpoint results; uddg redirect params are decoded to the real URL. */
export function parseDdgResults(html: string): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];
  for (const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const uddg = /[?&]uddg=([^&]+)/.exec(m[1]);
    const url = uddg ? decodeURIComponent(uddg[1]) : m[1];
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    if (url.startsWith('http')) results.push({ title, url });
    if (results.length >= 10) break;
  }
  return results;
}

export function createWebTools(fetcher: typeof fetch = fetch) {
  const webSearch = defineTool({
    name: 'web_search',
    description:
      'Search the web (DuckDuckGo). Returns result titles and URLs. A search result alone does not verify a link — web_fetch a result before citing it in the newsletter.',
    input: v.object({ query: v.string() }),
    output: v.object({ results: v.array(v.object({ title: v.string(), url: v.string() })) }),
    async run({ input, signal }) {
      const res = await fetcher(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`,
        { signal, headers: { 'User-Agent': 'zio-newsletter/1.0' } },
      );
      return { results: parseDdgResults(await res.text()) };
    },
  });

  const webFetch = defineTool({
    name: 'web_fetch',
    description:
      'Fetch a URL and return its text content (HTML stripped, truncated). Any URL you cite in the newsletter must come from the evidence feed or from a web_fetch call this run.',
    input: v.object({ url: v.pipe(v.string(), v.url()) }),
    output: v.object({ url: v.string(), content: v.string() }),
    async run({ input, signal }) {
      const res = await fetcher(input.url, {
        signal,
        headers: { 'User-Agent': 'zio-newsletter/1.0' },
        redirect: 'follow',
      });
      const content = stripHtml(await res.text()).slice(0, 20_000);
      fetchTrace.add(canonicalizeUrl(input.url));
      if (res.url) fetchTrace.add(canonicalizeUrl(res.url)); // post-redirect URL too
      return { url: res.url || input.url, content };
    },
  });

  return [webSearch, webFetch];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 22 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/tools/web-tools.ts src/tools/web-tools.test.ts
git commit -m "feat(newsletter): web_search + web_fetch tools with fetch trace"
```

---

### Task 13: `newsletter-style` skill

**Files:**
- Create: `src/skills/newsletter-style/SKILL.md`

**Interfaces:**
- Produces: skill markdown imported by `newsletter-editor.ts` (Task 14) with `with { type: 'skill' }`. The fixture validation (Task 16) checks output against the triage bounds and section rules written here.

- [ ] **Step 1: Write the skill**

Create `src/skills/newsletter-style/SKILL.md`:

````markdown
---
name: newsletter-style
description: Digest format, voice, section order, and triage bar for the weekly "This Week in ZIO" newsletter. Load when triaging gathered items or writing a newsletter issue.
---

# This Week in ZIO — style

## Format

Front matter, exactly:

```markdown
---
title: "This Week in ZIO — YYYY-MM-DD"
date: YYYY-MM-DD
window: YYYY-MM-DD to YYYY-MM-DD
---
```

Sections in this order, each `## `-level; omit a section entirely when it has
no items — never leave an empty heading:

1. Releases
2. Notable features in progress
3. Blog posts & articles
4. Videos
5. Community discussions
6. Events

## Item format

Each kept item is one bullet:

```markdown
- **[Title](url)** — 1–3 sentences of why it matters.
```

The commentary must add something the title doesn't say: what changed, who it
affects, why a reader should click. Restating the title in more words is a
defect. When an item's excerpt notes cross-links ("Also seen via …"), fold the
discussion link into the commentary.

## Triage bar

Keep an item when a working ZIO developer would want to know about it this
week. Drop: patch-only dependency bumps, off-topic keyword hits, duplicate
coverage of an item already kept, internal chore PRs (CI, formatting,
version bumps). A typical week keeps 5–25 items; below 5 kept items, prefer a
short honest issue over padding.

## Voice

Knowledgeable colleague, not a press release. Plain sentences, no hype
adjectives ("amazing", "game-changing"), no exclamation marks. Opinions are
welcome when grounded in the item's content ("the third streaming-perf PR
this month — a pattern worth watching").

## Quiet weeks

A window with nothing newsworthy gets a two-or-three-sentence issue saying it
was quiet, plus the provenance footer. Never pad, never fabricate.

## Provenance footer

End every issue with:

```markdown
---

_Sources covered: <ok sources>; <failed sources> unavailable this week._
_Items gathered: N, kept: M. Run id: <run id>._
```

When every source was covered, drop the "unavailable" clause.
````

- [ ] **Step 2: Verify the frontmatter parses**

Run: `node -e "const s=require('node:fs').readFileSync('src/skills/newsletter-style/SKILL.md','utf8'); const m=/^---\n([\s\S]*?)\n---/.exec(s); if(!m||!/name: newsletter-style/.test(m[1])) throw new Error('bad frontmatter'); console.log('frontmatter ok')"`
Expected: `frontmatter ok`

- [ ] **Step 3: Commit**

```bash
git add src/skills/newsletter-style/SKILL.md
git commit -m "feat(newsletter): newsletter-style skill (format, triage bar, voice)"
```

---

### Task 14: `newsletter-editor` agent (instructions + wiring)

**Files:**
- Create: `src/agents/newsletter-editor.md`
- Create: `src/agents/newsletter-editor.ts`

**Interfaces:**
- Consumes: `TIERS.writer` (`src/shared/models.ts`), `createWebTools` (Task 12), `newsletter-style` skill (Task 13), `local()` sandbox.
- Produces: default-exported `AgentDefinition` consumed by the workflow (Task 15). Single agent, **no subagents** — the gathering was deterministic; only editorial judgment runs on the model.

- [ ] **Step 1: Write the instructions**

Create `src/agents/newsletter-editor.md`:

```markdown
# Newsletter editor

You are the curator-editor of "This Week in ZIO", a weekly digest of ZIO
ecosystem activity. You never invent items: the evidence feed gathered for
this run is your world, plus anything you fetch yourself with web_fetch.

## Flow

1. **Read the evidence feed** (the run prompt gives its path) — a JSON array
   of gathered items with source, title, url, publishedAt, author, repo,
   excerpt.
2. **Triage** every item into a section, rank within section, and drop noise,
   following the newsletter-style skill's triage bar.
3. **Gap-fill (optional, bounded).** Use web_search/web_fetch only for what
   collectors cannot reach: upcoming conferences and meetups, talks, and X
   discussion. Every gap-fill item you cite must use a URL you fetched with
   web_fetch this run — a search-result URL you did not fetch is not
   verified and will fail the link-check. A handful of searches at most.
4. **Write** the issue to the output path from the run prompt, following the
   newsletter-style skill exactly: front matter, section order, one bullet
   per item with why-it-matters commentary, provenance footer built from the
   source-status list in the run prompt.

## Hard rules

- Every URL in the output must come from the evidence feed or your own
  web_fetch calls this run. No exceptions, no memory-recalled links.
- Sections with no items are omitted, not left empty.
- An empty or thin feed produces a short honest "quiet week" issue.
- Dates, version numbers, and author names come from the items — never from
  memory.
```

- [ ] **Step 2: Write the wiring**

Create `src/agents/newsletter-editor.ts`:

```ts
import { defineAgent, type AgentRouteHandler } from '@flue/runtime';
import { local } from '@flue/runtime/node';

import instructions from './newsletter-editor.md' with { type: 'markdown' };
import newsletterStyle from '../skills/newsletter-style/SKILL.md' with { type: 'skill' };
import { TIERS } from '../shared/models.ts';
import { createWebTools } from '../tools/web-tools.ts';

export const description =
  'Curates and writes the weekly "This Week in ZIO" digest from a gathered evidence feed.';

// Authenticate the caller and confirm they may drive this agent instance here.
export const route: AgentRouteHandler = async (_c, next) => next();

// Single agent, no subagents: gathering already happened deterministically in
// the workflow; only triage + writing need a model. cwd is the flowrite repo
// itself — the newsletter archive lives here, not in a library checkout.
export default defineAgent(() => ({
  ...TIERS.writer,
  instructions,
  sandbox: local(),
  cwd: process.cwd(),
  skills: [newsletterStyle],
  tools: createWebTools(),
}));
```

- [ ] **Step 3: Verify types and build**

Run: `./node_modules/.bin/tsc && ./node_modules/.bin/flue build`
Expected: both exit 0. (`flue build` also validates the skill import and agent discovery.)

- [ ] **Step 4: Commit**

```bash
git add src/agents/newsletter-editor.md src/agents/newsletter-editor.ts
git commit -m "feat(newsletter): newsletter-editor agent"
```

---

### Task 15: `newsletter` workflow (window → collect → editor → link-check)

**Files:**
- Create: `src/workflows/newsletter.ts`

**Interfaces:**
- Consumes: `collectAll`/`SourceStatus` (Task 10), `loadSources` (Task 3), `rawItemsSchema`/`canonicalizeUrl` (Task 1), `findUnverifiedUrls` (Task 11), `fetchTrace`/`resetFetchTrace` (Task 12), agent (Task 14), plus existing shared modules: `withTransientRetry` (`src/shared/style-loop.ts`), `trackTokenUsage` (`src/shared/token-usage.ts`), `trackComponentUsage` (`src/shared/component-usage.ts`), `installVerboseObserver` (`src/shared/verbose-observer.ts`).
- Produces: default-exported workflow `newsletter`. Input `{ from?, to?, dryRun?, itemsPath? }`; output `{ path, itemsGathered, sourcesCovered, summary, insights }`. `itemsPath` skips collection and loads a frozen feed — the editor-fixture test hook (Task 16).

Not built on `defineDocsWorkflow`: that wrapper is one-prompt-in/one-result-out, while this run does code work before the session (collectors, evidence file) and after it (link-check fix loop with extra prompts). Its conventions are kept — transient retry, token/component logging in `finally`, insights retrospective.

- [ ] **Step 1: Write the workflow**

Create `src/workflows/newsletter.ts`:

```ts
import { defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import newsletterEditor from '../agents/newsletter-editor.ts';
import { installVerboseObserver } from '../shared/verbose-observer.ts';
import { withTransientRetry } from '../shared/style-loop.ts';
import { trackTokenUsage } from '../shared/token-usage.ts';
import { trackComponentUsage } from '../shared/component-usage.ts';
import { findUnverifiedUrls } from '../shared/link-check.ts';
import { loadSources } from '../collectors/sources.ts';
import { collectAll, type SourceStatus } from '../collectors/index.ts';
import { canonicalizeUrl, rawItemsSchema, type RawItem } from '../collectors/types.ts';
import { fetchTrace, resetFetchTrace } from '../tools/web-tools.ts';

export const route: WorkflowRouteHandler = async (_c, next) => next();

// FLUE_VERBOSE_TOOLS=1 opts into full tool/subagent call detail.
installVerboseObserver();

const insightsSchema = v.array(
  v.object({
    phase: v.picklist(['collect', 'triage', 'write', 'link-check']),
    obstacle: v.pipe(v.string(), v.description('What actually went wrong or slowed you down this run')),
    resolution: v.pipe(v.string(), v.description('How you got past it')),
    suggestedFix: v.nullable(
      v.pipe(v.string(), v.description('A concrete instruction/tool/config change that would prevent this next time, or null')),
    ),
  }),
);

const editorResultSchema = v.object({
  summary: v.pipe(v.string(), v.description('One line: window, item counts, anything unusual')),
  insights: insightsSchema,
});

const outputSchema = v.object({
  path: v.string(),
  itemsGathered: v.number(),
  sourcesCovered: v.array(v.string()),
  summary: v.string(),
  insights: insightsSchema,
});

const MAX_LINK_FIX_ROUNDS = 2;

const statusLine = (statuses: SourceStatus[]): string => {
  const ok = statuses.filter((s) => s.ok).map((s) => `${s.source} (${s.count})`);
  const failed = statuses.filter((s) => !s.ok).map((s) => s.source);
  return failed.length === 0
    ? `Sources covered: ${ok.join(', ')}.`
    : `Sources covered: ${ok.join(', ')}; UNAVAILABLE this week: ${failed.join(', ')}.`;
};

const buildPrompt = (opts: {
  from: string;
  to: string;
  evidencePath: string;
  outputPath: string;
  itemCount: number;
  statuses: SourceStatus[];
}): string =>
  `Produce the "This Week in ZIO" issue for the window ${opts.from} to ${opts.to}. ` +
  `The evidence feed is at ${opts.evidencePath} (${opts.itemCount} items) — read it first. ` +
  `${statusLine(opts.statuses)} ` +
  `Write the finished issue to ${opts.outputPath} (create parent directories if needed), following the ` +
  `newsletter-style skill exactly; the provenance footer's sources line must reflect the source status above verbatim. ` +
  `Gap-fill with web_search/web_fetch only for events, conferences, and X discussion — every gap-fill link must be ` +
  `a URL you fetched with web_fetch this run. ` +
  `Report a one-line summary and a run retrospective: the real obstacles you hit and how you resolved them ` +
  `(empty if it went smoothly — never invent friction).`;

export default defineWorkflow({
  agent: newsletterEditor,
  input: v.object({
    from: v.pipe(v.optional(v.string()), v.description('ISO window start, inclusive; default: `to` minus 7 days')),
    to: v.pipe(v.optional(v.string()), v.description('ISO window end, inclusive; default: now')),
    dryRun: v.pipe(v.optional(v.boolean()), v.description('Print the finished markdown to stdout; write nothing under newsletters/')),
    itemsPath: v.pipe(
      v.optional(v.string()),
      v.description('Skip collection and use this frozen items.json instead (editor fixture runs)'),
    ),
  }),
  output: outputSchema,
  async run({ harness, input, log }) {
    const to = input.to ?? new Date().toISOString();
    const from = input.from ?? new Date(Date.parse(to) - 7 * 86_400_000).toISOString();
    const dateSlug = to.slice(0, 10);

    resetFetchTrace();

    // Gather (deterministic, zero LLM) — or load the frozen fixture feed.
    let items: RawItem[];
    let statuses: SourceStatus[];
    if (input.itemsPath) {
      items = v.parse(rawItemsSchema, JSON.parse(await readFile(input.itemsPath, 'utf8')));
      statuses = [{ source: 'fixture', ok: true, count: items.length, error: null }];
    } else {
      const sources = await loadSources(join(process.cwd(), 'newsletter.sources.yaml'));
      ({ items, statuses } = await collectAll(sources, { from, to }));
    }
    for (const s of statuses.filter((x) => !x.ok)) {
      log.info(`collector ${s.source} unavailable this week: ${s.error}`);
    }

    // Evidence + output paths. dryRun redirects both to a temp dir so nothing
    // lands under newsletters/; a normal run overwrites the same window's files.
    const outDir = input.dryRun
      ? await mkdtemp(join(tmpdir(), 'newsletter-'))
      : join(process.cwd(), 'newsletters');
    const evidencePath = join(outDir, 'evidence', `${dateSlug}.items.json`);
    const outputPath = join(outDir, `${dateSlug}.md`);
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, JSON.stringify(items, null, 2));

    const usage = trackTokenUsage();
    const components = trackComponentUsage();
    let stats: ReturnType<typeof usage.stop> | undefined;
    try {
      const session = await harness.session();
      const { data } = await withTransientRetry(log, 'newsletter write', () =>
        session.prompt(
          buildPrompt({ from, to, evidencePath, outputPath, itemCount: items.length, statuses }),
          { result: editorResultSchema },
        ),
      );

      // Hallucination guard: every output URL ∈ items.json ∪ fetch trace.
      const allowed = new Set([...items.map((i) => canonicalizeUrl(i.url)), ...fetchTrace]);
      for (let round = 0; ; round++) {
        const markdown = await readFile(outputPath, 'utf8');
        const bad = findUnverifiedUrls(markdown, allowed);
        if (bad.length === 0) break;
        if (round >= MAX_LINK_FIX_ROUNDS) {
          throw new Error(
            `newsletter link-check failed after ${MAX_LINK_FIX_ROUNDS} fix rounds; unverified URLs: ${bad.join(', ')}`,
          );
        }
        log.info(`link-check round ${round + 1}: ${bad.length} unverified URL(s): ${bad.join(', ')}`);
        await withTransientRetry(log, `newsletter link fix ${round + 1}`, () =>
          session.prompt(
            `The issue at ${outputPath} cites URLs that are neither in the evidence feed nor were fetched ` +
              `this run: ${bad.join(', ')}. For each one, either remove the item or replace the link with the ` +
              `canonical URL from the evidence feed (${evidencePath}), then save the file. Do not add new items.`,
            { result: v.object({ done: v.boolean() }) },
          ),
        );
      }

      // Token/cost line appended post-check (it contains no URLs).
      stats = usage.stop();
      await appendFile(outputPath, `_Tokens: ${stats.totalTokens}, cost: $${stats.cost.toFixed(4)}._\n`);

      if (input.dryRun) {
        console.log(await readFile(outputPath, 'utf8'));
      }
      log.info(`newsletter run insights: ${JSON.stringify(data.insights)}`);
      return {
        path: input.dryRun ? outputPath : relative(process.cwd(), outputPath),
        itemsGathered: items.length,
        sourcesCovered: statuses.filter((s) => s.ok).map((s) => s.source),
        summary: data.summary,
        insights: data.insights,
      };
    } finally {
      const t = stats ?? usage.stop();
      log.info(
        `newsletter token consumption: ${t.totalTokens} tokens ` +
          `(in ${t.input}, out ${t.output}, cacheRead ${t.cacheRead}, cacheWrite ${t.cacheWrite}) ` +
          `across ${t.turns} turns, cost $${t.cost.toFixed(4)}`,
        t,
      );
      log.info(`newsletter component usage: ${JSON.stringify(components.stop())}`);
    }
  },
});
```

- [ ] **Step 2: Verify types, build, and unit tests**

Run: `./node_modules/.bin/tsc && ./node_modules/.bin/flue build && pnpm test`
Expected: all exit 0; 22 tests pass.

Note: if `usage.stop()` in this codebase's `trackTokenUsage` is not safe to reason about from the call site, read `src/shared/token-usage.ts` and match its actual return type in the `stats` declaration — the `finally` must log exactly like `docs-workflow.ts` does.

- [ ] **Step 3: Commit**

```bash
git add src/workflows/newsletter.ts
git commit -m "feat(newsletter): newsletter workflow with evidence feed and link-check"
```

---

### Task 16: Freeze the editor fixture + Haiku validation run

**Files:**
- Create: `fixtures/newsletter/items.json` (frozen output of a real gathered week)

**Interfaces:**
- Consumes: `scripts/collect.ts` (Task 10), workflow `itemsPath`/`dryRun` inputs (Task 15).

- [ ] **Step 1: Freeze one real week**

Run:

```bash
mkdir -p fixtures/newsletter
GITHUB_TOKEN=$(gh auth token) node scripts/collect.ts > fixtures/newsletter/items.json
```

Expected: stderr statuses show mostly `ok: true`; `fixtures/newsletter/items.json` holds a non-empty JSON array. Inspect it: items must span at least two different `source` values for the fixture to exercise triage. If the current week is dead quiet, pass an explicit richer window, e.g. `node scripts/collect.ts 2026-07-01T00:00:00.000Z 2026-07-08T00:00:00.000Z > fixtures/newsletter/items.json`.

- [ ] **Step 2: Run the editor on the fixture with Haiku (dry run)**

Run:

```bash
NODE_USE_ENV_PROXY=1 no_proxy=localhost,127.0.0.1 FLUE_VERBOSE_TOOLS=1 \
  ./node_modules/.bin/flue run newsletter --env .env.testing \
  --input '{"itemsPath":"fixtures/newsletter/items.json","dryRun":true}'
```

Expected: run completes; markdown printed to stdout; terminal JSON result on stdout with `path`, `summary`, `insights`.

- [ ] **Step 3: Validate the output against the spec's fixture assertions**

Manual read of the printed markdown — all must hold:

1. Front matter present with title `This Week in ZIO — YYYY-MM-DD`, date, window.
2. Sections appear in spec order; no empty section headings.
3. Every link is from the fixture (the link-check enforced this — the run finishing *is* the assertion; a link-check failure after 2 rounds throws).
4. Kept-item count is within the style skill's 5–25 band (or a justified quiet issue).
5. Provenance footer present with sources line and gathered/kept counts.

If 2/4/5 fail, fix the `newsletter-style` skill or `newsletter-editor.md` wording (instructions, not code) and re-run this step.

- [ ] **Step 4: Commit**

```bash
git add fixtures/newsletter/items.json
git commit -m "test(newsletter): freeze editor fixture from a real gathered week"
```

---

### Task 17: Weekly GitHub Actions deployment

**Files:**
- Create: `.github/workflows/zio-newsletter.yml`

**Interfaces:**
- Consumes: workflow `newsletter` (Task 15) via `flue run`, `newsletters/` archive convention.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/zio-newsletter.yml`:

```yaml
name: zio-newsletter
on:
  schedule:
    - cron: '0 6 * * 1' # weekly, Monday 06:00 UTC
  workflow_dispatch:
    inputs:
      from:
        description: 'ISO window start (optional, default: to minus 7 days)'
        required: false
        default: ''
      to:
        description: 'ISO window end (optional, default: now)'
        required: false
        default: ''

permissions:
  contents: write # commits only under newsletters/

jobs:
  newsletter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Run the newsletter workflow
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          INPUT=$(jq -nc --arg from '${{ inputs.from }}' --arg to '${{ inputs.to }}' \
            '{from: $from, to: $to} | with_entries(select(.value != ""))')
          ./node_modules/.bin/flue run newsletter --input "$INPUT"
      - name: Archive the issue (archival, not publishing)
        run: |
          git config user.name 'zio-newsletter[bot]'
          git config user.email 'zio-newsletter@users.noreply.github.com'
          git add newsletters/
          git diff --cached --quiet || git commit -m "newsletter: $(date -I)"
          git push
      - uses: actions/upload-artifact@v4
        with:
          name: newsletter
          path: newsletters/
```

- [ ] **Step 2: Verify the YAML parses**

Run: `node -e "import('yaml').then(y => { y.parse(require('node:fs').readFileSync('.github/workflows/zio-newsletter.yml','utf8')); console.log('yaml ok'); })"`
Expected: `yaml ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/zio-newsletter.yml
git commit -m "ci(newsletter): weekly scheduled newsletter run"
```

---

## Spec coverage map (self-review record)

| Spec section | Tasks |
| --- | --- |
| RawItem schema + window filter | 1 |
| github-releases / github-prs collectors | 4, 5 |
| blogs / hackernews / reddit / youtube collectors | 6, 7, 8, 9 |
| `newsletter.sources.yaml` single curation point | 3 |
| Dedupe by canonical URL, evidence `items.json` | 1, 10, 15 |
| Editor agent (triage + write, no subagents) | 13, 14 |
| Web tools gap-fill + fetch-trace verification | 12 |
| Deterministic link-check, max 2 fix rounds, loud failure | 11, 15 |
| Front matter + provenance footer (incl. token/cost line) | 13, 15 |
| Collector failure degrades, never kills run | 6, 10, 15 |
| Empty window → quiet issue | 13, 14 |
| `--dry-run` prints, writes nothing under `newsletters/` | 15 |
| Editor fixture on Haiku | 15 (`itemsPath`), 16 |
| Collector unit tests on recorded responses | 1–10 |
| Weekly cron + `workflow_dispatch` from/to | 17 |
| Insights retrospective reuse | 15 |
| X.com = editor gap-fill only | 12, 14 (never a collector) |
