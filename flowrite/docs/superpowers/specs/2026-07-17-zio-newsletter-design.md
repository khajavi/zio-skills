# RFC + Spec: `zio-newsletter` — weekly ZIO ecosystem digest generator

- **Status:** Proposed
- **Date:** 2026-07-17
- **Component:** flowrite (Flue-based ZIO documentation agents)
- **Author:** @khajavi

## Summary

A new agent, `zio-newsletter`, that runs weekly, gathers the last seven days of
ZIO ecosystem activity — library releases, notable merged PRs, blog posts,
videos, community discussions, and events — and writes a **digest-with-commentary
newsletter as a markdown blog post**. Output is a markdown file only; publishing
to a blog platform stays with humans. It is a sibling to `docs-gardener`: a
scheduled, evidence-driven agent where deterministic code gathers facts and the
model provides editorial judgment.

## Motivation

The ZIO ecosystem produces a steady stream of releases, articles, talks, and
discussions scattered across GitHub, blogs, YouTube, Hacker News, Reddit, and X.
Nobody aggregates it. A weekly digest ("This Week in ZIO", in the spirit of
This Week in Rust) gives the community one place to catch up and gives library
authors visibility for their work. Assembling it by hand takes hours every week;
almost all of that work is mechanical gathering plus light editorial framing —
exactly the split an agent handles well.

Non-goals (explicitly out of scope for v1):

- Publishing to any blog platform, mailing list, or social channel. **Markdown
  file only** — a human takes it from there.
- Deep-dive feature articles or interviews. The format is a digest.
- Historical backfill. Each run covers one window; the archive accumulates
  forward.

## Design overview

An agent is `model + instructions + tools + skills + sandbox`. The newsletter
splits into a deterministic gathering layer and a single editorial agent:

```
src/workflows/newsletter.ts            # entry: { from?, to?, dryRun? } — defaults to last 7 days
src/collectors/                        # deterministic layer, zero LLM
  types.ts                             #   RawItem valibot schema + window filter
  github-releases.ts                   #   gh api: releases per configured repo
  github-prs.ts                        #   merged PRs in core repos (significance filter)
  blogs.ts                             #   RSS/Atom feeds
  hackernews.ts                        #   Algolia API, query=zio
  reddit.ts                            #   r/scala search.json, keyword zio
  youtube.ts                           #   channel/search RSS feeds
src/agents/newsletter-editor.md        # identity: curator-editor, never invents items
src/agents/newsletter-editor.ts        # wiring: profile + tools + skills
src/skills/newsletter-style/SKILL.md   # digest format, voice, section order, triage bar
newsletter.sources.yaml                # curated: repos, feeds, subreddits, channels, queries
.github/workflows/zio-newsletter.yml   # weekly cron, reference deployment
newsletters/                           # output archive: YYYY-MM-DD.md per run
```

### Considered alternatives

- **B — Single web-research agent.** One agent with web tools told to "find last
  week's ZIO news." Rejected: expensive (dozens of searches per run), noisy,
  hallucination-prone (invented releases), and untestable — every run differs.
- **C — Multi-agent fan-out.** Per-source researcher subagents plus an editor
  synthesizer, matching flowrite's writer architecture. Rejected for v1: the
  gathering here is mechanical (APIs and feeds), so subagents add cost and moving
  parts without quality gain. Deterministic collectors keep the model where it
  earns its cost — editorial judgment.

Chosen: **A — deterministic collectors + LLM editor**, the docs-gardener
philosophy applied to news: deterministic where possible, model for semantics.

## Gathering: the collectors

All collectors are plain TypeScript, no LLM, run in parallel, and normalize to
one schema:

```ts
rawItem: {
  source:      'github-release' | 'github-pr' | 'blog' | 'hackernews'
             | 'reddit' | 'youtube' | 'web',
  title:       string,
  url:         string,   // canonical link — fetched from the source, never synthesized
  publishedAt: string,   // ISO date; collectors drop items outside the window
  author:      string | null,
  repo:        string | null,   // github sources
  excerpt:     string | null,   // release notes / post body, truncated
}
```

Per source:

| Collector        | Mechanism                                        | Notes                                             |
| ---------------- | ------------------------------------------------ | ------------------------------------------------- |
| github-releases  | `gh api repos/{repo}/releases`                   | per repo in config; includes release notes excerpt |
| github-prs       | `gh api` merged PRs, core repos only             | significance filter: exclude bot/Steward-only bumps |
| blogs            | RSS/Atom fetch + parse                           | ziverge.com, zio.dev, dev.to/t/zio, community feeds |
| hackernews       | Algolia HN API, `query=zio`, date-bounded        | comment-count threshold from config                |
| reddit           | `r/scala` + keyword `search.json`, UA header set | score threshold from config                        |
| youtube          | channel/search RSS feeds                         | configured channels (Ziverge, conference channels)  |
| web (gap-fill)   | editor's web-search tool at edit time            | events/conferences, X hot topics — see editor phase |

X.com has no free API; X coverage is best-effort via the editor's web search,
never a collector.

`newsletter.sources.yaml` is the single curation point: org globs (`zio/*`),
named ecosystem repos (e.g. `ghostdogpr/caliban`), feed URLs, subreddits,
channels, search queries, and noise thresholds. The agent never invents repos or
feeds; extending coverage is a config PR.

After collection: dedupe by canonical URL (a release announced on Reddit and HN
keeps the earliest/original item, cross-links noted in `excerpt`), then the
merged feed is written as `items.json` — the run's evidence file.

## Editing: the `newsletter-editor` agent

Single agent, no subagents. Input: the `items.json` feed plus the window dates.
Two phases in one session:

1. **Triage.** Classify each item into a section, rank within section, drop
   noise (patch-only dependency bumps, off-topic HN/Reddit hits, duplicate
   coverage). The `newsletter-style` skill defines the bar for
   "newsletter-worthy."
2. **Write.** Digest with commentary: each kept item becomes a bold linked
   title plus 1–3 sentences of *why it matters* — not a restated title. Section
   order: **Releases → Notable features in progress → Blog posts & articles →
   Videos → Community discussions → Events**. Sections with no items are
   omitted, not left empty.

Tools: web-search/web-fetch, **gap-fill only** — upcoming conferences, talks,
and X discussion the collectors can't reach. Every gap-fill item must carry a
URL the editor actually fetched during the run; the link-check treats the fetch
trace as part of the allowed set.

Hallucination guard by construction: the editor curates what collectors
delivered; it cannot introduce an item whose URL was neither gathered nor
fetched. After writing, a **deterministic link-check** verifies every URL in the
output markdown is a member of `items.json` ∪ fetch-trace. A violation triggers
a fix round (max 2), then a loud failure.

Front matter of the output post: title ("This Week in ZIO — YYYY-MM-DD"), date,
window covered, and a provenance footer (sources covered, items gathered vs
kept, run id, token/cost line from the existing component-usage tracker).

Model: Sonnet in production; Haiku via `--env .env.testing` for dev runs, per
repo convention.

## Error handling

- **Collector failure never kills the run.** A failed source contributes zero
  items, and the provenance footer says so explicitly: "Sources covered:
  github, blogs, hn, youtube (reddit unavailable this week)." No silent gaps —
  a reader can tell a quiet source from a broken one.
- **Empty window** → a short "quiet week" newsletter with the provenance
  footer, never a padded or fabricated one.
- **Link-check failure after 2 fix rounds** → run fails loudly (CI red). An
  unverified link never ships.
- **Rate limits:** `gh` uses `GITHUB_TOKEN`; Reddit requires a User-Agent
  header; collectors back off and report failure rather than retry-storm.

## Testing

- **Editor fixture:** a checked-in, frozen `items.json` from one real gathered
  week. The editor runs on Haiku against it; assertions: sections
  present-or-omitted correctly, every output link ⊆ fixture URLs, kept-item
  count within triage bounds set by the style skill.
- **Collector unit tests** against recorded HTTP responses — no live network in
  CI.
- **`--dry-run`** prints the markdown to stdout and writes nothing; used
  locally and in CI smoke tests.
- Run with `FLUE_VERBOSE_TOOLS=1` during development, per repo convention.
- Reuse the run retrospective (`insights[]`) so the editor's context improves
  across weeks like the writers'.

## Scheduled trigger (v1 scope)

```yaml
# .github/workflows/zio-newsletter.yml
on:
  schedule: [{ cron: '0 6 * * 1' }]   # weekly, Mon 06:00 UTC
  workflow_dispatch: {}                # manual/backfill runs (from/to inputs)
permissions:
  contents: write                      # commits only under newsletters/
jobs:
  newsletter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: ./node_modules/.bin/flue run newsletter
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: |                         # archive step: commit + artifact
          git add newsletters/ && git commit -m "newsletter: $(date -I)" && git push
      - uses: actions/upload-artifact@v4
        with: { name: newsletter, path: newsletters/ }
```

- Cron in v1 scope per decision; `workflow_dispatch` accepts `from`/`to` for
  manual re-runs.
- Committing to `newsletters/` is **archival, not publishing** — it satisfies
  "markdown file only." A human moves the post to the blog platform.
- Idempotent per window: re-running the same window overwrites the same
  `newsletters/YYYY-MM-DD.md`.

## Open questions

1. Significance filter for `github-prs`: label-based (`feature`,
   `enhancement`), size-based, or model-side triage only?
2. Should `newsletter.sources.yaml` live in flowrite or in a separate
   community-editable repo once the pilot works?
3. Editor voice calibration: how much personality before it needs a human
   editorial pass every week anyway?

## Rollout

1. Implement `collectors/` + `newsletter.sources.yaml` seeded with zio org,
   Ziverge blog, HN/Reddit queries, and 2–3 ecosystem repos; unit tests on
   recorded responses.
2. Implement `newsletter` workflow, `newsletter-editor` agent,
   `newsletter-style` skill, and the deterministic link-check with fix rounds.
3. Freeze one real week's `items.json` as the editor fixture; validate output
   structure on Haiku.
4. Ship `.github/workflows/zio-newsletter.yml`; first two production runs get a
   human read-through before the output is shared anywhere.
